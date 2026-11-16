import { describe, expect, it } from 'vitest'
import { assembleGroups, DocsCheckError, extractBlocks, originOf, parseTsc, vueScript } from '../../scripts/docs-check/extract'

// The docs check (scripts/docs-check.ts) type-checks the marked code blocks of docs/guide.
// These tests cover the part that reads the Markdown and maps errors back to it.

const doc = (...lines: string[]) => lines.join('\n')
const STARTER = { source: 'starter/cms.config.ts', text: "import { f } from 'tinyzoo'\nexport const Base = 1\n" }

describe('extractBlocks', () => {
  it('takes the fence right after a marker, with its group, path and first code line', () => {
    const md = doc('# Title', '', '<!-- check: news/cms.config.ts -->', '```ts', 'export const a = 1', '```', '', 'text')
    const [b, ...rest] = extractBlocks(md, 'docs/guide/x.md')
    expect(rest).toEqual([])
    expect(b).toMatchObject({ doc: 'docs/guide/x.md', group: 'news', path: 'cms.config.ts', flag: null, lang: 'ts', code: 'export const a = 1', markerLine: 3, line: 5 })
  })

  it('ignores unmarked fences, and a marker shown inside another fence', () => {
    const md = doc(
      '```ts', 'const unmarked = 1', '```',
      '````md', '<!-- check: demo/cms.config.ts -->', '```ts', 'const shown = 1', '```', '````',
      '<!-- check: real/cms.config.ts -->', '```ts', 'const real = 1', '```',
    )
    expect(extractBlocks(md, 'x.md').map((b) => b.group)).toEqual(['real'])
  })

  it('reads flags, and keeps blocks of several files and groups in order', () => {
    const md = doc(
      '<!-- check: a/cms.config.ts append-to-starter -->', '```ts', 'one', '```',
      '<!-- check: a/app/pages/p.vue -->', '```vue', '<script setup lang="ts">', 'two', '</script>', '```',
      '<!-- check: b/cms.config.ts -->', '```ts', 'three', '```',
      '<!-- check: b/cms.config.ts + -->', '```ts', 'four', '```',
    )
    const blocks = extractBlocks(md, 'x.md')
    expect(blocks.map((b) => [b.group, b.path, b.flag])).toEqual([
      ['a', 'cms.config.ts', 'append-to-starter'], ['a', 'app/pages/p.vue', null], ['b', 'cms.config.ts', null], ['b', 'cms.config.ts', '+'],
    ])
  })

  it('removes the indent of a fence inside a list item', () => {
    const md = doc('1. Step', '', '   <!-- check: a/cms.config.ts -->', '   ```ts', '   const a = 1', '     const b = 2', '   ```')
    expect(extractBlocks(md, 'x.md')[0]?.code).toBe('const a = 1\n  const b = 2')
  })

  it.each([
    ['a marker with no fence under it', ['<!-- check: a/cms.config.ts -->', '', '```ts', 'x', '```'], 'x.md:1: the check marker must be followed'],
    ['an unknown flag', ['<!-- check: a/cms.config.ts nope -->', '```ts', 'x', '```'], 'unknown flag "nope"'],
    ['a path the check does not know', ['<!-- check: a/package.json -->', '```json', '{}', '```'], '"package.json" is not a file the check knows'],
    ['append-to-starter on another file', ['<!-- check: a/app/x.ts append-to-starter -->', '```ts', 'x', '```'], 'belongs on cms.config.ts'],
    ['a fence never closed', ['<!-- check: a/cms.config.ts -->', '```ts', 'x'], 'never closed'],
    ['a path that leaves the group', ['<!-- check: a/app/../../x.ts -->', '```ts', 'x', '```'], 'leaves the group'],
  ])('refuses %s', (_name, lines, message) => {
    expect(() => extractBlocks(lines.join('\n'), 'x.md')).toThrow(DocsCheckError)
    expect(() => extractBlocks(lines.join('\n'), 'x.md')).toThrow(message)
  })
})

describe('vueScript', () => {
  it('returns the body of <script setup lang="ts"> and the line it starts on', () => {
    const code = ['<script setup lang="ts">', 'const a = 1', 'const b = 2', '</script>', '', '<template><p /></template>'].join('\n')
    expect(vueScript(code)).toEqual({ body: 'const a = 1\nconst b = 2\n', line: 2 })
  })

  it('accepts the attributes in either order, and nothing before the script', () => {
    expect(vueScript('<script lang="ts" setup>\nx\n</script>')?.line).toBe(2)
    expect(vueScript('<template><p /></template>')).toBeNull()
    expect(vueScript('<script>\nexport default {}\n</script>')).toBeNull()
  })

  it('refuses a script that is not TypeScript', () => {
    expect(() => vueScript('<script setup lang="js">\nx\n</script>')).toThrow(/lang="ts"/)
  })
})

describe('assembleGroups', () => {
  it('concatenates the blocks of one file and maps lines back to the Markdown', () => {
    const md = doc(
      'intro',                                                // 1
      '<!-- check: g/cms.config.ts -->', '```ts',            // 2, 3
      "import { f } from 'tinyzoo'", 'export const A = 1',   // 4, 5
      '```', 'between',
      '<!-- check: g/cms.config.ts + -->', '```ts',            // 8, 9
      'export const B = 2', 'export const C = 3',            // 10, 11
      '```',
    )
    const file = assembleGroups(extractBlocks(md, 'docs/guide/g.md'), STARTER).get('g')![0]!
    expect(file.path).toBe('cms.config.ts')
    expect(file.content).toBe("import { f } from 'tinyzoo'\nexport const A = 1\n\nexport const B = 2\nexport const C = 3\nexport {}\n")
    expect(originOf(file, 1)).toEqual({ source: 'docs/guide/g.md', line: 4 })
    expect(originOf(file, 2)).toEqual({ source: 'docs/guide/g.md', line: 5 })
    expect(originOf(file, 4)).toEqual({ source: 'docs/guide/g.md', line: 10 })
    expect(originOf(file, 5)).toEqual({ source: 'docs/guide/g.md', line: 11 })
  })

  it('adds an append-to-starter block to a copy of the starter, and says where each part came from', () => {
    const md = doc('<!-- check: g/cms.config.ts append-to-starter -->', '```ts', 'export const Team = 1', '```')
    const file = assembleGroups(extractBlocks(md, 'docs/guide/g.md'), STARTER).get('g')![0]!
    expect(file.content).toBe("import { f } from 'tinyzoo'\nexport const Base = 1\n\nexport const Team = 1\nexport {}\n")
    expect(originOf(file, 2)).toEqual({ source: 'starter/cms.config.ts', line: 2 })
    expect(originOf(file, 4)).toEqual({ source: 'docs/guide/g.md', line: 3 })
  })

  it('writes only the <script setup> of a .vue block, to <name>.vue.ts, with lines that match', () => {
    const md = doc('<!-- check: g/app/pages/team.vue -->', '```vue', '<script setup lang="ts">', 'const a = 1', 'const b: number = "x"', '</script>', '<template><p>{{ a }}</p></template>', '```')
    const file = assembleGroups(extractBlocks(md, 'g.md'), STARTER).get('g')![0]!
    expect(file.path).toBe('app/pages/team.vue.ts')
    expect(file.content).toBe('const a = 1\nconst b: number = "x"\nexport {}\n')
    expect(originOf(file, 2)).toEqual({ source: 'g.md', line: 5 })
  })

  it('leaves out a .vue block with no script', () => {
    const md = doc('<!-- check: g/app/components/X.vue -->', '```vue', '<template><p /></template>', '```')
    expect(assembleGroups(extractBlocks(md, 'g.md'), STARTER).get('g')![0]!.content).toBe('\nexport {}\n')
  })

  it('keeps groups apart', () => {
    const md = doc('<!-- check: a/cms.config.ts -->', '```ts', 'a', '```', '<!-- check: b/cms.config.ts -->', '```ts', 'b', '```')
    const groups = assembleGroups(extractBlocks(md, 'g.md'), STARTER)
    expect([...groups.keys()]).toEqual(['a', 'b'])
  })

  it.each([
    ['a file repeated without the continuation flag', ['<!-- check: g/cms.config.ts -->', '```ts', 'a', '```', '<!-- check: g/cms.config.ts -->', '```ts', 'b', '```'], 'appears again'],
    ['a continuation with nothing before it', ['<!-- check: g/cms.config.ts + -->', '```ts', 'a', '```'], 'cannot continue anything'],
    ['append-to-starter on a later block', ['<!-- check: g/cms.config.ts -->', '```ts', 'a', '```', '<!-- check: g/cms.config.ts append-to-starter -->', '```ts', 'b', '```'], 'only the first block'],
  ])('refuses %s', (_name, lines, message) => {
    expect(() => assembleGroups(extractBlocks(lines.join('\n'), 'g.md'), STARTER)).toThrow(message)
  })
})

describe('parseTsc', () => {
  it('reads errors and joins their continuation lines', () => {
    const out = [
      "test/docs/.generated/news/cms.config.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.",
      '  The expected type comes from property "x".',
      'test/docs/.generated/news/app/pages/a.vue.ts(3,1): error TS2304: Cannot find name \'foo\'.',
      '',
    ].join('\n')
    expect(parseTsc(out)).toEqual([
      { file: 'test/docs/.generated/news/cms.config.ts', line: 12, column: 5, code: 'TS2322', message: "Type 'string' is not assignable to type 'number'.\n  The expected type comes from property \"x\"." },
      { file: 'test/docs/.generated/news/app/pages/a.vue.ts', line: 3, column: 1, code: 'TS2304', message: "Cannot find name 'foo'." },
    ])
  })
})

// The docs check, part 1: find the code blocks of the developer guide that are marked for
// checking and turn them into files. Pure functions (no file system), tested in
// test/unit/docs-check.spec.ts. The runner (scripts/docs-check.ts) writes and checks the files.
//
// A block is checked when the line right before its fence is a marker:
//
//   <!-- check: news/cms.config.ts -->
//   ```ts
//   …
//   ```
//
// `<group>/<path>`: blocks of one group are one small site (its own `cms.config.ts`, app and
// server files). A flag may follow the path: `+` (this block continues the file above it:
// the same file, no repeated imports) or `append-to-starter` (on `cms.config.ts`: the block
// is added to a copy of the starter's config instead of standing alone).

export const FLAGS = ['+', 'append-to-starter'] as const
export type Flag = (typeof FLAGS)[number]

export interface DocBlock {
  /** The Markdown file (as given to `extractBlocks`). */
  doc: string
  /** 1-based line of the marker in the Markdown file. */
  markerLine: number
  /** 1-based line of the block's first code line. */
  line: number
  group: string
  path: string
  flag: Flag | null
  lang: string
  code: string
}

/** One piece of a generated file and where it came from. */
export interface Segment {
  /** First line of the piece in the generated file (1-based). */
  start: number
  lines: number
  /** The Markdown file, or another source file for the part that is not from a doc. */
  source: string
  /** 1-based line in `source` of the piece's first line. */
  sourceLine: number
}

export interface GeneratedFile {
  group: string
  /** Path inside the group's folder, as written in the marker (a `.vue` file becomes `<name>.vue.ts`). */
  path: string
  content: string
  segments: Segment[]
}

export class DocsCheckError extends Error {}

const MARKER = /^<!--\s*check:\s*([^\s/]+)\/(\S+?)(?:\s+(\S+))?\s*-->\s*$/
const FENCE = /^(\s*)(`{3,}|~{3,})\s*([^\s`]*)/
const OWN_PATHS = /^(cms\.config\.ts|app\/.+\.(?:ts|vue)|server\/.+\.ts)$/

/** Every marked block of one Markdown file, in order. Unmarked fences are skipped whole. */
export function extractBlocks(markdown: string, doc: string): DocBlock[] {
  const lines = markdown.split('\n')
  const blocks: DocBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    const marker = MARKER.exec(line.trim())
    const fence = FENCE.exec(line)
    if (marker) {
      const next = lines[i + 1] ?? ''
      const open = FENCE.exec(next)
      if (!open) throw new DocsCheckError(`${doc}:${i + 1}: the check marker must be followed by a code fence on the very next line`)
      const [, group, path, flag] = marker as unknown as [string, string, string, string | undefined]
      if (!OWN_PATHS.test(path)) throw new DocsCheckError(`${doc}:${i + 1}: "${path}" is not a file the check knows (cms.config.ts, app/**/*.ts|vue, server/**/*.ts)`)
      if (path.includes('..')) throw new DocsCheckError(`${doc}:${i + 1}: "${path}" leaves the group's folder`)
      if (flag !== undefined && !(FLAGS as readonly string[]).includes(flag)) throw new DocsCheckError(`${doc}:${i + 1}: unknown flag "${flag}" (known: ${FLAGS.join(', ')})`)
      if (flag === 'append-to-starter' && path !== 'cms.config.ts') throw new DocsCheckError(`${doc}:${i + 1}: append-to-starter belongs on cms.config.ts`)
      const [, indent = '', ticks = '```', lang = ''] = open
      let end = i + 2
      while (end < lines.length) {
        const close = FENCE.exec(lines[end] ?? '')
        if (close && (close[2] ?? '')[0] === ticks[0] && (close[2] ?? '').length >= ticks.length && (lines[end] ?? '').trim() === (close[2] ?? '')) break
        end++
      }
      if (end >= lines.length) throw new DocsCheckError(`${doc}:${i + 2}: the code fence is never closed`)
      const code = lines.slice(i + 2, end).map((l) => (indent && l.startsWith(indent) ? l.slice(indent.length) : l)).join('\n')
      blocks.push({ doc, markerLine: i + 1, line: i + 3, group, path, flag: (flag as Flag | undefined) ?? null, lang, code })
      i = end + 1
      continue
    }
    if (fence) {
      // An unmarked fence: skip to its end so a marker shown as an example inside it is not taken.
      const ticks = fence[2] ?? '```'
      i++
      while (i < lines.length) {
        const close = FENCE.exec(lines[i] ?? '')
        if (close && (close[2] ?? '')[0] === ticks[0] && (close[2] ?? '').length >= ticks.length && (lines[i] ?? '').trim() === (close[2] ?? '')) break
        i++
      }
      i++
      continue
    }
    i++
  }
  return blocks
}

/** The body of the `<script setup>` of a Vue file, and the line it starts on (1-based, within `code`). */
export function vueScript(code: string): { body: string; line: number } | null {
  const m = /<script\b([^>]*)>/.exec(code)
  if (!m) return null
  const attrs = m[1] ?? ''
  if (!/\bsetup\b/.test(attrs)) return null
  if (/\blang\s*=\s*["'](?!ts["'])/.test(attrs)) throw new DocsCheckError('a <script setup> in a doc must be lang="ts"')
  const start = m.index + m[0].length
  const end = code.indexOf('</script>', start)
  if (end < 0) throw new DocsCheckError('a <script setup> is never closed')
  const before = code.slice(0, start)
  return { body: code.slice(start, end).replace(/^\n/, ''), line: before.split('\n').length + (code[start] === '\n' ? 1 : 0) }
}

/** Turn the marked blocks of several docs into the files of each group. `starter` is the starter's cms.config.ts. */
export function assembleGroups(blocks: DocBlock[], starter: { source: string; text: string }): Map<string, GeneratedFile[]> {
  const groups = new Map<string, Map<string, DocBlock[]>>()
  for (const b of blocks) {
    const files = groups.get(b.group) ?? new Map<string, DocBlock[]>()
    files.set(b.path, [...(files.get(b.path) ?? []), b])
    groups.set(b.group, files)
  }
  const out = new Map<string, GeneratedFile[]>()
  for (const [group, files] of groups) {
    const generated: GeneratedFile[] = []
    for (const [path, list] of files) {
      const first = list[0]!
      if (list.slice(1).some((b) => b.flag === 'append-to-starter')) {
        throw new DocsCheckError(`${first.doc}:${first.markerLine}: only the first block of ${group}/${path} may say append-to-starter`)
      }
      if (first.flag === '+') throw new DocsCheckError(`${first.doc}:${first.markerLine}: the first block of ${group}/${path} cannot continue anything (flag "+")`)
      for (const b of list.slice(1)) {
        if (b.flag !== '+') throw new DocsCheckError(`${b.doc}:${b.markerLine}: ${group}/${path} appears again; mark a continuation with the flag "+" (it adds to the file above), or use another group`)
      }
      generated.push(assembleFile(group, path, list, starter))
    }
    out.set(group, generated)
  }
  return out
}

function assembleFile(group: string, path: string, list: DocBlock[], starter: { source: string; text: string }): GeneratedFile {
  const isVue = path.endsWith('.vue')
  const segments: Segment[] = []
  const parts: string[] = []
  let line = 1
  const push = (text: string, source: string, sourceLine: number) => {
    const n = text.split('\n').length
    segments.push({ start: line, lines: n, source, sourceLine })
    parts.push(text)
    line += n
  }
  if (list[0]!.flag === 'append-to-starter') push(starter.text.replace(/\n+$/, ''), starter.source, 1)
  for (const b of list) {
    let code = b.code
    let sourceLine = b.line
    if (isVue) {
      const script = vueScript(b.code)
      if (!script) continue
      code = script.body.replace(/\n+$/, '')
      sourceLine = b.line + script.line - 1
    }
    if (parts.length) push('', b.doc, b.markerLine)
    push(code.replace(/\n+$/, ''), b.doc, sourceLine)
  }
  // A module (so top-level await and `import` work the same everywhere).
  const content = `${parts.join('\n')}\nexport {}\n`
  return { group, path: isVue ? `${path}.ts` : path, content, segments }
}

/** Where a line of a generated file came from: `{ source, line }`. */
export function originOf(file: GeneratedFile, line: number): { source: string; line: number } | null {
  for (const s of file.segments) {
    if (line >= s.start && line < s.start + s.lines) return { source: s.source, line: s.sourceLine + (line - s.start) }
  }
  return null
}

export interface TscIssue { file: string; line: number; column: number; code: string; message: string }

/** Parse `tsc --pretty false` output into issues; continuation lines are joined to the message. */
export function parseTsc(output: string): TscIssue[] {
  const issues: TscIssue[] = []
  for (const raw of output.split('\n')) {
    const m = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(raw)
    if (m) issues.push({ file: m[1]!, line: Number(m[2]), column: Number(m[3]), code: m[4]!, message: m[5]! })
    else if (/^\s+\S/.test(raw) && issues.length) issues[issues.length - 1]!.message += `\n${raw}`
  }
  return issues
}

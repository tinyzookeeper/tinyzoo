import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DOC_LINKS, DOCS_URL, docsUrl } from '../../packages/cms/src/docs'

// The npm package has no docs, so a message that points at one gives its address on GitHub,
// and the heading it names must exist (GitHub's way of making anchors).
const root = join(import.meta.dirname, '../..')
const slug = (heading: string) => heading.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-')
const headings = (file: string) => readFileSync(join(root, 'docs', file), 'utf8').split('\n').filter((l) => /^#{1,6}\s/.test(l)).map((l) => slug(l.replace(/^#+\s+/, '')))

describe('the docs addresses in messages', () => {
  it('point at a docs page and a heading that exist', () => {
    for (const [name, link] of Object.entries(DOC_LINKS) as [string, { file: string; anchor?: string }][]) {
      if (link.anchor) expect(headings(link.file), `${name} → ${link.file}#${link.anchor}`).toContain(link.anchor)
      else expect(() => readFileSync(join(root, 'docs', link.file)), name).not.toThrow()
    }
  })

  it('are GitHub addresses', () => {
    expect(docsUrl('changingType')).toBe('https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/upgrading.md#changing-a-fields-type')
    expect(docsUrl('from07to10')).toBe('https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/upgrading.md#from-07-to-10')
    expect(DOCS_URL.startsWith('https://github.com/tinyzookeeper/tinyzoo/blob/main/')).toBe(true)
  })

  it('are the only way the CLI and the server cite a docs file (no bare docs/… path in a message)', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (name === 'node_modules' || name === 'starter') continue
        if (statSync(p).isDirectory()) walk(p)
        else if (p.endsWith('.ts')) files.push(p)
      }
    }
    for (const d of ['cli', 'server', 'src', 'forms']) walk(join(root, 'packages/cms', d))
    files.push(join(root, 'packages/cms/module.ts'))
    const bare: string[] = []
    for (const file of files) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        // comments may name a doc; a string must not
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
        if (/(?<![/\w.-])docs\/[\w./-]+\.md/.test(line)) bare.push(`${file.replace(root, '')}:${i + 1}`)
      })
    }
    expect(bare).toEqual([])
  })
})

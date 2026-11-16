import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Every relative link in the docs points at a file that exists, and a `#anchor` at a heading
// that exists in it (GitHub's way of making anchors). Pages move; links must follow.
const root = join(import.meta.dirname, '../..')

function markdownFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) markdownFiles(path, out)
    else if (name.endsWith('.md')) out.push(path)
  }
  return out
}

/** The text outside code fences. */
function outsideFences(md: string): string {
  let fence = false
  return md.split('\n').filter((line) => {
    if (line.startsWith('```')) { fence = !fence; return false }
    return !fence
  }).join('\n')
}

/** The same without inline code, where a `[x](y)` is an example, not a link. */
const prose = (md: string): string => outsideFences(md).replace(/`[^`\n]*`/g, '')

/** GitHub's heading anchor: lowercase, punctuation dropped, spaces to dashes. */
export function slug(heading: string): string {
  return heading.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-')
}

function anchors(file: string): Set<string> {
  const seen = new Map<string, number>()
  const out = new Set<string>()
  for (const line of outsideFences(readFileSync(file, 'utf8')).split('\n')) {
    const m = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line)
    if (!m) continue
    const base = slug(m[1]!.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'))
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    out.add(n ? `${base}-${n}` : base)
  }
  return out
}

const files = [join(root, 'README.md'), join(root, 'CONTRIBUTING.md'), ...markdownFiles(join(root, 'docs'))]

describe('links in the docs', () => {
  it('slugs headings the way GitHub does', () => {
    expect(slug('Pages under pages: the page tree')).toBe('pages-under-pages-the-page-tree')
    expect(slug('`tinyzoo generate`: a guard')).toBe('tinyzoo-generate-a-guard')
    expect(slug('Migration … was never applied, but a newer one was')).toBe('migration--was-never-applied-but-a-newer-one-was')
  })

  it('every relative link and anchor resolves', () => {
    const broken: string[] = []
    for (const file of files) {
      const text = prose(readFileSync(file, 'utf8'))
      for (const m of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const target = m[1]!
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) continue
        const [path, anchor] = target.split('#') as [string, string | undefined]
        const at = path ? resolve(dirname(file), decodeURIComponent(path)) : file
        if (!existsSync(at)) { broken.push(`${relative(root, file)}: ${target} (no such file)`); continue }
        if (anchor && at.endsWith('.md') && !anchors(at).has(anchor)) broken.push(`${relative(root, file)}: ${target} (no such heading in ${relative(root, at)})`)
      }
    }
    expect(broken).toEqual([])
  })
})

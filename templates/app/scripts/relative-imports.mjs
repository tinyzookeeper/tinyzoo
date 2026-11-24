// Turns the `~/` imports of one template into relative ones, so its files keep working when they
// live in the one app (where `~` is the app's own folder, not the template's).
//   node templates/app/scripts/relative-imports.mjs <id> [--root <folder>]
// Every `from '~/x'`, `import '~/x'` and `import('~/x')` in the .vue, .ts, .mts and .js files under
// <root>/<id>/app becomes the path from that file to <root>/<id>/app/x. Only the quoted specifier
// changes. The default root is the repo's templates folder. Running it again changes nothing.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const usage = 'usage: node templates/app/scripts/relative-imports.mjs <id> [--root <folder>]'
const args = process.argv.slice(2)
let root = resolve(here, '..', '..')
const rootAt = args.indexOf('--root')
if (rootAt !== -1) {
  if (!args[rootAt + 1]) { console.error(usage); process.exit(2) }
  root = resolve(args[rootAt + 1])
  args.splice(rootAt, 2)
}
const id = args[0]
const appDir = id && !id.startsWith('-') ? join(root, id, 'app') : ''
if (!id || args.length !== 1 || !statSync(appDir, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(id ? `no such template: ${join(root, String(id), 'app')}\n${usage}` : usage)
  process.exit(2)
}

const extensions = ['.vue', '.ts', '.mts', '.js']
const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (extensions.some((ext) => entry.name.endsWith(ext))) files.push(path)
  }
}
walk(appDir)

// A module specifier is the quoted string after `from`, after a bare `import`, or inside `import(`.
const specifier = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"\n]*)\2/g

// Whether the statement a specifier ends belongs to a type-only import or export: `import type`,
// `export type`, or braces in which every name carries its own `type`.
const typeOnly = (text, at) => {
  const starts = [...text.slice(0, at).matchAll(/\b(import|export)\b/g)]
  const statement = text.slice(starts.at(-1)?.index ?? at, at)
  if (/^(import|export)\s+type\b/.test(statement)) return true
  const braces = statement.match(/\{([^}]*)\}/)
  if (!braces || /^import\s+[\w$]+\s*,/.test(statement) || /^import\s+[\w$*]/.test(statement)) return false
  return braces[1].split(',').map((name) => name.trim()).filter(Boolean).every((name) => /^type\s/.test(name))
}

let lines = 0
let changed = 0
let unsupported = false
const warnings = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  let count = 0
  const next = text.replace(specifier, (whole, lead, quote, path, at) => {
    if (path.startsWith('~~/') || path.startsWith('@/')) {
      console.error(`${relative(root, file)}: cannot handle "${path}" (only ~/ is rewritten)`)
      unsupported = true
      return whole
    }
    if (!path.startsWith('~/')) return whole
    if (!/\bfrom\s*$/.test(lead) || !typeOnly(text, at)) warnings.push(`warning: ${relative(root, file)} imports "${path}" without type only`)
    let target = posix.relative(dirname(file).split(sep).join('/'), join(appDir, path.slice(2)).split(sep).join('/'))
    if (!target.startsWith('.')) target = `./${target}`
    count++
    return `${lead}${quote}${target}${quote}`
  })
  if (count) {
    writeFileSync(file, next)
    console.log(`${relative(root, file)}: ${count}`)
    lines += count
    changed++
  }
}
for (const warning of warnings) console.warn(warning)
if (unsupported) process.exit(1)
console.log(changed ? `${lines} lines in ${changed} files` : 'nothing to do')

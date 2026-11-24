// Compares a template's main.css with the one app's and writes the template's design.css.
//   node templates/app/scripts/theme-diff.mjs <id> [--write]
// The one app has a single @theme with every design's tokens. A token the app lacks is added to it;
// a token the template gives another value goes into the template's design.css (under
// html[data-design="<id>"], in the theme layer so a look's own value still wins), together with the
// template's own base rules. Without --write it only prints what would change; when there is
// nothing left to do it says so, which is how a person checks the step is done.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Index of the `}` that closes the `{` at `open`, skipping comments and strings.
const closing = (text, open) => {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c === '/' && text[i + 1] === '*') i = text.indexOf('*/', i + 2) + 1 || text.length
    else if (c === '"' || c === "'") { for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++ }
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i
  }
  throw new Error('unbalanced braces in the stylesheet')
}

// Splits a declaration list at the semicolons that are not inside parentheses or quotes.
const declarations = (body) => {
  const found = []
  let depth = 0
  let quote = ''
  let from = 0
  for (let i = 0; i <= body.length; i++) {
    const c = body[i]
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = '' }
    else if (c === '"' || c === "'") quote = c
    else if (c === '(') depth++
    else if (c === ')') depth--
    else if ((c === ';' && depth === 0) || i === body.length) {
      const match = body.slice(from, i).trim().match(/^(--[\w-]+)\s*:\s*([\s\S]*)$/)
      if (match) found.push([match[1], match[2].trim()])
      from = i + 1
    }
  }
  return found
}

// A main.css as its theme tokens and the rest of it: everything except @import, @source, the
// @theme block and top-level comments, kept as written.
export const parseMainCss = (text) => {
  const theme = []
  const rules = []
  let i = 0
  while (i < text.length) {
    if (/\s/.test(text[i])) { i++; continue }
    if (text.startsWith('/*', i)) { i = text.indexOf('*/', i + 2) + 2 || text.length; continue }
    if (text[i] === '@' && /^@(import|source|charset)\b/.test(text.slice(i, i + 9))) {
      i = text.indexOf(';', i) + 1 || text.length
      continue
    }
    const open = text.indexOf('{', i)
    if (open === -1) break
    const end = closing(text, open)
    if (/^@theme\b/.test(text.slice(i, open).trim())) {
      theme.push(...declarations(text.slice(open + 1, end).replace(/\/\*[\s\S]*?\*\//g, '')))
    } else {
      rules.push(text.slice(i, end + 1))
    }
    i = end + 1
  }
  return { theme, rules: rules.join('\n\n') }
}

const capital = (id) => id.charAt(0).toUpperCase() + id.slice(1)

// The design.css of a design: its differing theme values, then its own rules.
export const designCss = (id, differing, rules) => {
  const Id = capital(id)
  const parts = [
    `/* ${Id}'s own rules from its main.css, for ${Id}'s sites only (html[data-design="${id}"]).\n   Written by templates/app/scripts/theme-diff.mjs; change the template's main.css and run it again. */`,
  ]
  if (differing.length) {
    const lines = differing.map(([name, value]) => `    ${name}: ${value};`).join('\n')
    parts.push(`/* Its theme values that differ from the app's: in the theme layer, so a look's own value still wins. */\n@layer theme {\n  html[data-design="${id}"] {\n${lines}\n  }\n}`)
  }
  if (rules.trim()) parts.push(rules.replaceAll('html[data-look]', `html[data-design="${id}"]`))
  return `${parts.join('\n\n')}\n`
}

const squash = (value) => value.replace(/\s+/g, ' ').trim()

const main = () => {
  const usage = 'usage: node templates/app/scripts/theme-diff.mjs <id> [--write]'
  const args = process.argv.slice(2)
  const write = args.includes('--write')
  const rest = args.filter((arg) => arg !== '--write')
  const id = rest[0]
  const templates = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  if (!id || rest.length !== 1 || id.startsWith('-') || !existsSync(join(templates, id, 'app/assets/css/main.css'))) {
    console.error(usage)
    process.exit(2)
  }
  const cssDir = join(templates, id, 'app/assets/css')
  const appMain = join(templates, 'app/app/assets/css/main.css')
  const appText = readFileSync(appMain, 'utf8')
  const app = new Map(parseMainCss(appText).theme)
  const own = parseMainCss(readFileSync(join(cssDir, 'main.css'), 'utf8'))

  const missing = own.theme.filter(([name]) => !app.has(name))
  const differing = own.theme.filter(([name, value]) => app.has(name) && squash(app.get(name)) !== squash(value))
  const css = designCss(id, differing, own.rules)

  console.log(`a. tokens the app's @theme lacks (${missing.length})`)
  for (const [name, value] of missing) console.log(`   ${name}: ${value}`)
  console.log(`b. tokens whose value differs from the app's (${differing.length})`)
  for (const [name, value] of differing) console.log(`   ${name}\n     app:      ${app.get(name)}\n     template: ${value}`)
  console.log(`c. design.css\n${css.replace(/^/gm, '   | ')}`)

  // A look that reads a font token it does not set itself gets the app's value, not the template's.
  const looks = readdirSync(cssDir).filter((file) => file.endsWith('.css') && !['main.css', 'design.css'].includes(file))
  const advice = []
  for (const [token, value] of differing.filter(([name]) => name.startsWith('--font-'))) {
    const suffix = token.slice('--font-'.length)
    for (const file of looks) {
      const look = file.replace(/\.css$/, '')
      const sheet = readFileSync(join(cssDir, file), 'utf8')
      const componentsDir = join(templates, id, 'app/components', look)
      const components = existsSync(componentsDir)
        ? readdirSync(componentsDir).filter((name) => name.endsWith('.vue')).map((name) => readFileSync(join(componentsDir, name), 'utf8'))
        : []
      const usesClass = components.some((source) => new RegExp(`(^|[^\\w-])font-${suffix}(?![\\w-])`).test(source))
      const usesVar = sheet.includes(`var(${token})`)
      if ((usesVar || usesClass) && !sheet.includes(`${token}:`)) {
        advice.push(`   look ${look} uses ${token} but does not set it; add \`${token}: ${value};\` to its html[data-look="${look}"] block`)
      }
    }
  }
  console.log(`d. looks that use a differing font token without setting it (${advice.length})`)
  for (const line of advice) console.log(line)

  const designPath = join(cssDir, 'design.css')
  const current = existsSync(designPath) ? readFileSync(designPath, 'utf8') : null
  if (!missing.length && current === css) {
    console.log('nothing to do')
    return
  }
  if (!write) return

  if (current !== css) {
    writeFileSync(designPath, css)
    console.log(`wrote ${designPath}`)
  }
  if (missing.length) {
    // The new tokens go at the end of the app's @theme block, under a comment naming the design.
    const open = appText.search(/@theme\b[^{]*\{/)
    const end = closing(appText, appText.indexOf('{', open))
    const lines = missing.map(([name, value]) => `  ${name}: ${value};`).join('\n')
    const before = appText.slice(0, end).replace(/\s*$/, '')
    writeFileSync(appMain, `${before}\n  /* ${capital(id)} */\n${lines}\n${appText.slice(end)}`)
    console.log(`added ${missing.length} tokens to ${appMain}`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()

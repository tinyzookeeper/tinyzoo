// `look-pairs` (run in the repo: `node templates/kit/scripts/look-pairs.mjs`): the colours each
// look puts together with its main colour, read from its stylesheet and components
// (templates/kit/look-pairs.ts), and the `own:` line of each look in looks.ts that records them.
//
//   node templates/kit/scripts/look-pairs.mjs            what was found, one line per look
//   node templates/kit/scripts/look-pairs.mjs --why      the same, with where each colour was found
//   node templates/kit/scripts/look-pairs.mjs --check    exit 1 if a looks.ts would change (CI)
//   node templates/kit/scripts/look-pairs.mjs --write    write the found colours into looks.ts
//
// `--write` keeps the hand-written `main`, `calm`, `follows` and `also` of a look's `own:` and replaces
// `against` and `fixed`. A new look needs a first `own:` line from `--write`; after that, run
// it whenever a look's stylesheet or components change.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { lookTemplates, ownLine, scanLook, writeOwn } from '../look-pairs.ts'

const templatesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const args = new Set(process.argv.slice(2))
const show = (values) => (values.length ? values.join(' ') : '-')
const same = (a = [], b = []) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')

const results = []
for (const template of lookTemplates(templatesDir)) {
  const file = join(templatesDir, template, 'looks.ts')
  const { looks } = await import(pathToFileURL(file).href)
  for (const look of looks.all) results.push({ template, file, look, found: scanLook(templatesDir, template, look) })
}

// The own line a look should have: its hand-written keys, and what was found.
const lineOf = ({ look, found }) =>
  ownLine({ main: look.own?.main, calm: look.own?.calm, follows: look.own?.follows, also: look.own?.also, against: found.against, fixed: found.fixed })

// Each template's looks.ts with every look's line put in place.
const rewritten = (template) => {
  const file = join(templatesDir, template, 'looks.ts')
  const before = readFileSync(file, 'utf8')
  let after = before
  for (const r of results.filter((x) => x.template === template)) after = writeOwn(after, r.look.id, lineOf(r))
  return { file, before, after }
}
const templates = [...new Set(results.map((r) => r.template))]

if (args.has('--check')) {
  const stale = results.filter((r) => writeOwn(readFileSync(r.file, 'utf8'), r.look.id, lineOf(r)) !== readFileSync(r.file, 'utf8'))
  if (stale.length) {
    for (const r of stale) console.log(`${r.template}/${r.look.id}`)
    console.error(`\n✗ ${stale.length} look(s) have colour pairs that looks.ts does not say: run node templates/kit/scripts/look-pairs.mjs --write`)
    process.exit(1)
  }
  console.log(`✓ the colour pairs of all ${results.length} looks are in looks.ts`)
} else if (args.has('--write')) {
  let changed = 0
  for (const template of templates) {
    const { file, before, after } = rewritten(template)
    if (after === before) continue
    writeFileSync(file, after)
    changed++
    console.log(`wrote ${template}/looks.ts`)
  }
  console.log(changed ? `${changed} file(s) changed` : 'nothing to change')
} else {
  for (const { template, look, found } of results) {
    const differs = !same(look.own?.against, found.against) || !same(look.own?.fixed, found.fixed)
    const derived = found.derived.length ? `  derived (not checked) ${found.derived.join(' ')}` : ''
    console.log(`${template}/${look.id}  main ${found.main}  against ${show(found.against)}  fixed ${show(found.fixed)}${derived}  page ${found.page ?? '-'}${differs ? '  [looks.ts differs]' : ''}`)
    if (args.has('--why')) {
      for (const [key, why] of Object.entries(found.sources)) for (const w of why) console.log(`    ${key}  ${w}`)
    }
  }
}

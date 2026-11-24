// The type check of one design of the one app: the types of the template's own files and the
// kit's, Vue templates included (vue-tsc 3), as strict as a template's own build checks them.
//
//   node templates/app/scripts/typecheck.mjs <id>      (a template's `pnpm typecheck` runs this)
//
// All designs in one TypeScript project would clash: each has its own `wordsOf`, `BlockOf` and
// <AtelierHero>. So each design gets a project of its own: the app prepared with only this design
// (in a build folder of its own, so several checks can run side by side), plus what Nuxt does
// for a template's own build and the one app does by itself at build time: the design's helpers
// (app/utils, app/composables) as globals, its components under the names its files use, and
// `#site` as its folder.
//
// The block components take their props from the generated client (app/lib/cms-content.ts), so
// renaming a field in cms.config.ts and running the `cms:client` script makes the check fail
// wherever the old name is still read. Findings in tinyzoo's own files are tinyzoo's to keep right:
// only this design's files and the kit's are reported.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const templatesDir = resolve(appDir, '..')
const kitDir = join(templatesDir, 'kit')
const id = process.argv[2]
if (!id || !existsSync(join(templatesDir, id, 'looks.ts'))) {
  console.error('usage: typecheck.mjs <template id>   (a folder of templates/ with looks.ts)')
  process.exit(2)
}
const { scanDesign } = await import(join(kitDir, 'design-build.ts'))
const { createUnimport, scanDirExports } = createRequire(join(kitDir, 'package.json'))('unimport')

const root = join(templatesDir, id)
const buildDir = join(appDir, '.nuxt-types', id)
const env = { ...process.env, TZ_DESIGNS: id, TZ_BUILD_DIR: buildDir, PATH: `${join(appDir, 'node_modules', '.bin')}${delimiter}${process.env.PATH ?? ''}` }
const run = (cmd, args) => spawnSync(cmd, args, { cwd: appDir, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' })

const prepared = run('nuxt', ['prepare'])
if (prepared.status !== 0) {
  process.stderr.write(`${prepared.stdout ?? ''}${prepared.stderr ?? ''}${prepared.error?.message ?? ''}`)
  process.exit(prepared.status ?? 1)
}

// ── the design's project, beside Nuxt's own ──
const out = join(buildDir, 'tz-types')
mkdirSync(out, { recursive: true })
const rel = (file) => { const r = relative(out, file).split('\\').join('/'); return r.startsWith('.') ? r : `./${r}` }
const noExt = (file) => file.replace(/\.(ts|mts|js|mjs)$/, '')

// Its helpers, as Nuxt declares a template's own: globals.
const helpers = await scanDirExports(['app/composables', 'app/utils'].map((d) => join(root, d)), { filePatterns: ['*.{ts,js,mjs,mts}', '*/index.{ts,js,mjs,mts}'] })
// (the vueTemplate addon declares them for Vue templates too, as Nuxt does)
const imports = await createUnimport({ imports: helpers, addons: { vueTemplate: true } }).generateTypeDeclarations({ resolvePath: (i) => rel(noExt(i.from)) })
writeFileSync(join(out, 'imports.d.ts'), imports)

// Its components under the names its files use (a kit component of the same name is left as the
// kit's: the template's has the same props, by the kit's rule).
const nuxtComponents = readFileSync(join(buildDir, 'types', 'components.d.ts'), 'utf8')
const known = new Set([...nuxtComponents.matchAll(/^\s+'?(\w+)'?:/gm)].map((m) => m[1]))
const own = scanDesign(id, root).components.filter((c) => !known.has(c.name))
writeFileSync(join(out, 'components.d.ts'), [
  'declare module \'vue\' {',
  '  export interface GlobalComponents {',
  ...own.map((c) => `    '${c.name}': typeof import(${JSON.stringify(rel(c.file))})['default']`),
  '  }',
  '}',
  'export {}',
  '',
].join('\n'))
// The design's helpers come first: where a global name is declared twice, TypeScript keeps the
// first declaration, and the design's name must win over one of Nitro's server helpers (Event's
// `useEvent`), as it does in the template's own build (Nuxt lists its app's imports before Nitro's).
writeFileSync(join(out, 'nuxt.d.ts'), ['/// <reference path="./imports.d.ts" />', '/// <reference path="../nuxt.d.ts" />', '/// <reference path="./components.d.ts" />', 'export {}', ''].join('\n'))

// Nuxt's settings with this design's files, and `#site` as its folder. (`paths` replace those of
// the extended file, so Nuxt's are carried over, made absolute.)
const nuxtApp = JSON.parse(readFileSync(join(buildDir, 'tsconfig.app.json'), 'utf8'))
const paths = Object.fromEntries(Object.entries(nuxtApp.compilerOptions.paths ?? {}).map(([k, v]) => [k, v.map((p) => (isAbsolute(p) ? p : resolve(buildDir, p)))]))
paths['#site'] = [root]
paths['#site/*'] = [`${root}/*`]
writeFileSync(join(out, 'tsconfig.json'), JSON.stringify({
  extends: '../tsconfig.app.json',
  compilerOptions: { paths },
  include: [
    './nuxt.d.ts',
    `${root}/app/**/*`, `${root}/app/**/*.vue`, `${root}/looks.ts`, `${root}/texts/**/*`,
    `${kitDir}/app/**/*`, `${kitDir}/app/**/*.vue`, `${kitDir}/looks.ts`,
  ],
  exclude: (nuxtApp.exclude ?? []).map((p) => (isAbsolute(p) ? p : resolve(buildDir, p))),
}, null, 2))

// ── the check ──
const res = run('vue-tsc', ['--noEmit', '--pretty', 'false', '-p', join(out, 'tsconfig.json')])
// An error starts at the file name; its explanation continues on indented lines.
const mine = (file) => {
  const abs = resolve(appDir, file)
  return !abs.includes('node_modules') && (abs.startsWith(`${root}/`) || abs.startsWith(`${kitDir}/`))
}
const findings = []
let keep = false
for (const line of `${res.stdout}${res.stderr}`.split('\n')) {
  const m = /^(.+?)\(\d+,\d+\): error TS\d+/.exec(line)
  if (m) keep = mine(m[1])
  else if (/^\S/.test(line)) keep = false
  if (keep) findings.push(line)
}
if (findings.length) {
  console.error(findings.join('\n'))
  console.error(`\n✗ ${findings.filter((l) => /: error TS/.test(l)).length} type error(s) in ${id}'s files and the kit's`)
  process.exit(1)
}
if (res.status !== 0 && !/error TS/.test(`${res.stdout}${res.stderr}`)) {
  process.stderr.write(`${res.stdout}${res.stderr}`)
  process.exit(res.status ?? 1)
}
console.log(`✓ types ok (${id}'s own files and the kit's, in the one app)`)

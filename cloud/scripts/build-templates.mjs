// Build the apps the hosting drivers run: the one app that holds the designs of every hosted
// template (templates/app), and the Basic website's (packages/cms/starter). One build of an app
// serves any number of sites (everything per site comes from its row in the site directory).
//
//   pnpm --filter tinyzoo-cloud templates:build                          both apps, every design
//   pnpm --filter tinyzoo-cloud templates:build photographer,wedding     only the apps these need
//   pnpm --filter tinyzoo-cloud templates:build photographer wedding basic
//
// The one app is built with the designs named (TZ_DESIGNS), and says which in
// `.output/tinyzoo-designs.json`: the hosting drivers refuse a site of another template with
// the words to build it. With no names it has every design (a TZ_DESIGNS already in the
// environment is passed on as it is).
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { APPS, BUILT_TEMPLATES, repoRoot as root } from './lib.mjs'

// The templates and apps named, one after the other as a list: `a,b` or `a b`.
const named = process.argv.slice(2).flatMap((a) => a.split(',')).map((a) => a.trim()).filter(Boolean)
const known = BUILT_TEMPLATES.map((t) => t.id)
const unknown = named.filter((id) => !known.includes(id))
if (unknown.length) {
  console.error(`No such template: ${unknown.join(', ')} (there are: ${known.join(', ')})`)
  process.exit(2)
}
const wanted = named.length ? BUILT_TEMPLATES.filter((t) => named.includes(t.id)) : BUILT_TEMPLATES
const apps = APPS.filter((app) => wanted.some((t) => t.app === app.id))

// The designs the one app is built with: the ones named (in the order of the templates), else
// what the environment says, else none given (every design).
const designs = named.length
  ? wanted.filter((t) => t.app === 'templates').map((t) => t.id)
  : (process.env.TZ_DESIGNS?.split(',').map((id) => id.trim()).filter(Boolean) ?? BUILT_TEMPLATES.filter((t) => t.app === 'templates').map((t) => t.id))

// The font files a build downloads are kept between builds. Google can answer the same request
// with other files at another time, and @nuxt/fonts keeps its CSS for a week only; with one
// kept folder two builds of the same code use the same files. @nuxt/fonts keeps them in
// `<app root>/node_modules/.cache/nuxt/fonts/`, so that folder of each app is a link to the one
// shared folder (TZ_FONTS_CACHE, or node_modules/.cache/tinyzoo-fonts of the repository). A
// build machine must keep that one folder (a cache mount, say) and point TZ_FONTS_CACHE at it.
const fontsCache = resolve(process.env.TZ_FONTS_CACHE || join(root, 'node_modules', '.cache', 'tinyzoo-fonts'))

function shareFontsCache(appDir) {
  const link = join(appDir, 'node_modules', '.cache', 'nuxt', 'fonts')
  mkdirSync(fontsCache, { recursive: true })
  mkdirSync(dirname(link), { recursive: true })
  let present = null
  try { present = lstatSync(link) } catch { /* nothing there yet */ }
  if (present?.isSymbolicLink() && resolve(dirname(link), readlinkSync(link)) === fontsCache) return
  if (present) {
    // What is there already goes into the shared folder, without replacing a file that is in it.
    if (!present.isSymbolicLink() || existsSync(link)) cpSync(link, fontsCache, { recursive: true, force: false, errorOnExist: false, dereference: true })
    rmSync(link, { recursive: true, force: true })
  }
  symlinkSync(fontsCache, link, 'dir')
}

console.log(`Fonts kept in ${fontsCache}`)

// One after the other, never together: the one app's build peaks at about 6.5 GB of memory.
for (const app of apps) {
  const dir = join(root, app.dir)
  const entry = join(dir, '.output', 'server', 'index.mjs')
  shareFontsCache(dir)
  const env = { ...process.env }
  if (app.id === 'templates') {
    // A build of every design leaves TZ_DESIGNS out, so the app does not think it was narrowed.
    if (named.length || process.env.TZ_DESIGNS) env.TZ_DESIGNS = designs.join(',')
    else delete env.TZ_DESIGNS
  }
  console.log(`\n▸ ${app.id}: pnpm --filter ${app.pkg} build${app.id === 'templates' ? ` (designs: ${designs.join(', ')})` : ''}`)
  const res = spawnSync('pnpm', ['--filter', app.pkg, 'build'], { cwd: root, stdio: 'inherit', env })
  if (res.status !== 0 || !existsSync(entry)) {
    console.error(`\n✗ ${app.id} did not build (${entry} is missing)`)
    process.exit(1)
  }
  if (app.id === 'templates') writeFileSync(join(dir, '.output', 'tinyzoo-designs.json'), `${JSON.stringify({ designs, builtAt: new Date().toISOString() }, null, 2)}\n`)
  console.log(`✓ ${app.id}: ${entry}`)
}

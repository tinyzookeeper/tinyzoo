// Every look with its preset and with some own colours, side by side, for the eye: one page
// (index.html) with the first screen of each look's home page, once in its default colours and
// once for each colour given. Under each picture stands the colour as given and as shown.
//
//   node templates/app/scripts/own-gallery.mjs --entry <.output/server/index.mjs> --templates photographer,wedding
//        --out <folder> --pg postgres://user:pw@host:port/postgres --prefix tzown_ --model
//        --own '#2e7d32,#f59e0b,#1d4ed8' [--templates-dir <folder>] [--port 4890] [--keep] [--reuse]
//
// One site per look, seeded in that look (`--reuse` takes the databases of an earlier run with
// `--keep` as they are; scripts/own-contrast.mjs makes the same ones). The pictures are 720 × 450
// (the screen at 1440 × 900, halved). Every site is left without an own colour.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { arg, chooseLook, dropSites, freePortFrom, log, makeSites, repoRoot, seedSite, signIn, sitesFor, startServer, writeDirectory } from './sites.mjs'

const entry = arg('entry')
const out = arg('out')
const pgUrl = arg('pg')
const prefix = arg('prefix')
const templatesDir = resolve(arg('templates-dir', join(repoRoot, 'templates')))
const templates = String(arg('templates', '')).split(',').filter(Boolean)
const colours = String(arg('own', '')).split(',').map((c) => c.trim().toLowerCase()).filter(Boolean)
if (!entry || !out || !pgUrl || !prefix || !templates.length || !colours.length || colours.some((c) => !/^#[0-9a-f]{6}$/.test(c))) {
  console.error('usage: own-gallery.mjs --entry <server> --templates a,b --out <folder> --pg <postgres url> --prefix <db prefix_> --own <#rrggbb,#rrggbb> [--model] [--keep] [--reuse]')
  process.exit(2)
}
const { chromium } = createRequire(join(repoRoot, 'cloud', 'package.json'))('playwright')

const port = Number(arg('port', 0)) || await freePortFrom(4890)
const dataDir = resolve(repoRoot, 'templates', 'app', '.data', `${prefix}data`)
const rows = await makeSites({ pgUrl, prefix, dataDir, port, sites: await sitesFor(templatesDir, templates), model: arg('model', false) === true, keep: arg('reuse', false) === true })
const directoryFile = join(dataDir, 'sites.json')
writeDirectory(directoryFile, rows)
mkdirSync(out, { recursive: true })

let server = null
let browser = null
const list = []
try {
  server = await startServer({ entry, directoryFile, port, logFile: join(dataDir, 'server.log') })
  if (arg('reuse', false) !== true) for (const row of rows) seedSite(row, templatesDir)
  browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 0.5, locale: 'cs-CZ', colorScheme: 'light', reducedMotion: 'reduce' })
  for (const row of rows) {
    const s = row._site
    const cookie = await signIn(s.url)
    const shots = []
    for (const colour of [null, ...colours]) {
      await chooseLook(s.url, cookie, s.look, s.presets[0], colour)
      const page = await ctx.newPage()
      await page.goto(s.url, { waitUntil: 'networkidle' })
      const shown = await page.evaluate(() => document.documentElement.getAttribute('data-own'))
      const file = `${s.slug}-${colour ? colour.slice(1) : 'preset'}.png`
      await page.screenshot({ path: join(out, file) })
      await page.close()
      shots.push({ file, given: colour, shown })
    }
    await chooseLook(s.url, cookie, s.look, s.presets[0], null)
    list.push({ site: s.slug, template: s.template, look: s.look, preset: s.presets[0], shots })
    log(s.slug)
  }
}
finally {
  await browser?.close().catch(() => {})
  await server?.stop()
  if (arg('keep', false) !== true) await dropSites({ pgUrl, rows })
}

const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const caption = (shot) => (!shot.given ? 'the preset' : shot.shown && shot.shown !== shot.given ? `${shot.given}, shown as ${shot.shown}` : `${shot.given}, as given`)
const columns = colours.length + 1
writeFileSync(join(out, 'index.html'), `<!doctype html>
<meta charset="utf-8">
<title>An own colour on every look</title>
<style>
  body { font: 14px system-ui, sans-serif; margin: 24px; background: #f4f4f2; color: #222; }
  h1 { font-size: 20px; }
  h2 { font-size: 15px; margin: 28px 0 8px; }
  .row { display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 10px; }
  figure { margin: 0; }
  img { width: 100%; display: block; border: 1px solid #d8d8d4; }
  figcaption { font-size: 12px; color: #555; padding: 4px 0; }
</style>
<h1>The first screen of every look: its preset, and ${colours.length} own colours</h1>
${list.map((l) => `<h2>${esc(l.template)} / ${esc(l.look)} (preset ${esc(l.preset)})</h2>
<div class="row">${l.shots.map((shot) => `<figure><img loading="lazy" src="${esc(shot.file)}" alt=""><figcaption>${esc(caption(shot))}</figcaption></figure>`).join('')}</div>`).join('\n')}
`)
writeFileSync(join(out, 'gallery.json'), JSON.stringify({ entry, colours, looks: list }, null, 2))
log(`${list.length} looks × ${columns} pictures in ${out}; open ${join(out, 'index.html')}`)
process.exit(0)

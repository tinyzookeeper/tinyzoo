// Pictures of every look of some templates, from a built server, to compare two builds
// (scripts/compare-shots.mjs): a template's own build before a change and the one app after it,
// say. The same sites, seed and moment give the same pictures, so any difference is the build's.
//
//   node templates/app/scripts/shots.mjs --entry <.output/server/index.mjs> --templates photographer,wedding
//        --out <folder> --pg postgres://user:pw@host:port/postgres --prefix tzshots_a_ [--model]
//        [--templates-dir <folder of templates, for looks and seeds>] [--port 4870] [--keep] [--reuse]
//
// For every look (one site each, seeded in that look): the home page in the default colours at
// 1440 × 900 and 390 × 844 (whole page, up to 8 000 px), the first screen in each other colour
// preset, one page of each kind of entry the template gives an address (an album…) and a
// missing address. `--model`: the rows name their content model (the one app). `--keep` keeps
// the databases; `--reuse` takes kept ones as they are (no seed).
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { appDir, arg, chooseLook, dropSites, entryPagesOf, firstSlug, freePortFrom, log, makeSites, repoRoot, seedSite, signIn, sitesFor, sleep, startServer, writeDirectory } from './sites.mjs'

const entry = arg('entry')
const out = arg('out')
const pgUrl = arg('pg')
const prefix = arg('prefix')
const templatesDir = resolve(arg('templates-dir', join(repoRoot, 'templates')))
const templates = String(arg('templates', '')).split(',').filter(Boolean)
if (!entry || !out || !pgUrl || !prefix || !templates.length) {
  console.error('usage: shots.mjs --entry <server> --templates a,b --out <folder> --pg <postgres url> --prefix <db prefix_> [--model] [--keep] [--reuse]')
  process.exit(2)
}
const { chromium } = createRequire(join(repoRoot, 'cloud', 'package.json'))('playwright')

/** The first Wednesday from today on, 9.40: what a template works out from "now" is pictured then (cloud/scripts/template-pictures.mjs). */
function weekdayMorning() {
  const d = new Date()
  d.setHours(9, 40, 0, 0)
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1)
  return d
}

const MAX_HEIGHT = 8000

async function shoot(browser, url, file, { width, height, full }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: 'cs-CZ', colorScheme: 'light', reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const failures = []
  page.on('pageerror', (e) => failures.push(String(e?.message ?? e)))
  page.on('console', (m) => { if (m.type() === 'error' || /hydrat/i.test(m.text())) failures.push(m.text()) })
  await page.clock.setFixedTime(weekdayMorning())
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  // Pictures load as they come into view: walk down the page, then back up, and wait for them.
  await page.evaluate(async (max) => {
    for (const img of document.images) { img.loading = 'eager'; img.decoding = 'sync' }
    const end = Math.min(document.documentElement.scrollHeight, max)
    for (let y = 0; y <= end; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)) }
    window.scrollTo(0, 0)
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); setTimeout(r, 8000) }))))
    await Promise.all([...document.images].map((i) => i.decode?.().catch(() => {})))
    await document.fonts.ready
  }, MAX_HEIGHT)
  await page.waitForLoadState('networkidle')
  await sleep(400)
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight)
  await page.screenshot({
    path: file, animations: 'disabled', caret: 'hide',
    ...(full ? { fullPage: true, clip: { x: 0, y: 0, width, height: Math.min(pageHeight, MAX_HEIGHT) } } : {}),
  })
  await ctx.close()
  return failures
}

const port = Number(arg('port', 0)) || await freePortFrom(4870)
const dataDir = resolve(out, '..', `${prefix}data`)
const sites = await sitesFor(templatesDir, templates)
const rows = await makeSites({ pgUrl, prefix, dataDir, port, sites, model: arg('model', false) === true, keep: arg('reuse', false) === true })
const directoryFile = join(dataDir, 'sites.json')
writeDirectory(directoryFile, rows)
mkdirSync(out, { recursive: true })

let server = null
let browser = null
const report = { entry, started: new Date().toISOString(), shots: [], failures: {} }
try {
  server = await startServer({ entry, directoryFile, port, logFile: join(dataDir, 'server.log') })
  log(`server ${server.pid} on ${port}, up in ${Math.round(server.readyMs)} ms`)
  if (arg('reuse', false) !== true) {
    for (const row of rows) {
      const t0 = Date.now()
      seedSite(row, templatesDir)
      log(`seeded ${row._site.slug} in ${Math.round((Date.now() - t0) / 1000)} s`)
    }
  }
  browser = await chromium.launch()
  for (const row of rows) {
    const s = row._site
    const cookie = await signIn(s.url)
    const [first, ...others] = s.presets
    await chooseLook(s.url, cookie, s.look, first)
    const name = (what) => join(out, `${s.slug}-${what}.png`)
    const take = async (what, url, size) => {
      const failures = await shoot(browser, url, name(what), size)
      report.shots.push(`${s.slug}-${what}.png`)
      if (failures.length) report.failures[`${s.slug}-${what}`] = failures
    }
    await take('desktop', s.url, { width: 1440, height: 900, full: true })
    await take('phone', s.url, { width: 390, height: 844, full: true })
    await take('404', `${s.url}/tady-nic-neni`, { width: 1440, height: 900, full: true })
    for (const page of entryPagesOf(templatesDir, s.template)) {
      const slug = await firstSlug(s.url, page.entity)
      if (slug) await take(`entry-${page.prefix}`, `${s.url}/${page.prefix}/${slug}`, { width: 1440, height: 900, full: true })
    }
    for (const preset of others) {
      await chooseLook(s.url, cookie, s.look, preset)
      await take(preset, s.url, { width: 1440, height: 900, full: false })
    }
    await chooseLook(s.url, cookie, s.look, first)
    log(`${s.slug}: ${report.shots.filter((f) => f.startsWith(`${s.slug}-`)).length} shots`)
  }
}
finally {
  await browser?.close().catch(() => {})
  await server?.stop()
  if (server) log(`server ${server.pid} stopped`)
  if (arg('keep', false) !== true) await dropSites({ pgUrl, rows })
  writeFileSync(join(out, 'shots.json'), JSON.stringify(report, null, 2))
}
log(`${report.shots.length} shots in ${out}; ${Object.keys(report.failures).length} with browser errors`)
for (const [shot, failures] of Object.entries(report.failures)) console.log(`  ${shot}: ${failures.slice(0, 3).join(' | ')}`)
process.exit(0)
void appDir

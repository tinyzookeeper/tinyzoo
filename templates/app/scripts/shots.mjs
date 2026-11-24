// Pictures of every look of some templates, from a built server, to compare two builds
// (scripts/compare-shots.mjs): a template's own build before a change and the one app after it,
// say. The same sites, seed and moment give the same pictures, so any difference is the build's.
//
//   node templates/app/scripts/shots.mjs --entry <.output/server/index.mjs> --templates photographer,wedding
//        --out <folder> --pg postgres://user:pw@host:port/postgres --prefix tzshots_a_ [--model]
//        [--templates-dir <folder of templates, for looks and seeds>] [--port 4870] [--keep] [--reuse]
//        [--now 2026-11-25T09:40:00]
//
// For every look (one site each, seeded in that look): the home page in the default colours at
// 1440 × 900 and 390 × 844 (whole page, up to 8 000 px), the first screen in each other colour
// preset, one page of each kind of entry the template gives an address (an album…) and a
// missing address. `--model`: the rows name their content model (the one app). `--keep` keeps
// the databases; `--reuse` takes kept ones as they are (no seed).
//
// Time: the browser's clock stands still at one moment (`--now`, by default the first Wednesday
// from today on at 9.40), so what a look works out from "now" in the browser (open now, the next
// match, a countdown) is the same in both runs. The seeds count some dates from the day they run
// (an event some months ahead, this week's lunch menu): two runs to compare must be seeded on the
// same day. shots.json records both, and compare-shots.mjs warns when two runs differ in either.
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
const clock = arg('now', null) ? new Date(String(arg('now'))) : weekdayMorning()
if (Number.isNaN(clock.getTime())) {
  console.error(`--now is not a moment: ${arg('now')}`)
  process.exit(2)
}
/** The local day of a moment, 2026-11-24. */
const dayOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const MAX_HEIGHT = 8000

async function shoot(browser, url, file, { width, height, full }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: 'cs-CZ', colorScheme: 'light', reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const failures = []
  page.on('pageerror', (e) => failures.push(String(e?.message ?? e)))
  page.on('console', (m) => { if (m.type() === 'error' || /hydrat/i.test(m.text())) failures.push(m.text()) })
  await page.clock.setFixedTime(clock)
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
  const bottom = full ? Math.min(pageHeight, MAX_HEIGHT) : height
  await page.screenshot({
    path: file, animations: 'disabled', caret: 'hide',
    ...(full ? { fullPage: true, clip: { x: 0, y: 0, width, height: bottom } } : {}),
  })
  // The page's forms (a look draws its fields with the design's own components): how many, and
  // how many the picture shows whole. The first form below the picture gets a picture of its own.
  const forms = await page.evaluate(() => [...document.querySelectorAll('form')].map((f) => { const r = f.getBoundingClientRect(); return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY } }))
  const below = forms.findIndex((f) => f.bottom > bottom)
  let formFile = null
  if (full && below !== -1) {
    formFile = file.replace(/\.png$/, '-form.png')
    await page.locator('form').nth(below).screenshot({ path: formFile, animations: 'disabled', caret: 'hide' })
  }
  await ctx.close()
  return { failures, meta: { height: pageHeight, forms: forms.length, formsInPicture: forms.filter((f) => f.bottom <= bottom).length }, formFile }
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
const report = { entry, started: new Date().toISOString(), clock: clock.toISOString(), seededOn: null, shots: [], pages: {}, failures: {} }
try {
  server = await startServer({ entry, directoryFile, port, logFile: join(dataDir, 'server.log') })
  log(`server ${server.pid} on ${port}, up in ${Math.round(server.readyMs)} ms`)
  if (arg('reuse', false) !== true) {
    report.seededOn = dayOf(new Date())
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
      const { failures, meta, formFile } = await shoot(browser, url, name(what), size)
      report.shots.push(`${s.slug}-${what}.png`)
      if (formFile) report.shots.push(`${s.slug}-${what}-form.png`)
      report.pages[`${s.slug}-${what}`] = meta
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

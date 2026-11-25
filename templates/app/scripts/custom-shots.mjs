// Pictures of the two blocks that show a site's own content type (`custom_entries`, `custom_chosen`) and of
// one entry page, in every look of every hosted template, from a built server of the one app,
// with contact sheets that put the looks side by side.
//
//   node templates/app/scripts/custom-shots.mjs --entry templates/app/.output/server/index.mjs
//        --out <folder> --pg postgres://cms:cms@127.0.0.1:55481/postgres --prefix tzx_
//        [--templates a,b] [--keep] [--port <n>]
//
// Every look gets a site of its own (the one app, content types switched on), seeded with its
// template's demo content and set to the look. Each site then makes the type `custom_course` (courses
// with a picture, a short text, a date, a level, a price and a programme) through the admin
// routes, five entries of it, and puts five blocks at the end of its home page: a list of cards,
// three that must draw nothing (no source, a missing type, a chosen entry that does not exist),
// a list of rows and a block of two chosen entries.
//
// Pictures (under <out>/shots): the home page at 1440 × 900 and 390 × 844 (it must hold exactly
// three blocks), a picture of each block (`cards`, `rows`, `chosen`), the page of the entry with
// the longest title (`entry`, at most 3 000 px high), and `/kurzy/neexistuje`, which must be a 404.
// Sheets (under <out>/sheets): per template and width, `<template>-<width>-blocks.png` (one column
// per look, one row per block) and `<template>-<width>-entry.png`. 1440 pictures are halved.
// report.json lists every shot, every failure, browser errors and the seconds each phase took.
//
// `--prefix` must start with `tzx_`: the databases it names are dropped at the end, unless
// `--keep` (which keeps them and the data folder). `--templates` defaults to every template of
// the one app, in the order of templates/app/designs.ts. `--port` defaults to the first free from 4900.
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { arg, chooseLook, clean, dropSites, freePortFrom, log, makeSites, repoRoot, seedSiteAsync, signIn, sitesFor, sleep, startServer, writeDirectory } from './sites.mjs'

const SEEDS_AT_ONCE = 4
const SHOTS = ['cards', 'rows', 'chosen']
const WIDTHS = [{ width: 1440, height: 900, scale: 0.5 }, { width: 390, height: 844, scale: 1 }]
const ENTRY_MAX_HEIGHT = 3000

// ---------------------------------------------------------------------------------------------
// Contact sheets

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * One sheet: a column per look, a row per picture. `columns` is `[{ caption, files: [path|null] }]`
 * (a missing file leaves an empty framed box). Each picture is scaled by `scale`, framed by 1 px of
 * mid-grey, and set under a caption of its column; 24 px between and around, on white.
 * Returns `{ width, height }` of the sheet written to `file`.
 */
export async function composeSheet(sharp, columns, { scale, file }) {
  const GAP = 24
  const CAPTION = 36
  const FRAME = 1
  const FRAME_COLOR = '#999999'
  const rowCount = Math.max(1, ...columns.map((c) => c.files.length))
  // Every picture, scaled and framed.
  const cells = []
  for (const col of columns) {
    const list = []
    for (let r = 0; r < rowCount; r++) {
      const path = col.files[r]
      let buf = null
      let info = { width: Math.round(1440 * scale), height: 120 }
      if (path && existsSync(path)) {
        const meta = await sharp(path).metadata()
        const resized = await sharp(path).resize({ width: Math.max(1, Math.round(meta.width * scale)) }).png().toBuffer({ resolveWithObject: true })
        buf = resized.data
        info = resized.info
      }
      const framed = await sharp(buf ?? { create: { width: info.width, height: info.height, channels: 3, background: '#ffffff' } })
        .extend({ top: FRAME, bottom: FRAME, left: FRAME, right: FRAME, background: FRAME_COLOR })
        .png().toBuffer({ resolveWithObject: true })
      list.push({ buf: framed.data, width: framed.info.width, height: framed.info.height })
    }
    cells.push(list)
  }
  const colWidths = cells.map((list) => Math.max(...list.map((c) => c.width)))
  const rowHeights = Array.from({ length: rowCount }, (_, r) => Math.max(...cells.map((list) => list[r].height)))
  const width = GAP + colWidths.reduce((sum, w) => sum + w + GAP, 0)
  const height = GAP + CAPTION + rowHeights.reduce((sum, h) => sum + h + GAP, 0)
  const layers = []
  let x = GAP
  columns.forEach((col, ci) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${colWidths[ci]}" height="${CAPTION}"><text x="0" y="24" font-family="sans-serif" font-size="20" fill="#000000">${esc(col.caption)}</text></svg>`
    layers.push({ input: Buffer.from(svg), left: x, top: GAP })
    let y = GAP + CAPTION
    cells[ci].forEach((cell, r) => {
      layers.push({ input: cell.buf, left: x, top: y })
      y += rowHeights[r] + GAP
    })
    x += colWidths[ci] + GAP
  })
  mkdirSync(dirname(file), { recursive: true })
  await sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).composite(layers).png().toFile(file)
  return { width, height }
}

// ---------------------------------------------------------------------------------------------
// The demo content

/** A moment in Prague, today's date plus `days`, at a whole hour or half hour (`hour` may be 17.5). */
function pragueMoment(days, hour) {
  const base = new Date()
  base.setUTCDate(base.getUTCDate() + days)
  const [y, m, d] = [base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()]
  const h = Math.floor(hour)
  const min = Math.round((hour - h) * 60)
  const offsetOf = (at) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at)
    const get = (t) => Number(parts.find((p) => p.type === t).value)
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) - at.getTime()
  }
  const wall = Date.UTC(y, m, d, h, min)
  let at = new Date(wall - offsetOf(new Date(wall)))
  at = new Date(wall - offsetOf(at))
  return at.toISOString()
}

const para = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const programme = (intro, items) => ({
  type: 'doc',
  content: [
    para(intro),
    { type: 'bulletList', content: items.map((t) => ({ type: 'listItem', content: [para(t)] })) },
  ],
})

/** Five courses: the first has a long title, the second no picture, the third no date. */
function courses() {
  return [
    {
      title: 'Celodenní kurz pro úplné začátečníky, kteří si chtějí vyzkoušet všechno od základů a bez stresu',
      slug: 'celodenni-kurz-pro-uplne-zacatecniky', picture: true, level: 'zacatecnici', price: 2490, at: [21, 9],
      perex: 'Přijďte si na jeden den vyzkoušet všechno od začátku. Nic nemusíte umět ani mít s sebou, o vybavení se postaráme my. Dopoledne si ukážeme základy, odpoledne budete tvořit sami a my vám budeme nablízku.',
      program: programme('Co vás čeká během dne:', ['Seznámení a krátká ukázka', 'Základní postupy krok za krokem', 'Společný oběd v klidu', 'Vlastní práce s naší pomocí']),
    },
    {
      title: 'Večerní workshop pro začátečníky', slug: 'vecerni-workshop', picture: false, level: 'zacatecnici', price: 890, at: [9, 17.5],
      perex: 'Dvě hodiny, na které se nemusíte připravovat.',
      program: programme('Večer v pohodě:', ['Krátký úvod', 'Samostatná práce', 'Otázky a odpovědi']),
    },
    {
      title: 'Jarní intenzivní kurz', slug: 'jarni-intenzivni-kurz', picture: true, level: 'mirne-pokrocili', price: 1490, at: null,
      perex: 'Pro ty, kdo už něco umí a chtějí se posunout dál. Termín ještě upřesňujeme, napište nám a dáme vám vědět jako první.',
      program: programme('Kurz probíhá v několika setkáních:', ['Opakování základů', 'Složitější postupy', 'Vlastní projekt']),
    },
    {
      title: 'Dopolední setkání s praxí', slug: 'dopoledni-setkani', picture: true, level: 'mirne-pokrocili', price: 1490, at: [35, 9],
      perex: 'Malá skupina, hodně praxe a čas na vaše otázky. Odcházíte s hotovou prací a s tipy, jak pokračovat doma.',
      program: programme('Dopoledne plné praxe:', ['Rozcvička a opakování', 'Práce ve dvojicích', 'Rozbor výsledků']),
    },
    {
      title: 'Víkendový workshop pro malé skupiny', slug: 'vikendovy-workshop', picture: true, level: 'pokrocili', price: 2490, at: [70, 10],
      perex: 'Dva dny soustředěné práce pro nejvýše osm lidí. Hodí se pro každého, kdo chce na konkrétním projektu pracovat s naší podporou a zpětnou vazbou.',
      program: programme('Dva dny, jedno téma:', ['Sobota: zadání a první verze', 'Neděle: dopilování a společné představení']),
    },
  ]
}

const TYPE_FIELDS = [
  { key: 'cover', type: 'media', label: { cs: 'Obrázek', en: 'Picture' } },
  { key: 'perex', type: 'text', long: true, label: { cs: 'Krátký popis', en: 'Short description' } },
  { key: 'startsAt', type: 'datetime', allDay: false, label: { cs: 'Termín', en: 'Date' } },
  {
    key: 'level', type: 'select', label: { cs: 'Úroveň', en: 'Level' },
    options: [
      { value: 'zacatecnici', label: { cs: 'Začátečníci', en: 'Beginners' } },
      { value: 'mirne-pokrocili', label: { cs: 'Mírně pokročilí', en: 'Intermediate' } },
      { value: 'pokrocili', label: { cs: 'Pokročilí', en: 'Advanced' } },
    ],
  },
  { key: 'price', type: 'number', label: { cs: 'Cena', en: 'Price' } },
  { key: 'program', type: 'richtext', label: { cs: 'Program', en: 'Programme' } },
]

// ---------------------------------------------------------------------------------------------
// One site's setup, through the admin routes

const adminHeaders = (base, cookie) => ({ 'content-type': 'application/json', accept: 'application/json', origin: base, cookie })

async function call(base, cookie, method, path, body) {
  const res = await fetch(`${base}${path}`, { method, headers: adminHeaders(base, cookie), ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* not JSON */ }
  return { status: res.status, body: json, text }
}

/** Change the site's structure against its current version (tried again when the version moved on). */
async function changeModel(base, cookie, ops) {
  for (let round = 0; ; round++) {
    const m = await call(base, cookie, 'GET', '/api/cms/_model')
    if (m.status !== 200) throw new Error(`GET _model on ${base}: ${m.status} ${m.text.slice(0, 300)}`)
    const res = await call(base, cookie, 'POST', '/api/cms/_model', { baseVersion: m.body.version, ops })
    if (res.status === 409 && round < 4) continue
    if (res.status !== 200) throw new Error(`POST _model on ${base}: ${res.status} ${res.text.slice(0, 400)}`)
    return res.body
  }
}

/** Make the type and its entries, and put the five blocks at the end of the home page. Returns the long entry's slug. */
async function setUpSite(row) {
  const s = row._site
  const base = s.url
  const cookie = await signIn(base)
  await chooseLook(base, cookie, s.look, s.presets[0])

  await changeModel(base, cookie, [{
    op: 'type.add', name: 'custom_course', label: { cs: 'Kurzy', en: 'Courses' }, labelSingular: { cs: 'Kurz', en: 'Course' },
    page: { prefix: 'kurzy' }, publish: true,
  }])
  await changeModel(base, cookie, TYPE_FIELDS.map((field) => ({ op: 'field.add', type: 'custom_course', field })))
  await changeModel(base, cookie, [{ op: 'type.update', type: 'custom_course', page: { image: 'cover', summary: 'perex' } }])

  // The pictures the seed uploaded (images only), a different one for each entry, round again when there are few.
  const media = await call(base, cookie, 'GET', '/api/cms/_media?accept=image/*&limit=60')
  if (media.status !== 200) throw new Error(`media list on ${base}: ${media.status} ${media.text.slice(0, 300)}`)
  const pictures = (media.body.items ?? []).filter((m) => String(m.mime ?? '').startsWith('image/')).map((m) => m.id)
  if (!pictures.length) throw new Error(`no pictures in the media library of ${base}`)

  const made = []
  let n = 0
  for (const c of courses()) {
    const body = {
      title: c.title, slug: c.slug, status: 'published', perex: c.perex, level: c.level, price: c.price, program: c.program,
      ...(c.picture ? { cover: pictures[n++ % pictures.length] } : {}),
      ...(c.at ? { startsAt: pragueMoment(c.at[0], c.at[1]) } : {}),
    }
    const res = await call(base, cookie, 'POST', '/api/cms/custom_course', body)
    if (res.status !== 201) throw new Error(`entry ${c.slug} on ${base}: ${res.status} ${res.text.slice(0, 400)}`)
    made.push({ id: res.body.row.id, slug: res.body.row.slug ?? c.slug })
  }

  // The home page: the page entry with the slug `home`.
  const pages = await call(base, cookie, 'GET', '/api/cms/page?limit=100')
  if (pages.status !== 200) throw new Error(`page list on ${base}: ${pages.status} ${pages.text.slice(0, 300)}`)
  const home = (pages.body.rows ?? []).find((p) => p.slug === 'home')
  if (!home) throw new Error(`no home page on ${base}`)
  const block = (type, heading, text, source, layout) => ({ id: crypto.randomUUID(), type, heading, text, source, layout })
  const sections = [
    ...(home.sections ?? []),
    block('custom_entries', 'Kurzy a workshopy', 'Malé skupiny, hodně praxe a odpovědi na všechno, na co se zeptáte.', {
      type: 'custom_course', show: { image: 'cover', text: 'perex', date: 'startsAt', label: 'level', more: ['price', 'gone'] }, limit: 3,
    }, 'cards'),
    // Three that draw nothing.
    block('custom_entries', null, null, null, 'cards'),
    block('custom_entries', null, null, { type: 'custom_missing' }, 'cards'),
    block('custom_chosen', null, null, { type: 'custom_course', entries: [crypto.randomUUID()] }, 'cards'),
    block('custom_entries', 'Nejbližší termíny', null, {
      type: 'custom_course', show: { text: 'perex', date: 'startsAt', label: 'level' }, order: { by: 'startsAt', dir: 'asc' }, limit: 5,
    }, 'rows'),
    block('custom_chosen', 'Doporučujeme', null, {
      type: 'custom_course', show: { image: 'cover', text: 'perex', date: 'startsAt', label: 'level' }, entries: [made[3].id, made[1].id],
    }, null),
  ]
  const saved = await call(base, cookie, 'PATCH', `/api/cms/page/${home.id}`, { sections })
  if (saved.status !== 200) throw new Error(`home page of ${base}: ${saved.status} ${saved.text.slice(0, 600)}`)
  return made[0].slug
}

// ---------------------------------------------------------------------------------------------
// Pictures

/** Wait for the page to be still: pictures loaded (also those below the fold), fonts ready. */
async function settle(page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    for (const img of document.images) { img.loading = 'eager'; img.decoding = 'sync' }
    const end = Math.min(document.documentElement.scrollHeight, 8000)
    for (let y = 0; y <= end; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)) }
    window.scrollTo(0, 0)
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); setTimeout(r, 8000) }))))
    await Promise.all([...document.images].map((i) => i.decode?.().catch(() => {})))
    await document.fonts.ready
  })
  await page.waitForLoadState('networkidle')
  await sleep(400)
}

/** A fresh context and page like shots.mjs makes; `work(page, response)` takes the pictures. Returns the browser's complaints. */
async function visit(browser, url, { width, height }, work, { quiet = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: 'cs-CZ', colorScheme: 'light', reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const errors = []
  // The 404 page's own failed request is no error of the page.
  page.on('pageerror', (e) => errors.push(String(e?.message ?? e)))
  page.on('console', (m) => { if (!quiet && (m.type() === 'error' || /hydrat/i.test(m.text()))) errors.push(m.text()) })
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle' })
    await work(page, response)
  }
  finally { await ctx.close() }
  return errors
}

// ---------------------------------------------------------------------------------------------
// Main

async function main() {
  const entry = arg('entry')
  const out = arg('out')
  const pgUrl = arg('pg')
  const prefix = arg('prefix')
  if (!entry || !out || !pgUrl || typeof prefix !== 'string') {
    console.error('usage: custom-shots.mjs --entry <server> --out <folder> --pg <postgres url> --prefix tzx_ [--templates a,b] [--keep] [--port <n>]')
    process.exit(2)
  }
  if (!prefix.startsWith('tzx_')) {
    console.error(`--prefix must start with tzx_ (the databases it names are dropped): ${prefix}`)
    process.exit(2)
  }
  const keep = arg('keep', false) === true
  const templatesDir = join(repoRoot, 'templates')
  const all = [...readFileSync(join(templatesDir, 'app', 'designs.ts'), 'utf8').split('export const DESIGNS')[1].split('\n}')[0].matchAll(/^\s*(?:'([^']+)'|([A-Za-z0-9_]+))\s*(?::\s*\w+)?,\s*$/gm)].map((m) => m[1] ?? m[2])
  const wanted = arg('templates', null) === null ? all : String(arg('templates')).split(',').filter(Boolean)
  const unknown = wanted.filter((t) => !all.includes(t))
  if (unknown.length || !wanted.length) {
    console.error(`not templates of the one app: ${unknown.join(', ') || '(none given)'}; known: ${all.join(', ')}`)
    process.exit(2)
  }
  const { chromium } = createRequire(join(repoRoot, 'cloud', 'package.json'))('playwright')
  const sharp = createRequire(join(repoRoot, 'packages', 'cms', 'package.json'))('sharp')

  const outDir = resolve(out)
  const shotsDir = join(outDir, 'shots')
  const sheetsDir = join(outDir, 'sheets')
  mkdirSync(shotsDir, { recursive: true })
  mkdirSync(sheetsDir, { recursive: true })
  const dataDir = join(outDir, '..', `${prefix}data`)
  const port = Number(arg('port', 0)) || await freePortFrom(4900)

  const t0 = Date.now()
  const seconds = {}
  let phaseStart = t0
  const endPhase = (name) => { seconds[name] = Math.round((Date.now() - phaseStart) / 100) / 10; phaseStart = Date.now() }
  const report = { entry, started: new Date().toISOString(), templates: wanted, shots: [], sheets: [], failures: [], browserErrors: {}, seconds }
  const fail = (where, message) => { report.failures.push({ where, message: String(message) }); log(`FAILED ${where}: ${String(message).split('\n')[0]}`) }

  const sites = await sitesFor(templatesDir, wanted)
  const rows = await makeSites({ pgUrl, prefix, dataDir, port, sites, model: true })
  const directoryFile = join(dataDir, 'sites.json')
  writeDirectory(directoryFile, rows)
  endPhase('start')

  let server = null
  let browser = null
  try {
    server = await startServer({ entry, directoryFile, port, logFile: join(dataDir, 'server.log'), env: { NUXT_CMS_CUSTOM_TYPES: 'on' } })
    log(`server ${server.pid} on ${port}, up in ${Math.round(server.readyMs)} ms; ${rows.length} sites`)
    endPhase('server')

    // Seeds, a few at once.
    const seeded = []
    let next = 0
    await Promise.all(Array.from({ length: Math.min(SEEDS_AT_ONCE, rows.length) }, async () => {
      while (next < rows.length) {
        const row = rows[next++]
        const t = Date.now()
        try {
          await seedSiteAsync(row, templatesDir)
          seeded.push(row)
          log(`seeded ${row._site.slug} in ${Math.round((Date.now() - t) / 1000)} s`)
        }
        catch (e) { fail(`seed ${row._site.slug}`, e.message) }
      }
    }))
    endPhase('seeds')

    // The type, its entries and the blocks of each site.
    const ready = []
    for (const row of rows.filter((r) => seeded.includes(r))) {
      try {
        row._entrySlug = await setUpSite(row)
        ready.push(row)
        log(`set up ${row._site.slug}`)
      }
      catch (e) { fail(`setup ${row._site.slug}`, e.message) }
    }
    endPhase('setup')

    // Pictures.
    browser = await chromium.launch()
    for (const row of ready) {
      const s = row._site
      try {
        for (const size of WIDTHS) {
          const name = (what) => `${s.slug}-${what}-${size.width}.png`
          const key = (what) => `${s.slug}-${what}-${size.width}`
          const shot = (what) => { report.shots.push(name(what)); return join(shotsDir, name(what)) }

          const homeErrors = await visit(browser, s.url, size, async (page, response) => {
            if (response?.status() !== 200) fail(key('home'), `the home page answered ${response?.status()}`)
            await settle(page)
            const blocks = page.locator('section.custom-block')
            const count = await blocks.count()
            if (count !== 3) fail(key('home'), `${count} blocks of section.custom-block, expected 3`)
            // A header that stays on screen would lie over a block's picture: hidden, without moving anything.
            await page.evaluate(() => {
              for (const el of document.querySelectorAll('body *')) {
                const { position } = getComputedStyle(el)
                if (position === 'sticky' || position === 'fixed') el.style.visibility = 'hidden'
              }
            })
            for (let i = 0; i < Math.min(count, SHOTS.length); i++) {
              await blocks.nth(i).screenshot({ path: shot(SHOTS[i]), animations: 'disabled', caret: 'hide' })
            }
          })
          if (homeErrors.length) report.browserErrors[key('home')] = homeErrors

          const entryErrors = await visit(browser, `${s.url}/kurzy/${row._entrySlug}`, size, async (page, response) => {
            if (response?.status() !== 200) fail(key('entry'), `the entry page answered ${response?.status()}`)
            await settle(page)
            const height = await page.evaluate(() => document.documentElement.scrollHeight)
            await page.screenshot({
              path: shot('entry'), animations: 'disabled', caret: 'hide',
              fullPage: true, clip: { x: 0, y: 0, width: size.width, height: Math.min(height, ENTRY_MAX_HEIGHT) },
            })
          })
          if (entryErrors.length) report.browserErrors[key('entry')] = entryErrors

          await visit(browser, `${s.url}/kurzy/neexistuje`, size, async (_page, response) => {
            if (response?.status() !== 404) fail(key('missing'), `/kurzy/neexistuje answered ${response?.status()}, expected 404`)
          }, { quiet: true })
        }
        log(`${s.slug}: pictures done`)
      }
      catch (e) { fail(`pictures ${s.slug}`, e.message) }
    }
    endPhase('pictures')

    // Sheets.
    for (const template of wanted) {
      const mine = ready.filter((r) => r._site.template === template)
      if (!mine.length) continue
      for (const size of WIDTHS) {
        const file = (what) => join(shotsDir, what)
        const sheet = async (kind, filesOf) => {
          const name = `${template}-${size.width}-${kind}.png`
          try {
            const columns = mine.map((r) => ({ caption: r._site.look, files: filesOf(r._site).map(file) }))
            const dims = await composeSheet(sharp, columns, { scale: size.scale, file: join(sheetsDir, name) })
            report.sheets.push({ file: name, ...dims })
          }
          catch (e) { fail(`sheet ${name}`, e.message) }
        }
        await sheet('blocks', (s) => SHOTS.map((w) => `${s.slug}-${w}-${size.width}.png`))
        await sheet('entry', (s) => [`${s.slug}-entry-${size.width}.png`])
      }
    }
    endPhase('sheets')
  }
  catch (e) { fail('run', e.stack ?? e.message) }
  finally {
    await browser?.close().catch(() => {})
    await server?.stop()
    if (server) log(`server ${server.pid} stopped`)
    if (!keep) {
      try { await dropSites({ pgUrl, rows }) } catch (e) { fail('drop databases', e.message) }
      clean(dataDir)
    }
    seconds.total = Math.round((Date.now() - t0) / 100) / 10
    writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  }
  log(`${report.shots.length} shots, ${report.sheets.length} sheets, ${report.failures.length} failures, ${Object.keys(report.browserErrors).length} pictures with browser errors, ${seconds.total} s`)
  for (const f of report.failures) console.log(`  ${f.where}: ${f.message.split('\n')[0]}`)
  for (const [shot, errs] of Object.entries(report.browserErrors)) console.log(`  ${shot}: ${errs.slice(0, 2).join(' | ')}`)
  process.exit(0)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()

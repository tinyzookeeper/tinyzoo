// How many of the texts on a page the editor in the preview finds by itself (typing in the page, since
// part 2e of the builder), in every look of every hosted template, from a built server of the one app.
//
//   node templates/app/scripts/typing-coverage.mjs --entry templates/app/.output/server/index.mjs
//        --out <folder> --pg postgres://cms:cms@127.0.0.1:55481/postgres --prefix tzx_
//        [--templates a,b] [--keep] [--seeded] [--port <n>]
//
// Every look gets a site of its own (the one app), seeded with its template's demo content and set to the
// look, and a server with the editor in the preview switched on (NUXT_CMS_BUILDER=on). For the home page
// and one inner page (the page with the most blocks after it), the script opens the page's editor in the
// admin with the preview beside the form, as an owner would, and asks the page what it finds: for every
// block the page draws, its non-empty plain texts (the block's own and those of the items of its lists),
// its rich texts and its pictures, which of them a click finds (marked with `cmsField()`, or found by
// itself) and why the others are not (`not-on-page`: no element shows that text, the page shows another
// one; `longer-text`: it stands inside a longer text of one element; `split`: it is split across elements
// in a way the normal form does not join; `ambiguous`: two fields have it and the order does not tell;
// `hidden`: only elements hidden at the desktop width show it; `form`: only an option of a form's select
// shows it; `drawing`: only an SVG drawing shows it). The page is laid out at a desktop width.
//
// Since part 2f it also counts every visible text inside the blocks (the smallest elements with a text of
// their own) and what a click there finds: a field of the block (`own`), a field of an entry of a collection
// the page loaded (`entry`), a value of a global (`global`), or nothing (`none`), with the kind of the rest:
// `date` (a date or a time), `number`, `derived` (made from a value: shortened, joined, put in a sentence),
// `form` (a part of a form: a label, a button, an option) and `word` (a look's own word).
//
// Since part 2g a text of an entry or a global may be found by a form of a value that is no text (a number
// with its unit, a date as the page writes it, a choice by its name) or as several values in a row (the
// "from" and the "to" of one row): these are counted apart (`by form`), within `entry` and `global`.
//
// Writes <out>/report.json (every look, page, block and miss) and prints a line per look and the totals
// per template. `--prefix` must start with `tzx_` (or another `tz…_` of the run's own): the databases it names are dropped at the end, unless
// `--keep`. `--seeded` takes the sites of a run kept before (its data folder's sites.json) as they are,
// without making or seeding them again. `--port` defaults to the first free from 4900.
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { SERVICE, arg, chooseLook, clean, dropSites, freePortFrom, log, makeSites, repoRoot, seedSiteAsync, signIn, sitesFor, sleep, startServer, writeDirectory } from './sites.mjs'

const SEEDS_AT_ONCE = 4
const VIEWPORT = { width: 1600, height: 1000 }

/** The home page and the page with the most blocks after it: `[{ id, slug }]`. */
async function pagesOf(base, cookie) {
  const res = await fetch(`${base}/api/cms/page?limit=100`, { headers: { accept: 'application/json', origin: base, cookie } })
  if (!res.ok) throw new Error(`page list on ${base}: ${res.status}`)
  const rows = (await res.json()).rows ?? []
  const home = rows.find((p) => p.slug === 'home')
  const inner = rows.filter((p) => p !== home && Array.isArray(p.sections) && p.sections.length).sort((a, b) => b.sections.length - a.sections.length)[0]
  return [home, inner].filter(Boolean).map((p) => ({ id: p.id, slug: p.slug }))
}

/** Open a page's editor with the preview beside the form, and ask the page what it finds. */
async function measurePage(ctx, base, page) {
  const tab = await ctx.newPage()
  const errors = []
  tab.on('pageerror', (e) => errors.push(String(e?.message ?? e)))
  try {
    await tab.goto(`${base}/admin/page/${page.id}`, { waitUntil: 'load' })
    let frame = null
    for (let i = 0; i < 200 && !frame; i++) {
      for (const f of tab.frames()) {
        if (!/[?&]preview/.test(f.url())) continue
        const ready = await f.evaluate(() => typeof window.__cmsBuilderCoverage === 'function' && !!document.querySelector('[data-cms-block]')).catch(() => false)
        if (ready) frame = f
      }
      if (!frame) await sleep(100)
    }
    if (!frame) throw new Error('the preview did not switch the editor on')
    // Pictures below the fold get their address, and the page is still.
    await frame.evaluate(async () => {
      for (const img of document.images) img.loading = 'eager'
      await document.fonts.ready
      await new Promise((r) => setTimeout(r, 600))
    })
    const blocks = await frame.evaluate(() => window.__cmsBuilderCoverage())
    // What the page loaded through the content API (since 2f): kept once the tools are on, as its answers come.
    let last = -1
    for (let i = 0, still = 0; i < 60 && still < 5; i++) {
      const now = await frame.evaluate(() => (typeof window.__cmsBuilderRecords === 'function' ? window.__cmsBuilderRecords() : 0)).catch(() => 0)
      still = now > 0 && now === last ? still + 1 : 0
      last = now
      await sleep(100)
    }
    const texts = await frame.evaluate(() => (typeof window.__cmsBuilderTexts === 'function' ? window.__cmsBuilderTexts() : []))
    return { blocks, texts, errors }
  }
  finally { await tab.close() }
}

/** Totals of a list of blocks. */
function tally(blocks) {
  const t = { text: 0, textFound: 0, textMarked: 0, itemText: 0, itemTextFound: 0, rich: 0, richFound: 0, pictures: 0, picturesFound: 0, reasons: {} }
  for (const b of blocks) {
    for (const f of b.found) {
      if (f.kind === 'rich') { t.rich++; t.richFound++; continue }
      t.text++; t.textFound++
      if (f.marked) t.textMarked++
      if (f.inItem) { t.itemText++; t.itemTextFound++ }
    }
    for (const m of b.missed) {
      if (m.kind === 'rich') { t.rich++; continue }
      t.text++
      if (m.inItem) t.itemText++
      t.reasons[m.reason] = (t.reasons[m.reason] ?? 0) + 1
    }
    t.pictures += b.pictures.total
    t.picturesFound += b.pictures.found
  }
  return t
}

/** Totals of the visible texts of a page's blocks: what they resolve to, and the kinds of the rest. */
function tallyTexts(blocks) {
  const t = { pieces: 0, own: 0, entry: 0, global: 0, none: 0, entryByForm: 0, globalByForm: 0, rest: {} }
  for (const b of blocks ?? []) {
    for (const p of b.pieces) {
      t.pieces++
      t[p.res]++
      if (p.res === 'none') t.rest[p.rest] = (t.rest[p.rest] ?? 0) + 1
      // Found by a form of a value, or as values in a row (since 2g).
      if (p.by === 'value' && (p.res === 'entry' || p.res === 'global')) t[`${p.res}ByForm`]++
    }
  }
  return t
}

function addTexts(into, t) {
  for (const [k, v] of Object.entries(t)) {
    if (k === 'rest') for (const [r, n] of Object.entries(v)) into.rest[r] = (into.rest[r] ?? 0) + n
    else into[k] = (into[k] ?? 0) + v
  }
}

const textsLine = (t) => `visible texts ${t.pieces}: own ${t.own}, entry ${t.entry}, global ${t.global}, of them by form ${(t.entryByForm ?? 0) + (t.globalByForm ?? 0)} (resolved ${t.own + t.entry + t.global}, ${pct(t.own + t.entry + t.global, t.pieces)}), none ${t.none}${Object.keys(t.rest).length ? ` (${Object.entries(t.rest).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(', ')})` : ''}`

function add(into, t) {
  for (const [k, v] of Object.entries(t)) {
    if (k === 'reasons') for (const [r, n] of Object.entries(v)) into.reasons[r] = (into.reasons[r] ?? 0) + n
    else into[k] = (into[k] ?? 0) + v
  }
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10} %` : '-')
const line = (t) => `texts ${t.textFound}/${t.text} (${pct(t.textFound, t.text)}; without a form's choices ${t.textFound}/${t.text - (t.reasons.form ?? 0)}, ${pct(t.textFound, t.text - (t.reasons.form ?? 0))}; marked ${t.textMarked}; in lists ${t.itemTextFound}/${t.itemText}), rich ${t.richFound}/${t.rich}, pictures ${t.picturesFound}/${t.pictures}${Object.keys(t.reasons).length ? `; missed: ${Object.entries(t.reasons).map(([r, n]) => `${r} ${n}`).join(', ')}` : ''}`

async function main() {
  const entry = arg('entry')
  const out = arg('out')
  const pgUrl = arg('pg')
  const prefix = arg('prefix')
  if (!entry || !out || !pgUrl || typeof prefix !== 'string') {
    console.error('usage: typing-coverage.mjs --entry <server> --out <folder> --pg <postgres url> --prefix tzx_ [--templates a,b] [--keep] [--seeded] [--port <n>]')
    process.exit(2)
  }
  if (!/^tz[a-z0-9]+_/.test(prefix)) {
    console.error(`--prefix must start with tzx_ or another tz…_ of its own (the databases it names are dropped): ${prefix}`)
    process.exit(2)
  }
  const keep = arg('keep', false) === true
  const seededBefore = arg('seeded', false) === true
  const templatesDir = join(repoRoot, 'templates')
  const all = [...readFileSync(join(templatesDir, 'app', 'designs.ts'), 'utf8').split('export const DESIGNS')[1].split('\n}')[0].matchAll(/^\s*(?:'([^']+)'|([A-Za-z0-9_]+))\s*(?::\s*\w+)?,\s*$/gm)].map((m) => m[1] ?? m[2])
  const wanted = arg('templates', null) === null ? all : String(arg('templates')).split(',').filter(Boolean)
  const unknown = wanted.filter((t) => !all.includes(t))
  if (unknown.length || !wanted.length) {
    console.error(`not templates of the one app: ${unknown.join(', ') || '(none given)'}; known: ${all.join(', ')}`)
    process.exit(2)
  }
  const { chromium } = createRequire(join(repoRoot, 'cloud', 'package.json'))('playwright')

  const outDir = resolve(out)
  mkdirSync(outDir, { recursive: true })
  const dataDir = join(outDir, '..', `${prefix}data`)
  const directoryFile = join(dataDir, 'sites.json')
  const port = Number(arg('port', 0)) || await freePortFrom(4900)
  const t0 = Date.now()
  const report = { entry, started: new Date().toISOString(), templates: wanted, looks: [], failures: [], totals: {} }
  const fail = (where, message) => { report.failures.push({ where, message: String(message) }); log(`FAILED ${where}: ${String(message).split('\n')[0]}`) }

  const sites = await sitesFor(templatesDir, wanted)
  let rows
  if (seededBefore) {
    if (!existsSync(directoryFile)) throw new Error(`--seeded: no ${directoryFile}`)
    const kept = JSON.parse(readFileSync(directoryFile, 'utf8')).sites
    rows = sites.map((s) => {
      const slug = `${s.template}-${s.look}`
      const row = kept.find((r) => r.id === slug)
      if (!row) throw new Error(`--seeded: no site ${slug} in ${directoryFile}`)
      const url = `http://${slug}.localhost:${port}`
      return { ...row, publicUrl: url, _site: { ...s, slug, database: new URL(row.databaseUrl).pathname.slice(1), url } }
    })
  }
  else rows = await makeSites({ pgUrl, prefix, dataDir, port, sites, model: true })
  writeDirectory(directoryFile, rows)

  let server = null
  let browser = null
  try {
    server = await startServer({ entry, directoryFile, port, logFile: join(dataDir, 'server.log'), env: { NUXT_CMS_CUSTOM_TYPES: 'on', NUXT_CMS_BUILDER: 'on' } })
    log(`server ${server.pid} on ${port}; ${rows.length} sites`)
    let ready = rows
    if (!seededBefore) {
      const seeded = []
      let next = 0
      await Promise.all(Array.from({ length: Math.min(SEEDS_AT_ONCE, rows.length) }, async () => {
        while (next < rows.length) {
          const row = rows[next++]
          try {
            await seedSiteAsync(row, templatesDir)
            const cookie = await signIn(row._site.url)
            await chooseLook(row._site.url, cookie, row._site.look, row._site.presets[0])
            seeded.push(row)
            log(`seeded ${row._site.slug}`)
          }
          catch (e) { fail(`seed ${row._site.slug}`, e.message) }
        }
      }))
      ready = rows.filter((r) => seeded.includes(r))
    }

    browser = await chromium.launch()
    for (const row of ready) {
      const s = row._site
      const look = { template: s.template, look: s.look, pages: [] }
      const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, locale: 'cs-CZ', colorScheme: 'light', reducedMotion: 'reduce' })
      try {
        // The preview beside the form, as the editor remembers it.
        await ctx.addInitScript(() => { try { localStorage.setItem('cms-preview:page', '1') } catch { /* no storage */ } })
        const login = await ctx.request.post(`${s.url}/api/cms/_auth/login`, { headers: { origin: s.url, accept: 'application/json' }, data: { email: SERVICE.email, password: SERVICE.password } })
        if (!login.ok()) throw new Error(`sign-in: ${login.status()}`)
        const cookie = await signIn(s.url)
        for (const page of await pagesOf(s.url, cookie)) {
          try {
            const { blocks, texts, errors } = await measurePage(ctx, s.url, page)
            const t = tally(blocks)
            look.pages.push({ slug: page.slug, totals: t, texts: tallyTexts(texts), blocks, textBlocks: texts, errors })
            if (errors.length) fail(`${s.slug} ${page.slug}`, `page errors: ${errors.slice(0, 2).join(' | ')}`)
          }
          catch (e) { fail(`${s.slug} ${page.slug}`, e.message) }
        }
      }
      catch (e) { fail(s.slug, e.message) }
      finally { await ctx.close() }
      look.totals = { reasons: {} }
      look.texts = { rest: {} }
      for (const p of look.pages) {
        add(look.totals, p.totals)
        addTexts(look.texts, p.texts)
      }
      report.looks.push(look)
      log(`${s.slug.padEnd(30)} ${line(look.totals)}`)
      log(`${''.padEnd(30)} ${textsLine(look.texts)}`)
    }
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
  }

  // Totals per template, and the misses by reason with a few examples.
  const examples = {}
  report.texts = {}
  for (const template of wanted) {
    const totals = { reasons: {} }
    const texts = { rest: {} }
    for (const l of report.looks.filter((x) => x.template === template)) {
      add(totals, l.totals)
      addTexts(texts, l.texts ?? { rest: {} })
    }
    report.totals[template] = totals
    report.texts[template] = texts
  }
  // The texts that resolve to nothing, most frequent first, by their kind.
  const unresolved = {}
  for (const l of report.looks) {
    for (const p of l.pages) {
      for (const b of p.textBlocks ?? []) {
        for (const x of b.pieces) {
          if (x.res !== 'none') continue
          const key = `${l.template}/${b.type} ${x.rest}: «${x.text}»`
          unresolved[key] ??= { count: 0, looks: new Set() }
          unresolved[key].count++
          unresolved[key].looks.add(l.look)
        }
      }
    }
  }
  report.unresolved = Object.entries(unresolved).sort((a, b) => b[1].count - a[1].count).slice(0, 400).map(([key, v]) => ({ key, count: v.count, looks: [...v.looks] }))
  for (const l of report.looks) {
    for (const p of l.pages) {
      for (const b of p.blocks) {
        for (const m of b.missed) {
          if (m.kind === 'rich') continue
          const key = `${l.template}/${b.type}.${m.field.replace(/@.*/, '[]')}: ${m.reason}`
          examples[key] ??= { count: 0, looks: new Set(), value: m.value }
          examples[key].count++
          examples[key].looks.add(l.look)
        }
      }
    }
  }
  report.misses = Object.entries(examples).sort((a, b) => b[1].count - a[1].count).map(([key, v]) => ({ key, count: v.count, looks: [...v.looks], value: v.value }))
  report.seconds = Math.round((Date.now() - t0) / 1000)
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))

  console.log('\nper template:')
  const grand = { reasons: {} }
  for (const [template, t] of Object.entries(report.totals)) {
    add(grand, t)
    console.log(`  ${template.padEnd(14)} ${line(t)}`)
  }
  console.log(`  ${'all'.padEnd(14)} ${line(grand)}`)
  console.log('\nvisible texts per template (since 2f):')
  const grandTexts = { rest: {} }
  for (const [template, t] of Object.entries(report.texts)) {
    addTexts(grandTexts, t)
    console.log(`  ${template.padEnd(14)} ${textsLine(t)}`)
  }
  console.log(`  ${'all'.padEnd(14)} ${textsLine(grandTexts)}`)
  console.log('\ntexts that resolve to nothing (most frequent first):')
  for (const u of report.unresolved.slice(0, 60)) console.log(`  ${String(u.count).padStart(3)} ${u.key}`)
  console.log('\nmisses (most frequent first):')
  for (const m of report.misses.slice(0, 60)) console.log(`  ${String(m.count).padStart(3)} ${m.key}  «${m.value}»`)
  console.log(`\n${report.looks.length} looks, ${report.failures.length} failures, ${report.seconds} s`)
  for (const f of report.failures) console.log(`  ${f.where}: ${f.message.split('\n')[0]}`)
  process.exit(0)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()

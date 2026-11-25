// An owner's own main colour on real pages: does any text become harder to read than with the
// preset? The palette's rules keep the pairs readable that a look's code shows together
// (templates/kit/look-pairs.ts); that scan reads one rule and one element at a time. This script
// asks the browser instead: it opens every look's home page from a built server, measures the
// contrast of every text against the background the page really draws behind it, with the
// preset and then with each colour given, and lists the texts that crossed a mark.
//
//   node templates/app/scripts/own-contrast.mjs --entry <.output/server/index.mjs> --templates photographer,wedding
//        --pg postgres://user:pw@host:port/postgres --prefix tzown_ --model --own '#2e7d32,#f59e0b'
//        [--out <file.json>] [--presets all] [--templates-dir <folder>] [--port 4880] [--keep] [--reuse]
//
// For every look (one site each, seeded in that look), in its default colours (`--presets all`:
// in each of its presets): the home page at 1440 × 900, whole. A text *crossed a mark* when its
// contrast was at least 4.5 with the preset and is under 4.5 with the colour, or was at least 3
// and is under 3 (the two marks of the palette's rules, as WCAG counts contrast). Texts over a
// picture or a gradient are left out: no single colour is behind them. A text whose own colour
// or background is partly transparent is measured as the browser mixes it over what is behind.
//
// The exit code is 0 either way: this is a report for the eye, not a gate. It says where a
// look's code puts the main colour and another colour together in a way the scan cannot see.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { arg, chooseLook, dropSites, freePortFrom, log, looksOf, makeSites, repoRoot, seedSite, signIn, sitesFor, startServer, writeDirectory } from './sites.mjs'

const entry = arg('entry')
const pgUrl = arg('pg')
const prefix = arg('prefix')
const templatesDir = resolve(arg('templates-dir', join(repoRoot, 'templates')))
const templates = String(arg('templates', '')).split(',').filter(Boolean)
const colours = String(arg('own', '')).split(',').map((c) => c.trim().toLowerCase()).filter(Boolean)
if (!entry || !pgUrl || !prefix || !templates.length || !colours.length || colours.some((c) => !/^#[0-9a-f]{6}$/.test(c))) {
  console.error('usage: own-contrast.mjs --entry <server> --templates a,b --pg <postgres url> --prefix <db prefix_> --own <#rrggbb,#rrggbb> [--model] [--presets all] [--out <file.json>] [--keep] [--reuse]')
  process.exit(2)
}
const allPresets = arg('presets', '') === 'all'
const { chromium } = createRequire(join(repoRoot, 'cloud', 'package.json'))('playwright')

/** Every text of the page with the colour behind it, in document order. Runs in the browser. */
function measure() {
  const parse = (value) => {
    const m = /rgba?\(([^)]+)\)/.exec(value)
    if (!m) return null
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
  }
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 })
  // The colour the page draws behind an element: its nearest filled backgrounds, mixed down to
  // an opaque one. Null where a picture or a gradient is in the way.
  const behind = (el) => {
    const layers = []
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.backgroundImage && s.backgroundImage !== 'none') return null
      const c = parse(s.backgroundColor)
      if (c && c.a > 0) {
        layers.push(c)
        if (c.a === 1) break
      }
    }
    let colour = { r: 255, g: 255, b: 255, a: 1 }
    if (layers.length && layers[layers.length - 1].a === 1) colour = layers.pop()
    for (const layer of layers.reverse()) colour = over(layer, colour)
    return colour
  }
  const out = []
  const seen = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.trim()
    const el = walker.currentNode.parentElement
    if (!text || !el || seen.has(el)) continue
    seen.add(el)
    const s = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    if (s.visibility === 'hidden' || s.display === 'none' || !box.width || !box.height) continue
    let opacity = 1
    for (let e = el; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity)
    const bg = behind(el)
    const fg = parse(s.color)
    if (!fg || !bg || opacity < 0.05) { out.push(null); continue }
    const shown = over({ ...fg, a: fg.a * opacity }, bg)
    out.push({ text: text.slice(0, 60), tag: el.tagName.toLowerCase(), cls: String(el.className?.baseVal ?? el.className ?? '').slice(0, 80), fg: [shown.r, shown.g, shown.b], bg: [bg.r, bg.g, bg.b], raw: [fg.r, fg.g, fg.b], faded: fg.a * opacity < 0.995 })
  }
  return out
}

const linear = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

const port = Number(arg('port', 0)) || await freePortFrom(4880)
const dataDir = resolve(repoRoot, 'templates', 'app', '.data', `${prefix}data`)
const sites = await sitesFor(templatesDir, templates)
const rows = await makeSites({ pgUrl, prefix, dataDir, port, sites, model: arg('model', false) === true, keep: arg('reuse', false) === true })
const directoryFile = join(dataDir, 'sites.json')
writeDirectory(directoryFile, rows)

let server = null
let browser = null
const report = { entry, started: new Date().toISOString(), colours, looks: [] }
try {
  server = await startServer({ entry, directoryFile, port, logFile: join(dataDir, 'server.log') })
  log(`server ${server.pid} on ${port}`)
  if (arg('reuse', false) !== true) for (const row of rows) seedSite(row, templatesDir)
  browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'cs-CZ', colorScheme: 'light', reducedMotion: 'reduce' })
  const read = async (url) => {
    const page = await ctx.newPage()
    await page.goto(url, { waitUntil: 'networkidle' })
    const own = await page.evaluate(() => document.documentElement.getAttribute('data-own'))
    const texts = await page.evaluate(measure)
    await page.close()
    return { own, texts }
  }
  for (const row of rows) {
    const s = row._site
    const cookie = await signIn(s.url)
    const looks = await looksOf(templatesDir, s.template)
    for (const preset of allPresets ? s.presets : s.presets.slice(0, 1)) {
      await chooseLook(s.url, cookie, s.look, preset, null)
      const before = await read(s.url)
      // A colour of the page as the look names it: the preset's variable with that value, else the colour.
      const vars = looks.resolve(s.look, preset).preset.vars
      const named = (c) => Object.keys(vars).find((name) => String(vars[name]).toLowerCase() === hex(c)) ?? hex(c)
      for (const colour of colours) {
        await chooseLook(s.url, cookie, s.look, preset, colour)
        const after = await read(s.url)
        const crossed = []
        if (after.texts.length === before.texts.length) {
          after.texts.forEach((now, i) => {
            const was = before.texts[i]
            if (!now || !was) return
            const had = contrast(was.fg, was.bg)
            const has = contrast(now.fg, now.bg)
            const mark = had >= 4.5 ? 4.5 : had >= 3 ? 3 : 0
            if (mark && has < mark - 0.05) crossed.push({ text: now.text, tag: now.tag, cls: now.cls, pair: `${named(was.raw)} on ${named(was.bg)}${was.faded ? ' (faded)' : ''}`, has, was: `${hex(was.fg)} on ${hex(was.bg)} (${had.toFixed(2)})`, now: `${hex(now.fg)} on ${hex(now.bg)} (${has.toFixed(2)})`, mark })
          })
        }
        report.looks.push({ site: s.slug, look: s.look, preset, colour, shown: after.own, texts: after.texts.filter(Boolean).length, sameShape: after.texts.length === before.texts.length, crossed })
        log(`${s.slug} ${preset} ${colour} → ${after.own}: ${after.texts.filter(Boolean).length} texts, ${crossed.length} crossed a mark${after.texts.length === before.texts.length ? '' : ' (the page changed shape: not compared)'}`)
      }
    }
    await chooseLook(s.url, cookie, s.look, s.presets[0], null)
  }
}
finally {
  await browser?.close().catch(() => {})
  await server?.stop()
  if (arg('keep', false) !== true) await dropSites({ pgUrl, rows })
}
const out = arg('out', null)
if (typeof out === 'string') writeFileSync(out, JSON.stringify(report, null, 2))
const runs = report.looks.length
const bad = report.looks.filter((l) => l.crossed.length)
console.log(`\n${runs} pages measured (${new Set(report.looks.map((l) => l.site)).size} looks × ${colours.length} colours${allPresets ? ' × their presets' : ''}); ${runs - bad.length} with no text across a mark, ${bad.length} with some`)
for (const l of bad) {
  console.log(`\n${l.site} ${l.preset} ${l.colour} → ${l.shown}: ${l.crossed.length} of ${l.texts} texts`)
  for (const c of l.crossed.slice(0, 4)) console.log(`  “${c.text}” <${c.tag} class="${c.cls}"> ${c.pair}: was ${c.was}, now ${c.now}`)
}
// The pairs behind them, look by look: what a look's `own.also` should name (templates/kit/palette.ts).
const pairs = new Map()
for (const l of bad) for (const c of l.crossed) {
  const key = `${l.site}: ${c.pair}`
  const e = pairs.get(key) ?? pairs.set(key, { texts: 0, lowest: Infinity }).get(key)
  e.texts++
  e.lowest = Math.min(e.lowest, c.has)
}
if (pairs.size) console.log('\nthe pairs, as the preset names them:')
for (const [key, e] of [...pairs].sort()) console.log(`  ${key}: ${e.texts} texts, lowest ${e.lowest.toFixed(2)}`)
const all = report.looks.flatMap((l) => l.crossed.map((c) => c.has))
console.log(`\n${all.length} texts across a mark, ${all.filter((x) => x < 3).length} of them under 3, of ${report.looks.reduce((n, l) => n + l.texts, 0)} texts measured`)
process.exit(0)

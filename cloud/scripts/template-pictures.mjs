// The pictures of the templates that the gallery, the look step and the "name your site"
// step show (cloud/public/templates/), and what is known about them
// (cloud/shared/template-pictures.json). Run again whenever a design or a built template changes:
//
//   pnpm --filter tinyzoo-cloud pictures            # the planned templates, from the designs folder
//   pnpm --filter tinyzoo-cloud pictures --real     # the built templates, from real sites it makes
//   pnpm --filter tinyzoo-cloud pictures --designs /path/to/template-designs
//
// From the designs (template-designs/<slug>/): a look is alive when <slug>/<a|b|c|d>.html exists
// (*.dropped.html and *.v1.html are rejected or old versions); its name is the "## A · Name"
// heading of <slug>/notes.md; its picture is <slug>/shots/<letter>-top.jpg (the first screen,
// 1440 × 900). Each look gets
//   <slug>/<look>-card.webp    800 × 500, the gallery's card
//   <slug>/<look>-thumb.webp   240 × 150, the small pictures of a card's other looks
//
// From real sites (--real; needs the templates built and Postgres): the script starts a cloud
// app of its own, makes one site of every look of every built template, and takes the same two
// pictures of each, plus
//   <id>/<look>-top.webp       1440 × 900, the first screen with the site's name left out: the
//                              "name your site" step writes the typed name there
//   <id>/<look>-tall.webp      900 × 1350, the top of the home page, for the look step
// It also measures where and how the site writes its name (the wordmark: place, size, colour,
// typeface) and copies the typeface's files to public/templates/fonts/, so the typed name can be
// set in it.
//
// A template without looks (Basic) has one set of pictures, named after the template.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { arg, cleanSites, cloudDir, dbUrl, dropDatabase, freePortFrom, log, recreateDatabase, repoRoot, sleep, startCloud, templateEntries, waitFor } from './lib.mjs'

const sharp = createRequire(join(repoRoot, 'packages/cms/package.json'))('sharp')
const out = join(cloudDir, 'public', 'templates')
const dataFile = join(cloudDir, 'shared', 'template-pictures.json')
const real = arg('real', false) === true
const keep = arg('keep', false) === true // --real --keep: the cloud app's database and the sites stay, to look at

/** "Celý rok" → "cely-rok": a look's id is its Czech name as a plain word. */
export const lookId = (name) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** The designs folder: given, or beside the repository, or (in a git worktree) beside the main checkout. */
function designsDir() {
  const given = arg('designs', null) || process.env.TEMPLATE_DESIGNS
  if (given && given !== true) return given
  const here = join(repoRoot, 'template-designs')
  if (existsSync(here)) return here
  try {
    const common = execFileSync('git', ['-C', repoRoot, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim()
    const main = join(dirname(common), 'template-designs')
    if (existsSync(main)) return main
  }
  catch { /* not a git checkout */ }
  return here
}

const read = () => (existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, 'utf8')) : {})
const write = (data) => {
  const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]))
  writeFileSync(dataFile, `${JSON.stringify(sorted, null, 2)}\n`)
}

const webp = (input, width, height, file, quality) => sharp(input).resize(width, height, { fit: 'cover', position: 'top' }).webp({ quality, effort: 6 }).toFile(file)

// ── the planned templates, from the designs ─────────────────────────────────────

async function fromDesigns() {
  const dir = designsDir()
  if (!existsSync(dir)) {
    console.error(`The designs folder is missing: ${dir}\nSay where it is: pnpm --filter tinyzoo-cloud pictures --designs <folder>`)
    process.exit(2)
  }
  log(`designs: ${dir}`)
  const data = read()
  const built = new Set(Object.keys(templateEntries))
  let looks = 0
  for (const slug of readdirSync(dir).sort()) {
    if (slug.startsWith('_') || slug.startsWith('.') || !existsSync(join(dir, slug, 'notes.md'))) continue
    // A built template's pictures come from real sites (--real), not from its designs.
    if (built.has(slug)) continue
    const names = new Map([...readFileSync(join(dir, slug, 'notes.md'), 'utf8').matchAll(/^## ([A-D]) · ([^\n(]+)/gm)].map((m) => [m[1].toLowerCase(), m[2].trim()]))
    const alive = ['a', 'b', 'c', 'd'].filter((l) => existsSync(join(dir, slug, `${l}.html`)))
    if (!alive.length) continue
    mkdirSync(join(out, slug), { recursive: true })
    const entry = { source: 'design', looks: [] }
    for (const letter of alive) {
      const name = names.get(letter)
      const shot = join(dir, slug, 'shots', `${letter}-top.jpg`)
      if (!name) throw new Error(`${slug}/notes.md has no "## ${letter.toUpperCase()} · Name" heading for ${letter}.html`)
      if (!existsSync(shot)) throw new Error(`${shot} is missing`)
      const id = lookId(name)
      await webp(shot, 800, 500, join(out, slug, `${id}-card.webp`), 80)
      await webp(shot, 240, 150, join(out, slug, `${id}-thumb.webp`), 74)
      entry.looks.push({ id, name, design: letter })
      looks++
    }
    // Pictures of looks that are gone (a design dropped since the last run).
    const keep = new Set(entry.looks.flatMap((l) => [`${l.id}-card.webp`, `${l.id}-thumb.webp`]))
    for (const f of readdirSync(join(out, slug))) if (!keep.has(f)) rmSync(join(out, slug, f))
    data[slug] = entry
    log(`  ${slug}: ${entry.looks.map((l) => l.name).join(', ')}`)
  }
  write(data)
  log(`${looks} looks of ${Object.values(data).filter((t) => t.source === 'design').length} planned templates → ${out}`)
}

// ── the built templates, from real sites ────────────────────────────────────────

// What each built template is called in its pictures: the name its demo content is about.
const DEMO = {
  basic: { name: 'Pekárna Na Růžku', looks: [null] },
  photographer: { name: 'Johana Loudová', looks: ['atelier', 'negativ', 'zapisnik'] },
}
// Where a template writes the site's name. Photographer marks it (data-wordmark); the starter's
// header is plain markup.
const WORDMARK = { basic: 'header .site-header > a > span', photographer: 'header [data-wordmark]' }

/** Where and how the page writes the site's name, in CSS pixels of a 1440 px wide screen. */
const measure = (page, selector) => page.evaluate((selector) => {
  const el = [...document.querySelectorAll(selector)].find((e) => e.getClientRects().length)
  if (!el) return null
  const range = document.createRange()
  range.selectNodeContents(el)
  const box = range.getBoundingClientRect()
  const s = getComputedStyle(el)
  const family = s.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '')
  // Up to where the name may run: the nearest thing to its right in the same row.
  const row = [...document.querySelectorAll('header a, header button, header nav')].map((e) => e.getBoundingClientRect())
    .filter((r) => r.width && r.left > box.right + 4 && r.top < box.bottom && r.bottom > box.top)
  const limit = Math.min(innerWidth * 0.72, ...row.map((r) => r.left - 24))
  // The typeface's files: the @font-face rules of this family that hold Czech letters ("A" is
  // in the Latin file, "ě" in the extended one), in the styles the name is written in.
  const czech = (range) => !range || range.split(',').some((part) => {
    const [from, to = from] = part.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h.replace(/\?/g, '0'), 16))
    return [0x41, 0x11b].some((c) => c >= from && c <= to)
  })
  const weight = Number(s.fontWeight) || 400
  const styles = new Set(['normal', ...[...el.querySelectorAll('*')].map((e) => getComputedStyle(e).fontStyle)])
  const fonts = []
  for (const sheet of document.styleSheets) {
    let rules = []
    try { rules = [...sheet.cssRules] } catch { continue }
    for (const rule of rules) {
      if (!(rule instanceof CSSFontFaceRule)) continue
      const d = rule.style
      if (d.getPropertyValue('font-family').trim().replace(/^["']|["']$/g, '') !== family) continue
      const [from, to = from] = (d.getPropertyValue('font-weight') || '400').split(/\s+/).map(Number)
      if (weight < from || weight > to) continue
      const style = d.getPropertyValue('font-style') || 'normal'
      const range = d.getPropertyValue('unicode-range')
      if (!styles.has(style) || !czech(range)) continue
      const src = /url\(["']?([^"')]+\.woff2[^"')]*)["']?\)/.exec(d.getPropertyValue('src'))?.[1]
      if (src) fonts.push({ src: new URL(src, sheet.href || location.href).pathname, weight: d.getPropertyValue('font-weight') || '400', style, stretch: d.getPropertyValue('font-stretch') || '', range })
    }
  }
  // A name in the middle of the header stays in the middle, however long it is.
  const centred = Math.abs((box.left + box.right) / 2 - innerWidth / 2) < 3
  const left = [...document.querySelectorAll('header a, header button, header nav')].map((e) => e.getBoundingClientRect())
    .filter((r) => r.width && r.right < box.left - 4 && r.top < box.bottom && r.bottom > box.top)
  const room = centred ? 2 * Math.min(innerWidth / 2 - Math.max(0, ...left.map((r) => r.right + 24)), limit - innerWidth / 2) : limit - box.left
  return {
    anchor: centred ? 'center' : 'left',
    // "Johana *Loudová*": the look sets the last word in italics.
    italicLast: !!el.querySelector('em'),
    x: Math.round((centred ? innerWidth / 2 : box.left) * 10) / 10, y: Math.round((box.top + box.height / 2) * 10) / 10, maxWidth: Math.round(room),
    size: parseFloat(s.fontSize), family, weight, stretch: s.fontStretch === '100%' ? '' : s.fontStretch,
    color: s.color, transform: s.textTransform === 'none' ? '' : s.textTransform, spacing: s.letterSpacing === 'normal' ? '' : s.letterSpacing,
    fonts,
  }
}, selector)

async function fromRealSites() {
  const { chromium } = await import('playwright')
  for (const [id, entry] of Object.entries(templateEntries)) {
    if (existsSync(entry)) continue
    console.error(`The template "${id}" is not built (${entry}).\nRun: pnpm --filter tinyzoo-cloud templates:build`)
    process.exit(2)
  }
  const DB = 'tz_cloud_pics'
  const dataDir = join(cloudDir, '.data', 'pics', 'sites')
  let cloud = null, browser = null, failed = null
  try {
    log('preparing a cloud app of its own')
    await cleanSites(dataDir, 'tzc_pics_')
    await recreateDatabase(DB)
    cloud = await startCloud({
      port: await freePortFrom(3270),
      logFile: join(cloudDir, '.preview', 'pictures-cloud.log'),
      env: {
        NUXT_DATABASE_URL: dbUrl(DB), NUXT_HOSTING_DRIVER: 'local', NUXT_HOSTING_LOCAL_DATA_DIR: dataDir, NUXT_HOSTING_LOCAL_DATABASE_PREFIX: 'tzc_pics_',
        NUXT_HOSTING_LOCAL_PORT_FROM: '4350', NUXT_HOSTING_LOCAL_PORT_TO: '4359', NUXT_HOSTING_LOCAL_PUBLIC_URL: '', NUXT_MAX_SITES_PER_USER: '10',
        NUXT_REQUIRE_VERIFIED_EMAIL: 'false', NUXT_MAIL_TRANSPORT: 'log',
      },
    })
    browser = await chromium.launch()
    const api = await browser.newContext()
    const post = async (path, data) => {
      const res = await api.request.post(`${cloud.url}${path}`, { data })
      if (!res.ok()) throw new Error(`${path} → ${res.status()} ${await res.text()}`)
      return res.json()
    }
    await post('/api/auth/signup', { name: 'Obrázky šablon', email: 'pictures@example.com', password: 'obrazky-sablon-1', locale: 'cs' })

    const data = read()
    const fontFiles = new Map() // the site's path → the copied file's name
    mkdirSync(join(out, 'fonts'), { recursive: true })
    for (const [template, demo] of Object.entries(DEMO)) {
      mkdirSync(join(out, template), { recursive: true })
      const entry = { source: 'site', looks: [] }
      for (const look of demo.looks) {
        const id = look ?? template
        const slug = `obrazky-${template}${look ? `-${look}` : ''}`
        const { site } = await post('/api/sites', { name: demo.name, slug, template, look })
        const made = await waitFor(async () => {
          const s = (await (await api.request.get(`${cloud.url}/api/sites/${site.id}`)).json()).site
          if (s.status === 'failed') throw new Error(`${slug} could not be made: ${s.errorDetail ?? ''}`)
          return s.status === 'ready' ? s : null
        }, { timeout: 180_000, every: 500, what: `${slug} to be made` })
        const origin = made.publicUrl
        const port = new URL(origin).port

        // Twice the pixels, scaled down afterwards: sharper than a picture taken at its final size.
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'cs-CZ', colorScheme: 'light' })
        const page = await ctx.newPage()
        await page.goto(origin, { waitUntil: 'networkidle' })
        await page.evaluate(() => document.fonts.ready)
        // Pictures load as they come into view: walk down what the tall picture shows, then back.
        await page.evaluate(async () => {
          for (const img of document.images) { img.loading = 'eager'; img.decoding = 'sync' }
          for (let y = 0; y <= 2400; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 200)) }
          window.scrollTo(0, 0)
          const shown = [...document.images].filter((i) => i.getBoundingClientRect().top < 2400)
          await Promise.all(shown.map((i) => (i.complete ? null : new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); setTimeout(r, 8000) }))))
          await Promise.all(shown.map((i) => i.decode?.().catch(() => {})))
        })
        await sleep(600)

        const first = await page.screenshot({ type: 'png' })
        await webp(first, 800, 500, join(out, template, `${id}-card.webp`), 82)
        await webp(first, 240, 150, join(out, template, `${id}-thumb.webp`), 76)
        const tall = await page.screenshot({ type: 'png', fullPage: true, clip: { x: 0, y: 0, width: 1440, height: 2160 } })
        await webp(tall, 900, 1350, join(out, template, `${id}-tall.webp`), 80)

        const wordmark = await measure(page, WORDMARK[template])
        if (!wordmark) throw new Error(`${slug}: the site's name was not found on the page (${WORDMARK[template]})`)
        // The same screen without the name: the wizard writes the typed one there.
        await page.addStyleTag({ content: `${WORDMARK[template]} { visibility: hidden !important }` })
        await sleep(100)
        await webp(await page.screenshot({ type: 'png' }), 1440, 900, join(out, template, `${id}-top.webp`), 82)

        for (const font of wordmark.fonts) {
          if (!fontFiles.has(font.src)) {
            const res = await api.request.get(`http://127.0.0.1:${port}${font.src}`)
            if (!res.ok()) throw new Error(`${slug}: the typeface file ${font.src} did not load (${res.status()})`)
            const bytes = await res.body()
            const name = `${lookId(wordmark.family)}-${createHash('sha256').update(bytes).digest('hex').slice(0, 10)}.woff2`
            writeFileSync(join(out, 'fonts', name), bytes)
            fontFiles.set(font.src, name)
          }
          font.src = `/templates/fonts/${fontFiles.get(font.src)}`
        }
        entry.looks.push({ id, wordmark })
        await ctx.close()
        log(`  ${template}/${id}: ${wordmark.family} ${wordmark.weight}, ${wordmark.fonts.length} file(s)`)
      }
      data[template] = entry
    }
    // Typeface files nothing names any more.
    const used = new Set(Object.values(data).flatMap((t) => t.looks).flatMap((l) => l.wordmark?.fonts ?? []).map((f) => f.src.split('/').pop()))
    for (const f of readdirSync(join(out, 'fonts'))) if (!used.has(f)) rmSync(join(out, 'fonts', f))
    write(data)
    await api.close()
  }
  catch (err) {
    failed = err
    console.error('\n' + (err?.stack ?? err))
  }
  finally {
    await browser?.close().catch(() => {})
    if (cloud) {
      await cloud.stop().catch(() => {})
      if (!keep) {
        await cleanSites(dataDir, 'tzc_pics_').catch((e) => console.error('cleanup:', e.message))
        await dropDatabase(DB).catch(() => {})
      }
    }
  }
  if (failed) process.exit(1)
  log(`pictures of the built templates → ${out}`)
}

if (real) await fromRealSites()
else await fromDesigns()
process.exit(0)

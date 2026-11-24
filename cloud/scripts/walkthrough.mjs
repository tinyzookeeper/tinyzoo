// A recorded walkthrough of the product, for someone who was not there:
//
//   pnpm --filter tinyzoo-cloud walkthrough               # everything, in full quality (about 40 minutes)
//   pnpm --filter tinyzoo-cloud walkthrough --quick        # the two films small and fast, to try things out (about 10 minutes)
//   pnpm --filter tinyzoo-cloud walkthrough --only desktop # desktop | phone | screens | index
//   pnpm --filter tinyzoo-cloud walkthrough --domain example.cz   # another domain in every address (or SHOWCASE_DOMAIN)
//   pnpm --filter tinyzoo-cloud walkthrough --domain none  # plain local addresses (<slug>.localhost:<port>)
//   pnpm --filter tinyzoo-cloud walkthrough --keep         # leave its cloud app's database and sites in place
//   pnpm --filter tinyzoo-cloud walkthrough --url http://localhost:3200   # against a running app, with that app's addresses
//
// It makes, in cloud/.preview/:
//   walkthrough-desktop.mp4        the master: 2880 × 1620 at 60 frames a second, in Czech. The start
//                                  page → the gallery of templates → Photographer → its look → the
//                                  name → the account → the site being made → its page → the website
//                                  and an album → the invitation → the admin, where the home page's
//                                  heading is changed and then the look, and both are seen on the site
//   walkthrough-desktop-1080p.mp4  the same at 1920 × 1080, for sharing
//   walkthrough-phone.mp4          a shorter way in on a phone: 1170 × 2532 at 60 frames a second
//   screens/*.png                  every screen at 1440 px and 390 px wide, and three in dark mode
//   looks/*.jpg                    the Photographer site in each of its three looks
//   index.html                     all of it on one page
//
// The addresses. The sites run on this machine as always, but everything a person sees says
// https://<slug>.pushbase.app (and the cloud app https://tinyzoo.pushbase.app): the local
// hosting driver is given that pattern, and a small https proxy started here answers for those
// names inside the recording browser only (film.mjs: showcaseProxy). The browser is told to
// send them to the proxy and to know no other name; the script checks that it obeys before it
// opens anything, and stops if it does not. Nothing here talks to the real pushbase.app.
//
// The films are not screen recordings: the pages run slowed down and a picture is taken for
// every frame (film.mjs: film), so the text is sharp and the pace even. A pointer is drawn.
//
// Things on the pages are found by identifiers (data attributes, field names, addresses), and
// the admin's two buttons by their keys in the admin's own dictionary, never by a wording
// written here: the script survives a change of the texts.
//
// Needs the templates built (pnpm --filter tinyzoo-cloud templates:build), Postgres and ffmpeg.
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { arg, cleanSites, cloudDir, dbUrl, dropDatabase, freePortFrom, log, open, recreateDatabase, repoRoot, runDb, runPort, runPrefix, sleep, startCloud, templateEntries, waitFor } from './lib.mjs'
import { drawPointer, film, filmLine, hand, showcaseProxy, slowDown, smallerCopy } from './film.mjs'

const keep = arg('keep', false) === true
const quick = arg('quick', false) === true
const given = arg('url', null)
const only = arg('only', null) // desktop | phone | screens | index (only writes index.html again)
const domainArg = arg('domain', null) || process.env.SHOWCASE_DOMAIN || 'pushbase.app'
const domain = given || domainArg === 'none' ? null : String(domainArg)
const ffmpeg = process.env.FFMPEG || (existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg')
// (CLOUD_RUN_TAG and CLOUD_PORT_SHIFT give a second checkout its own databases and ports: lib.mjs)
const DB = runDb('tz_cloud_walk')
const PREFIX = runPrefix('tzc_walk_')
const dataDir = join(cloudDir, '.data', 'walk', 'sites')
const preview = join(cloudDir, '.preview')
const screens = join(preview, 'screens')
const looksDir = join(preview, 'looks')
const stamp = Date.now().toString(36).slice(-4)
const suffix = quick ? '-quick' : ''
// A film's files may be this large; a larger one is made again a little smaller.
const MAX_BYTES = 150e6

// How each film is made. `slow`: how many times slower the page runs than the film (a picture
// of 2880 × 1620 takes about 80 ms to take; at 60 frames a second there is slow/60 s for each).
const TAKES = quick
  ? { desktop: { width: 1440, height: 810, scale: 1, fps: 30, slow: 3, crf: 27, preset: 'veryfast', quality: 85 }, phone: { width: 390, height: 844, scale: 1, fps: 30, slow: 3, crf: 27, preset: 'veryfast', quality: 85 } }
  : { desktop: { width: 1440, height: 810, scale: 2, fps: 60, slow: 8, crf: 20, preset: 'medium', quality: 95 }, phone: { width: 390, height: 844, scale: 3, fps: 60, slow: 7, crf: 19, preset: 'medium', quality: 95 } }

for (const [id, entry] of Object.entries(templateEntries)) {
  if (given || only === 'index' || existsSync(entry)) continue
  console.error(`The template "${id}" is not built (${entry}).\nRun: pnpm --filter tinyzoo-cloud templates:build`)
  process.exit(2)
}
mkdirSync(screens, { recursive: true })
mkdirSync(looksDir, { recursive: true })

// The people of the walkthrough. All make a Photographer website (the template with looks).
// `suggested` is the address the wizard offers for the name: typed over only when this run
// needs another (against a running app an earlier run may hold it).
const people = {
  desktop: { name: 'Johana Loudová', email: 'johana@example.com', password: 'fotim-od-roku-2014', site: 'Johana Loudová', slug: 'johana-loudova', suggested: 'johana-loudova', look: 'negativ', nextLook: 'zapisnik', nextColorsId: 'svestka', adminPassword: 'administrace-johana-1', heading: 'Fotím lidi *tak, jak jsou.*', headingSays: 'Fotím lidi' },
  phone: { name: 'Tereza Malá', email: 'tereza@example.com', password: 'tereza-foti-rada-1', site: 'Tereza Malá', slug: 'tereza-mala', suggested: 'tereza-mala', look: 'zapisnik' },
  // (three sites, one in each look: the screenshots of the looks come from them)
  screens: { name: 'Eva Králová', email: 'eva@example.com', password: 'fotky-od-evy-12', site: 'Johana Loudová', slug: 'foto' },
}
const LOOKS = ['atelier', 'negativ', 'zapisnik']

let cloud = null
let proxy = null
let browser = null
/** The cloud app as this script's own requests reach it (always on this machine). */
let local = null
/** The cloud app as the recording browser opens it. */
let base = null
const extraSites = [] // made for the phone take and the screenshots: removed at the end
const filmed = []

// The admin's own words for its buttons, by their keys (packages/cms/app/i18n/cs.ts).
const admin = (await import(join(repoRoot, 'packages/cms/app/i18n/cs.ts'))).default

/** Wait until a page of the admin has loaded what it shows (not forever: the editor's live preview may go on loading pictures). */
const quiet = (page) => page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})

/** Links that would open a new tab stay in this one, so the film is one continuous take. */
const oneTab = (context) => context.addInitScript(() => {
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element ? e.target.closest('a[target="_blank"]') : null
    if (a) a.setAttribute('target', '_self')
  }, true)
  window.open = (url) => { if (url) location.href = String(url); return null }
})

/** A request of this script to the cloud app, on this machine (never under the showcase's names). */
async function ask(ctx, method, path, data) {
  const res = await ctx.request.fetch(`${local}${path}`, { method, data })
  return { status: res.status(), ok: res.ok(), body: await res.json().catch(() => null) }
}

/** A request the page itself makes to the app it is on (carries its sign-in). */
const inPage = (page, method, path, data) => page.evaluate(async ([method, path, data]) => {
  const res = await fetch(path, { method, headers: data ? { 'content-type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined })
  return { status: res.status, ok: res.ok, body: await res.json().catch(() => null) }
}, [method, path, data])

/** Against a running app an earlier run may hold the address: then this run takes a fresh one, and a fresh e-mail with it. */
async function freeIdentity(who) {
  const ctx = await browser.newContext()
  try {
    const free = (await ask(ctx, 'GET', `/api/slug?slug=${who.slug}`)).body?.ok
    if (!free || arg('fresh', false) === true) { who.slug = `${who.slug}-${stamp}`; who.email = who.email.replace('@', `-${stamp}@`) }
  }
  finally { await ctx.close() }
  return who
}

/** A context for a film: the page slowed down, a pointer drawn, links kept in the tab. */
async function filmContext(take, { phone = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: take.width, height: take.height }, deviceScaleFactor: take.scale, locale: 'cs-CZ', colorScheme: 'light', ignoreHTTPSErrors: !!domain,
    ...(phone ? { isMobile: true, hasTouch: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' } : {}),
  })
  // The page runs `slow` times slower than real time: so must every wait of this script be patient.
  ctx.setDefaultTimeout(300_000)
  ctx.setDefaultNavigationTimeout(300_000)
  await slowDown(ctx, take.slow)
  const pointer = { at: phone ? { x: 200, y: 600 } : { x: 930, y: 470 } }
  await drawPointer(ctx, { touch: phone, where: () => pointer.at })
  await oneTab(ctx)
  const page = await ctx.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(String(e).split('\n')[0]))
  return { ctx, page, pointer, problems }
}

/** Start filming a loaded page; the hand's place is what a new page draws the pointer at. */
async function roll(setup, take, file) {
  const reel = await film(setup.ctx, setup.page, { out: file, fps: take.fps, slow: take.slow, scale: take.scale, quality: take.quality, crf: take.crf, preset: take.preset, ffmpeg })
  const h = hand(setup.page, reel, { start: setup.pointer.at })
  setup.pointer.at = h.where()
  // (the pointer's place follows the hand)
  const where = h.where
  Object.defineProperty(setup.pointer, 'at', { get: () => where(), configurable: true })
  await h.settle()
  return { reel, h }
}

/** Write the film; one that came out too large is made again a little smaller. */
async function finish(reel, take, file) {
  let result = await reel.cut()
  if (result.bytes > MAX_BYTES) {
    const smaller = file.replace(/\.mp4$/, '.smaller.mp4')
    execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', file, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(take.crf + 4), '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', '-an', smaller], { maxBuffer: 1 << 26 })
    renameSync(smaller, file)
    result = { ...result, bytes: statSync(file).size }
  }
  filmed.push(result)
  log(`  ${filmLine(result)}`)
  return result
}

async function removeSite(ctx, id, slug) {
  await ask(ctx, 'POST', `/api/sites/${id}/remove`, { confirm: slug }).catch(() => {})
}

// ── the desktop film ────────────────────────────────────────────────────────────

async function desktopTake() {
  log('desktop film')
  const take = TAKES.desktop
  const who = await freeIdentity(people.desktop)
  const setup = await filmContext(take)
  const { page } = setup
  await open(page, base)
  const file = join(preview, `walkthrough-desktop${suffix}.mp4`)
  const { reel, h } = await roll(setup, take, file)
  const arrive = async () => { await page.waitForLoadState('domcontentloaded').catch(() => {}); await h.settle(); await quiet(page); await h.settle() }

  // The start page: what it is, with real websites turning in its window.
  await h.read(2200)
  await h.rest(1010, 400)
  await h.read(3000)
  await h.scroll(640, { ms: 1300 })
  await h.read(1300)
  await h.scroll(560, { ms: 1200 })
  await h.read(1100)
  await h.scroll(-1200, { ms: 1200 })
  await h.click(page.locator('[data-cta]'))
  await page.waitForSelector('[data-wizard=ready]')

  // 1 · the template: the whole gallery, every card a real design; some looks glanced at.
  await h.read(1600)
  const glance = async (template, looks) => {
    for (const look of looks) {
      await h.hover(page.locator(`[data-template=${template}] [data-look-thumb=${look}]`), { spot: { x: 0.5, y: 0.5 } })
      await h.read(850)
    }
  }
  await h.scroll(560, { ms: 1500 })
  await glance('wedding', ['vecer', 'magazin'])
  await h.scroll(760, { ms: 1700 })
  await glance('restaurant', ['talir', 'paragon'])
  await h.scroll(1580, { ms: 2800 })
  await h.read(900)
  await h.scroll(-2900, { ms: 1500 })
  await h.click(page.locator('[data-field=hospitality]'))
  await h.read(900)
  await glance('accommodation', ['ode-dveri'])
  await h.click(page.locator('[data-field=personal]'))
  await h.read(900)
  await glance('photographer', ['negativ', 'zapisnik'])
  await h.click(page.locator('[data-template=photographer]'), { spot: { x: 0.5, y: 0.3 } })
  await h.read(900)
  await h.click(page.locator('[data-next]').first())

  // 2 · the look: the three side by side, real sites; one picked after a look at each.
  await page.waitForSelector('[data-step=look]')
  await h.read(1300)
  await h.scroll(250, { ms: 800 })
  for (const look of LOOKS) {
    await h.hover(page.locator(`[data-look=${look}]`), { spot: { x: 0.5, y: 0.4 } })
    await h.read(1500)
  }
  await h.click(page.locator(`[data-look=${who.look}]`), { spot: { x: 0.5, y: 0.45 } })
  await h.read(900)
  await h.click(page.locator('[data-next]').first())

  // 3 · the name and the address: the look in the window takes the name as it is typed.
  await page.waitForSelector('[data-field-name]')
  await h.read(900)
  await h.type(page.locator('[data-field-name]'), who.site)
  if (who.slug !== who.suggested) await h.type(page.locator('[data-field-slug]'), who.slug, { clear: true })
  await page.waitForSelector('[data-slug-ok]')
  await h.rest(1010, 520)
  await h.read(2000)
  await h.click(page.locator('[data-next]').first())

  // 4 · the account.
  await page.waitForSelector('[data-field-person]')
  await h.read(700)
  await h.type(page.locator('[data-field-person]'), who.name)
  await h.type(page.locator('[data-field-email]'), who.email)
  await h.type(page.locator('[data-field-password]'), who.password)
  await h.read(600)
  await h.click(page.locator('[data-next]').first(), { after: 200 })

  // Being made: the hand rests while the animals work.
  await page.waitForSelector('[data-build]')
  await h.rest(430, 650)
  await page.waitForSelector('[data-site-name]')
  const sitePage = page.url()
  await page.waitForSelector('[data-site-preview] iframe.is-loaded').catch(() => {})
  await h.read(2600)

  // The site's page, then the website itself.
  await h.hover(page.locator('[data-site-preview]'))
  await h.read(900)
  await h.click(page.locator('[data-open-site]'), { after: 100 })
  await arrive()
  const site = new URL(page.url()).origin
  await h.read(2400)
  // Down the home page: the gallery, one day, the prices.
  for (const by of [860, 1100, 1500]) {
    await h.scroll(by, { ms: 1500 })
    await h.read(1200)
  }
  // An album, and a photograph of it opened large.
  await page.goto(`${site}${await page.locator('a[href^="/album/"]').first().getAttribute('href')}`)
  await arrive()
  await h.read(1300)
  await h.click(page.locator('[data-photo]').nth(1))
  await page.waitForSelector('[data-lightbox]')
  await h.read(1500)
  await h.click(page.locator('[data-lightbox-next]'))
  await h.read(1200)
  await h.click(page.locator('[data-lightbox-next]'))
  await h.read(1200)
  await h.key('Escape', { after: 700 })

  // Back on the site's page in the cloud: into the admin with the invitation.
  await page.goto(sitePage)
  await arrive()
  await page.waitForSelector('[data-invite]')
  await h.read(1200)
  await h.click(page.locator('[data-invite]'), { after: 100 })
  await arrive()
  await page.waitForSelector('input[type=password]')
  await h.read(1500)
  await h.type(page.locator('input[type=password]'), who.adminPassword)
  await h.read(500)
  await h.click(page.locator('button[type=submit]').first())
  await page.waitForURL(/\/admin\/?$/)
  await arrive()
  await h.read(2800)

  // Change the home page's heading: the page with the address "home", its opening block.
  const pages = (await inPage(page, 'GET', '/api/cms/page?limit=100')).body?.rows ?? []
  const home = pages.find((p) => p.slug === 'home')
  if (!home) throw new Error('the site has no page with the address "home"')
  const hero = home.sections.findIndex((s) => s.type === 'hero')
  await h.click(page.locator('a[href="/admin/page"]').first())
  await page.waitForURL('**/admin/page')
  await quiet(page)
  await h.read(1100)
  await h.click(page.locator(`a[href="/admin/page/${home.id}"]`).first(), { spot: { x: 0.3, y: 0.5 } })
  await page.waitForURL(`**/admin/page/${home.id}`)
  await arrive()
  await h.read(1800)
  // (a block is a row that opens: a plain button with aria-expanded, in the page's order)
  await h.click(page.locator('button[aria-expanded]:not([aria-haspopup]):not([aria-controls]):not([id])').nth(hero), { spot: { x: 0.35, y: 0.5 } })
  await page.waitForSelector('input[name=heading]')
  await h.read(800)
  await h.type(page.locator('input[name=heading]'), who.heading, { clear: true })
  await h.read(2200)
  await h.click(page.getByRole('button', { name: admin.editor.update, exact: true }).first())
  await h.read(2200)

  // Another look, in Site settings.
  await h.click(page.locator('a[href="/admin/siteSettings"]').first())
  await page.waitForURL('**/admin/siteSettings')
  await arrive()
  await h.read(1500)
  // The home page is beside the form: the look and then its colours change there before saving.
  const drawn = () => page.frames().find((f) => f.url().includes('?preview'))?.evaluate(() => `${document.documentElement.dataset.look}/${document.documentElement.dataset.colors}`)
  await h.click(page.locator(`button[role=radio][value=${who.nextLook}]`))
  await h.read(2600)
  // (the colours offered are the chosen look's own three: the field follows the look)
  await h.click(page.locator(`button[role=radio][value=${who.nextColorsId}]`))
  await h.read(2600)
  if (await drawn() !== `${who.nextLook}/${who.nextColorsId}`) throw new Error(`the preview beside the settings shows ${await drawn()}`)
  await h.click(page.getByRole('button', { name: admin.common.save, exact: true }).first())
  await h.read(2000)

  // And see both on the site: the new heading, in the new look.
  await h.click(page.locator('a[href="/"][target="_blank"]').first())
  await page.waitForURL(`${site}/`)
  await arrive()
  const shown = await page.locator('h1').first().innerText()
  if (!shown.includes(who.headingSays)) throw new Error(`the site still says "${shown}"`)
  const look = await page.evaluate(() => document.documentElement.dataset.look)
  if (look !== who.nextLook) throw new Error(`the site is still drawn as ${look}`)
  await h.rest(700, 560)
  await h.read(2800)
  await h.scroll(900, { ms: 1500 })
  await h.read(1600)
  await h.scroll(-900, { ms: 1100 })
  await h.read(1800)

  await finish(reel, take, file)
  if (!quick) {
    const copy = await smallerCopy(file, join(preview, 'walkthrough-desktop-1080p.mp4'), { width: 1920, height: 1080, ffmpeg })
    log(`  walkthrough-desktop-1080p.mp4: ${(copy.bytes / 1e6).toFixed(1)} MB`)
  }
  if (setup.problems.length) log(`  page errors: ${[...new Set(setup.problems)].join(' | ')}`)
  await setup.ctx.close()
  return { ...who, id: sitePage.split('/').pop() }
}

// ── the phone film ──────────────────────────────────────────────────────────────

async function phoneTake() {
  log('phone film')
  const take = TAKES.phone
  const who = await freeIdentity(people.phone)
  const setup = await filmContext(take, { phone: true })
  const { page } = setup
  await open(page, base)
  const file = join(preview, `walkthrough-phone${suffix}.mp4`)
  const { reel, h } = await roll(setup, take, file)
  const arrive = async () => { await page.waitForLoadState('domcontentloaded').catch(() => {}); await h.settle(); await quiet(page); await h.settle() }

  await h.read(1800)
  await h.scroll(520, { ms: 1100 })
  await h.read(1300)
  await h.scroll(-520, { ms: 800 })
  await h.click(page.locator('[data-cta]'))
  await page.waitForSelector('[data-wizard=ready]')
  // The gallery: a few cards pass, then Photographer, by one of its looks.
  await h.read(1000)
  await h.scroll(1900, { ms: 2600 })
  await h.read(600)
  await h.scroll(-1900, { ms: 1100 })
  await h.click(page.locator(`[data-template=photographer] [data-look-thumb=${who.look}]`))
  await h.read(900)
  await h.click(page.locator('[data-next]').first())
  // The looks, one under the other on a phone; the chosen one is already marked.
  await page.waitForSelector('[data-step=look]')
  await h.read(1100)
  await h.scroll(900, { ms: 1700 })
  await h.read(900)
  await h.click(page.locator('[data-next]').first())
  // The name: the look in the window under the form takes it.
  await page.waitForSelector('[data-field-name]')
  await h.type(page.locator('[data-field-name]'), who.site)
  if (who.slug !== who.suggested) await h.type(page.locator('[data-field-slug]'), who.slug, { clear: true })
  await page.waitForSelector('[data-slug-ok]')
  await h.scroll(470, { ms: 1100 })
  await h.read(1700)
  await h.click(page.locator('[data-next]').first())
  await page.waitForSelector('[data-field-person]')
  await h.type(page.locator('[data-field-person]'), who.name)
  await h.type(page.locator('[data-field-email]'), who.email)
  await h.type(page.locator('[data-field-password]'), who.password)
  await h.click(page.locator('[data-next]').first(), { after: 200 })
  await page.waitForURL(/\/sites\/[0-9a-f-]{36}$/)
  const id = page.url().split('/').pop()
  extraSites.push({ who, id, slug: who.slug })
  await page.waitForSelector('[data-build]')
  await h.rest(330, 760)
  await page.waitForSelector('[data-site-name]')
  await page.waitForSelector('[data-site-preview] iframe.is-loaded').catch(() => {})
  await h.read(2200)
  await h.click(page.locator('[data-open-site]'), { after: 100 })
  await arrive()
  await h.read(2000)
  for (const by of [820, 1100, 1300]) {
    await h.scroll(by, { ms: 1400 })
    await h.read(1200)
  }
  await h.scroll(-3220, { ms: 1300 })
  await h.read(1400)

  await finish(reel, take, file)
  if (setup.problems.length) log(`  page errors: ${[...new Set(setup.problems)].join(' | ')}`)
  await setup.ctx.close()
}

// ── every screen, at both widths, and three in the dark ─────────────────────────

const SIZES = { desktop: { width: 1440, height: 900, scale: 2 }, phone: { width: 390, height: 844, scale: 2 } }

async function screensPass(main) {
  log('screenshots')
  const who = await freeIdentity(people.screens)
  const shots = []
  const shot = async (page, name, { size, dark = false, full = true }) => {
    await sleep(700)
    const file = `${name}--${SIZES[size].width}${dark ? '-dark' : ''}.png`
    await page.screenshot({ path: join(screens, file), fullPage: full })
    shots.push(file)
  }
  const context = (size, dark = false) => browser.newContext({ viewport: { width: SIZES[size].width, height: SIZES[size].height }, deviceScaleFactor: SIZES[size].scale, locale: 'cs-CZ', colorScheme: dark ? 'dark' : 'light', ignoreHTTPSErrors: !!domain })
  /** Sign a context in: the page asks the app it is on, so the sign-in is kept for that address. */
  const signIn = async (page, person) => {
    if (!page.url().startsWith(base)) await open(page, `${base}/login`)
    const res = await inPage(page, 'POST', '/api/auth/login', { email: person.email, password: person.password })
    if (!res.ok) throw new Error(`could not sign in as ${person.email}`)
  }
  const made = {} // look → the site's address
  /** The first two steps: Photographer, and the look (a screenshot of each when asked for). */
  const pickLook = async (page, opts, look) => {
    await open(page, `${base}/new`)
    await page.waitForSelector('[data-wizard=ready]')
    await page.locator('[data-template=photographer]').click({ position: { x: 40, y: 40 } })
    await page.mouse.move(0, 0)
    await page.locator('[data-template] img').first().evaluate((img) => img.decode?.())
    if (opts.wizardShots) await shot(page, '02-template', opts)
    await page.locator('[data-next]').first().click()
    await page.waitForSelector('[data-step=look]')
    await page.locator(`[data-look=${look}]`).click()
    await page.mouse.move(0, 0)
    await page.locator('[data-look] img').first().evaluate((img) => img.decode?.())
    if (opts.wizardShots) await shot(page, '02b-look', opts)
    await page.locator('[data-next]').first().click()
  }
  /** The wizard up to its last step, with a screenshot of each, then the site being made and made. */
  const wizard = async (page, opts, { slug, account, look }) => {
    await pickLook(page, opts, look)
    await page.locator('[data-field-name]').fill(who.site)
    await page.locator('[data-field-slug]').fill(slug)
    await page.waitForSelector('[data-slug-ok]')
    if (opts.wizardShots) await shot(page, '03-your-site', opts)
    if (account) {
      await page.locator('[data-next]').first().click()
      await page.locator('[data-field-person]').fill(who.name)
      await page.locator('[data-field-email]').fill(who.email)
      await page.locator('[data-field-password]').fill(who.password)
      if (opts.wizardShots) await shot(page, '04-your-account', opts)
    }
    await page.locator('[data-next]').first().click()
    await page.waitForURL(/\/sites\/[0-9a-f-]{36}$/)
    const id = page.url().split('/').pop()
    extraSites.push({ who, id, slug })
    await page.waitForSelector('[data-step=content][data-state=running]', { timeout: 60_000 })
    await shot(page, '05-being-made', { ...opts, full: false })
    await page.waitForSelector('[data-build=done]', { timeout: 60_000 })
    await shot(page, '06-made', { ...opts, full: false })
    await page.waitForSelector('[data-site-name]', { timeout: 60_000 })
    await page.waitForSelector('[data-site-preview] iframe.is-loaded')
    await sleep(1500)
    await shot(page, '07-site-page', opts)
    made[look] = await page.locator('[data-open-site]').getAttribute('href')
    return id
  }

  // Light, at both widths. The first one signs up; the second is signed in already.
  let first = true
  for (const size of ['desktop', 'phone']) {
    const opts = { size, wizardShots: true }
    const ctx = await context(size)
    const page = await ctx.newPage()
    await open(page, base)
    await shot(page, '01-start', opts)
    await open(page, `${base}/login`)
    await shot(page, '10-sign-in', opts)
    await open(page, `${base}/forgot`)
    await shot(page, '11-forgotten-password', opts)
    if (first) {
      await wizard(page, opts, { slug: `${who.slug}-atelier`, account: true, look: 'atelier' })
    }
    else {
      // The account step is only shown signed out: take it first, then sign in for the rest.
      await pickLook(page, opts, 'negativ')
      await page.locator('[data-field-name]').fill(who.site)
      await page.locator('[data-field-slug]').fill(`${who.slug}-negativ`)
      await page.waitForSelector('[data-slug-ok]')
      await shot(page, '03-your-site', opts)
      await page.locator('[data-next]').first().click()
      await page.locator('[data-field-person]').fill(who.name)
      await page.locator('[data-field-email]').fill(who.email)
      await page.locator('[data-field-password]').fill(who.password)
      await shot(page, '04-your-account', opts)
      await page.evaluate(() => localStorage.removeItem('tz-cloud-new'))
      await signIn(page, who)
      await wizard(page, { size, wizardShots: false }, { slug: `${who.slug}-negativ`, account: false, look: 'negativ' })
    }
    await open(page, `${base}/sites`)
    await page.waitForSelector('[data-site]')
    await shot(page, '08-my-websites', opts)
    await open(page, `${base}/account`)
    await shot(page, '09-account', opts)
    // The site's page once the owner has been in the admin and changed the look: the main film's site.
    if (main) {
      const mine = await context(size)
      const p = await mine.newPage()
      await signIn(p, main)
      await open(p, `${base}/sites/${main.id}`)
      await p.waitForSelector('[data-admin=open]', { timeout: 20_000 }).catch(() => {})
      await p.waitForSelector('[data-site-preview] iframe.is-loaded')
      await sleep(1500)
      await shot(p, '12-site-page-after-first-visit', opts)
      await mine.close()
    }
    await ctx.close()
    first = false
  }

  // Dark: the three that matter most.
  const dark = { size: 'desktop', dark: true, wizardShots: false }
  const ctx = await context('desktop', true)
  const page = await ctx.newPage()
  await open(page, base)
  await shot(page, '01-start', dark)
  await signIn(page, who)
  await wizard(page, dark, { slug: `${who.slug}-zapisnik`, account: false, look: 'zapisnik' })
  await ctx.close()

  // The three sites: the first screen and the whole home page of each look, at both widths.
  for (const look of LOOKS) {
    if (!made[look]) continue
    for (const size of ['desktop', 'phone']) {
      const c = await context(size)
      const p = await c.newPage()
      await p.goto(made[look], { waitUntil: 'networkidle' })
      await p.evaluate(() => document.fonts.ready)
      await p.screenshot({ path: join(looksDir, `${look}-${size}-top.jpg`), type: 'jpeg', quality: 88 })
      // Pictures load as they come into view: walk down the page first, then take all of it.
      await p.evaluate(async () => {
        // (decoded at once, not when the browser gets to it: a capture of the whole page would miss those)
        for (const img of document.images) { img.loading = 'eager'; img.decoding = 'sync' }
        for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)) }
        const shown = [...document.images].filter((i) => i.offsetParent !== null)
        await Promise.all(shown.map((i) => (i.complete && i.naturalWidth ? null : new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); setTimeout(r, 8000) }))))
        await Promise.all(shown.map((i) => i.decode?.().catch(() => {})))
        window.scrollTo(0, 0)
      })
      await sleep(800)
      await p.screenshot({ path: join(looksDir, `${look}-${size}.jpg`), type: 'jpeg', quality: 80, fullPage: true, scale: 'css' })
      await c.close()
    }
    log(`  looks/${look}-*.jpg`)
  }
  return shots
}

function indexHtml(shots) {
  const have = (f) => existsSync(join(preview, f))
  const mb = (f) => `${(statSync(join(preview, f)).size / 1e6).toFixed(0)} MB`
  const extra = existsSync(screens) ? readdirSync(screens).filter((f) => f.startsWith('e2e-')).sort() : []
  const titles = {
    '01-start': 'Úvodní stránka', '02-template': 'Průvodce · šablona', '02b-look': 'Průvodce · vzhled', '03-your-site': 'Průvodce · váš web', '04-your-account': 'Průvodce · váš účet',
    '05-being-made': 'Web se staví', '06-made': 'Hotovo', '07-site-page': 'Stránka webu (poprvé)', '08-my-websites': 'Moje weby', '09-account': 'Účet',
    '10-sign-in': 'Přihlášení', '11-forgotten-password': 'Zapomenuté heslo', '12-site-page-after-first-visit': 'Stránka webu (po prvním vstupu do administrace a změně vzhledu)',
    'e2e-being-made': 'Web se staví (z e2e)', 'e2e-look': 'Průvodce · vzhled (z e2e)', 'e2e-failed': 'Krok se nepovedl · Zkusit znovu', 'e2e-waiting': 'Čeká na potvrzení e-mailu', 'e2e-sites-limit': 'Moje weby · limit',
  }
  const group = (files) => {
    const by = new Map()
    for (const f of files) { const key = f.split('--')[0].replace(/\.png$/, ''); by.set(key, [...(by.get(key) ?? []), f]) }
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b))
  }
  const fig = (f) => `<figure class="${f.includes('--390') ? 'phone' : 'wide'}"><a href="screens/${f}"><img loading="lazy" src="screens/${f}" alt=""></a><figcaption>${f.includes('-dark') ? 'tmavý režim · ' : ''}${f.includes('--390') ? '390 px' : '1440 px'}</figcaption></figure>`
  const section = ([key, files]) => `<section><h3>${titles[key] ?? key}</h3><div class="row">${files.sort((a, b) => a.includes('--390') - b.includes('--390') || a.localeCompare(b)).map(fig).join('')}</div></section>`
  const LOOK_NAMES = { atelier: 'Ateliér', negativ: 'Negativ', zapisnik: 'Zápisník' }
  const lookFig = (look, size) => (have(`looks/${look}-${size}-top.jpg`)
    ? `<figure class="${size === 'phone' ? 'phone' : 'wide'}"><a href="looks/${look}-${size}.jpg"><img loading="lazy" src="looks/${look}-${size}-top.jpg" alt=""></a><figcaption>${size === 'phone' ? '390 px' : '1440 px'} · klepnutím celá stránka</figcaption></figure>`
    : '')
  const looksHtml = LOOKS.filter((look) => have(`looks/${look}-desktop-top.jpg`)).map((look) => `<section><h3>${LOOK_NAMES[look]}</h3><div class="row">${lookFig(look, 'desktop')}${lookFig(look, 'phone')}</div></section>`).join('\n')
  // The page plays the 1080p copy (lighter to play in a browser); the master is linked beside it.
  const desktop = have('walkthrough-desktop-1080p.mp4') ? 'walkthrough-desktop-1080p.mp4' : have('walkthrough-desktop.mp4') ? 'walkthrough-desktop.mp4' : null
  const links = [
    have('walkthrough-desktop.mp4') ? `<a href="walkthrough-desktop.mp4">originál 2880 × 1620, 60 snímků/s (${mb('walkthrough-desktop.mp4')})</a>` : '',
    have('walkthrough-desktop-1080p.mp4') ? `<a href="walkthrough-desktop-1080p.mp4">1920 × 1080 (${mb('walkthrough-desktop-1080p.mp4')})</a>` : '',
  ].filter(Boolean).join(' · ')
  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>tinyzoo cloud · náhled</title>
<style>
  :root { color-scheme: light; --ink:#131313; --text:#2E3035; --muted:#6E675D; --cream:#F9F5EF; --line:#E7DDCD; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.6 Inter, -apple-system, "Segoe UI", sans-serif; color: var(--text); background: var(--cream); }
  main { max-width: 1280px; margin: 0 auto; padding: 48px 24px 96px; }
  h1 { font: 800 40px/1.1 Manrope, Inter, sans-serif; letter-spacing: -.025em; color: var(--ink); margin: 0 0 8px; }
  h2 { font: 800 26px/1.2 Manrope, Inter, sans-serif; letter-spacing: -.02em; color: var(--ink); margin: 56px 0 16px; }
  h3 { font: 600 15px/1.3 Inter, sans-serif; color: var(--ink); margin: 32px 0 10px; }
  p { margin: 0 0 12px; max-width: 70ch; color: var(--muted); }
  a { color: var(--ink); }
  code { font: 13px ui-monospace, Menlo, monospace; background: #fff; border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; color: var(--ink); }
  .videos { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 24px; align-items: start; }
  video { width: 100%; display: block; background: #fff; border: 1px solid var(--line); border-radius: 16px; }
  .row { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
  figure { margin: 0; }
  figure.wide { flex: 1 1 520px; max-width: 760px; }
  figure.phone { flex: 0 0 220px; }
  figure img { width: 100%; display: block; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
  figcaption { font-size: 12px; color: var(--muted); margin-top: 6px; }
  @media (max-width: 800px) { .videos { grid-template-columns: 1fr; } }
</style></head>
<body><main>
<h1>tinyzoo cloud</h1>
<p>Od úvodní stránky po úpravu webu v administraci. Vytvořeno skriptem <code>cloud/scripts/walkthrough.mjs</code> ${new Date().toLocaleString('cs-CZ')}.</p>
<h2>Průchod</h2>
<div class="videos">
  <div>${desktop ? `<video controls preload="metadata" src="${desktop}"></video><p style="margin-top:8px">Počítač, česky. ${links}</p>` : '<p>Video z počítače chybí.</p>'}</div>
  <div>${have('walkthrough-phone.mp4') ? `<video controls preload="metadata" src="walkthrough-phone.mp4"></video><p style="margin-top:8px">Telefon, 1170 × 2532, 60 snímků/s (${mb('walkthrough-phone.mp4')}).</p>` : '<p>Video z telefonu chybí.</p>'}</div>
</div>
${looksHtml ? `<h2>Šablona Fotograf · tři vzhledy</h2>\n<p>Jeden web, jeden obsah, tři vzhledy. Každý je web vytvořený průvodcem, s ukázkovým obsahem.</p>\n${looksHtml}` : ''}
<h2>Obrazovky</h2>
${group(shots).map(section).join('\n')}
${extra.length ? `<h2>Stavy z e2e testu</h2>${group(extra).map(section).join('\n')}` : ''}
</main></body></html>`
}

let failed = null
try {
  if (only === 'index') {
    writeFileSync(join(preview, 'index.html'), indexHtml(readdirSync(screens).filter((f) => /^\d\d-/.test(f))))
    log(`done: ${join(preview, 'index.html')}`)
    process.exit(0)
  }
  if (given) {
    local = base = String(given).replace(/\/+$/, '')
  }
  else {
    log('preparing a cloud app of its own')
    await cleanSites(dataDir, PREFIX)
    await recreateDatabase(DB)
    const port = await freePortFrom(runPort(3280))
    if (domain) proxy = await showcaseProxy({ domain, cloudPort: port, dataDir })
    cloud = await startCloud({
      port,
      logFile: join(preview, 'walkthrough-cloud.log'),
      env: {
        NUXT_DATABASE_URL: dbUrl(DB), NUXT_HOSTING_DRIVER: 'local', NUXT_HOSTING_LOCAL_DATA_DIR: dataDir, NUXT_HOSTING_LOCAL_DATABASE_PREFIX: PREFIX,
        NUXT_HOSTING_LOCAL_PORT_FROM: String(runPort(4370)), NUXT_HOSTING_LOCAL_PORT_TO: String(runPort(4389)), NUXT_MAX_SITES_PER_USER: '3',
        NUXT_REQUIRE_VERIFIED_EMAIL: 'false', NUXT_PUBLIC_SHOW_PLANNED: 'true', NUXT_MAIL_TRANSPORT: 'log', NUXT_DEV_MAIL_LINKS: 'false',
        // What a person sees: real-looking addresses, answered by the proxy inside the recording browser.
        ...(proxy ? { NUXT_PUBLIC_URL: proxy.cloudUrl, NUXT_HOSTING_LOCAL_PUBLIC_URL: proxy.siteUrlPattern, CLOUD_DEV_HOSTS: `.${domain}` } : { NUXT_HOSTING_LOCAL_PUBLIC_URL: '' }),
      },
    })
    local = cloud.url
    base = proxy ? proxy.cloudUrl : cloud.url
  }
  log(`cloud app: ${base}${base === local ? '' : ` (on this machine: ${local})`}`)
  browser = await chromium.launch({ args: ['--disable-smooth-scrolling', ...(proxy?.browserArgs ?? [])] })
  // Before anything is opened under the showcase's names: the browser must send them here.
  if (proxy) { await proxy.check(browser); log(`addresses: *.${domain} are answered on this machine only (checked)`) }

  let main = null
  if (!only || only === 'desktop') main = await desktopTake()
  if (!only || only === 'phone') await phoneTake()
  let shots = existsSync(screens) ? readdirSync(screens).filter((f) => /^\d\d-/.test(f)) : []
  if ((!only && !quick) || only === 'screens') shots = await screensPass(main)
  if (main) {
    // The cloud's page of the site follows the look its owner set in the site's admin.
    const ctx = await browser.newContext()
    await ask(ctx, 'POST', '/api/auth/login', { email: main.email, password: main.password })
    const seen = (await ask(ctx, 'GET', `/api/sites/${main.id}?runtime=1`)).body?.site
    await ctx.close()
    if (seen?.look !== main.nextLook) throw new Error(`the cloud still says the site's look is ${seen?.look}`)
    log(`  the cloud's page of ${main.slug} now says its look is ${seen.look}`)
  }
  writeFileSync(join(preview, 'index.html'), indexHtml(shots))
  log(`  index.html (${shots.length} screenshots)`)

  // The sites made only for the phone film and the screenshots go again; the main one stays
  // (against a running app) so there is something to look at.
  const ctxs = new Map()
  for (const s of extraSites) {
    if (!ctxs.has(s.who.email)) {
      const ctx = await browser.newContext()
      await ask(ctx, 'POST', '/api/auth/login', { email: s.who.email, password: s.who.password })
      ctxs.set(s.who.email, ctx)
    }
    await removeSite(ctxs.get(s.who.email), s.id, s.slug)
  }
  if (extraSites.length) {
    await waitFor(async () => {
      for (const s of extraSites) if ((await ask(ctxs.get(s.who.email), 'GET', `/api/sites/${s.id}`)).status !== 404) return false
      return true
    }, { timeout: 60_000, what: 'the extra sites to be removed' }).catch((e) => log(`  ${e.message}`))
  }
  for (const ctx of ctxs.values()) await ctx.close()
  if (main && given) log(`the main site stays: ${main.site} (${main.email} / ${main.password}; admin password ${main.adminPassword})`)
}
catch (err) {
  failed = err
  console.error('\n' + (err?.stack ?? err))
}
finally {
  await browser?.close().catch(() => {})
  await proxy?.stop().catch(() => {})
  if (cloud) {
    await cloud.stop().catch(() => {})
    if (!keep) {
      await cleanSites(dataDir, PREFIX).catch((e) => console.error('cleanup:', e.message))
      await dropDatabase(DB).catch(() => {})
    }
  }
  log(failed ? 'FAILED' : `done: ${join(preview, 'index.html')}`)
}
process.exit(failed ? 1 : 0)

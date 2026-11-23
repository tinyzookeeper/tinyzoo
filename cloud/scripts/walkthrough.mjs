// A recorded walkthrough of the product, for someone who was not there:
//
//   pnpm --filter tinyzoo-cloud walkthrough             # its own cloud app, removed afterwards
//   pnpm --filter tinyzoo-cloud walkthrough --keep       # … left in place
//   pnpm --filter tinyzoo-cloud walkthrough --url http://localhost:3200
//                                                        # against a running app: the main site stays
//
// It makes, in cloud/.preview/:
//   walkthrough-desktop.mp4   one continuous take at 1440×900, in Czech: start page → template →
//                             name → account → being made → the site's page → the website →
//                             invitation → admin, where the home page's heading is changed and
//                             seen on the site. The mouse is drawn (Playwright's video has none).
//   walkthrough-phone.mp4     the same way in, on a phone-sized screen (a touch dot for the finger)
//   screens/*.png             every screen at 1440 px and 390 px, and three in dark mode
//   index.html                all of it on one page
//
// Needs the template built (pnpm --filter tinyzoo-cloud templates:build) and ffmpeg.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { arg, cleanSites, cloudDir, dbUrl, dropDatabase, freePortFrom, human, installCursor, log, open, recordFrames, recreateDatabase, sleep, startCloud, templateEntry, waitFor } from './lib.mjs'

const keep = arg('keep', false) === true
const given = arg('url', null)
const only = arg('only', null) // desktop | phone | screens | index (only writes index.html again)
const ffmpeg = process.env.FFMPEG || (existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg')
const DB = 'tz_cloud_walk'
const dataDir = join(cloudDir, '.data', 'walk', 'sites')
const preview = join(cloudDir, '.preview')
const screens = join(preview, 'screens')
const raw = join(preview, '.raw')
const stamp = Date.now().toString(36).slice(-4)

if (!given && !existsSync(templateEntry)) {
  console.error(`The template is not built (${templateEntry}).\nRun: pnpm --filter tinyzoo-cloud templates:build`)
  process.exit(2)
}
mkdirSync(screens, { recursive: true })
rmSync(raw, { recursive: true, force: true })
mkdirSync(raw, { recursive: true })

// The people of the walkthrough. Against a running app the addresses must be free: a short
// stamp is added when they are not.
const people = {
  desktop: { name: 'Jana Nováková', email: 'jana@example.com', password: 'pekarna-na-ruzku-1', site: 'Pekárna Na Růžku', slug: 'pekarna-na-ruzku', adminPassword: 'administrace-jana-1' },
  phone: { name: 'Tomáš Dvořák', email: 'tomas@example.com', password: 'kola-od-tomase-1', site: 'Kola od Tomáše', slug: 'kola-od-tomase' },
  screens: { name: 'Eva Králová', email: 'eva@example.com', password: 'kvetiny-od-evy-1', site: 'Květinářství Fialka', slug: 'kvetinarstvi-fialka' },
}

let cloud = null
let browser = null
const extraSites = [] // made for the phone take and the screenshots: removed at the end

/** Links that would open a new tab stay in this one, so the take is continuous. */
const oneTab = (context) => context.addInitScript(() => {
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element ? e.target.closest('a[target="_blank"]') : null
    if (a) a.setAttribute('target', '_self')
  }, true)
  window.open = (url) => { if (url) location.href = String(url); return null }
})

/** Against a running app an earlier run may hold the address: then this run takes a fresh one, and a fresh e-mail with it. */
async function freeIdentity(base, who) {
  const ctx = await browser.newContext()
  try {
    const free = (await (await ctx.request.get(`${base}/api/slug?slug=${who.slug}`)).json()).ok
    if (!free || arg('fresh', false) === true) { who.slug = `${who.slug}-${stamp}`; who.email = who.email.replace('@', `-${stamp}@`) }
  }
  finally { await ctx.close() }
  return who
}

/** The recording as an MP4. The first moment (a blank page before the app loads) is cut, so the video opens on the start page. */
async function toMp4(webm, out) {
  execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-ss', '0.8', '-i', webm, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out])
}

async function removeSite(ctx, base, id, slug) {
  await ctx.request.post(`${base}/api/sites/${id}/remove`, { data: { confirm: slug } }).catch(() => {})
}

// ── the desktop take ────────────────────────────────────────────────────────────

async function desktopTake(base) {
  log('desktop take')
  const who = await freeIdentity(base, people.desktop)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ', colorScheme: 'light', recordVideo: { dir: raw, size: { width: 1440, height: 900 } } })
  await installCursor(ctx)
  await oneTab(ctx)
  const page = await ctx.newPage()
  const hand = human(page)
  await hand.place(960, 520)

  // The start page.
  await open(page, base)
  await hand.nudge()
  await hand.read(2600)
  await hand.scroll(620, 1300)
  await hand.read(1700)
  await hand.scroll(560, 1200)
  await hand.read(1500)
  await hand.scroll(-1300, 1100)
  await hand.read(500)
  await hand.click(page.locator('[data-cta]'))
  await page.waitForSelector('[data-wizard=ready]')

  // 1 · the template.
  await hand.read(1800)
  await hand.click(page.locator('[data-field=hospitality]'))
  await hand.read(1300)
  await hand.click(page.locator('[data-field=services]'))
  await hand.read(1300)
  await hand.click(page.locator('[data-field=all]'))
  await hand.read(700)
  await hand.click(page.locator('[data-template=basic]'))
  await hand.read(900)
  await hand.click(page.locator('[data-next]').first())

  // 2 · the name and the address.
  await page.waitForSelector('[data-field-name]')
  await hand.read(900)
  await hand.type(page.locator('[data-field-name]'), who.site)
  if (who.slug !== 'pekarna-na-ruzku') await hand.type(page.locator('[data-field-slug]'), who.slug, { clear: true })
  await page.waitForSelector('[data-slug-ok]')
  await hand.read(1900)
  await hand.click(page.locator('[data-next]').first())

  // 3 · the account.
  await page.waitForSelector('[data-field-person]')
  await hand.read(800)
  await hand.type(page.locator('[data-field-person]'), who.name)
  await hand.type(page.locator('[data-field-email]'), who.email)
  await hand.type(page.locator('[data-field-password]'), who.password)
  await hand.read(900)
  await hand.click(page.locator('[data-next]').first(), { after: 200 })

  // Being made: the hand rests while the animals work.
  await page.waitForSelector('[data-build]')
  await hand.rest(420, 700)
  await page.waitForSelector('[data-site-name]', { timeout: 90_000 })
  await hand.read(3200)

  // The site's page, then the website itself.
  await hand.hover(page.locator('[data-site-preview]'))
  await hand.read(1200)
  await hand.click(page.locator('[data-open-site]'), { after: 100 })
  await hand.arrive()
  await hand.read(2600)
  await hand.scroll(700, 1400)
  await hand.read(1500)
  await hand.scroll(-700, 900)
  await hand.read(600)
  await page.goBack()
  await hand.arrive()
  await page.waitForSelector('[data-invite]')
  await hand.read(1500)

  // Into the admin: the invitation, a password, and in.
  await hand.click(page.locator('[data-invite]'), { after: 100 })
  await hand.arrive()
  await page.waitForSelector('input[type=password]')
  await hand.read(1800)
  await hand.type(page.locator('input[type=password]'), who.adminPassword)
  await hand.read(600)
  await hand.click(page.locator('button[type=submit]').first())
  await page.waitForURL(/\/admin\/?$/, { timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  await hand.read(3000)

  // Change the home page's heading.
  await hand.click(page.locator('a[href="/admin/page"]').first())
  await page.waitForURL('**/admin/page')
  await hand.read(1300)
  await hand.click(page.locator('a[href^="/admin/page/"]').filter({ hasText: 'Úvod' }).first())
  await page.waitForURL(/\/admin\/page\/[0-9a-f-]{36}/)
  await page.waitForLoadState('networkidle')
  await hand.read(2200)
  await hand.click(page.getByRole('button', { name: /^Úvod/ }).first())
  await page.waitForSelector('input[name=heading]')
  await hand.read(900)
  const heading = 'Pečeme pro celou ulici.'
  await hand.type(page.locator('input[name=heading]'), heading, { clear: true })
  await hand.read(2200)
  await hand.click(page.getByRole('button', { name: 'Aktualizovat' }).first())
  await hand.read(2600)

  // And see it on the site.
  const site = new URL(page.url()).origin
  const view = page.locator('a[href="/"]').filter({ hasText: 'Zobrazit web' }).first()
  if (await view.isVisible().catch(() => false)) await hand.click(view)
  else await page.goto(site)
  await page.waitForURL(`${site}/`)
  await hand.arrive()
  const shown = await page.locator('h1').first().innerText()
  if (!shown.includes('Pečeme pro celou ulici')) throw new Error(`the site still says "${shown}"`)
  await hand.rest(560, 430)
  await hand.read(4200)

  const video = page.video()
  await ctx.close()
  const webm = await video.path()
  await toMp4(webm, join(preview, 'walkthrough-desktop.mp4'))
  log('  walkthrough-desktop.mp4')
  return who
}

// ── the phone take ──────────────────────────────────────────────────────────────

async function phoneTake(base) {
  log('phone take')
  const who = await freeIdentity(base, people.phone)
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: false, locale: 'cs-CZ', colorScheme: 'light',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  })
  await installCursor(ctx, { touch: true })
  await oneTab(ctx)
  const page = await ctx.newPage()
  const hand = human(page, { speed: 1.1 })
  await hand.place(200, 600)

  await open(page, base)
  // Recorded at device resolution (780 × 1688), which Playwright's own video cannot do.
  const film = await recordFrames(page, join(raw, 'phone'), { ffmpeg })
  await hand.nudge()
  await hand.read(2200)
  await hand.scroll(900, 1500)
  await hand.read(1200)
  await hand.scroll(-900, 900)
  await hand.click(page.locator('[data-cta]'))
  await page.waitForSelector('[data-wizard=ready]')
  await hand.read(1500)
  await hand.scroll(500, 1000)
  await hand.read(900)
  await hand.scroll(-500, 700)
  await hand.click(page.locator('[data-template=basic]'))
  await hand.click(page.locator('[data-next]').first())
  await page.waitForSelector('[data-field-name]')
  await hand.type(page.locator('[data-field-name]'), who.site)
  if (who.slug !== 'kola-od-tomase') await hand.type(page.locator('[data-field-slug]'), who.slug, { clear: true })
  await page.waitForSelector('[data-slug-ok]')
  await hand.read(1500)
  await hand.click(page.locator('[data-next]').first())
  await page.waitForSelector('[data-field-person]')
  await hand.type(page.locator('[data-field-person]'), who.name)
  await hand.type(page.locator('[data-field-email]'), who.email)
  await hand.type(page.locator('[data-field-password]'), who.password)
  await hand.click(page.locator('[data-next]').first(), { after: 200 })
  await page.waitForURL(/\/sites\/[0-9a-f-]{36}$/)
  const id = page.url().split('/').pop()
  extraSites.push({ who, id, slug: who.slug })
  await page.waitForSelector('[data-build]')
  await hand.rest(330, 790)
  await page.waitForSelector('[data-site-name]', { timeout: 90_000 })
  await hand.read(2600)
  await hand.scroll(700, 1300)
  await hand.read(1800)
  await hand.scroll(-700, 900)
  await hand.click(page.locator('[data-open-site]'), { after: 100 })
  await hand.arrive()
  await hand.read(2200)
  await hand.scroll(900, 1500)
  await hand.read(2200)
  await hand.scroll(-900, 1000)
  await hand.read(1200)

  await film.stop(join(preview, 'walkthrough-phone.mp4'))
  await ctx.close()
  log(`  walkthrough-phone.mp4 (${film.frames()} frames)`)
}

// ── every screen, at both widths, and three in the dark ─────────────────────────

const SIZES = { desktop: { width: 1440, height: 900, scale: 1 }, phone: { width: 390, height: 844, scale: 2 } }

async function screensPass(base, main) {
  log('screenshots')
  const who = await freeIdentity(base, people.screens)
  const shots = []
  const shot = async (page, name, { size, dark = false, full = true }) => {
    await sleep(650)
    const file = `${name}--${SIZES[size].width}${dark ? '-dark' : ''}.png`
    await page.screenshot({ path: join(screens, file), fullPage: full })
    shots.push(file)
  }
  const context = (size, dark = false) => browser.newContext({ viewport: { width: SIZES[size].width, height: SIZES[size].height }, deviceScaleFactor: SIZES[size].scale, locale: 'cs-CZ', colorScheme: dark ? 'dark' : 'light' })
  const signIn = async (ctx, person) => {
    const res = await ctx.request.post(`${base}/api/auth/login`, { data: { email: person.email, password: person.password } })
    if (!res.ok()) throw new Error(`could not sign in as ${person.email}`)
  }
  /** The wizard up to its last step, with a screenshot of each, then the site being made and made. */
  const wizard = async (page, opts, { slug, account }) => {
    await open(page, `${base}/new`)
    await page.waitForSelector('[data-wizard=ready]')
    if (opts.wizardShots) await shot(page, '02-template', { ...opts, full: false })
    await page.locator('[data-next]').first().click()
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
    await page.waitForSelector('[data-site-preview] iframe')
    await sleep(1800)
    await shot(page, '07-site-page', opts)
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
      await wizard(page, opts, { slug: who.slug, account: true })
    }
    else {
      // The account step is only shown signed out: take it first, then sign in for the rest.
      await open(page, `${base}/new`)
      await page.waitForSelector('[data-wizard=ready]')
      await shot(page, '02-template', { ...opts, full: false })
      await page.locator('[data-next]').first().click()
      await page.locator('[data-field-name]').fill(who.site)
      await page.locator('[data-field-slug]').fill(`${who.slug}-2`)
      await page.waitForSelector('[data-slug-ok]')
      await shot(page, '03-your-site', opts)
      await page.locator('[data-next]').first().click()
      await page.locator('[data-field-person]').fill(who.name)
      await page.locator('[data-field-email]').fill(who.email)
      await page.locator('[data-field-password]').fill(who.password)
      await shot(page, '04-your-account', opts)
      await page.evaluate(() => localStorage.removeItem('tz-cloud-new'))
      await signIn(ctx, who)
      await wizard(page, { size, wizardShots: false }, { slug: `${who.slug}-2`, account: false })
    }
    await open(page, `${base}/sites`)
    await page.waitForSelector('[data-site]')
    await shot(page, '08-my-websites', opts)
    await open(page, `${base}/account`)
    await shot(page, '09-account', opts)
    // The site's page once the owner has been in the admin: the main take's site.
    if (main) {
      const mine = await browser.newContext({ viewport: { width: SIZES[size].width, height: SIZES[size].height }, deviceScaleFactor: SIZES[size].scale, locale: 'cs-CZ' })
      await signIn(mine, main)
      const p = await mine.newPage()
      await open(p, `${base}/sites`)
      await p.locator('[data-site]').first().click()
      await p.waitForSelector('[data-admin=open]', { timeout: 20_000 }).catch(() => {})
      await p.waitForSelector('[data-site-preview] iframe')
      await sleep(1800)
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
  await signIn(ctx, who)
  await wizard(page, dark, { slug: `${who.slug}-3`, account: false })
  await ctx.close()
  return shots
}

function indexHtml(shots) {
  const have = (f) => existsSync(join(preview, f))
  const extra = existsSync(screens) ? readdirSync(screens).filter((f) => f.startsWith('e2e-')).sort() : []
  const titles = {
    '01-start': 'Úvodní stránka', '02-template': 'Průvodce · šablona', '03-your-site': 'Průvodce · váš web', '04-your-account': 'Průvodce · váš účet',
    '05-being-made': 'Web se staví', '06-made': 'Hotovo', '07-site-page': 'Stránka webu (poprvé)', '08-my-websites': 'Moje weby', '09-account': 'Účet',
    '10-sign-in': 'Přihlášení', '11-forgotten-password': 'Zapomenuté heslo', '12-site-page-after-first-visit': 'Stránka webu (po prvním vstupu do administrace)',
    'e2e-being-made': 'Web se staví (z e2e)', 'e2e-failed': 'Krok se nepovedl · Zkusit znovu', 'e2e-waiting': 'Čeká na potvrzení e-mailu', 'e2e-sites-limit': 'Moje weby · limit',
  }
  const group = (files) => {
    const by = new Map()
    for (const f of files) { const key = f.split('--')[0].replace(/\.png$/, ''); by.set(key, [...(by.get(key) ?? []), f]) }
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b))
  }
  const fig = (f) => `<figure class="${f.includes('--390') ? 'phone' : 'wide'}"><a href="screens/${f}"><img loading="lazy" src="screens/${f}" alt=""></a><figcaption>${f.includes('-dark') ? 'tmavý režim · ' : ''}${f.includes('--390') ? '390 px' : '1440 px'}</figcaption></figure>`
  const section = ([key, files]) => `<section><h3>${titles[key] ?? key}</h3><div class="row">${files.sort((a, b) => a.includes('--390') - b.includes('--390') || a.localeCompare(b)).map(fig).join('')}</div></section>`
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
  <div>${have('walkthrough-desktop.mp4') ? '<video controls preload="metadata" src="walkthrough-desktop.mp4"></video><p style="margin-top:8px">Počítač, 1440 × 900, česky.</p>' : '<p>Video z počítače chybí.</p>'}</div>
  <div>${have('walkthrough-phone.mp4') ? '<video controls preload="metadata" src="walkthrough-phone.mp4"></video><p style="margin-top:8px">Telefon, 390 × 844.</p>' : '<p>Video z telefonu chybí.</p>'}</div>
</div>
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
  let base = given
  if (!base) {
    log('preparing a cloud app of its own')
    await cleanSites(dataDir, 'tzc_walk_')
    await recreateDatabase(DB)
    cloud = await startCloud({
      port: await freePortFrom(3280),
      logFile: join(preview, 'walkthrough-cloud.log'),
      env: {
        NUXT_DATABASE_URL: dbUrl(DB), NUXT_HOSTING_DRIVER: 'local', NUXT_HOSTING_LOCAL_DATA_DIR: dataDir, NUXT_HOSTING_LOCAL_DATABASE_PREFIX: 'tzc_walk_',
        NUXT_HOSTING_LOCAL_PORT_FROM: '4370', NUXT_HOSTING_LOCAL_PORT_TO: '4389', NUXT_MAX_SITES_PER_USER: '3',
        NUXT_REQUIRE_VERIFIED_EMAIL: 'false', NUXT_PUBLIC_SHOW_PLANNED: 'true', NUXT_MAIL_TRANSPORT: 'log',
      },
    })
    base = cloud.url
  }
  base = base.replace(/\/+$/, '')
  log(`cloud app: ${base}`)
  browser = await chromium.launch()

  let main = null
  if (!only || only === 'desktop') main = await desktopTake(base)
  if (!only || only === 'phone') await phoneTake(base)
  let shots = existsSync(screens) ? readdirSync(screens).filter((f) => /^\d\d-/.test(f)) : []
  if (!only || only === 'screens') shots = await screensPass(base, main)
  writeFileSync(join(preview, 'index.html'), indexHtml(shots))
  log(`  index.html (${shots.length} screenshots)`)

  // The sites made only for the phone take and the screenshots go again; the main one stays
  // (against a running app) so there is something to look at.
  const ctxs = new Map()
  for (const s of extraSites) {
    if (!ctxs.has(s.who.email)) {
      const ctx = await browser.newContext()
      await ctx.request.post(`${base}/api/auth/login`, { data: { email: s.who.email, password: s.who.password } })
      ctxs.set(s.who.email, ctx)
    }
    await removeSite(ctxs.get(s.who.email), base, s.id, s.slug)
  }
  if (extraSites.length) {
    await waitFor(async () => {
      for (const s of extraSites) if ((await ctxs.get(s.who.email).request.get(`${base}/api/sites/${s.id}`)).status() !== 404) return false
      return true
    }, { timeout: 60_000, what: 'the extra sites to be removed' }).catch((e) => log(`  ${e.message}`))
  }
  for (const ctx of ctxs.values()) await ctx.close()
  if (main) log(`the main site stays: ${main.site} (${main.email} / ${main.password}; admin password ${main.adminPassword})`)
}
catch (err) {
  failed = err
  console.error('\n' + (err?.stack ?? err))
}
finally {
  await browser?.close().catch(() => {})
  rmSync(raw, { recursive: true, force: true })
  if (cloud) {
    await cloud.stop().catch(() => {})
    if (!keep) {
      await cleanSites(dataDir, 'tzc_walk_').catch((e) => console.error('cleanup:', e.message))
      await dropDatabase(DB).catch(() => {})
    }
  }
  log(failed ? 'FAILED' : `done: ${join(preview, 'index.html')}`)
}
process.exit(failed ? 1 : 0)

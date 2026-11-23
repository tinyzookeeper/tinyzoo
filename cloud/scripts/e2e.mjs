// The whole flow for real, locally, through a browser (Playwright):
//
//   pnpm --filter tinyzoo-cloud e2e            # needs the template built: pnpm --filter tinyzoo-cloud templates:build
//
// It starts a cloud app of its own (database tz_cloud_e2e, sites under .data/e2e, ports
// 4350–4369, app on 3290 or the next free port), so the developer's own data and running
// app are not touched, and removes everything it made at the end (--keep leaves it).
//
// What it proves: sign-up through the wizard, a site made and served with the chosen name,
// the invitation into the admin, two sites made at the same moment, the limit, ownership and
// CSRF checks, a template with looks (the look is chosen in the wizard, kept, shown by the
// site and changed in its admin), removal (process, database and folder gone), a failed step and "Try again",
// a restart of the cloud app bringing stopped sites back, the confirm-your-e-mail-first mode,
// forgot password, and both languages. It also measures how long creation takes and how much
// memory a site process holds.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import {
  alive, arg, cleanSites, cloudDir, databaseExists, dbUrl, dropDatabase, freePortFrom, log, open, recreateDatabase,
  siteProcesses, sleep, startCloud, stopSiteProcesses, templateEntries, templateEntry, waitFor,
} from './lib.mjs'

const keep = arg('keep', false) === true
const headed = arg('headed', false) === true
const DB = 'tz_cloud_e2e'
const dataDir = join(cloudDir, '.data', 'e2e', 'sites')
const preview = join(cloudDir, '.preview')
const shots = join(preview, 'screens')
const stamp = Date.now().toString(36).slice(-5)
const results = []
const measures = { creation: [], memory: [] }

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail })
  log(ok ? '  ✓' : '  ✗', name, detail && !ok ? `— ${detail}` : '')
  if (!ok) throw new Error(`failed: ${name}${detail ? ` (${detail})` : ''}`)
}

for (const [id, entry] of Object.entries(templateEntries)) {
  if (existsSync(entry)) continue
  console.error(`The template "${id}" is not built (${entry}).\nRun: pnpm --filter tinyzoo-cloud templates:build`)
  process.exit(2)
}
mkdirSync(shots, { recursive: true })

const cloudEnv = (extra = {}) => ({
  NUXT_DATABASE_URL: dbUrl(DB),
  NUXT_HOSTING_DRIVER: 'local',
  NUXT_HOSTING_LOCAL_DATA_DIR: dataDir,
  NUXT_HOSTING_LOCAL_DATABASE_PREFIX: 'tzc_e2e_',
  NUXT_HOSTING_LOCAL_PORT_FROM: '4350',
  NUXT_HOSTING_LOCAL_PORT_TO: '4369',
  NUXT_MAX_SITES_PER_USER: '3',
  NUXT_REQUIRE_VERIFIED_EMAIL: 'false',
  NUXT_PUBLIC_SHOW_PLANNED: 'true',
  NUXT_MAIL_TRANSPORT: 'log',
  ...extra,
})

let cloud = null
let browser = null
let templateMoved = false
const bak = `${templateEntry}.e2e-bak`

const internal = (publicUrl) => `http://127.0.0.1:${new URL(publicUrl).port}`
const siteAnswers = async (publicUrl) => {
  try { return (await fetch(`${internal(publicUrl)}/api/health/ready`, { signal: AbortSignal.timeout(3000) })).status === 200 }
  catch { return false }
}

/** Walk the wizard. Signed out: all three steps; signed in: two. Returns the page on the site's own route. */
async function wizard(page, base, { name, slug, person }) {
  await open(page, `${base}/new`)
  await page.waitForSelector('[data-wizard=ready]')
  await page.locator('[data-template=basic]').click()
  await page.locator('[data-next]').first().click()
  await page.locator('[data-field-name]').fill(name)
  if (slug) await page.locator('[data-field-slug]').fill(slug)
  await page.waitForSelector('[data-slug-ok]')
  if (person) {
    await page.locator('[data-next]').first().click()
    await page.locator('[data-field-person]').fill(person.name)
    await page.locator('[data-field-email]').fill(person.email)
    await page.locator('[data-field-password]').fill(person.password)
  }
  const t0 = Date.now()
  await page.locator('[data-next]').first().click()
  await page.waitForURL(/\/sites\/[0-9a-f-]{36}$/)
  return t0
}

const siteIdOf = (page) => page.url().split('/').pop()
async function apiSite(page, base, id) {
  const res = await page.request.get(`${base}/api/sites/${id}?runtime=1`)
  return res.ok() ? (await res.json()) : null
}
function tookMs(site) {
  return Object.fromEntries(site.steps.map((s) => [s.id, Date.parse(s.finishedAt) - Date.parse(s.startedAt)]))
}

async function main() {
  log('preparing: a clean database and folder for this run')
  await cleanSites(dataDir, 'tzc_e2e_')
  await recreateDatabase(DB)
  const port = await freePortFrom(3290)
  cloud = await startCloud({ port, env: cloudEnv(), logFile: join(preview, 'e2e-cloud.log') })
  const base = cloud.url
  log(`cloud app up at ${base}`)

  browser = await chromium.launch({ headless: !headed })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ' })
  const page = await ctx.newPage()
  const jana = { name: 'Jana Nováková', email: `jana-${stamp}@example.com`, password: 'dlouhe-heslo-jany-1' }

  // ── the start page and the wizard ──
  log('1 · start page and wizard')
  await open(page, base)
  check('the start page is in Czech', (await page.locator('h1').innerText()).includes('Vlastní web'))
  await page.locator('[data-cta]').click()
  await page.waitForURL('**/new')
  await page.waitForSelector('[data-wizard=ready]')
  check('planned templates show with the flag, marked', await page.locator('[data-template=restaurant][data-ready=false]').count() === 1 && await page.locator('[data-template=restaurant] [role=radio]').count() === 0)
  await page.locator('[data-template=restaurant]').click({ force: true })
  check('a planned template cannot be picked', await page.locator('[data-template=basic] [role=radio][aria-checked=true]').count() === 1)
  check('twenty-one templates in the gallery', await page.locator('[data-template]').count() === 21)
  // Every card shows a real design: its picture loads, and a template with several looks lets them be glanced at.
  const pictures = await page.evaluate(async () => {
    const cards = [...document.querySelectorAll('[data-template]')]
    const first = cards.map((c) => c.querySelector('img'))
    await Promise.all(first.map((img) => { img.loading = 'eager'; return img.decode().catch(() => {}) }))
    return { cards: cards.length, loaded: first.filter((img) => img.naturalWidth >= 800).length, thumbs: document.querySelectorAll('[data-look-thumb]').length }
  })
  check('every card shows its template\'s real picture', pictures.loaded === 21 && pictures.thumbs === 51, JSON.stringify(pictures))
  await page.locator('[data-template=restaurant] [data-look-thumb=talir]').click()
  check('a planned template\'s looks can be glanced at, and it still cannot be picked', await page.locator('[data-template=restaurant][data-shown-look=talir]').count() === 1 && await page.locator('[data-template=basic] [role=radio][aria-checked=true]').count() === 1)
  await page.locator('[data-field=hospitality]').click()
  check('the field filter narrows the gallery', await page.locator('[data-template]').count() === 2)
  await page.locator('[data-field=all]').click()
  await page.locator('[data-next]').first().click()
  await page.waitForSelector('[data-step=site]')
  check('a template with one design goes straight to the site\'s name', await page.locator('[data-step=look]').count() === 0 && await page.locator('ol [aria-current=step]').innerText() === '2\nVáš web')
  await page.locator('[data-field-name]').fill('Pekárna U Žlutého koně')
  await page.waitForSelector('[data-slug-ok]')
  check('the window beside the form shows the template for real, with the typed name where the site writes it', await page.locator('[data-site-frame] img[src="/templates/basic/basic-top.webp"]').count() === 1 && (await page.locator('[data-site-frame] .shot__name').innerText()).trim() === 'Pekárna U Žlutého koně')
  check('the address is suggested from the name', await page.locator('[data-field-slug]').inputValue() === 'pekarna-u-zluteho-kone')
  await page.locator('[data-field-slug]').fill('admin')
  await page.getByText('Tahle adresa je vyhrazená').waitFor()
  check('a reserved address is refused as you type', true)
  await page.locator('[data-field-slug]').fill(`e2e-pekarna-${stamp}`)
  await page.waitForSelector('[data-slug-ok]')
  await page.reload()
  await page.waitForSelector('html[data-app-ready]')
  await page.waitForSelector('[data-wizard=ready]')
  check('a reload keeps the step and what was typed', await page.locator('[data-field-name]').inputValue() === 'Pekárna U Žlutého koně' && await page.locator('[data-field-slug]').inputValue() === `e2e-pekarna-${stamp}`)
  await page.waitForSelector('[data-slug-ok]')
  await page.locator('[data-next]').first().click()
  await page.locator('[data-field-person]').fill(jana.name)
  await page.locator('[data-field-email]').fill(jana.email)
  await page.locator('[data-field-password]').fill(jana.password)
  const t0 = Date.now()
  await page.locator('[data-next]').first().click()
  await page.waitForURL(/\/sites\/[0-9a-f-]{36}$/)
  await page.waitForSelector('[data-build]')
  await page.screenshot({ path: join(shots, 'e2e-being-made.png') })
  await page.waitForSelector('[data-site-name]', { timeout: 60_000 })
  const screenMs = Date.now() - t0
  const first = await apiSite(page, base, siteIdOf(page))
  check('the site is ready', first?.site.status === 'ready', first?.site.status)
  const realMs = Date.parse(first.site.readyAt) - Date.parse(first.site.createdAt)
  measures.creation.push({ site: first.site.slug, serverMs: realMs, screenMs, steps: tookMs(first.site) })
  log(`    made in ${realMs} ms on the server (${JSON.stringify(tookMs(first.site))}), ${screenMs} ms on screen`)
  check('its address is <slug>.localhost:<port>', new RegExp(`^http://e2e-pekarna-${stamp}\\.localhost:43[56]\\d$`).test(first.site.publicUrl), first.site.publicUrl)

  // ── the website itself ──
  log('2 · the website')
  const web = await ctx.newPage()
  await web.goto(first.site.publicUrl, { waitUntil: 'networkidle' })
  check('the site shows the chosen name in its header', (await web.locator('header').first().innerText()).includes('Pekárna U Žlutého koně'))
  check('the site holds the demo content', (await web.locator('h1').first().innerText()).includes('Chléb'))
  for (const path of ['/aktuality', '/o-nas', '/kontakt', '/en', '/']) await web.goto(first.site.publicUrl + path, { waitUntil: 'networkidle' })
  check('the English version answers', (await web.request.get(`${first.site.publicUrl}/en`)).ok())
  await web.close()

  // ── the admin: a fresh link, then the invitation ──
  log('3 · into the admin')
  const before = await page.locator('[data-invite]').getAttribute('href')
  check('the invitation link leads to the site\'s admin', before.startsWith(`${first.site.publicUrl}/admin/invite/`), before)
  await page.locator('[data-fresh-link]').click()
  await waitFor(async () => (await page.locator('[data-invite]').getAttribute('href')) !== before, { what: 'a fresh invitation link' })
  const invite = await page.locator('[data-invite]').getAttribute('href')
  check('"Make a new link" gives another link', invite !== before)
  const admin = await ctx.newPage()
  await admin.goto(before, { waitUntil: 'networkidle' })
  check('the old link stopped working', await admin.locator('input[type=password]').count() === 0)
  await admin.goto(invite, { waitUntil: 'networkidle' })
  await admin.locator('input[type=password]').fill('heslo-do-administrace-1')
  await admin.locator('button[type=submit]').first().click()
  await admin.waitForURL(/\/admin\/?$/, { timeout: 20_000 })
  await admin.waitForSelector('#cms-main, main')
  check('choosing a password lands in the admin, signed in', new URL(admin.url()).pathname.replace(/\/$/, '') === '/admin')
  await admin.close()
  await page.bringToFront()
  await page.waitForSelector('[data-admin=open]', { timeout: 20_000 })
  check('the site\'s page now says "Open the admin"', true)
  const afterAccept = await apiSite(page, base, first.site.id)
  check('the invitation link is no longer sent to the browser', afterAccept.site.inviteUrl === null && afterAccept.site.ownerAccepted)

  // ── two more at the same moment ──
  log('4 · two sites made at the same moment, while the first runs')
  const made = await Promise.all(['dva', 'tri'].map((n) => page.request.post(`${base}/api/sites`, { data: { name: `Web ${n}`, slug: `e2e-${n}-${stamp}`, template: 'basic' } })))
  check('both are accepted', made.every((r) => r.status() === 201))
  const ids = await Promise.all(made.map(async (r) => (await r.json()).site.id))
  const both = await waitFor(async () => {
    const sites = await Promise.all(ids.map((id) => apiSite(page, base, id)))
    if (sites.some((s) => s.site.status === 'failed')) throw new Error(`a site failed: ${JSON.stringify(sites.map((s) => s.site.steps))}`)
    return sites.every((s) => s.site.status === 'ready') ? sites : null
  }, { timeout: 90_000, what: 'both sites to be ready' })
  for (const s of both) measures.creation.push({ site: s.site.slug, serverMs: Date.parse(s.site.readyAt) - Date.parse(s.site.createdAt), steps: tookMs(s.site) })
  const urls = [first.site.publicUrl, ...both.map((s) => s.site.publicUrl)]
  check('each has a port of its own', new Set(urls.map((u) => new URL(u).port)).size === 3, urls.join(' '))
  check('all three answer', (await Promise.all(urls.map(siteAnswers))).every(Boolean))
  check('three site processes run', (await siteProcesses(dataDir)).length === 3)

  log('5 · the limit')
  await open(page, `${base}/sites`)
  await page.waitForSelector('[data-limit]')
  check('"My websites" shows three cards and explains the limit', await page.locator('[data-site]').count() === 3 && await page.locator('[data-another]').count() === 0)
  await page.screenshot({ path: join(shots, 'e2e-sites-limit.png'), fullPage: true })
  const fourth = await page.request.post(`${base}/api/sites`, { data: { name: 'Čtvrtý', slug: `e2e-ctyri-${stamp}`, template: 'basic' } })
  check('a fourth site is refused', fourth.status() === 403 && (await fourth.json()).data?.code === 'sites.limit')
  await open(page, `${base}/new`)
  await page.waitForSelector('[data-wizard=ready]')
  check('the wizard says so instead of starting', (await page.locator('main').innerText()).includes('Další web už se na účet nevejde'))

  // ── someone else, and requests that should be refused ──
  log('6 · ownership and refused requests')
  const other = await browser.newContext({ locale: 'cs-CZ' })
  const signup = await other.request.post(`${base}/api/auth/signup`, { data: { name: 'Cizí Člověk', email: `cizi-${stamp}@example.com`, password: 'uplne-jine-heslo-1' } })
  check('another person signs up', signup.status() === 201)
  check('they cannot read my site', (await other.request.get(`${base}/api/sites/${first.site.id}`)).status() === 404)
  check('they cannot delete my site', (await other.request.post(`${base}/api/sites/${first.site.id}/remove`, { data: { confirm: first.site.slug } })).status() === 404)
  check('they cannot get an invitation link to it', (await other.request.post(`${base}/api/sites/${first.site.id}/invite`)).status() === 404)
  const taken = await (await other.request.get(`${base}/api/slug?slug=${first.site.slug}`)).json()
  check('a taken address is reported, with a free one close to it', taken.problem === 'taken' && taken.suggestion === `${first.site.slug}-2`, JSON.stringify(taken))
  check('a planned template is refused by the server', (await other.request.post(`${base}/api/sites`, { data: { name: 'X', slug: `e2e-x-${stamp}`, template: 'restaurant' } })).status() === 422)
  check('a bad address is refused by the server', (await other.request.post(`${base}/api/sites`, { data: { name: 'X', slug: 'Bad_Slug"; drop', template: 'basic' } })).status() === 422)
  const anon = await browser.newContext()
  check('signed out, the API answers 401', (await anon.request.get(`${base}/api/sites`)).status() === 401)
  check('a form post is refused (415)', (await anon.request.post(`${base}/api/auth/login`, { form: { email: jana.email, password: jana.password } })).status() === 415)
  check('a cross-site post is refused (403)', (await anon.request.post(`${base}/api/auth/login`, { data: { email: jana.email, password: jana.password }, headers: { 'sec-fetch-site': 'cross-site' } })).status() === 403)
  check('a wrong password is refused (401)', (await anon.request.post(`${base}/api/auth/login`, { data: { email: jana.email, password: 'spatne-heslo-123' } })).status() === 401)
  const pageHtml = await (await page.request.get(`${base}/sites/${first.site.id}`)).text()
  const secrets = JSON.stringify(afterAccept) + pageHtml
  check('no secret reaches the browser', !/servicePassword|appSecret|setupToken|statusToken|NUXT_APP_SECRET/.test(secrets))
  await other.close()
  await anon.close()

  // ── a template with looks ──
  log('6b · a template with looks: Photographer')
  const ctxP = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ' })
  const pp = await ctxP.newPage()
  const johana = { name: 'Johana Loudová', email: `johana-${stamp}@example.com`, password: 'dlouhe-heslo-johany-1' }
  await open(pp, `${base}/new`)
  await pp.waitForSelector('[data-wizard=ready]')
  await pp.locator('[data-template=photographer]').click()
  await pp.locator('[data-next]').first().click()
  await pp.waitForSelector('[data-step=look]')
  check('picking Photographer leads to its looks', await pp.locator('[data-look]').count() === 3)
  check('the first look is chosen to begin with', await pp.locator('[data-look=atelier][aria-checked=true]').count() === 1)
  check('the wizard has four steps now', await pp.locator('ol [aria-current=step]').innerText() === '2\nVzhled' && await pp.locator('ol > li').count() === 4)
  await pp.screenshot({ path: join(shots, 'e2e-look.png'), fullPage: true })
  await pp.locator('[data-look=negativ]').click()
  check('another look can be picked', await pp.locator('[data-look=negativ][aria-checked=true]').count() === 1 && await pp.locator('[data-picked-look]').innerText() === 'Negativ')
  await pp.reload()
  await pp.waitForSelector('html[data-app-ready]')
  await pp.waitForSelector('[data-wizard=ready]')
  check('a reload keeps the step and the look', await pp.locator('[data-look=negativ][aria-checked=true]').count() === 1)
  await pp.locator('[data-next]').first().click()
  await pp.locator('[data-field-name]').fill('Ateliér Světlo')
  await pp.locator('[data-field-slug]').fill(`e2e-atelier-${stamp}`)
  await pp.waitForSelector('[data-slug-ok]')
  check('the look is in the summary beside the template', (await pp.locator('aside dl').innerText()).replace(/\s+/g, ' ').includes('Šablona Fotograf Vzhled Negativ'))
  check('the window shows the chosen look with the typed name', await pp.locator('[data-site-frame] img[src="/templates/photographer/negativ-top.webp"]').count() === 1 && (await pp.locator('[data-site-frame] .shot__name').innerText()).trim().toLowerCase() === 'ateliér světlo')
  await pp.locator('[data-next]').first().click()
  await pp.locator('[data-field-person]').fill(johana.name)
  await pp.locator('[data-field-email]').fill(johana.email)
  await pp.locator('[data-field-password]').fill(johana.password)
  await pp.locator('[data-next]').first().click()
  await pp.waitForURL(/\/sites\/[0-9a-f-]{36}$/)
  await pp.waitForSelector('[data-site-name]', { timeout: 180_000 })
  const photo = await apiSite(pp, base, siteIdOf(pp))
  check('the Photographer site is ready, with its look kept', photo?.site.status === 'ready' && photo.site.template === 'photographer' && photo.site.look === 'negativ', JSON.stringify([photo?.site.status, photo?.site.look]))
  measures.creation.push({ site: photo.site.slug, template: 'photographer', serverMs: Date.parse(photo.site.readyAt) - Date.parse(photo.site.createdAt), steps: tookMs(photo.site) })
  log(`    made in ${Date.parse(photo.site.readyAt) - Date.parse(photo.site.createdAt)} ms on the server (${JSON.stringify(tookMs(photo.site))})`)
  check('its page in the cloud names the look', (await pp.locator('main').innerText()).replace(/\s+/g, ' ').includes('Vzhled Negativ'))

  const pw = await ctxP.newPage()
  await pw.goto(photo.site.publicUrl, { waitUntil: 'networkidle' })
  const lookOn = (p) => p.evaluate(() => ({ look: document.documentElement.dataset.look, colors: document.documentElement.dataset.colors, brand: getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() }))
  check('the website is drawn in the chosen look, in its default colours', JSON.stringify(await lookOn(pw)) === JSON.stringify({ look: 'negativ', colors: 'mosaz', brand: '#d4b57e' }), JSON.stringify(await lookOn(pw)))
  check('it shows the chosen name as its wordmark', (await pw.locator('header').first().innerText()).toLowerCase().includes('ateliér světlo') && (await pw.locator('footer').innerText()).toLowerCase().includes('ateliér světlo'))
  check('it holds the demo content', (await pw.locator('h1').first().innerText()).toLowerCase().includes('fotím') && await pw.locator('.mosaic a.tile').count() === 14)
  // Negativ lays its heading over the photograph: it opens on the block's photograph for dark looks.
  const opening = await pw.evaluate(async () => {
    const page = (await (await fetch('/api/content/page/home')).json()).item
    const hero = page.sections.find((s) => s.type === 'hero')
    return { dark: hero.darkImage?.url ?? null, first: hero.images[0]?.image?.url ?? null, shown: document.querySelector('main section img')?.getAttribute('src') ?? '' }
  })
  check('Negativ opens on the photograph for dark looks', !!opening.dark && opening.dark !== opening.first && opening.shown === opening.dark, JSON.stringify(opening))
  const theme = await pw.evaluate(async () => (await (await fetch('/api/cms/_theme')).json()).name)
  check('the site\'s admin is called by the site\'s name', theme === 'Ateliér Světlo', JSON.stringify(theme))
  check('its photographs are served', await pw.evaluate(async () => { const img = document.querySelector('.mosaic img'); return !!img && (await fetch(img.currentSrc)).ok }))
  for (const path of ['/galerie', '/galerie/svatby', '/album/anna-a-vojta', '/cenik', '/o-mne', '/kontakt', '/ochrana-osobnich-udaju']) {
    const res = await pw.goto(photo.site.publicUrl + path, { waitUntil: 'networkidle' })
    check(`${path} answers with one heading`, res.status() === 200 && await pw.locator('h1').count() === 1, `${res.status()}`)
  }
  // An album's photograph opens large over the page; the keyboard leads on and closes it.
  await pw.goto(`${photo.site.publicUrl}/album/anna-a-vojta`, { waitUntil: 'networkidle' })
  await pw.locator('[data-photo]').nth(1).click()
  await pw.waitForSelector('[data-lightbox]')
  const count = () => pw.locator('[data-lightbox-count]').innerText()
  const at2 = await count()
  await pw.keyboard.press('ArrowRight')
  await pw.waitForFunction((was) => document.querySelector('[data-lightbox-count]')?.textContent !== was, at2)
  const at3 = await count()
  await pw.keyboard.press('ArrowLeft')
  await pw.waitForFunction((was) => document.querySelector('[data-lightbox-count]')?.textContent !== was, at3)
  check('an album photograph opens large, and the arrows lead to the next and back', at2.startsWith('02') && at3.startsWith('03') && (await count()) === at2 && await pw.locator('[data-lightbox] img').first().isVisible(), `${at2} → ${at3}`)
  await pw.keyboard.press('Escape')
  await pw.waitForSelector('[data-lightbox]', { state: 'detached' })
  check('Escape closes it, and the page is where it was', new URL(pw.url()).pathname === '/album/anna-a-vojta' && await pw.evaluate(() => document.documentElement.style.overflow === ''))
  await pw.goto(`${photo.site.publicUrl}/kontakt`, { waitUntil: 'networkidle' })
  await pw.locator('form [name=name]').fill('Tereza Malá')
  await pw.locator('form [name=email]').fill(`tereza-${stamp}@example.com`)
  await pw.locator('form [name=message]').fill('Dobrý den, máte volno 12. 6. 2027?')
  await pw.locator('form button[type=submit]').click()
  await pw.locator('[role=status]').waitFor({ timeout: 15_000 })
  check('the enquiry form sends', (await pw.locator('[role=status]').innerText()).includes('Děkuji'))

  // Its owner changes the look and the colours in the site's own admin (here through the admin's API, signed in by the invitation).
  await pw.goto(await pp.locator('[data-invite]').getAttribute('href'), { waitUntil: 'networkidle' })
  await pw.locator('input[type=password]').fill('heslo-do-administrace-2')
  await pw.locator('button[type=submit]').first().click()
  await pw.waitForURL(/\/admin\/?$/, { timeout: 20_000 })
  const changed = await pw.evaluate(async () => {
    const json = { accept: 'application/json', 'content-type': 'application/json' }
    const { row } = await (await fetch('/api/cms/_singleton/siteSettings', { headers: json })).json()
    const skip = new Set(['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'])
    const body = Object.fromEntries(Object.entries(row).filter(([k]) => !skip.has(k) && !k.endsWith('__media') && !(k.endsWith('Id') && k.slice(0, -2) in row)))
    const messages = await (await fetch('/api/cms/enquiry', { headers: json })).json()
    const put = await fetch('/api/cms/_singleton/siteSettings', { method: 'PUT', headers: json, body: JSON.stringify({ ...body, look: 'zapisnik', colors: 'svestka' }) })
    return { was: { look: row.look, colors: row.colors, siteName: row.siteName }, put: put.status, enquiries: (messages.items ?? messages.rows ?? []).length, body }
  })
  check('the settings hold what the wizard chose', changed.was.look === 'negativ' && changed.was.colors === 'mosaz' && changed.was.siteName === 'Ateliér Světlo', JSON.stringify(changed.was))
  check('the enquiry arrived in the admin', changed.enquiries === 1, JSON.stringify(changed))
  check('the owner can save another look and colours', changed.put === 200, String(changed.put))
  await pw.goto(photo.site.publicUrl, { waitUntil: 'networkidle' })
  check('the website follows: another look, other colours, the same content', JSON.stringify(await lookOn(pw)) === JSON.stringify({ look: 'zapisnik', colors: 'svestka', brand: '#753a57' }) && (await pw.locator('h1').first().innerText()).includes('Fotím') && await pw.locator('.prints a.print').count() === 14, JSON.stringify(await lookOn(pw)))
  await pp.reload()
  await pp.waitForSelector('[data-site-name]')
  check('the cloud\'s page of the site names the look it shows now', (await apiSite(pp, base, siteIdOf(pp)))?.site.look === 'zapisnik' && (await pp.locator('main').innerText()).replace(/\s+/g, ' ').includes('Vzhled Zápisník'))
  // Every look draws the same page: one main heading, the same sections, whatever the look.
  const drawn = {}
  for (const look of ['atelier', 'negativ', 'zapisnik']) {
    await pw.evaluate(({ body, look }) => fetch('/api/cms/_singleton/siteSettings', { method: 'PUT', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ ...body, look, colors: 'bronz' }) }), { body: changed.body, look })
    await pw.goto(photo.site.publicUrl, { waitUntil: 'networkidle' })
    drawn[look] = await pw.evaluate(() => ({ look: document.documentElement.dataset.look, colors: document.documentElement.dataset.colors, h1: document.querySelectorAll('h1').length, headings: [...document.querySelectorAll('main h1, main h2')].map((h) => h.textContent.trim().replace(/\s+/g, ' ').toLowerCase()).join(' | ') }))
  }
  check('each look has one main heading on the home page', Object.values(drawn).every((d) => d.h1 === 1), JSON.stringify(drawn))
  check('the three looks show the same sections in the same order', new Set(Object.values(drawn).map((d) => d.headings)).size === 1, JSON.stringify(drawn))
  check('colours of another look give way to the look\'s own', drawn.atelier.colors === 'bronz' && drawn.negativ.colors === 'mosaz' && drawn.zapisnik.colors === 'inkoust', JSON.stringify(drawn))
  await pw.close()

  const badLook = await pp.request.post(`${base}/api/sites`, { data: { name: 'X', slug: `e2e-y-${stamp}`, template: 'photographer', look: 'nope' } })
  check('a look the template does not have is refused by the server', badLook.status() === 422 && (await badLook.json()).data?.code === 'look.unavailable')
  check('a look for a template without looks is refused too', (await pp.request.post(`${base}/api/sites`, { data: { name: 'X', slug: `e2e-y-${stamp}`, template: 'basic', look: 'atelier' } })).status() === 422)
  // (removed here, so the counts of the sections that follow stay Jana's three)
  const photoPid = (await siteProcesses(dataDir)).find((p) => p.slug === photo.site.slug)?.pid
  check('removing it is accepted', (await pp.request.post(`${base}/api/sites/${photo.site.id}/remove`, { data: { confirm: photo.site.slug } })).ok())
  await waitFor(async () => !(await alive(photoPid)) && !existsSync(join(dataDir, photo.site.slug)), { what: 'the Photographer site to be removed' })
  check('its process, folder and database are gone', !(await databaseExists(`tzc_e2e_${photo.site.slug.replace(/-/g, '_')}`)))
  await ctxP.close()

  // ── memory, after a few page loads ──
  for (const p of await siteProcesses(dataDir)) measures.memory.push({ site: p.slug, rssMB: Math.round(p.rssBytes / 1048576) })
  log(`    memory of the site processes: ${measures.memory.map((m) => `${m.site} ${m.rssMB} MB`).join(', ')}`)

  // ── delete one ──
  log('7 · delete a website')
  const doomed = both[1].site
  const doomedPid = (await siteProcesses(dataDir)).find((p) => p.slug === doomed.slug)?.pid
  const doomedDb = `tzc_e2e_${doomed.slug.replace(/-/g, '_')}`
  check('before: its process, database and folder exist', !!doomedPid && await databaseExists(doomedDb) && existsSync(join(dataDir, doomed.slug)))
  await open(page, `${base}/sites/${doomed.id}`)
  await page.locator('[data-delete]').click()
  await page.locator('[data-confirm]').fill('neco-jineho')
  check('the button stays off until the address is typed', await page.locator('[data-confirm-delete]').isDisabled())
  await page.locator('[data-confirm]').fill(doomed.slug)
  await page.locator('[data-confirm-delete]').click()
  await page.waitForURL('**/sites', { timeout: 30_000 })
  await waitFor(async () => !(await alive(doomedPid)), { what: 'the site process to stop' })
  check('its process is gone', !(await alive(doomedPid)))
  check('its database is gone', !(await databaseExists(doomedDb)))
  check('its folder is gone', !existsSync(join(dataDir, doomed.slug)))
  check('it no longer answers', !(await siteAnswers(doomed.publicUrl)))
  check('the others still answer', (await Promise.all([first.site.publicUrl, both[0].site.publicUrl].map(siteAnswers))).every(Boolean))
  await page.waitForSelector('[data-site]')
  check('"My websites" shows two', await page.locator('[data-site]').count() === 2)
  check('its address is free again', (await (await page.request.get(`${base}/api/slug?slug=${doomed.slug}`)).json()).ok === true)

  // ── a step fails; "Try again" goes on ──
  log('8 · a failed step and "Try again"')
  renameSync(templateEntry, bak); templateMoved = true
  await wizard(page, base, { name: 'Zkouška nezdaru', slug: `e2e-nezdar-${stamp}` })
  await page.waitForSelector('[data-build=failed]', { timeout: 30_000 })
  check('the failure is said in plain words', (await page.locator('[data-fail-text]').innerText()).includes('Šablona ještě není sestavená'))
  await page.screenshot({ path: join(shots, 'e2e-failed.png') })
  renameSync(bak, templateEntry); templateMoved = false
  await page.locator('[data-retry]').click()
  await page.waitForSelector('[data-site-name]', { timeout: 60_000 })
  const retried = await apiSite(page, base, siteIdOf(page))
  check('after "Try again" the site is ready', retried.site.status === 'ready' && await siteAnswers(retried.site.publicUrl))
  check('the failed step was tried twice, the others once', retried.site.steps[0].attempts === 2 && retried.site.steps[3].attempts === 1, JSON.stringify(retried.site.steps.map((s) => s.attempts)))

  // ── restart: the cloud app stops, the sites stop, everything comes back ──
  log('9 · restart of the cloud app (sites stopped too, as after a reboot)')
  const expected = [first.site, both[0].site, retried.site]
  await cloud.stop()
  await stopSiteProcesses(dataDir)
  check('nothing runs any more', (await siteProcesses(dataDir)).length === 0 && !(await siteAnswers(first.site.publicUrl)))
  cloud = await startCloud({ port, env: cloudEnv({ NUXT_REQUIRE_VERIFIED_EMAIL: 'true' }), logFile: join(preview, 'e2e-cloud.log') })
  await waitFor(async () => (await Promise.all(expected.map((s) => siteAnswers(s.publicUrl)))).every(Boolean), { timeout: 60_000, what: 'the sites to come back' })
  check('the three remaining sites are up again at the same addresses', (await siteProcesses(dataDir)).length === 3)
  await open(page, `${base}/sites/${first.site.id}`)
  await page.waitForSelector('[data-site-name]')
  check('the session survived the restart', (await page.locator('[data-site-name]').innerText()) === 'Pekárna U Žlutého koně')
  const again = await ctx.newPage()
  await again.goto(first.site.publicUrl, { waitUntil: 'networkidle' })
  check('its content is still there', (await again.locator('header').first().innerText()).includes('Pekárna U Žlutého koně'))
  await again.close()

  // ── confirm the e-mail first ──
  log('10 · a site waits for the e-mail to be confirmed (NUXT_REQUIRE_VERIFIED_EMAIL=true)')
  const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ' })
  const p3 = await ctx3.newPage()
  const petr = { name: 'Petr Svoboda', email: `petr-${stamp}@example.com`, password: 'petrovo-dlouhe-heslo' }
  await wizard(p3, base, { name: 'Truhlářství Svoboda', slug: `e2e-truhlar-${stamp}`, person: petr })
  await p3.waitForSelector('[data-build=waiting]')
  const waitingId = siteIdOf(p3)
  await sleep(1500)
  check('the site waits: nothing was made yet', (await apiSite(p3, base, waitingId)).site.status === 'waiting' && !existsSync(join(dataDir, `e2e-truhlar-${stamp}`)))
  await p3.screenshot({ path: join(shots, 'e2e-waiting.png') })
  check('in development the confirmation link is on the page', await p3.locator('[data-dev-link]').count() === 1)
  await p3.locator('[data-dev-link]').click()
  await p3.waitForSelector('[data-verify=done]')
  await p3.waitForURL(new RegExp(`/sites/${waitingId}$`), { timeout: 15_000 })
  await p3.waitForSelector('[data-site-name]', { timeout: 60_000 })
  const confirmed = await apiSite(p3, base, waitingId)
  check('confirming the e-mail started the site, and it is ready', confirmed.site.status === 'ready' && await siteAnswers(confirmed.site.publicUrl))
  check('the account is marked confirmed', (await (await p3.request.get(`${base}/api/account`)).json()).user.emailVerified === true)

  // ── the account: language, name, forgotten password ──
  log('11 · account: language, sign out, forgotten password')
  await p3.locator('[data-locale-switch]').click()
  await p3.getByText('Open the website').first().waitFor()
  check('the pages switch to English', true)
  check('the choice is kept on the account', (await (await p3.request.get(`${base}/api/account`)).json()).user.locale === 'en')
  await open(p3, `${base}/account`)
  await p3.locator('[data-account-menu]').click()
  await p3.getByRole('menuitem', { name: 'Sign out' }).click()
  await p3.waitForURL(base + '/')
  check('signed out, a site page leads to signing in', (await p3.goto(`${base}/sites/${waitingId}`), p3.url().includes('/login?next=')))
  await open(p3, `${base}/forgot`)
  await p3.locator('[data-field-email]').fill(petr.email)
  await p3.locator('[data-submit]').click()
  await p3.locator('[data-dev-link]').click()
  await p3.waitForURL('**/reset/**')
  await p3.waitForSelector('html[data-app-ready]')
  await p3.locator('[data-field-password]').fill('petrovo-nove-heslo-22')
  await p3.locator('[data-submit]').click()
  await p3.waitForURL('**/sites')
  await p3.waitForSelector('[data-site]')
  check('a reset link sets a new password and signs in', await p3.locator('[data-site]').count() === 1)
  const fresh = await browser.newContext()
  check('the old password no longer works', (await fresh.request.post(`${base}/api/auth/login`, { data: { email: petr.email, password: petr.password } })).status() === 401)
  check('the new one does', (await fresh.request.post(`${base}/api/auth/login`, { data: { email: petr.email, password: 'petrovo-nove-heslo-22' } })).status() === 200)
  const unknown = await fresh.request.post(`${base}/api/auth/forgot`, { data: { email: `nikdo-${stamp}@example.com` } })
  check('asking for an unknown address answers the same', unknown.status() === 200 && (await unknown.json()).devResetUrl === null)
  await fresh.close()
  await ctx3.close()

  for (const p of await siteProcesses(dataDir)) measures.memory.push({ site: p.slug, rssMB: Math.round(p.rssBytes / 1048576), after: 'restart' })
}

let failed = null
try {
  await main()
}
catch (err) {
  failed = err
  console.error('\n' + (err?.stack ?? err))
}
finally {
  if (templateMoved && existsSync(bak)) renameSync(bak, templateEntry)
  await browser?.close().catch(() => {})
  await cloud?.stop().catch(() => {})
  if (!keep) {
    await cleanSites(dataDir, 'tzc_e2e_').catch((e) => console.error('cleanup:', e.message))
    await dropDatabase(DB).catch(() => {})
  }
  const summary = { at: new Date().toISOString(), ok: !failed, checks: results.length, failedAt: failed ? String(failed.message) : null, measures, results }
  writeFileSync(join(preview, 'e2e-result.json'), JSON.stringify(summary, null, 2))
  log(failed ? `FAILED after ${results.length} checks` : `all ${results.length} checks passed`)
  if (measures.creation.length) log('creation (server):', measures.creation.map((c) => `${c.serverMs} ms`).join(', '))
  if (measures.memory.length) log('memory:', measures.memory.map((m) => `${m.rssMB} MB`).join(', '))
  if (failed && existsSync(join(preview, 'e2e-cloud.log'))) console.error('--- last lines of the cloud app log ---\n' + readFileSync(join(preview, 'e2e-cloud.log'), 'utf8').split('\n').slice(-25).join('\n'))
}
process.exit(failed ? 1 : 0)

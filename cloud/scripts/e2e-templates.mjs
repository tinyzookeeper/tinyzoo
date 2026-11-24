// The part of the end-to-end check every hosted template goes through (templates/<id>), and
// what each template adds of its own. Run by scripts/e2e.mjs:
//
//   pnpm --filter tinyzoo-cloud e2e                        # the whole flow, then every hosted template
//   pnpm --filter tinyzoo-cloud e2e --templates wedding    # only these templates' part
//
// All of them are designs of the one app (templates/app), each site a process of it in its
// multi-tenant mode; the site's <html> says which design draws it.
// For each template: a site is made from its last look (not the default one), with the typed
// name; it is drawn in that look and its default colours; then, signed in to the site's admin
// through the invitation, every look is set with each of its palettes and checked: the look
// and the palette's own colours on the page, one main heading, the same sections whatever the
// look, nothing wider than a phone's screen. Then the template's own checks (its form sends,
// a gift is reserved…), and the site is removed.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUILT_TEMPLATES, log, looksOf, open, waitFor } from './lib.mjs'

/**
 * What a template adds to the common checks: `scripts/e2e/<id>.mjs`, whose default export is
 *   name    the name the site is made with
 *   named   (page) => whether the page carries that name where the look writes it
 *   extra   ({ page, origin, check, site }) => the template's own checks; `page` is signed in to
 *           the site's admin, so `/api/cms/…` answers it
 */
async function checksOf(id) {
  const file = join(dirname(fileURLToPath(import.meta.url)), 'e2e', `${id}.mjs`)
  if (!existsSync(file)) throw new Error(`scripts/e2e/${id}.mjs is missing: the template "${id}" has no checks of its own`)
  return (await import(file)).default
}

/** The settings as the admin's API takes them back: without what the server keeps itself. */
const SETTINGS = `async () => {
  const json = { accept: 'application/json', 'content-type': 'application/json' }
  const { row } = await (await fetch('/api/cms/_singleton/siteSettings', { headers: json })).json()
  const skip = new Set(['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'])
  return Object.fromEntries(Object.entries(row).filter(([k]) => !skip.has(k) && !k.endsWith('__media') && !(k.endsWith('Id') && k.slice(0, -2) in row)))
}`

const drawn = (page) => page.evaluate(() => ({
  design: document.documentElement.dataset.design, look: document.documentElement.dataset.look, colors: document.documentElement.dataset.colors,
  vars: Object.fromEntries((document.documentElement.getAttribute('style') ?? '').split(';').filter(Boolean).map((d) => d.split(':').map((x) => x.trim()))),
  h1: document.querySelectorAll('h1').length,
  // (the sections' headings; the main one may carry the look's own sign between two names)
  sections: [...document.querySelectorAll('main h2')].map((h) => h.textContent.trim().replace(/\s+/g, ' ').toLowerCase()).join(' | '),
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}))

/**
 * Check the hosted templates named (all of them without names, except those with a section of
 * their own in e2e.mjs). `signUp(id)` gives a browser context signed in to the cloud as a new person (asked for every eight templates).
 */
export async function checkHostedTemplates({ browser, signUp, base, stamp, dataDir, check, measures, only = null, skip = [] }) {
  // One account may make ten websites an hour (and one address ten accounts in ten minutes):
  // a new person for every eight templates.
  let ctx = null
  let checked = 0
  for (const built of BUILT_TEMPLATES) {
    if (only ? !only.includes(built.id) : (skip.includes(built.id) || !built.dir.startsWith('templates/'))) continue
    if (checked++ % 8 === 0) {
      await ctx?.close()
      ctx = await signUp(built.id)
    }
    const page = await ctx.newPage()
    const spec = await checksOf(built.id)
    const looks = await looksOf(built)
    const chosen = looks.all[looks.all.length - 1]
    log(`· template ${built.id}: a site in the look ${chosen.id}`)
    const slug = `e2e-${built.id}-${stamp}`
    const made = await page.request.post(`${base}/api/sites`, { data: { name: spec.name, slug, template: built.id, look: chosen.id } })
    check(`${built.id}: the server takes the site`, made.ok(), `${made.status()} ${made.ok() ? '' : await made.text()}`)
    const { site: asked } = await made.json()
    const site = await waitFor(async () => {
      const s = (await (await page.request.get(`${base}/api/sites/${asked.id}`)).json()).site
      if (s.status === 'failed') throw new Error(`${slug} could not be made: ${s.errorDetail ?? ''}`)
      return s.status === 'ready' ? s : null
    }, { timeout: 240_000, every: 500, what: `${slug} to be made` })
    measures.creation.push({ site: slug, template: built.id, serverMs: Date.parse(site.readyAt) - Date.parse(site.createdAt) })
    const origin = site.publicUrl

    // The site as a visitor sees it.
    const wide = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ' })
    const web = await wide.newPage()
    // What goes wrong in the browser on the website's own pages: an exception, a page that the
    // browser had to draw again because the server's answer did not match (hydration). Not the
    // admin's pages (tinyzoo's own), and not an answer that is refused on purpose (the 404 above).
    const errors = []
    const onSite = () => !new URL(web.url()).pathname.startsWith('/admin')
    web.on('pageerror', (e) => { if (onSite()) errors.push(`${new URL(web.url()).pathname}: ${String(e).slice(0, 200)}`) })
    web.on('console', (m) => { if (m.type() === 'error' && onSite() && !m.text().startsWith('Failed to load resource')) errors.push(`${new URL(web.url()).pathname}: ${m.text().slice(0, 200)}`) })
    await web.goto(origin, { waitUntil: 'networkidle' })
    const first = await drawn(web)
    check(`${built.id}: the site is drawn in the chosen look and its default colours`, first.look === chosen.id && first.colors === chosen.presets[0].id, JSON.stringify([first.look, first.colors]))
    check(`${built.id}: the one app draws it as its own design`, first.design === built.id, String(first.design))
    check(`${built.id}: it carries the typed name`, await spec.named(web))
    check(`${built.id}: its admin is called by the site's name`, await web.evaluate(async () => (await (await fetch('/api/cms/_theme')).json()).name) === spec.name)
    check(`${built.id}: its pictures are served`, await web.evaluate(async () => { const img = [...document.images].find((i) => i.currentSrc); return !!img && (await fetch(img.currentSrc)).ok }))
    const missing = await web.goto(`${origin}/tahle-stranka-neni`, { waitUntil: 'networkidle' })
    check(`${built.id}: an address that leads nowhere answers 404 in the look`, missing.status() === 404 && await web.locator('header').count() >= 1 && await web.locator('h1').count() === 1, String(missing.status()))

    // Into the site's admin, through the invitation the cloud shows its owner.
    await open(page, `${base}/sites/${site.id}`)
    await web.goto(await page.locator('[data-invite]').getAttribute('href'), { waitUntil: 'networkidle' })
    await web.locator('input[type=password]').fill('heslo-do-administrace-3')
    await web.locator('button[type=submit]').first().click()
    await web.waitForURL(/\/admin\/?$/, { timeout: 20_000 })
    const body = await web.evaluate(`(${SETTINGS})()`)
    check(`${built.id}: the settings hold what was chosen`, body.look === chosen.id && body.colors === chosen.presets[0].id && body.siteName === spec.name, JSON.stringify([body.look, body.colors, body.siteName]))

    // Every look, in each of its palettes, on a desktop and on a phone.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'cs-CZ', isMobile: true, hasTouch: true })
    const small = await phone.newPage()
    const sections = new Set()
    for (const look of looks.all) {
      for (const preset of look.presets) {
        const put = await web.evaluate(({ body, look, colors }) => fetch('/api/cms/_singleton/siteSettings', { method: 'PUT', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ ...body, look, colors }) }).then((r) => r.status), { body, look: look.id, colors: preset.id })
        await web.goto(origin, { waitUntil: 'networkidle' })
        const d = await drawn(web)
        const same = Object.entries(preset.vars).every(([k, v]) => d.vars[k] === v)
        check(`${built.id}/${look.id}/${preset.id}: drawn in this look and these colours, one main heading, nothing too wide`, put === 200 && d.look === look.id && d.colors === preset.id && same && d.h1 === 1 && d.overflow <= 0, JSON.stringify({ put, look: d.look, colors: d.colors, same, h1: d.h1, overflow: d.overflow }))
        sections.add(d.sections)
        if (preset === look.presets[0]) {
          await small.goto(origin, { waitUntil: 'networkidle' })
          const p = await drawn(small)
          check(`${built.id}/${look.id}: fits a phone's screen, with the menu behind a button`, p.overflow <= 0 && p.h1 === 1 && await small.locator('header button[aria-controls]').first().isVisible(), JSON.stringify({ overflow: p.overflow, h1: p.h1 }))
          await small.locator('header button[aria-controls]').first().click()
          check(`${built.id}/${look.id}: the phone's menu opens with the menu's links`, await small.locator('#site-menu a').first().isVisible())
        }
      }
    }
    check(`${built.id}: every look shows the same sections in the same order`, sections.size === 1 && [...sections][0].length > 0, JSON.stringify([...sections]))
    // Colours of another look give way to the look's own.
    const other = looks.all[0].presets[1].id
    await web.evaluate(({ body, look, colors }) => fetch('/api/cms/_singleton/siteSettings', { method: 'PUT', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ ...body, look, colors }) }), { body, look: chosen.id, colors: looks.all.length > 1 ? other : chosen.presets[0].id })
    await web.goto(origin, { waitUntil: 'networkidle' })
    check(`${built.id}: colours of another look give way to the look's own`, (await drawn(web)).colors === chosen.presets[0].id)

    await spec.extra?.({ page: web, origin, check, site })
    check(`${built.id}: nothing failed in the browser on the way`, errors.length === 0, errors.slice(0, 3).join(' | '))
    await phone.close()
    await wide.close()

    check(`${built.id}: removing the site is accepted`, (await page.request.post(`${base}/api/sites/${site.id}/remove`, { data: { confirm: slug } })).ok())
    await waitFor(async () => !existsSync(join(dataDir, slug)), { timeout: 60_000, what: `${slug} to be removed` })
    await page.close()
  }
  await ctx?.close()
}

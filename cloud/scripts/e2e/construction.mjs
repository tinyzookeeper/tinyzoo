// Builders and architects' own part of the end-to-end check (scripts/e2e-templates.mjs runs it
// after the checks every hosted template goes through).
export default {
  // The name the site is made with.
  name: 'Stavby Novotný',
  // The name stands in the header's wordmark, whatever the look draws beside it.
  named: async (page) => (await page.locator('[data-wordmark]').first().innerText()).trim() === 'Stavby Novotný',
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })
    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('construction: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))

    // Every finished project has a page of its own with one heading: its name.
    const projects = await page.evaluate(async () => (await (await fetch('/api/content/project?limit=100')).json()).items.map((p) => ({ slug: p.slug, name: p.name, state: p.state })))
    check('construction: the demo has finished projects and ones under construction', projects.some((p) => p.state === 'done') && projects.some((p) => p.state === 'building'), JSON.stringify(projects.map((p) => p.state)))
    const bad = []
    for (const p of projects) {
      const res = await page.goto(`${origin}/realizace/${p.slug}`, { waitUntil: 'networkidle' })
      const heads = await page.locator('main h1').allInnerTexts()
      if (res.status() !== 200 || heads.length !== 1 || !heads[0].replace(/\s+/g, ' ').includes(p.name.replace(/\s+/g, ' '))) bad.push(`${p.slug}: ${res.status()} ${JSON.stringify(heads)}`)
    }
    check('construction: every project\'s page answers with its name as the one heading', projects.length > 0 && bad.length === 0, bad.join(' | '))

    // The archive lists the finished projects, and the filter by kind keeps what has that kind.
    await page.goto(`${origin}/realizace`, { waitUntil: 'networkidle' })
    const shown = () => page.evaluate(() => [...document.querySelectorAll('[data-project]')].filter((e) => e.offsetParent !== null).length)
    const all = await shown()
    check('construction: the archive shows every finished project', all === projects.filter((p) => p.state === 'done').length, String(all))
    await page.locator('.filter[data-filter=roof]').filter({ visible: true }).first().click()
    const roofs = await shown()
    check('construction: the filter keeps the projects of one kind', roofs >= 1 && roofs < all, `${roofs} of ${all}`)
    await page.locator('.filter[data-filter=all]').filter({ visible: true }).first().click()
    check('construction: "all" in the filter brings them back', (await shown()) === all)

    // The enquiry form: the choices are the firm's own, and an enquiry arrives in the admin.
    await page.goto(origin, { waitUntil: 'networkidle' })
    const form = page.locator('#poptavka form')
    await form.locator('[name=name]').fill('Jana Nováková')
    await form.locator('[name=phone]').fill('123 456 799')
    const kinds = await form.locator('select[name=kind] option').count()
    await form.locator('select[name=kind]').selectOption({ index: 2 })
    await form.locator('[name=permit][value=project]').check()
    await form.locator('[name=message]').fill('Dům na svahu, projekt máme.')
    await form.locator('button[type=submit]').click()
    await page.locator('#poptavka [role=status]').waitFor({ timeout: 15_000 })
    const rows = await page.evaluate(async () => { const r = await (await fetch('/api/cms/enquiry', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('construction: the enquiry form sends, with the firm\'s own choices', kinds === 6 && rows.length === 1 && rows[0].phone === '123 456 799' && rows[0].permit === 'project' && /Rekonstrukci/.test(rows[0].kind ?? ''), JSON.stringify(rows[0] ?? null))
  },
}

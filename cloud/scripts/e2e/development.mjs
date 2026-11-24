// Development's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the
// checks every hosted template goes through). The site is made in the last look (By the Sun) and
// is drawn in it here: its floor plan, its price list as a table, its form.
export default {
  // The name the site is made with.
  name: 'Domov na Slunci',
  // The name of the project is written in the header (By the Sun opens with a sentence, not the name).
  named: async (page) => /Domov na Slunci/.test(await page.locator('[data-wordmark]').first().innerText()),
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })

    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('development: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))

    // The price list is made from the flats: one row each, a sold flat without its price.
    const flats = await page.evaluate(async () => (await (await fetch('/api/content/flat?limit=100')).json()).items.map((f) => ({ number: f.number, layout: f.layout, state: f.state, slug: f.slug })))
    const rows = await page.evaluate(() => [...document.querySelectorAll('table tr.unit')].map((r) => ({ unit: r.dataset.unit, sold: r.classList.contains('s-sold'), text: r.textContent })))
    check('development: the price list has a row for every flat', flats.length === 14 && rows.length === flats.length, JSON.stringify([flats.length, rows.length]))
    check('development: a sold flat shows no price', rows.filter((r) => r.sold).length === flats.filter((f) => f.state === 'sold').length && rows.filter((r) => r.sold).every((r) => !/\d\sKč/.test(r.text.replace(/ /g, ' '))))

    // The filter: a layout leaves only its flats, and the count says how many.
    const layout = flats[0].layout
    const expected = flats.filter((f) => f.layout === layout).length
    await page.locator('[data-filter=layout] button', { hasText: layout }).first().click()
    const visible = await page.locator('table tr.unit:visible').count()
    const counted = Number(await page.locator('[data-count]').first().innerText())
    check('development: the filter by layout leaves the flats of that layout', visible === expected && counted === expected, JSON.stringify({ layout, expected, visible, counted }))
    await page.locator('[data-filter=layout] button').first().click()

    // A flat in the floor plan finds its row in the price list.
    const cell = page.locator('[data-plan] a[data-unit]').first()
    const unit = await cell.getAttribute('data-unit')
    await cell.click()
    await page.locator('table tr.unit.is-picked').first().waitFor({ timeout: 10_000 })
    check('development: a flat in the drawing finds its row in the price list', (await page.locator('table tr.unit.is-picked').first().getAttribute('data-unit')) === unit, unit)

    // "I'm interested" on a free flat chooses it in the enquiry form.
    const free = flats.find((f) => f.state === 'free')
    await page.locator(`table tr.unit[data-unit="${free.number}"] [data-pick]`).click()
    check('development: "I am interested" chooses the flat in the form', (await page.locator('form select[name=unit]').inputValue()) === free.number, free.number)

    // The enquiry: arrives in the admin, with the flat and the choices that were ticked.
    await page.locator('form [name=name]').fill('Jana Nováková')
    await page.locator('form [name=phone]').fill('123 456 789')
    await page.locator('form [name=email]').fill('jana@example.com')
    const wants = await page.locator('form input[name=want]').count()
    await page.locator('form input[name=want]').nth(1).check()
    await page.locator('form [name=message]').fill('Chceme se podívat v pátek.')
    await page.locator('form button[type=submit]').click()
    await page.locator('[role=status]').waitFor({ timeout: 15_000 })
    const enquiries = await page.evaluate(async () => { const r = await (await fetch('/api/cms/enquiry', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('development: the enquiry form sends, with the flat and the ticked choices', wants === 4 && enquiries.length === 1 && enquiries[0].unit === free.number && enquiries[0].email === 'jana@example.com' && enquiries[0].wants.split(', ').length === 2, JSON.stringify(enquiries[0] ?? null))

    // A flat has a page of its own, with one heading; a sold flat has no button to ask about it.
    for (const flat of [flats.find((f) => f.state === 'free'), flats.find((f) => f.state === 'reserved'), flats.find((f) => f.state === 'sold')]) {
      const res = await page.goto(`${origin}/byt/${flat.slug}`, { waitUntil: 'networkidle' })
      const h1 = await page.locator('main h1').allInnerTexts()
      const ask = await page.locator('main a[href*="#kontakt"]').count()
      check(`development: the page of flat ${flat.number} answers with one heading`, res.status() === 200 && h1.length === 1 && h1[0].includes(flat.number) && (flat.state === 'sold' ? ask === 0 : ask === 1), JSON.stringify({ status: res.status(), h1, ask }))
    }

    // The text page the footer links to.
    await page.goto(origin, { waitUntil: 'networkidle' })
    const privacy = await page.locator('footer a[href="/ochrana-osobnich-udaju"]').count()
    const res = await page.goto(`${origin}/ochrana-osobnich-udaju`, { waitUntil: 'networkidle' })
    check('development: the privacy page is linked from the footer and has one heading', privacy === 1 && res.status() === 200 && (await page.locator('main h1').count()) === 1, JSON.stringify({ privacy, status: res.status() }))
  },
}

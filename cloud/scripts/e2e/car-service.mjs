// The Garage's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the
// checks every hosted template goes through). The site is made in the last look, Šuplíky, from
// the demo content: the price list, a seasonal offer that is on today, and the request form.
export default {
  // The name the site is made with. The header writes it without its first word ("Autoservis").
  name: 'Autoservis Na Rovince',
  named: async (page) => /Na\s+Rovince/.test(await page.locator('[data-wordmark]').first().innerText()),
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })
    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('car-service: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))

    // The price list: every line of the collection, under its group, and a group closes and opens.
    const services = await page.evaluate(async () => (await (await fetch('/api/content/service?limit=100')).json()).items.length)
    const rows = await page.locator('[data-price-row]').count()
    const groups = await page.locator('details[data-group]').count()
    check('car-service: the price list shows every line of Services and prices, in groups', services > 0 && rows === services && groups >= 4, JSON.stringify({ services, rows, groups }))
    const first = page.locator('details[data-group]').first()
    await first.locator('summary').click()
    const closed = await first.evaluate((d) => !d.open)
    await first.locator('summary').click()
    check('car-service: a group of the price list closes and opens again', closed && await first.evaluate((d) => d.open))

    // The seasonal offer is shown between its dates (the demo's runs from before today to the 11th of December).
    const offer = await page.evaluate(async () => (await (await fetch('/api/content/seasonalOffer')).json()).items[0]?.title)
    check('car-service: the seasonal offer that is on today is shown', !!offer && await page.locator('[data-season] h1, [data-season] h2').first().innerText().then((t) => t.replace(/\s+/g, ' ').trim() === offer.replace(/\s+/g, ' ').trim()), String(offer))

    // The hours: a row for each day, today marked.
    check('car-service: the opening hours are a table of seven days', await page.locator('table tbody tr').count() === 7)

    // The text page of the footer answers with one heading.
    check('car-service: the footer links to the privacy page', await page.locator('footer a[href="/ochrana-osobnich-udaju"]').count() === 1)
    const privacy = await page.goto(`${origin}/ochrana-osobnich-udaju`, { waitUntil: 'networkidle' })
    check('car-service: the privacy page answers with one heading', privacy.status() === 200 && await page.locator('main h1').count() === 1)

    // The request form: the days to come are the next free ones, and a request arrives in the admin.
    await page.goto(origin, { waitUntil: 'networkidle' })
    const days = await page.locator('form select[name=when] option').allInnerTexts()
    check('car-service: the form offers "as soon as possible", four free days and "another day"', days.length === 6 && /nejdřív/i.test(days[0]), JSON.stringify(days))
    await page.locator('form [name=name]').fill('Jana Nováková')
    await page.locator('form [name=phone]').fill('123 456 789')
    await page.locator('form [name=car]').fill('Škoda kombi, 2015')
    await page.locator('form [name=message]').fill('Při brzdění píská zleva vepředu.')
    await page.locator('form select[name=when]').selectOption({ index: 1 })
    await page.locator('form [name=loaner]').check()
    await page.locator('form button[type=submit]').click()
    await page.locator('[role=status]').waitFor({ timeout: 15_000 })
    const requests = await page.evaluate(async () => { const r = await (await fetch('/api/cms/booking', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('car-service: a request arrives in the admin with the car, the day and the replacement car', requests.length === 1 && requests[0].name === 'Jana Nováková' && /Škoda/.test(requests[0].car ?? '') && requests[0].loaner === true && requests[0].when === days[1], JSON.stringify(requests[0] ?? null))
  },
}

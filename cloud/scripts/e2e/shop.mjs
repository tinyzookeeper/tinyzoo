// Shop's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the checks
// every hosted template goes through). Nothing here depends on the time of day: the sign and
// the hours are compared with what the browser's own clock and the settings' hours say.
export default {
  // The name the site is made with.
  name: 'Železářství U Zlatého hřebíku',
  // The name stands in the header where the look writes it (Portál sets it in capitals: compare without case).
  named: async (page) => (await page.locator('[data-wordmark]').first().innerText()).trim().toLowerCase() === 'železářství u zlatého hřebíku',
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })

    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('shop: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))

    // What the opening hours say about this very moment, worked out here from the settings and the browser's clock.
    const expected = await page.evaluate(async () => {
      const { item } = await (await fetch('/api/content/_global/siteSettings')).json()
      const now = new Date()
      const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()]
      const minutes = now.getHours() * 60 + now.getMinutes()
      const time = (t) => { const m = /(\d+)[:.](\d+)/.exec(t); return Number(m[1]) * 60 + Number(m[2]) }
      const stretches = item.hours.filter((h) => h.day === day).map((h) => [time(h.from), time(h.to)])
      return { open: stretches.some(([from, to]) => minutes >= from && minutes < to), day: now.getDay() === 0 ? 6 : now.getDay() - 1, hasHours: stretches.length > 0, rows: item.hours.length }
    })
    check('shop: the settings hold the opening hours as rows', expected.rows >= 6, String(expected.rows))
    const sign = page.locator('[data-open-sign]').first()
    await sign.waitFor({ state: 'visible', timeout: 10_000 })
    const said = (await sign.innerText()).toLowerCase()
    check('shop: the "Open" sign says what the hours and the visitor\'s clock say', expected.open ? /otevřeno/.test(said) : /zavřeno/.test(said), `${said.replace(/\s+/g, ' ')} (open: ${expected.open})`)
    const hours = (await page.locator('[data-today-hours]').first().innerText()).trim()
    check('shop: today\'s hours are written once the page is drawn', expected.hasHours ? /\d{1,2}:\d{2}\s*–\s*\d{1,2}:\d{2}/.test(hours) : /zavřeno/i.test(hours), hours)
    check('shop: the week marks today, and only today', await page.locator('[data-hours] [data-day].is-today').count() === 1 && await page.locator('[data-hours] [data-day].is-today').getAttribute('data-day') === String(expected.day))

    // A built site does not read a fixed "now" from the address: ask for the opposite of the truth, the sign keeps to the clock.
    await page.goto(`${origin}/?cas=${expected.open ? '2026-11-22T12:00' : '2026-11-23T12:00'}`, { waitUntil: 'networkidle' })
    const stubborn = (await page.locator('[data-open-sign]').first().innerText()).toLowerCase()
    check('shop: a fixed time in the address changes nothing on a built site', expected.open ? /otevřeno/.test(stubborn) : /zavřeno/.test(stubborn), stubborn.replace(/\s+/g, ' '))
    await page.goto(origin, { waitUntil: 'networkidle' })

    // The products in the window; "Put aside" fills in the enquiry form, which arrives in the admin.
    check('shop: nine products are in the window', await page.locator('[data-product]').count() === 9, String(await page.locator('[data-product]').count()))
    await page.locator('[data-ask]').first().click()
    const asked = await page.locator('form textarea[name=message]').inputValue()
    check('shop: "Ask" on a product writes the question into the form', /^Máte skladem: .+\?$/.test(asked), asked)
    await page.locator('[data-hold]').nth(1).click()
    const held = await page.locator('form textarea[name=message]').inputValue()
    check('shop: "Put aside" writes the request and ticks the box', /^Prosím o odložení: .+\.$/.test(held) && await page.locator('form input[name=hold]').isChecked(), held)
    await page.locator('form [name=name]').fill('Jana Nováková')
    await page.locator('form [name=contact]').fill('603 123 456')
    await page.locator('form button[type=submit]').click()
    await page.locator('[role=status]').waitFor({ timeout: 15_000 })
    const enquiries = await page.evaluate(async () => { const r = await (await fetch('/api/cms/enquiry', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('shop: the enquiry arrives in the admin with its message and the "put aside" box', enquiries.length === 1 && enquiries[0].name === 'Jana Nováková' && /^Prosím o odložení/.test(enquiries[0].message ?? '') && enquiries[0].hold === true, JSON.stringify(enquiries[0] ?? null))

    // Pages: the home page shows the newest four, the news page all of them; the privacy text is linked from the footer.
    check('shop: the home page shows the newest four news', await page.locator('#novinky article').count() === 4, String(await page.locator('#novinky article').count()))
    const news = await page.goto(`${origin}/novinky`, { waitUntil: 'networkidle' })
    check('shop: the news page lists all the news under one heading', news.status() === 200 && await page.locator('h1').count() === 1 && await page.locator('main article').count() > 4, String(await page.locator('main article').count()))
    const privacy = await page.goto(`${origin}/ochrana-osobnich-udaju`, { waitUntil: 'networkidle' })
    check('shop: the privacy page answers with one heading and its text', privacy.status() === 200 && await page.locator('h1').count() === 1 && await page.locator('main li').count() >= 2)
    await page.goto(origin, { waitUntil: 'networkidle' })
    check('shop: the footer links to the privacy page', await page.locator('footer a[href="/ochrana-osobnich-udaju"]').count() === 1)
  },
}

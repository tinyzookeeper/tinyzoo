// Salon's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the checks
// every hosted template goes through).
export default {
  // The name the site is made with.
  name: 'Hřebínek',
  // The name is written in the header by every look (Šachovnice in lowercase, Výloha in capitals, by CSS only).
  named: async (page) => ((await page.locator('header [data-wordmark]').first().textContent()) ?? '').trim().toLowerCase() === 'hřebínek',
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })
    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('salon: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))

    // The price list: every service of the collection is a row, a click on a row starts booking it.
    const services = await page.evaluate(async () => (await (await fetch('/api/content/service?limit=100')).json()).items.length)
    const rows = await page.locator('main [data-service-row]').count()
    check('salon: the price list shows every service', services === 25 && rows === services, JSON.stringify({ services, rows }))
    await page.locator('[data-service-row="Pánský střih"]').first().click()
    await page.waitForFunction(() => document.querySelector('form [name=service]')?.value === 'Pánský střih', null, { timeout: 5000 }).catch(() => {})
    check('salon: a click on a price chooses that service in the booking form', await page.locator('form [name=service]').inputValue() === 'Pánský střih')

    // A click on a person chooses them, and the days offered are only those the person works
    // (Tomáš Kubát works Wednesday to Saturday).
    await page.locator('[data-person-book="Tomáš Kubát"]').first().click()
    await page.waitForFunction(() => document.querySelector('form [name=person]')?.value === 'Tomáš Kubát', null, { timeout: 5000 }).catch(() => {})
    const days = await page.locator('form [name=day] option').allTextContents()
    check('salon: a click on a person chooses them and narrows the days to those they work', await page.locator('form [name=person]').inputValue() === 'Tomáš Kubát' && days.length > 0 && days.every((d) => /^(středa|čtvrtek|pátek|sobota) /.test(d)), JSON.stringify(days))

    // The hours are written from the settings: seven days, and today is marked once, after the page is mounted.
    const hours = await page.evaluate(() => ({ days: document.querySelectorAll('main [data-hours-day]').length, today: document.querySelectorAll('main [data-hours-day][data-today]').length }))
    const closedSunday = await page.evaluate(() => { const d = [...document.querySelectorAll('main [data-hours-day]')]; return !/\d/.test(d[6]?.textContent ?? '') })
    check('salon: the opening hours show seven days, today marked once, Sunday closed', hours.days === 7 && hours.today === 1 && closedSunday, JSON.stringify(hours))

    // The booking form sends and the request arrives in the admin.
    await page.locator('form [name=name]').fill('Jana Dvořáková')
    await page.locator('form [name=phone]').fill('123 456 789')
    await page.locator('form [name=part]').nth(1).check({ force: true })
    await page.locator('form button[type=submit]').click()
    await page.locator('form [role=status]').waitFor({ timeout: 15_000 })
    const requests = await page.evaluate(async () => { const r = await (await fetch('/api/cms/appointment', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    const sent = requests[0]
    check('salon: the booking form sends, with the service, the person, the day and the time of day', requests.length === 1 && sent.name === 'Jana Dvořáková' && sent.service === 'Pánský střih' && sent.person === 'Tomáš Kubát' && /^(středa|čtvrtek|pátek|sobota) \d+\. \d+\.$/.test(sent.day ?? '') && sent.part === 'afternoon', JSON.stringify(sent ?? null))

    // The text page the footer links to answers with one heading.
    const privacy = await page.goto(`${origin}/ochrana-osobnich-udaju`, { waitUntil: 'networkidle' })
    const headings = await page.locator('main h1').allTextContents()
    check('salon: the privacy page is there with one heading', privacy.status() === 200 && headings.length === 1 && /Ochrana osobních údajů/.test(headings[0]), JSON.stringify(headings))
    const footerLink = await page.evaluate(() => !![...document.querySelectorAll('footer a')].find((a) => a.getAttribute('href') === '/ochrana-osobnich-udaju'))
    check('salon: the footer links to the privacy page', footerLink)
  },
}

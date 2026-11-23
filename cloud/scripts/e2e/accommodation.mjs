// Accommodation's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the
// checks every hosted template goes through).
export default {
  // The name the site is made with.
  name: 'Chata Hvozd',
  // The name is written in the header's wordmark in every look; the admin is called by it.
  named: async (page) => (await page.locator('header [data-wordmark]').first().innerText()).trim() === 'Chata Hvozd',
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })
    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('accommodation: the menu\'s links lead to sections of the page', anchors.length >= 4 && missing.length === 0, JSON.stringify({ anchors, missing }))
    // Each room has a page of its own with one heading, and the room's button leads to the enquiry.
    const rooms = await page.evaluate(async () => (await (await fetch('/api/content/room?limit=100')).json()).items.map((r) => r.slug))
    let pages = true
    for (const slug of rooms) {
      const res = await page.goto(`${origin}/pokoj/${slug}`, { waitUntil: 'networkidle' })
      pages = pages && res.status() === 200 && await page.locator('main h1').count() === 1
    }
    check('accommodation: every room has a page with one heading', rooms.length === 4 && pages, JSON.stringify(rooms))
    // The trips are filtered by season in the browser.
    await page.goto(origin, { waitUntil: 'networkidle' })
    const all = await page.locator('.trip').count()
    await page.locator('[data-season=summer]').first().click()
    const summer = await page.locator('.trip:not([hidden])').count()
    check('accommodation: the season filter hides the trips that do not suit', all >= 6 && summer > 0 && summer < all, JSON.stringify({ all, summer }))
    // The short form of the opening carries its dates to the enquiry; a room's button chooses the room.
    await page.locator('main form').first().locator('[name=od]').fill('1. 3. 2027')
    await page.locator('main form').first().locator('[name=do]').fill('4. 3. 2027')
    await page.locator('main form').first().locator('[name=osob]').selectOption('3')
    await page.locator('main form').first().locator('button[type=submit]').click()
    await page.locator('[data-room] [data-enquire]').first().click()
    await page.waitForTimeout(600)
    const form = page.locator('form').last()
    check('accommodation: the opening\'s dates and the chosen room arrive in the enquiry', await form.locator('[name=arrival]').inputValue() === '1. 3. 2027' && await form.locator('[name=adults]').inputValue() === '3')
    // The enquiry sends and arrives in the admin.
    await form.locator('[name=name]').fill('Jana Nováková')
    await form.locator('[name=email]').fill('jana@example.com')
    await form.locator('button[type=submit]').click()
    await page.locator('[role=status]').waitFor({ timeout: 15_000 })
    const enquiries = await page.evaluate(async () => { const r = await (await fetch('/api/cms/enquiry', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('accommodation: the enquiry form sends and arrives in the admin', enquiries.length === 1 && enquiries[0].departure === '4. 3. 2027' && /^(Pokoj|Apartmán) /.test(enquiries[0].room ?? ''), JSON.stringify(enquiries[0] ?? null))
  },
}

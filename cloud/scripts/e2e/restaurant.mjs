// Restaurant's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the
// checks every hosted template goes through). The site is in the template's last look by now,
// signed in to its admin, so `/api/cms/…` answers `page`.
const NAME = 'Bistro Kmínek'

/** The weekday at the restaurant, Monday 0, and today's date there: what the page must say. */
const prague = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const get = (t) => parts.find((p) => p.type === t).value
  return { weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')), date: `${get('year')}-${get('month')}-${get('day')}` }
}

export default {
  // The name the site is made with.
  name: NAME,
  // The name is written where the look sets it (in capitals in one of them, so compare without case).
  named: async (page) => ((await page.locator('[data-wordmark]').first().textContent()) ?? '').trim().toLowerCase() === NAME.toLowerCase(),
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })

    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('restaurant: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))

    // Open now: the sentence says one of the two states, and the week marks today (the place's today).
    const open = await page.evaluate(() => { const el = document.querySelector('main [data-open]'); return el ? { state: el.getAttribute('data-state'), text: el.textContent.trim() } : null })
    check('restaurant: the page says whether the doors are open now', !!open && ['open', 'closed'].includes(open.state) && open.text.length > 3, JSON.stringify(open))
    const week = await page.evaluate(() => [...document.querySelectorAll('.hours li[data-day]')].map((li) => li.classList.contains('is-today')))
    check('restaurant: the opening hours list seven days and mark today', week.length === 7 && week.filter(Boolean).length === 1 && week[prague().weekday] === true, JSON.stringify(week))

    // Today's lunch: the soup and the main courses of the day, with prices, dated today or later.
    const lunch = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#poledni li')].filter((li) => /Kč/.test(li.textContent)).length, day: document.querySelector('#poledni time[datetime]')?.getAttribute('datetime')?.slice(0, 10) }))
    check('restaurant: the lunch shows the soup and the main courses of a day that is today or next', lunch.rows >= 5 && !!lunch.day && lunch.day >= prague().date, JSON.stringify(lunch))

    // The menu: every dish of the collection that is not hidden is on the page (behind a tab in the looks that have tabs).
    const dishes = await page.evaluate(async () => (await (await fetch('/api/content/dish?limit=100')).json()).items)
    const tab = page.locator('#listek button[aria-controls]').filter({ hasText: 'Dezerty' })
    if (await tab.count()) {
      check('restaurant: a menu section is shown one at a time', !(await page.getByText('Větrník').first().isVisible()))
      await tab.first().click()
    }
    check('restaurant: the menu shows the dishes of the chosen section', await page.getByText('Větrník').first().isVisible() && dishes.length >= 20, String(dishes.length))

    // Events: the three that are coming.
    check('restaurant: the three coming events are listed', (await page.locator('[data-event]').count()) === 3)

    // The reservation: the form sends, and the reservation arrives in the admin with what was chosen.
    await page.locator('form [name=date]').fill('2027-03-05')
    await page.locator('form select[name=time]').selectOption('18:30')
    await page.locator('form select[name=guests]').selectOption('4')
    await page.locator('form [name=name]').fill('Jana Nováková')
    await page.locator('form [name=phone]').fill('123 456 799')
    await page.locator('form [name=note]').fill('Dětská židlička, prosím.')
    await page.locator('form button[type=submit]').click()
    await page.locator('[role=status]').waitFor({ timeout: 15_000 })
    const rows = await page.evaluate(async () => { const r = await (await fetch('/api/cms/reservation', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    const row = rows[0]
    check('restaurant: the reservation form sends, and the reservation arrives in the admin', rows.length === 1 && row.name === 'Jana Nováková' && row.guests === '4' && row.time === '18:30' && row.date === '2027-03-05' && /židlička/.test(row.note ?? ''), JSON.stringify(row ?? null))
  },
}

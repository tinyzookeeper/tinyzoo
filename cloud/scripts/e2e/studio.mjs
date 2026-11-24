// Studio's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the checks
// every hosted template goes through). It holds at any time of day: what depends on the clock
// (today's day, the next dates of a class) is checked by what it must be, not by a fixed value.
export default {
  // The name the site is made with.
  name: 'Pohyb Orlice',
  // Every look writes the name in the header (Tabule in capitals, by CSS only).
  named: async (page) => ((await page.locator('header [data-wordmark]').first().textContent()) ?? '').trim() === 'Pohyb Orlice',
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })
    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('studio: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))

    // The timetable is the Lesson collection: every lesson is drawn once.
    const api = await page.evaluate(async () => {
      const get = async (path) => (await (await fetch(path)).json()).items
      return { lessons: await get('/api/content/lesson?limit=100'), kinds: await get('/api/content/lessonKind?limit=100') }
    })
    const drawn = await page.locator('main [data-lesson]').count()
    check('studio: the timetable draws every lesson of the collection once', api.lessons.length === 29 && drawn === api.lessons.length, JSON.stringify({ lessons: api.lessons.length, drawn }))

    // "Today" is worked out in the browser, after the page is mounted: marked once (never on Sunday, the studio is closed).
    const today = await page.evaluate(() => ({ marked: document.querySelectorAll('main .is-today').length, sunday: new Date().getDay() === 0 }))
    check('studio: today is marked in the timetable once the page is mounted (not on a Sunday)', today.sunday ? today.marked === 0 : today.marked >= 1, JSON.stringify(today))

    // A link of a kind of class filters the timetable to that kind.
    const kinds = [...api.kinds].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    const first = kinds[0]
    await page.locator('[data-kind-link]').first().click()
    const shown = await page.evaluate(() => [...document.querySelectorAll('main [data-lesson]')].filter((e) => !e.hidden && !e.classList.contains('is-off')).length)
    check('studio: the link of a kind of class shows only that kind in the timetable', shown === api.lessons.filter((l) => l.kind.id === first.id).length && shown > 0 && shown < api.lessons.length, JSON.stringify({ shown, kind: first.name }))

    // A tap on a class with a place left chooses it in the sign-up form, with its next dates.
    const free = new Set(api.lessons.filter((l) => l.free > 0).map((l) => l.id))
    let tapped = null
    for (const id of free) {
      const slot = page.locator(`main [data-lesson="${id}"]:visible`).first()
      if (await slot.count()) { tapped = id; await slot.click({ force: true }); break }
    }
    check('studio: a class is visible to tap', !!tapped)
    await page.waitForFunction((id) => document.querySelector('form select[name=lesson]')?.value === id, tapped, { timeout: 5000 }).catch(() => {})
    const dates = await page.locator('form select[name=date] option').allTextContents()
    check('studio: a tap on a class chooses it in the form and offers its next three dates', (await page.locator('form select[name=lesson]').inputValue()) === tapped && dates.length === 3 && dates.every((d) => /^\p{L}+ \d+\. \d+\. v \d+:\d{2}$/u.test(d)), JSON.stringify(dates))

    // A class that is full cannot be chosen in the form.
    const fullId = api.lessons.find((l) => l.free === 0)?.id
    const fullDisabled = await page.evaluate((id) => document.querySelector(`form select[name=lesson] option[value="${id}"]`)?.disabled === true, fullId)
    check('studio: a full class is offered but cannot be chosen', fullDisabled)

    // The sign-up arrives in the admin, with the class and the date the visitor read.
    await page.locator('form [name=name]').fill('Jana Dvořáková')
    await page.locator('form [name=email]').fill('jana@priklad.example')
    await page.locator('form [name=consent]').check()
    await page.locator('form button[type=submit]').click()
    await page.locator('form [role=status], [role=status]').first().waitFor({ timeout: 15_000 })
    const rows = await page.evaluate(async () => { const r = await (await fetch('/api/cms/trial', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    const row = rows[0]
    check('studio: the sign-up form sends, and the sign-up arrives in the admin', rows.length === 1 && row.name === 'Jana Dvořáková' && row.email === 'jana@priklad.example' && /^\p{L}+ \d+:\d{2} · .+/u.test(row.lesson ?? '') && /v \d+:\d{2}$/.test(row.date ?? '') && row.consent === true, JSON.stringify(row ?? null))

    // The timetable on a page of its own, and the text page the footer links to: one heading each.
    const timetable = await page.goto(`${origin}/rozvrh`, { waitUntil: 'networkidle' })
    const slots = await page.locator('main [data-lesson]').count()
    check('studio: the timetable page is there with one heading and every lesson', timetable.status() === 200 && (await page.locator('main h1').count()) === 1 && slots === api.lessons.length, String(slots))
    const privacy = await page.goto(`${origin}/ochrana-osobnich-udaju`, { waitUntil: 'networkidle' })
    const headings = await page.locator('main h1').allTextContents()
    check('studio: the privacy page is there with one heading', privacy.status() === 200 && headings.length === 1 && /Ochrana osobních údajů/.test(headings[0]), JSON.stringify(headings))
    const footerLink = await page.evaluate(() => !![...document.querySelectorAll('footer a')].find((a) => a.getAttribute('href') === '/ochrana-osobnich-udaju'))
    check('studio: the footer links to the privacy page', footerLink)
  },
}

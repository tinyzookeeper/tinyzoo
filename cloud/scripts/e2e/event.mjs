// Event's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the
// checks every hosted template goes through). It holds at any time of day and in any month:
// the demo's race is always some months ahead, so nothing here depends on a fixed date.
export default {
  // The name the site is made with: short enough for a look that breaks it after its first word.
  name: 'Čtyři kopce',
  // The name opens the page: Soutisk breaks it into two lines, Časomíra sets it on one.
  named: async (page) => /Čtyři\s+kopce/.test((await page.locator('main h1').first().innerText()).replace(/\s+/g, ' ')),
  async extra({ page, origin, check }) {
    const json = (path) => page.evaluate(async (p) => (await fetch(p, { headers: { accept: 'application/json' } })).json(), path)
    const oneHeading = async (path) => {
      const res = await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' })
      return res.status() === 200 && await page.locator('main h1').count() === 1
    }
    await page.goto(origin, { waitUntil: 'networkidle' })

    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('event: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))

    // The day of the start is the owner's content: a Saturday at ten, some months ahead of the day the site was made.
    const day = await page.evaluate(() => document.querySelector('main time[datetime]')?.getAttribute('datetime'))
    const when = /^(\d{4})-(\d{2})-(\d{2})T10:00$/.exec(day ?? '')
    const date = when ? new Date(Date.UTC(Number(when[1]), Number(when[2]) - 1, Number(when[3]), 12)) : null
    check('event: the day of the start is written from the settings, on a Saturday, ahead', !!date && date.getUTCDay() === 6 && date.getTime() > Date.now() + 100 * 86_400_000, String(day))

    // What follows from the clock is worked out in the browser: the countdown runs, and the fee period that holds is lit.
    const days = await page.locator('[data-cd=d]').first().innerText()
    check('event: the countdown counts the days to the start', Number(days) >= 100, days)
    const tracks = (await json('/api/content/track?limit=100')).items
    const periods = (await json('/api/content/feePeriod?limit=100')).items
    const lit = await page.locator('[data-current]').allInnerTexts()
    const first = tracks.map((t) => String(t.prices[0].price))
    check('event: the fee column that holds today is lit (the first period, a few months ahead)', periods.length === 3 && lit.length === tracks.length && lit.every((text, i) => text.replace(/\D/g, '') === first[i]), JSON.stringify({ lit, first }))

    // The sign-up links lead to the registration address, one for every route.
    const links = await page.evaluate(() => [...document.querySelectorAll('[data-register]')].map((a) => a.getAttribute('href')))
    check('event: every route has a sign-up link, and so do the opening and the closing call', links.length >= tracks.length && links.every((href) => /^https?:\/\//.test(href ?? '')), JSON.stringify(links))

    // The places left on the page are the routes' own.
    const free = tracks.reduce((n, t) => n + (t.free ?? 0), 0)
    check('event: the routes carry their places', tracks.length >= 4 && free > 0 && tracks.every((t) => t.capacity >= t.free), String(free))

    // The pages the home page leads to: each answers with one heading.
    check('event: the news page answers with one heading', await oneHeading('/aktuality'))
    const news = (await json('/api/content/newsItem?limit=100')).items
    check('event: a news item has a page of its own with one heading', news.length >= 3 && await oneHeading(`/aktuality/${news[0].slug}`))
    check('event: the page of full results answers with one heading and every row', await oneHeading('/vysledky') && (await page.locator('main li, main dl > div').count()) >= 18)
    check('event: the rules page answers with one heading', await oneHeading('/propozice'))
    check('event: the privacy page answers with one heading', await oneHeading('/ochrana-osobnich-udaju'))

    // The contact form: a message arrives in the admin.
    await page.goto(`${origin}/kontakt`, { waitUntil: 'networkidle' })
    await page.locator('form [name=name]').fill('Jana Nováková')
    await page.locator('form [name=email]').fill('jana@example.com')
    await page.locator('form [name=message]').fill('Kdy otevíráte prezenci?')
    await page.locator('form button[type=submit]').click()
    await page.locator('[data-form-sent]').waitFor({ timeout: 15_000 })
    const messages = await page.evaluate(async () => { const r = await (await fetch('/api/cms/enquiry', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('event: the contact form sends, and the message arrives in the admin', messages.length === 1 && messages[0].email === 'jana@example.com' && /prezenci/.test(messages[0].message ?? ''), JSON.stringify(messages[0] ?? null))
  },
}

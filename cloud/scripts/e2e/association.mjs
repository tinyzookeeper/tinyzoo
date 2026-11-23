// Association's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the
// checks every hosted template goes through).
export default {
  // The name the site is made with.
  name: 'Spolek z Dubiny',
  // The name is written in the header's mark; the admin is called by it.
  named: async (page) => (await page.locator('header [data-wordmark]').first().innerText()).trim() === 'Spolek z Dubiny',
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })
    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('association: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))
    // What depends on the day is drawn after the day is known: the demo's calendar is written from the
    // day the site was made, so there is a nearest event, a strip of twelve months with the current one marked, and a look back.
    check('association: the nearest event stands large, with coming events by month beside it', await page.locator('[data-nearest-card]').count() === 1 && await page.locator('[data-event]').count() >= 3)
    const now = await page.evaluate(() => ({ marked: document.querySelectorAll('[data-month-now]').length, current: document.querySelector('[data-month-now] p')?.textContent?.trim() }))
    const month = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', month: 'long' }).format(new Date())
    check('association: the strip of the year marks the current month', now.marked === 1 && now.current === month, JSON.stringify([now, month]))

    // Entry pages answer with one heading: an event, a piece of news, and the pages of the lists.
    const event = await page.locator('[data-event] a').first().getAttribute('href')
    const news = await page.locator('[data-news] a').first().getAttribute('href')
    for (const path of [event, news, '/akce', '/aktuality', '/dokumenty', '/ochrana-osobnich-udaju']) {
      const answer = await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' })
      check(`association: ${path} answers with one heading`, answer.status() === 200 && await page.locator('main h1').count() === 1, `${answer.status()} ${await page.locator('main h1').count()}`)
      if (path === '/dokumenty') check('association: the documents page offers the files to download', await page.locator('[data-document]').count() >= 6)
    }

    // "Přihlásit se" on an event leads to the form with that event chosen; the message arrives in the admin.
    await page.goto(origin, { waitUntil: 'networkidle' })
    await page.locator('[data-event] [data-signup]').first().click()
    await page.locator('form[data-contact-form]').waitFor()
    const topic = await page.locator('form select[name=topic]').inputValue()
    check('association: the form starts from the event the visitor chose', /^Přihlašuji se na akci: /.test(topic), topic)
    await page.locator('form [name=name]').fill('Jana Nováková')
    await page.locator('form [name=contact]').fill('jana@example.com')
    await page.locator('form [name=message]').fill('Přijdeme dva.')
    await page.locator('form button[type=submit]').click()
    await page.locator('[role=status]').waitFor({ timeout: 15_000 })
    const messages = await page.evaluate(async () => { const r = await (await fetch('/api/cms/contact', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('association: the message form sends, with the event as its topic', messages.length === 1 && messages[0].topic === topic && messages[0].name === 'Jana Nováková', JSON.stringify(messages[0] ?? null))
  },
}

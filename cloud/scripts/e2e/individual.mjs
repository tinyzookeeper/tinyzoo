// The Freelancer and consultant template's own part of the end-to-end check
// (scripts/e2e-templates.mjs runs it after the checks every hosted template goes through).
export default {
  // The name the site is made with.
  name: 'Ivana Modrá',
  // The name stands in the header, marked by every look's wordmark; the admin is called by it.
  named: async (page) => (await page.locator('[data-wordmark]').first().innerText()).trim() === 'Ivana Modrá',
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })
    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('individual: the menu\'s links lead to sections of the page', anchors.length >= 4 && missing.length === 0, JSON.stringify({ anchors, missing }))
    // The price list and the projects come from their collections, whatever the look.
    const counts = await page.evaluate(() => ({ services: document.querySelectorAll('[data-service]').length, projects: document.querySelectorAll('main [data-project]').length, articles: document.querySelectorAll('main [data-article]').length }))
    check('individual: the home page shows five services, four projects and three articles', counts.services === 5 && counts.projects === 4 && counts.articles === 3, JSON.stringify(counts))

    // A project and an article each have a page of their own, with one heading, and the lists
    // of all of them are pages of the menu's kind.
    await page.locator('main [data-project]').first().click()
    await page.waitForURL(/\/zakazky\/[^/]+$/, { timeout: 10_000 })
    await page.locator('main article h1').waitFor({ timeout: 10_000 })
    const project = await page.evaluate(() => ({ h1: document.querySelectorAll('h1').length, title: document.querySelector('h1')?.textContent.trim() }))
    check('individual: a project has a page with one heading', project.h1 === 1 && /kuchyně/.test(project.title ?? ''), JSON.stringify(project))
    await page.goto(origin, { waitUntil: 'networkidle' })
    await page.locator('main [data-article]').first().click()
    await page.waitForURL(/\/blog\/[^/]+$/, { timeout: 10_000 })
    await page.locator('main article h1').waitFor({ timeout: 10_000 })
    const article = await page.evaluate(() => ({ h1: document.querySelectorAll('h1').length, title: document.querySelector('h1')?.textContent.trim() }))
    check('individual: an article has a page with one heading', article.h1 === 1 && /ceny/.test(article.title ?? ''), JSON.stringify(article))
    for (const [path, entries] of [['/zakazky', '[data-project]'], ['/blog', '[data-article]'], ['/ochrana-osobnich-udaju', 'h1']]) {
      await page.goto(origin + path, { waitUntil: 'networkidle' })
      const d = await page.evaluate((sel) => ({ h1: document.querySelectorAll('h1').length, n: document.querySelectorAll(`main ${sel}`).length }), entries)
      check(`individual: ${path} answers with one heading and its content`, d.h1 === 1 && d.n >= 1, JSON.stringify(d))
    }
    // The privacy page is linked from the footer.
    await page.goto(origin, { waitUntil: 'networkidle' })
    check('individual: the footer links to the privacy page', await page.locator('footer a[href="/ochrana-osobnich-udaju"]').count() >= 1)

    // The contact form: the choices of when a call suits are the owner's own, and a message arrives in the admin.
    const choices = await page.locator('form .chip').count()
    await page.locator('form [name=name]').fill('Jana Nováková')
    await page.locator('form [name=email]').fill('jana@firma.example')
    await page.locator('form [name=message]').fill('Potřebuji napsat nový web pro truhlářství.')
    await page.locator('form .chip').nth(1).click()
    await page.locator('form button[type=submit]').click()
    await page.locator('[role=status]').waitFor({ timeout: 15_000 })
    const messages = await page.evaluate(async () => { const r = await (await fetch('/api/cms/message', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('individual: the contact form sends, with the owner\'s own choice of time', choices === 3 && messages.length === 1 && messages[0].name === 'Jana Nováková' && /Odpoledne/.test(messages[0].time ?? ''), JSON.stringify(messages[0] ?? null))
  },
}

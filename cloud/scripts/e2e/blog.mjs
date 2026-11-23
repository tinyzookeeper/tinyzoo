// Blog's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the checks
// every hosted template goes through).
export default {
  // The name the site is made with.
  name: 'Zápisník',
  // The name stands where the look writes it large (the opening of Obálka, the header of Čtvrthodinka).
  named: async (page) => /Zápisník/i.test(await page.locator('[data-wordmark]').first().innerText()),
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })
    // The menu leads to sections of the page and to pages of the sections.
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('header nav a')].map((a) => a.getAttribute('href')))
    const anchors = hrefs.filter((h) => h.includes('#')).map((h) => h.split('#')[1])
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('blog: the menu\'s links lead to sections of the page', hrefs.length >= 6 && missing.length === 0, JSON.stringify({ hrefs, missing }))

    // The lead article has a page of its own, with one heading, its author and its text.
    await page.locator('[data-lead]').first().click()
    // (the address changes before the page does: wait for the article itself)
    await page.waitForURL(/\/clanek\//)
    await page.locator('[data-article]').waitFor({ timeout: 15_000 })
    const article = await page.evaluate(() => ({ h1: document.querySelectorAll('h1').length, article: !!document.querySelector('[data-article]'), paragraphs: document.querySelectorAll('[data-article] .prose-look p').length, author: !!document.querySelector('[data-article] a[href^="/autor/"]') }))
    check('blog: an article opens on a page of its own, with one heading, its text and its author', article.h1 === 1 && article.article && article.paragraphs >= 2 && article.author, JSON.stringify(article))

    // Every section, the series and an author answer with one heading.
    const pages = await page.evaluate(async () => {
      const get = async (path) => (await (await fetch(`/api/content/${path}?limit=100`)).json()).items
      return { sections: (await get('section')).map((s) => `/rubrika/${s.slug}`), series: (await get('series')).map((s) => `/serial/${s.slug}`), authors: (await get('author')).map((s) => `/autor/${s.slug}`) }
    })
    const wanted = [...pages.sections, ...pages.series, ...pages.authors]
    const bad = []
    for (const path of wanted) {
      const res = await page.goto(origin + path, { waitUntil: 'networkidle' })
      const h1 = await page.locator('main h1').count()
      if (res.status() !== 200 || h1 !== 1) bad.push(`${path}: ${res.status()} h1=${h1}`)
    }
    check('blog: every section, series and author has a page with one heading', wanted.length >= 9 && bad.length === 0, JSON.stringify(bad))

    // The search box leads to a page of results.
    await page.goto(origin, { waitUntil: 'networkidle' })
    const box = page.locator('header input[name=q]:visible').first()
    await box.fill('studánky')
    await box.press('Enter')
    await page.waitForURL(/\/hledat\?q=/)
    await page.locator('[data-search-results] li').first().waitFor({ timeout: 10_000 })
    check('blog: the search finds articles', (await page.locator('[data-search-results] li').count()) >= 1)

    // Čtvrthodinka's shelves: the articles outside the chosen length step back.
    await page.goto(origin, { waitUntil: 'networkidle' })
    if (await page.locator('[data-time]').count()) {
      await page.locator('[data-time="5"]').click()
      const dim = await page.locator('.is-dim').count()
      await page.locator('[data-time="5"]').click()
      check('blog: choosing a shelf dims the articles outside it, choosing it again brings them back', dim > 0 && (await page.locator('.is-dim').count()) === 0, String(dim))
    }

    // The newsletter: the address arrives in the admin.
    await page.locator('form:has(input[name=email]) input[name=email]').fill('ctenar@example.com')
    await page.locator('form:has(input[name=email]) button[type=submit]').click()
    await page.locator('[role=status]:has-text("Děkujeme")').waitFor({ timeout: 15_000 })
    const rows = await page.evaluate(async () => { const r = await (await fetch('/api/cms/newsletter', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('blog: the newsletter sign-up sends and arrives in the admin', rows.some((r) => r.email === 'ctenar@example.com'), JSON.stringify(rows[0] ?? null))
  },
}

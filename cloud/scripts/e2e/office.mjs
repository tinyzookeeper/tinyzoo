// Office's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the checks
// every hosted template goes through).
export default {
  // The name the site is made with.
  name: 'Hájek & Veselá',
  // Both looks write the name in the header with `data-wordmark` (Šanony sets the "&" in colour, without spaces).
  named: async (page) => /Hájek\s*&\s*Veselá/.test((await page.locator('[data-wordmark]').first().innerText()).replace(/\s+/g, ' ')),
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })
    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('office: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))

    // The deadlines are written relative to the day the site was made: the nearest are still ahead.
    const deadlines = await page.evaluate(async () => (await (await fetch('/api/content/deadline?limit=100')).json()).items.map((d) => Date.parse(d.date)))
    const ahead = deadlines.filter((t) => t > Date.now() - 36 * 3_600_000)
    check('office: the demo\'s deadlines are ahead of today, so the ruler is never empty', deadlines.length >= 6 && ahead.length === deadlines.length, JSON.stringify({ all: deadlines.length, ahead: ahead.length }))

    // Cases and articles have pages of their own, each with one heading: the entry's title.
    const entries = await page.evaluate(async () => ({
      cases: (await (await fetch('/api/content/caseStudy?limit=100')).json()).items.map((c) => ({ slug: c.slug, title: c.title })),
      articles: (await (await fetch('/api/content/article?limit=100')).json()).items.map((a) => ({ slug: a.slug, title: a.title })),
    }))
    check('office: cases and articles are in the content API', entries.cases.length >= 3 && entries.articles.length >= 4, JSON.stringify([entries.cases.length, entries.articles.length]))
    for (const [prefix, entry] of [['pripad', entries.cases[0]], ['clanek', entries.articles[0]], ['clanky', null]]) {
      const res = await page.goto(`${origin}/${prefix}${entry ? `/${entry.slug}` : ''}`, { waitUntil: 'networkidle' })
      const h1 = await page.locator('main h1').allInnerTexts()
      const same = !entry || h1[0]?.replace(/\s+/g, ' ').replace(/ /g, ' ') === entry.title
      check(`office: /${prefix}${entry ? '/…' : ''} answers with one heading${entry ? ' (the title)' : ''}`, res.status() === 200 && h1.length === 1 && same, JSON.stringify([res.status(), h1]))
    }
    // The page with every article lists all of them, not three.
    const listed = await page.locator('main [data-article]').count()
    check('office: the page of all articles lists every article', listed === entries.articles.length, `${listed} of ${entries.articles.length}`)

    // The enquiry form: it sends and the enquiry arrives in the admin.
    await page.goto(origin, { waitUntil: 'networkidle' })
    await page.locator('form[data-enquiry] [name=name]').fill('Marie Nováková')
    await page.locator('form[data-enquiry] [name=email]').fill('marie@novakova.example')
    await page.locator('form[data-enquiry] [name=message]').fill('S.r.o. se čtyřmi zaměstnanci, hledáme novou účetní od ledna.')
    await page.locator('form[data-enquiry] button[type=submit]').click()
    await page.locator('[role=status]').waitFor({ timeout: 15_000 })
    const rows = await page.evaluate(async () => { const r = await (await fetch('/api/cms/enquiry', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('office: the enquiry form sends and the enquiry arrives in the admin', rows.length === 1 && rows[0].email === 'marie@novakova.example' && /čtyřmi/.test(rows[0].message ?? ''), JSON.stringify(rows[0] ?? null))
  },
}

// Sports club's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the
// checks every hosted template goes through). What depends on today's date (which match is next,
// which are played) is worked out here from the site's own content API, so the checks hold on
// any day and at any time of day.
export default {
  // The name the site is made with.
  name: 'Sokol Zálesí',
  // The club's name is written in the header (capitals in some looks, so without regard to case).
  named: async (page) => /sokol zálesí/i.test(await page.locator('[data-wordmark]').first().innerText()),
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })

    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('sports-club: the menu\'s links lead to sections of the page', anchors.length >= 4 && missing.length === 0, JSON.stringify({ anchors, missing }))

    // The club's facts as the content API holds them: the first team is the one the opening follows.
    const content = await page.evaluate(async () => {
      const list = async (entity, query = '') => (await (await fetch(`/api/content/${entity}?limit=100${query}`)).json()).items
      return { squads: await list('squad'), matches: await list('match', '&sort=date&dir=asc'), articles: await list('article', '&sort=date&dir=desc') }
    })
    const main = content.squads[0]
    const played = (m) => m.goalsFor != null && m.goalsAgainst != null
    const own = (squad) => content.matches.filter((m) => m.squad.id === squad.id)
    const coming = own(main).filter((m) => !played(m) && Date.parse(m.date) >= Date.now())
    const last = own(main).filter(played).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0]
    check('sports-club: the demo has both played and coming matches', coming.length > 0 && !!last, JSON.stringify({ coming: coming.length, last: !!last }))

    // The next match is the first coming one of the first team, the last result its last played one.
    const nextText = await page.locator('[data-next-match]').innerText()
    check('sports-club: the opening is about the next match of the first team', nextText.includes(coming[0].opponent), coming[0].opponent)
    const score = last.home ? `${last.goalsFor}:${last.goalsAgainst}` : `${last.goalsAgainst}:${last.goalsFor}`
    check('sports-club: the last result is the last played match of the first team', (await page.locator('[data-last-result]').getAttribute('data-last-result')) === score && (await page.locator('[data-last-result]').innerText()).includes(last.opponent), score)

    // The fixtures: coming matches before played ones, the tab of each team shows that team's matches.
    const tabs = await page.getByRole('tab').allInnerTexts()
    const shown = content.squads.filter((s) => s.inMatches)
    check('sports-club: every team that is in the match list has a tab', tabs.length === shown.length && shown.every((s) => tabs.some((t) => t.trim().toLowerCase() === s.name.toLowerCase())), JSON.stringify(tabs))
    const rows = async () => page.locator('#zapasy [data-match]').evaluateAll((els) => els.map((e) => e.getAttribute('data-played') === 'true'))
    const first = await rows()
    check('sports-club: the first team\'s matches are listed, the coming ones before the played ones', first.length === own(main).length && first.every((isPlayed, i) => !isPlayed || first.slice(i).every(Boolean)), JSON.stringify(first))
    const other = shown[1]
    await page.getByRole('tab').nth(1).click()
    await page.waitForFunction((n) => document.querySelectorAll('#zapasy [data-match]').length === n, own(other).length, { timeout: 5000 }).catch(() => {})
    check('sports-club: another team\'s tab lists that team\'s matches', (await rows()).length === own(other).length, other?.name)

    // News: the list lists every article, each article has a page of its own with one heading.
    await page.goto(`${origin}/aktuality`, { waitUntil: 'networkidle' })
    const hrefs = await page.evaluate(() => [...new Set([...document.querySelectorAll('main a[href^="/aktuality/"]')].map((a) => a.getAttribute('href')))])
    check('sports-club: the list of articles links to every article', hrefs.length === content.articles.length, `${hrefs.length} of ${content.articles.length}`)
    for (const article of content.articles) {
      const response = await page.goto(`${origin}/aktuality/${article.slug}`, { waitUntil: 'networkidle' })
      const headings = await page.locator('main h1').allInnerTexts()
      check(`sports-club: the article ${article.slug} has a page with one heading`, response.status() === 200 && headings.length === 1 && headings[0].replace(/\s+/g, ' ').toLowerCase().includes(article.title.slice(0, 12).toLowerCase()), JSON.stringify(headings))
    }

    // The privacy page is linked from the footer.
    await page.goto(origin, { waitUntil: 'networkidle' })
    const legal = await page.locator('footer a[href="/ochrana-osobnich-udaju"]').first().getAttribute('href')
    const privacy = await page.goto(`${origin}${legal}`, { waitUntil: 'networkidle' })
    check('sports-club: the privacy page is linked from the footer and answers with one heading', privacy.status() === 200 && (await page.locator('main h1').count()) === 1, String(legal))

    // The application for a trial training: it sends and arrives in the admin.
    await page.goto(origin, { waitUntil: 'networkidle' })
    await page.locator('form [name=child]').fill('Matěj Zkouška')
    await page.locator('form [name=birthYear]').fill('2017')
    await page.locator('form [name=parent]').fill('Jana Zkouškových')
    await page.locator('form [name=contact]').fill('123 456 789')
    await page.locator('form button[type=submit]').click()
    await page.locator('[role=status]').waitFor({ timeout: 15_000 })
    const applications = await page.evaluate(async () => { const r = await (await fetch('/api/cms/trial', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('sports-club: the application for a trial training sends and arrives in the admin', applications.length === 1 && applications[0].child === 'Matěj Zkouška' && applications[0].birthYear === '2017' && applications[0].contact === '123 456 789', JSON.stringify(applications[0] ?? null))
  },
}

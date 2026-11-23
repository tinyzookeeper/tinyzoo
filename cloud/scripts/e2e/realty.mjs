// Realty's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the
// checks every hosted template goes through).
export default {
  // The name the site is made with.
  name: 'Reality Vítek',
  // The name stands in the header, in the look's own type (a box, a serif, a bold word).
  named: async (page) => (await page.locator('header [data-wordmark]').first().innerText()).trim() === 'Reality Vítek',
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })
    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('realty: the menu\'s links lead to sections of the page', anchors.length >= 4 && missing.length === 0, JSON.stringify({ anchors, missing }))

    // The listings: a page of their own each, with one heading.
    const listings = await page.evaluate(async () => (await (await fetch('/api/content/listing?limit=100')).json()).items.map((l) => ({ slug: l.slug, title: l.title, deal: l.deal, kind: l.kind })))
    check('realty: the demo holds its properties', listings.length === 7, String(listings.length))
    const pages = []
    for (const l of listings) {
      const res = await page.goto(`${origin}/nabidka/${l.slug}`, { waitUntil: 'networkidle' })
      pages.push({ slug: l.slug, status: res.status(), h1: await page.locator('main h1').count(), title: (await page.locator('main h1').first().innerText()).replace(/\s+/g, ' ').trim() === l.title.replace(/\s+/g, ' ') })
    }
    check('realty: every property has a page of its own, with its title as the one heading', pages.every((p) => p.status === 200 && p.h1 === 1 && p.title), JSON.stringify(pages.filter((p) => p.status !== 200 || p.h1 !== 1 || !p.title)))
    const all = await page.goto(`${origin}/nabidka`, { waitUntil: 'networkidle' })
    check('realty: the whole offer has a page, with every property', all.status() === 200 && await page.locator('[data-grid] [data-card]').count() === listings.length)

    // The filter is made of the properties: its counts are theirs, and a chip narrows the cards.
    await page.goto(origin, { waitUntil: 'networkidle' })
    const rent = listings.filter((l) => l.deal === 'rent').length
    const chip = page.locator('[data-filter=rent]')
    check('realty: the chip of rentals counts the rentals', (await chip.innerText()).replace(/\D+/g, '') === String(rent), await chip.innerText())
    await chip.click()
    check('realty: a chip narrows the cards to what it says', await page.locator('[data-grid] [data-card]').count() === rent && await page.locator('[data-grid] [data-card][data-deal=sale]').count() === 0)
    await page.locator('[data-filter=all]').click()
    // A link can open the list with a filter set.
    await page.goto(`${origin}/nabidka?kind=plot`, { waitUntil: 'networkidle' })
    check('realty: an address can ask for a filter', await page.locator('[data-grid] [data-card]').count() === listings.filter((l) => l.kind === 'plot').length)

    // The three forms arrive in the admin.
    await page.goto(origin, { waitUntil: 'networkidle' })
    await page.locator('[data-enquiry] [name=name]').fill('Jana Nováková')
    await page.locator('[data-enquiry] [name=contact]').fill('jana@example.example')
    const topics = await page.locator('[data-enquiry] select[name=topic] option').count()
    await page.locator('[data-enquiry] select[name=topic]').selectOption({ index: 3 })
    await page.locator('[data-enquiry] [name=message]').fill('Mám zájem o prohlídku domu.')
    await page.locator('[data-enquiry] button[type=submit]').click()
    await page.locator('[data-enquiry] [role=status]').waitFor({ timeout: 15_000 })
    await page.locator('[data-valuation] [name=address]').fill('Zahradní 5, Písek')
    await page.locator('[data-valuation] [name=area]').fill('74')
    await page.locator('[data-valuation] [name=name]').fill('Petr Novák')
    await page.locator('[data-valuation] [name=contact]').fill('123 456 799')
    await page.locator('[data-valuation] button[type=submit]').click()
    await page.locator('[data-valuation] [role=status]').waitFor({ timeout: 15_000 })
    await page.locator('[data-cta] [name=email]').fill('pes@example.example')
    await page.locator('[data-cta] button[type=submit]').click()
    await page.locator('[data-cta] [role=status]').waitFor({ timeout: 15_000 })
    const rows = (name) => page.evaluate(async (n) => { const r = await (await fetch(`/api/cms/${n}`, { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] }, name)
    const [enquiries, valuations, watchers] = [await rows('enquiry'), await rows('valuation'), await rows('watchdog')]
    check('realty: the contact form sends, with the topics the agency listed', topics === 5 && enquiries.length === 1 && enquiries[0].topic === 'Mám zájem o prohlídku' && /prohlídku domu/.test(enquiries[0].message ?? ''), JSON.stringify(enquiries[0] ?? null))
    check('realty: the price estimate form sends', valuations.length === 1 && valuations[0].address === 'Zahradní 5, Písek' && valuations[0].kind === 'flat' && valuations[0].area === '74', JSON.stringify(valuations[0] ?? null))
    check('realty: the box that watches the offer sends', watchers.length === 1 && watchers[0].email === 'pes@example.example', JSON.stringify(watchers[0] ?? null))
  },
}

// Trades' own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the
// checks every hosted template goes through).
export default {
  // The name the site is made with.
  name: 'Novák topení',
  // The name is written large in the header's wordmark (Mistr and Reflex both mark it).
  named: async (page) => (await page.locator('header [data-wordmark]').first().innerText()).trim() === 'Novák topení',
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })
    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('trades: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))
    check('trades: the phone number from the settings is a link to call', await page.locator('main a[href^="tel:"]').count() >= 1)
    // A job has a page of its own, with one heading, in whatever look the site is in.
    const slug = await page.evaluate(async () => (await (await fetch('/api/content/job?limit=1')).json()).items[0]?.slug)
    const job = await page.goto(`${origin}/zakazka/${slug}`, { waitUntil: 'networkidle' })
    check('trades: a job has a page of its own with one heading', job.status() === 200 && await page.locator('h1').count() === 1, String(job.status()))
    // The page of all jobs shows every job, and the home page links to it.
    const total = await page.evaluate(async () => (await (await fetch('/api/content/job?limit=100')).json()).items.length)
    await page.goto(`${origin}/zakazky`, { waitUntil: 'networkidle' })
    check('trades: the page of all jobs shows every job', await page.locator('[data-job]').count() === total, String(total))
    // The enquiry form sends and the enquiry arrives in the admin.
    await page.goto(origin, { waitUntil: 'networkidle' })
    await page.locator('form [name=name]').fill('Jana Nováková')
    await page.locator('form [name=phone]').fill('123 456 702')
    await page.locator('form [name=town]').fill('Jičín')
    await page.locator('form [name=message]').fill('Kape kohout u pračky.')
    await page.locator('form button[type=submit]').click()
    await page.locator('[role=status]').waitFor({ timeout: 15_000 })
    const enquiries = await page.evaluate(async () => { const r = await (await fetch('/api/cms/enquiry', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('trades: the enquiry form sends and arrives in the admin', enquiries.length === 1 && enquiries[0].town === 'Jičín' && enquiries[0].phone === '123 456 702', JSON.stringify(enquiries[0] ?? null))
  },
}

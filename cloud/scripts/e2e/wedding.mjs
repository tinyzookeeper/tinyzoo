// Wedding's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the
// checks every hosted template goes through).
export default {
  // The name the site is made with.
  name: 'Klára a Matěj',
  // The names open the page, with the look's own sign between them; the admin is called by them.
  named: async (page) => /Klára\s*(&|a)\s*Matěj/.test((await page.locator('main h1').first().innerText()).replace(/\s+/g, ' ')),
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })
    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('wedding: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))
    const day = await page.evaluate(() => document.querySelector('main time[datetime]')?.getAttribute('datetime'))
    check('wedding: the day of the ceremony is written from the settings', day === '2027-06-19T12:30', String(day))
    // A guest reserves a gift: it then says so for everyone, and the admin shows it.
    const before = await page.evaluate(async () => (await (await fetch('/api/content/gift?limit=100')).json()).items.map((g) => ({ id: g.id, reserved: g.reserved, open: g.open })))
    const free = before.find((g) => !g.reserved && !g.open)
    await page.locator(`[data-gift="${free.id}"] [data-gift-reserve]`).click()
    await page.locator(`[data-gift="${free.id}"][data-reserved=true]`).waitFor({ timeout: 10_000 })
    const after = await page.evaluate(async () => (await (await fetch('/api/content/gift?limit=100')).json()).items)
    check('wedding: reserving a gift marks that gift, and no other', after.find((g) => g.id === free.id).reserved === true && after.filter((g) => g.reserved).length === before.filter((g) => g.reserved).length + 1)
    const open = before.find((g) => g.open)
    const refused = await page.evaluate(async (id) => (await fetch(`/api/gift/${id}/reserve`, { method: 'POST' })).status, open.id)
    check('wedding: a contribution anyone can add to cannot be reserved', refused === 404, String(refused))
    // The reply form: the dishes are the couple's own, and a reply arrives in the admin.
    await page.locator('form [name=name]').fill('Jana a Petr Novákovi')
    const dishes = await page.locator('form select[name=meal] option').count()
    await page.locator('form select[name=meal]').selectOption({ index: 1 })
    await page.locator('form [name=message]').fill('Přijedeme už v pátek večer.')
    await page.locator('form [name=ride]').check()
    await page.locator('form button[type=submit]').click()
    await page.locator('[role=status]').waitFor({ timeout: 15_000 })
    const replies = await page.evaluate(async () => { const r = await (await fetch('/api/cms/rsvp', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('wedding: the reply form sends, with the couple\'s own dishes and the ride', dishes === 4 && replies.length === 1 && replies[0].attending === 'yes' && replies[0].ride === true && /Pstruh/.test(replies[0].meal ?? ''), JSON.stringify(replies[0] ?? null))
  },
}

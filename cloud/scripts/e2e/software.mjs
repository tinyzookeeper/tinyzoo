// Software's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the
// checks every hosted template goes through).
export default {
  // The name the site is made with.
  name: 'Směnka',
  // The product's name is written in the header by every look (Magnets in lower case).
  named: async (page) => /Směnka/i.test(await page.locator('header [data-wordmark]').first().innerText()),
  async extra({ page, origin, check }) {
    await page.goto(origin, { waitUntil: 'networkidle' })
    // The menu leads to sections of the page: every one of its anchors is there.
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('software: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))

    // The price list: the switch between monthly and yearly payment changes the prices.
    const plan = page.locator('#cenik article').first()
    const monthly = await plan.innerText()
    await page.locator('#cenik button[aria-pressed]').nth(1).click()
    const yearly = await plan.innerText()
    check('software: the switch to yearly payment shows the yearly prices', monthly !== yearly && /240/.test(yearly) && /2\s?880/.test(yearly) && !/\b290\b/.test(yearly), yearly.replace(/\s+/g, ' ').slice(0, 120))

    // The changelog: the home page shows the newest releases, the page of its own all of them.
    const onHome = await page.locator('[data-release]:visible').count()
    await page.goto(`${origin}/novinky`, { waitUntil: 'networkidle' })
    const onPage = await page.locator('[data-release]:visible').count()
    check('software: the changelog shows five releases on the home page and all of them on its own page', onHome === 5 && onPage > 5 && await page.locator('h1').count() === 1, JSON.stringify({ onHome, onPage }))

    // The pages of the footer answer with one heading and their text.
    for (const path of ['/kontakt', '/ochrana-osobnich-udaju']) {
      await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' })
      check(`software: ${path} is a page with one heading`, await page.locator('main h1').count() === 1 && (await page.locator('main').innerText()).length > 100)
    }

    // The contact form: a message arrives in the admin, with the number of people chosen.
    await page.goto(origin, { waitUntil: 'networkidle' })
    const contact = page.locator('#kontakt form')
    await contact.locator('[name=name]').fill('Jana Nováková')
    await contact.locator('[name=email]').fill('jana@novakova.example')
    if (await contact.locator('[name=people]').count()) await contact.locator('[name=people]').selectOption('upto50')
    await contact.locator('[name=message]').fill('Máme kavárnu a čtyřicet lidí, hodí se Směnka?')
    await contact.locator('button[type=submit]').click()
    await page.locator('#kontakt [role=status]').waitFor({ timeout: 15_000 })
    const messages = await page.evaluate(async () => { const r = await (await fetch('/api/cms/contact', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('software: the contact form sends and the message arrives in the admin', messages.length === 1 && messages[0].email === 'jana@novakova.example' && /kavárnu/.test(messages[0].message ?? ''), JSON.stringify(messages[0] ?? null))

    // The sign-up request at the end of the page: an e-mail address arrives in the admin.
    const trial = page.locator('#vyzkouset form')
    await trial.locator('[name=email]').fill('vedouci@kavarna.example')
    await trial.locator('button[type=submit]').click()
    await page.locator('#vyzkouset [role=status]').waitFor({ timeout: 15_000 })
    const requests = await page.evaluate(async () => { const r = await (await fetch('/api/cms/trial', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('software: the sign-up field sends and the address arrives in the admin', requests.length === 1 && requests[0].email === 'vedouci@kavarna.example', JSON.stringify(requests[0] ?? null))
  },
}

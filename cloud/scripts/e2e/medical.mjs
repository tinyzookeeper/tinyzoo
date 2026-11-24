// Medical's own part of the end-to-end check (scripts/e2e-templates.mjs runs it after the
// checks every hosted template goes through).
export default {
  // The name the site is made with.
  name: 'Ordinace MUDr. Nováka',
  // The name is written in the header by the look (the element marked data-wordmark); the admin is called by it.
  named: async (page) => /Ordinace\s+MUDr\.\s+Nováka/.test((await page.locator('[data-wordmark]').first().innerText()).replace(/\s+/g, ' ')),
  async extra({ page, origin, check }) {
    const json = { accept: 'application/json', 'content-type': 'application/json' }
    const state = async () => (await page.locator('[data-open-state]').first().innerText()).replace(/\s+/g, ' ').trim()
    const rowsOf = () => page.evaluate(async () => (await (await fetch('/api/content/openingHour?limit=100')).json()).items)
    // The practice's own clock: its town's weekday and minutes, as the browser reads them now.
    const clock = () => page.evaluate(() => {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date())
      const get = (t) => p.find((x) => x.type === t).value
      return { day: get('weekday').toLowerCase().slice(0, 3), minutes: Number(get('hour')) * 60 + Number(get('minute')) }
    })
    const minutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

    // What the server answers cannot depend on the time: no state, no "today" until the browser has drawn the same.
    const html = await (await fetch(origin)).text()
    check('medical: the server\'s page says nothing of "open now" or "today" (the browser works it out)', !/Právě máme otevřeno|Teď máme zavřeno/.test(html) && !html.includes('data-today'))

    // The menu leads to sections of the page: every one of its anchors is there.
    await page.goto(origin, { waitUntil: 'networkidle' })
    const anchors = await page.evaluate(() => [...document.querySelectorAll('header nav a[href*="#"]')].map((a) => a.getAttribute('href').split('#')[1]))
    const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), anchors)
    check('medical: the menu\'s links lead to sections of the page', anchors.length >= 5 && missing.length === 0, JSON.stringify({ anchors, missing }))

    // The week lists the days that have hours, in the week's order, and exactly the one that is today is marked.
    const rows = await rowsOf()
    const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    const expected = order.filter((d) => rows.some((r) => r.day === d))
    const days = await page.evaluate(() => [...document.querySelectorAll('[data-day]')].map((e) => e.getAttribute('data-day')))
    check('medical: the week lists the days that have hours', rows.length >= 10 && days.join() === expected.join(), `${days.join()} / ${expected.join()}`)
    const now = await clock()
    const marked = await page.evaluate(() => [...document.querySelectorAll('[data-today]')].map((e) => e.getAttribute('data-day')))
    check('medical: exactly the day that is today is marked (none when the practice is closed all day)', expected.includes(now.day) ? marked.join() === now.day : marked.length === 0, `${marked.join()} / ${now.day}`)

    // "Open now" agrees with the hours for the browser's own clock.
    const parts = rows.filter((r) => r.day === now.day).map((r) => [minutes(r.from), minutes(r.to)])
    const open = parts.some(([from, to]) => from <= now.minutes && now.minutes < to)
    const text = await state()
    check('medical: "open now" agrees with the opening hours', open ? /^Právě máme otevřeno, dnes do \d{1,2}:\d{2}$/.test(text) : /^Teď máme zavřeno/.test(text), `${text} / ${JSON.stringify(now)} / ${JSON.stringify(parts)}`)

    // The hours are data: a row that covers the whole of today, added in the admin, opens the practice now.
    const added = await page.evaluate(async ({ h, day }) => (await fetch('/api/cms/openingHour', { method: 'POST', headers: h, body: JSON.stringify({ day, from: '0:00', to: '24:00', note: 'Zkouška', kind: 'walkin' }) })).status, { h: json, day: now.day })
    await page.goto(origin, { waitUntil: 'networkidle' })
    check('medical: a row added for today opens the practice, and that day is marked', added < 300 && /^Právě máme otevřeno/.test(await state()) && (await page.locator('[data-today]').count()) === 1, `${added} ${await state()}`)
    const extra = (await rowsOf()).find((r) => r.note === 'Zkouška')
    if (extra) await page.evaluate(async (id) => fetch(`/api/cms/openingHour/${id}`, { method: 'DELETE', headers: { accept: 'application/json' } }), extra.id)

    // Notices: the valid ones are shown; one that has expired is not.
    await page.goto(origin, { waitUntil: 'networkidle' })
    const shown = await page.locator('[data-notice]').count()
    const expired = await page.evaluate(async (h) => (await fetch('/api/cms/notice', { method: 'POST', headers: h, body: JSON.stringify({ title: 'Včerejší oznámení', text: 'Už neplatí.', important: false, icon: 'bell', validTo: new Date(Date.now() - 3 * 86_400_000).toISOString() }) })).status, json)
    await page.goto(origin, { waitUntil: 'networkidle' })
    check('medical: the notices that are valid are shown, an expired one is not', shown >= 1 && expired < 300 && (await page.locator('[data-notice]').count()) === shown && !(await page.locator('main').innerText()).includes('Včerejší oznámení'), `${shown} ${expired}`)
    const old = await page.evaluate(async () => (await (await fetch('/api/content/notice?limit=100&preview')).json()).items?.find((n) => n.title === 'Včerejší oznámení'))
    if (old) await page.evaluate(async (id) => fetch(`/api/cms/notice/${id}`, { method: 'DELETE', headers: { accept: 'application/json' } }), old.id)

    // The appointment form: the insurers are the practice's own, the consent is needed, and a request arrives in the admin.
    await page.goto(origin, { waitUntil: 'networkidle' })
    const insurers = await page.evaluate(async () => (await (await fetch('/api/content/insurer?limit=100')).json()).items.length)
    const options = await page.locator('form select[name=insurer] option').count()
    await page.locator('form [name=name]').fill('Jana Nováková')
    await page.locator('form [name=birthYear]').fill('1958')
    await page.locator('form [name=phone]').fill('123 456 799')
    await page.locator('form select[name=insurer]').selectOption({ index: 1 })
    await page.locator('form [name=reason]').fill('Kontrola tlaku')
    await page.locator('form input[name=when][value=morning]').check({ force: true })
    await page.locator('form button[type=submit]').click()
    await page.locator('form .field-error').first().waitFor({ timeout: 15_000 })
    check('medical: the request is not sent without the consent', (await page.locator('[role=status]').count()) === 0)
    await page.locator('form [name=consent]').check()
    await page.locator('form button[type=submit]').click()
    await page.locator('[role=status]').waitFor({ timeout: 15_000 })
    const requests = await page.evaluate(async () => { const r = await (await fetch('/api/cms/appointment', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('medical: the appointment form sends, with the practice\'s own insurers', options === insurers + 1 && requests.length === 1 && requests[0].when === 'morning' && requests[0].consent === true && /^\d{3} /.test(requests[0].insurer ?? ''), JSON.stringify(requests[0] ?? null))
  },
}

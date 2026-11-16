import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, signIn, testDb, truncateAll, waitForMail } from '../helpers/api'

// Website forms (defineForm): the playground's ContactForm and FormSettings.
const db = testDb()
let admin: Client
beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const good = { name: 'Jana', email: 'jana@example.com', message: 'Kdy je další závod?', consent: true, _t: 5000 }
const send = (c: Client, body: Record<string, unknown>) => c.post('/api/content/_form/contactForm', body)

describe('website forms', () => {
  it('describes the form in the language asked for', async () => {
    const cs = (await anonymous().get('/api/content/_form/contactForm')).body
    expect(cs.label).toBe('Kontaktní formulář')
    expect(cs.fields.map((f: any) => f.key)).toEqual(['name', 'email', 'topic', 'message', 'consent'])
    expect(cs.fields.find((f: any) => f.key === 'topic').options).toEqual(expect.arrayContaining([{ value: 'race', label: 'Závod' }]))
    const en = (await anonymous().get('/api/content/_form/contactForm?locale=en')).body
    expect(en.successMessage).toBe('Thank you, we will reply soon.')
    expect((await anonymous().get('/api/content/_form/post')).status).toBe(404) // not a form
  })

  it('accepts an optional choice left unchosen (sent as null, as the form does)', async () => {
    expect((await anonymous().get('/api/content/_form/contactForm')).body.fields.find((f: any) => f.key === 'topic').required).toBe(false)
    expect((await send(anonymous(), { ...good, topic: null })).status).toBe(201)
    const { rows } = await db.query('select topic from contact_form')
    expect(rows).toEqual([{ topic: null }])
  })

  it('stores a submission as a new entry and emails the people in Forms settings', async () => {
    await admin.put('/api/cms/_singleton/formSettings', { notifyTo: [{ id: 'a', type: 'item', email: 'office@example.com' }] })
    const res = await send(anonymous(), { ...good, topic: 'race', status: 'done' })
    expect(res.status).toBe(201)
    const { rows } = await db.query('select name, email, topic, status from contact_form')
    expect(rows).toEqual([{ name: 'Jana', email: 'jana@example.com', topic: 'race', status: 'new' }]) // a visitor cannot set the state
    const mail = await waitForMail('office@example.com')
    expect(mail.text).toContain('Kdy je další závod?')
    expect(mail.text).toMatch(/\/admin\/contactForm\//)
    expect((mail as any).replyTo).toBe('jana@example.com')
    expect(mail.subject).toContain('Jana')
  })

  it('answers robots exactly like a stored message (201, same body) but stores nothing', async () => {
    const stored = await send(anonymous(), good)
    await db.query('truncate contact_form')
    const honeypot = await send(anonymous(), { ...good, _hp: 'http://spam.example' })
    const tooFast = await send(anonymous(), { ...good, _t: 300 })
    expect([honeypot.status, tooFast.status]).toEqual([201, 201])
    expect([honeypot.body, tooFast.body]).toEqual([stored.body, stored.body])
    const { rows } = await db.query('select count(*)::int as n from contact_form')
    expect(rows[0].n).toBe(0)
  })

  it('validates even a form sent very fast (no silent "thank you" for an empty form)', async () => {
    expect((await send(anonymous(), { _t: 300 })).status).toBe(422)
  })

  it('validates against the form fields, per field', async () => {
    const res = await send(anonymous(), { name: 'Jana', email: 'not-an-email', _t: 5000 })
    expect(res.status).toBe(422)
    const paths = res.body.data.map((i: any) => i.path[0])
    expect(paths).toEqual(expect.arrayContaining(['email', 'message']))
  })

  it('words every refused field in the visitor\'s language, not the validator\'s', async () => {
    const cs = await send(anonymous(), { name: 'Jana', email: 'not-an-email', topic: 'nonsense', _locale: 'cs', _t: 5000 })
    expect(cs.status).toBe(422)
    const byField = (res: any) => Object.fromEntries(res.body.data.map((i: any) => [i.path[0], i.message]))
    expect(byField(cs)).toMatchObject({
      email: 'Zadejte prosím platný e-mail.',
      topic: 'Vyberte jednu z možností.',
      message: 'Vyplňte prosím.',
      consent: 'Pro odeslání je potřeba toto políčko zaškrtnout.',
    })
    const en = await send(anonymous(), { name: 'Jana', email: 'not-an-email', _locale: 'en', _t: 5000 })
    expect(byField(en)).toMatchObject({ email: 'Please enter a valid email.', message: 'Please fill this in.', consent: 'Please tick this box to send the form.' })
    const tooLong = await send(anonymous(), { ...good, message: 'x'.repeat(5001), _locale: 'en' })
    expect(byField(tooLong).message).toBe('This is too long (at most 5000 characters).')
    // no language given: the site's own (Czech)
    expect(byField(await send(anonymous(), { name: 'Jana', _t: 5000 })).email).toBe('Vyplňte prosím.')
  })

  it('a consent that must be ticked is refused unticked, accepted ticked', async () => {
    const schema = (await anonymous().get('/api/content/_form/contactForm')).body
    expect(schema.fields.find((f: any) => f.key === 'consent').required).toBe(true)
    expect((await send(anonymous(), { ...good, consent: false })).status).toBe(422)
    expect((await send(anonymous(), { ...good, consent: undefined })).status).toBe(422)
    expect((await send(anonymous(), { ...good, consent: 'on' })).status).toBe(201) // form data sends text
    expect((await send(anonymous(), good)).status).toBe(201)
  })

  it('refuses submissions sent from another site', async () => {
    const c = anonymous()
    const res = await c.request('POST', '/api/content/_form/contactForm', { json: good, headers: { origin: 'https://evil.example' } })
    expect(res.status).toBe(403)
  })

  it('limits how often one visitor can send', async () => {
    const c = anonymous()
    const codes: number[] = []
    for (let i = 0; i < 9; i++) codes.push((await send(c, good)).status)
    expect(codes.slice(0, 8).every((s) => s === 201)).toBe(true)
    expect(codes[8]).toBe(429)
    expect((await send(c, good)).headers.get('retry-after')).toBe('600') // the window: the most they wait
  })

  it('a post without the fill-in time (a form without JavaScript, a script) is accepted, not thrown away', async () => {
    const { _t: _omit, ...withoutTime } = good
    expect((await send(anonymous(), withoutTime)).status).toBe(201)
    expect((await db.query('select count(*)::int as n from contact_form')).rows[0].n).toBe(1)
  })
})

describe('CSV export', () => {
  it('downloads the submissions as CSV (signed in only), formulas neutralised', async () => {
    await send(anonymous(), { ...good, name: '=HYPERLINK("x")', message: 'Řádek, s čárkou' })
    const res = await admin.request('GET', '/api/cms/contactForm/_export', { headers: { accept: 'text/csv' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    const text = String(res.body) // (text decoding drops the BOM; the raw bytes start with it)
    // In the admin's language (the playground's default is Czech): labels, ";" for Czech Excel.
    expect(text.split('\r\n')[0]).toBe('Vaše jméno;E-mail;Téma;Zpráva;Souhlasím se zpracováním údajů;Stav;Vytvořeno')
    expect(text).toContain(';Nové;')
    const raw = new Uint8Array(await (await fetch(admin.baseURL + '/api/cms/contactForm/_export', { headers: { cookie: admin.cookie } })).arrayBuffer())
    expect([...raw.slice(0, 3)]).toEqual([0xEF, 0xBB, 0xBF])
    expect(text).toContain('"\'=HYPERLINK(""x"")"')
    expect(text).toContain('"Řádek, s čárkou"')
    expect((await anonymous().get('/api/cms/contactForm/_export')).status).toBe(401)
  })
})

describe('who reads the messages', () => {
  it('administrators and editors read, export and open them; authors get 403 everywhere, and no menu entry', async () => {
    const editor = await signIn('editor')
    const author = await signIn('author')
    await send(anonymous(), good)
    const { rows } = await db.query('select id from contact_form')
    const id = rows[0].id

    for (const c of [admin, editor]) {
      expect((await c.get('/api/cms/contactForm')).status).toBe(200)
      expect((await c.get(`/api/cms/contactForm/${id}`)).status).toBe(200)
      const csv = await c.get('/api/cms/contactForm/_export')
      expect(csv.status).toBe(200)
      expect(String(csv.body)).toContain('jana@example.com')
      expect((await c.get('/api/cms/_singleton/formSettings')).status).toBe(200)
    }
    for (const path of ['/api/cms/contactForm', `/api/cms/contactForm/${id}`, '/api/cms/contactForm/_export', '/api/cms/_singleton/formSettings', `/api/cms/contactForm/${id}/revisions`]) {
      expect((await author.get(path)).status, path).toBe(403)
    }
    const graph = (await author.get('/api/cms/_graph')).body
    expect(JSON.stringify(graph)).not.toContain('contactForm')
    expect(JSON.stringify(graph)).not.toContain('formSettings')
    expect(JSON.stringify((await admin.get('/api/cms/_graph')).body)).toContain('contactForm')
    // …nor does the search find a visitor's text for them.
    const found = (await author.get('/api/cms/_search?q=Kdy%20je')).body
    expect(JSON.stringify(found)).not.toContain('další závod')
  })
})

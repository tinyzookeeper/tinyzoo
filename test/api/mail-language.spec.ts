import { describe, expect, it } from 'vitest'
import { anonymous, newAccount, signIn, waitForMail } from '../helpers/api'

// Invitation and reset mails are written in the recipient's saved language; without one, in the
// language of the request that caused them (the admin's choice, else the browser's) — not in
// the site's default (Czech here) for someone whose browser says English.
let n = 0
const email = (what: string) => `${what}-${Date.now().toString(36)}-${n++}@test.local`

describe('invitation mail', () => {
  it("is in the inviting administrator's browser language when they never saved one, and names the role", async () => {
    const admin = await signIn('admin')
    const to = email('inv-en')
    const res = await admin.request('POST', '/api/cms/_users', { json: { email: to, role: 'editor' }, headers: { 'accept-language': 'en-GB,en;q=0.9,cs;q=0.5' } })
    expect(res.status).toBe(201)
    const mail = await waitForMail(to)
    expect(mail.subject).toMatch(/invited/i)
    expect(mail.text).toContain('as an editor')
    expect(mail.html).toContain('as an editor')
  })

  it('follows a Czech browser into Czech, with the role', async () => {
    const admin = await signIn('admin')
    const to = email('inv-cs')
    await admin.request('POST', '/api/cms/_users', { json: { email: to, role: 'author' }, headers: { 'accept-language': 'cs,en;q=0.5' } })
    const mail = await waitForMail(to)
    expect(mail.subject).toMatch(/Pozvánka/)
    expect(mail.text).toContain('jako autor')
  })

  it("prefers the language chosen in the admin (its cookie) over the browser's", async () => {
    const admin = await signIn('admin')
    const to = email('inv-de')
    admin.cookie += '; cms_admin_locale=de' // the admin's own choice of language
    await admin.request('POST', '/api/cms/_users', { json: { email: to, role: 'admin' }, headers: { 'accept-language': 'en' } })
    const mail = await waitForMail(to)
    expect(mail.subject).toMatch(/Einladung/)
    expect(mail.text).toContain('als Administrator')
  })

  it('a resent invitation names the role too', async () => {
    const admin = await signIn('admin')
    const to = email('inv-resend')
    const invited = await admin.post('/api/cms/_users', { email: to, role: 'author' })
    const resent = await admin.request('POST', `/api/cms/_users/${invited.body.user.id}/resend`, { headers: { 'accept-language': 'en' } })
    expect(resent.status).toBe(200)
    const mails = await waitForMail(to, (m) => /as an author/.test(m.text))
    expect(mails.text).toContain('as an author')
  })
})

describe('password reset mail', () => {
  it('is in English for someone with an English browser who never saved a language', async () => {
    const person = await newAccount('editor')
    const res = await anonymous().request('POST', '/api/cms/_auth/forgot', { json: { email: person.email }, headers: { 'accept-language': 'en-US,en;q=0.9' } })
    expect(res.status).toBe(200)
    const mail = await waitForMail(person.email, (m) => /password/i.test(m.subject))
    expect(mail.subject).toMatch(/Reset your password/)
  })

  it('a saved language wins over the browser', async () => {
    const person = await newAccount('editor')
    expect((await person.client.patch('/api/cms/_auth/me', { locale: 'cs' })).status).toBe(200)
    await anonymous().request('POST', '/api/cms/_auth/forgot', { json: { email: person.email }, headers: { 'accept-language': 'en-US,en;q=0.9' } })
    const mail = await waitForMail(person.email, (m) => /hesla/i.test(m.subject))
    expect(mail.subject).toMatch(/Obnovení hesla/)
  })
})

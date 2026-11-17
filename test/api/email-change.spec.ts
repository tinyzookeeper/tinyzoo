import { afterAll, describe, expect, it } from 'vitest'
import { accounts, anonymous, Client, linkIn, login, newAccount, sentMail, signIn, testDb, tokenOf, waitForMail } from '../helpers/api'

// Changing the email address an account signs in with: by the person (password, then a
// link to the new address) and by an administrator (Team).
const db = testDb()
afterAll(() => db.end())

let k = 0
const fresh = (what = 'new') => `${what}-${Date.now().toString(36)}-${k++}@test.local`
const ask = (c: Client, email: string, password: string) => c.post('/api/cms/_auth/email', { email, password })
/** The confirmation link mailed to `to` (the newest one). */
const linkTo = async (to: string) => linkIn((await waitForMail(to, (m) => m.text.includes('/admin/email/'))).text)
const confirm = (c: Client, link: string) => c.post('/api/cms/_auth/email/confirm', { token: tokenOf(link) })
/** How an address is shown in a notice to the old mailbox (see maskEmail). */
const masked = (email: string) => {
  const [local, domain] = email.split('@') as [string, string]
  return `${local[0]}…${local.length > 2 ? local.at(-1) : ''}@${domain}`
}

async function auditRows(where: string, params: unknown[]) {
  return (await db.query(`select action, user_id, record_id, meta from cms_audit where ${where} order by created_at`, params)).rows
}
async function eventually<T>(read: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const v = await read()
    if (ok(v) || Date.now() > deadline) return v
    await new Promise((r) => setTimeout(r, 50))
  }
}

describe('changing your own email', () => {
  it('needs your current password; a wrong one changes nothing and is audited', async () => {
    const acc = await newAccount('editor')
    const to = fresh()
    const res = await ask(acc.client, to, 'not my password')
    expect(res.status).toBe(422)
    expect(res.body.data).toEqual([{ path: ['password'], message: 'Wrong password' }])
    expect((await acc.client.get('/api/cms/_auth/email')).body).toEqual({ pending: null })
    await new Promise((r) => setTimeout(r, 300))
    expect(sentMail(to)).toEqual([])
    expect(sentMail(acc.email).filter((m) => m.text.includes('/admin/forgot'))).toEqual([])
    const rows = await auditRows(`user_id = $1 and action = 'account.email_failed'`, [acc.id])
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0].meta)).toEqual(['ip'])
  })

  it('counts wrong passwords against the same limit as failed sign-ins, so it is no second door for guessing', async () => {
    const acc = await newAccount('editor')
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) statuses.push((await ask(acc.client, fresh(), `guess number ${i}`)).status)
    expect(statuses.slice(0, 10).every((s) => s === 422)).toBe(true)
    expect(statuses[10]).toBe(429)
    // The guesses used up the sign-in budget of this address too: even the right password waits now.
    expect((await anonymous().post('/api/cms/_auth/login', { email: acc.email, password: acc.password })).status).toBe(429)
    expect((await ask(acc.client, fresh(), acc.password)).status).toBe(429)
  })

  it('refuses your own address and a malformed one, and is for signed-in people only', async () => {
    const acc = await newAccount('editor')
    const same = await ask(acc.client, `  ${acc.email.toUpperCase()} `, acc.password)
    expect(same.status).toBe(422)
    expect(same.body.data).toEqual([{ path: ['email'], code: 'same_email', message: 'This is already your address' }])
    expect((await ask(acc.client, 'not an address', acc.password)).status).toBe(422)
    expect((await ask(anonymous(), fresh(), 'whatever it is')).status).toBe(401)
    expect((await anonymous().get('/api/cms/_auth/email')).status).toBe(401)
  })

  it('sends a link to the new address and a notice to the old one; the link makes the change, once', async () => {
    const acc = await newAccount('editor')
    const other = await login(acc.email, acc.password) // another browser of the same person
    const to = fresh()
    const res = await ask(acc.client, `  ${to.toUpperCase()} `, acc.password)
    expect(res.status).toBe(200)
    expect(res.body.pending).toMatchObject({ email: to, expiresAt: expect.any(String) })
    expect((await acc.client.get('/api/cms/_auth/email')).body.pending).toMatchObject({ email: to })

    const link = await linkTo(to)
    expect(link.startsWith(`${new Client().baseURL}/admin/email/`)).toBe(true)
    // The old address hears about it right away, without the new address in full, with a way to stop it.
    const notice = await waitForMail(acc.email, (m) => m.text.includes('/admin/forgot'))
    expect(notice.text).toContain(masked(to))
    expect(notice.text).not.toContain(to)
    // Nothing has changed yet.
    expect((await acc.client.get('/api/cms/_auth/me')).body.user.email).toBe(acc.email)
    await login(acc.email, acc.password)

    // The page shows the address; opening it changes nothing.
    expect((await anonymous().get(`/api/cms/_auth/email/${tokenOf(link)}`)).body).toEqual({ email: to })
    // Opened in a browser that is not signed in: it works, and that browser stays signed out.
    const phone = new Client()
    const done = await confirm(phone, link)
    expect(done.status).toBe(200)
    expect(done.body).toEqual({ email: to, signedIn: false })
    expect((await phone.get('/api/cms/_auth/me')).status).toBe(401)

    // Like a password change: every session of the account ends.
    expect((await acc.client.get('/api/cms/_graph')).status).toBe(401)
    expect((await other.get('/api/cms/_graph')).status).toBe(401)
    // The new address signs in, the old one does not.
    const again = await login(to, acc.password)
    expect((await again.get('/api/cms/_auth/me')).body.user.email).toBe(to)
    expect((await anonymous().post('/api/cms/_auth/login', { email: acc.email, password: acc.password })).status).toBe(401)
    // The old address is told it happened.
    const changed = await waitForMail(acc.email, (m) => !m.text.includes('/admin/') && m.text.includes(masked(to)))
    expect(changed.text).not.toContain(to)

    // Once only.
    expect((await confirm(anonymous(), link)).status).toBe(410)
    expect((await anonymous().get(`/api/cms/_auth/email/${tokenOf(link)}`)).status).toBe(410)
    expect((await again.get('/api/cms/_auth/email')).body).toEqual({ pending: null })

    // Audited: the request and the change, with both addresses.
    const rows = await eventually(() => auditRows(`user_id = $1 and action in ('account.email_request', 'account.email')`, [acc.id]), (r) => r.length === 2)
    expect(rows.map((r) => [r.action, r.meta])).toEqual([
      ['account.email_request', { email: to, previousEmail: acc.email }],
      ['account.email', { email: to, previousEmail: acc.email }],
    ])
  })

  it('keeps the browser that confirms signed in, with the new address in its session', async () => {
    const acc = await newAccount('author')
    const other = await login(acc.email, acc.password)
    const to = fresh()
    await ask(acc.client, to, acc.password)
    const done = await confirm(acc.client, await linkTo(to))
    expect(done.body).toEqual({ email: to, signedIn: true })
    expect((await acc.client.get('/api/cms/_auth/me')).body.user.email).toBe(to)
    expect((await acc.client.get('/api/_auth/session')).body.user.email).toBe(to)
    expect((await other.get('/api/cms/_graph')).status).toBe(401)
  })

  it('leaves another account’s session alone when its browser opens the link', async () => {
    const acc = await newAccount('editor')
    const colleague = await signIn('editor')
    const to = fresh()
    await ask(acc.client, to, acc.password)
    const done = await confirm(colleague, await linkTo(to))
    expect(done.body).toEqual({ email: to, signedIn: false })
    expect((await colleague.get('/api/cms/_auth/me')).body.user.email).toBe(accounts().editor.email)
    await login(to, acc.password)
  })

  it('only the newest link works; cancelling or a password change stops it; an old link expires', async () => {
    const acc = await newAccount('editor')
    const first = fresh()
    const second = fresh()
    await ask(acc.client, first, acc.password)
    const firstLink = await linkTo(first)
    await ask(acc.client, second, acc.password)
    const secondLink = await linkTo(second)
    expect((await confirm(anonymous(), firstLink)).status).toBe(410)
    expect((await acc.client.get('/api/cms/_auth/email')).body.pending).toMatchObject({ email: second })

    // Cancelled on the account page.
    expect((await acc.client.delete('/api/cms/_auth/email')).status).toBe(200)
    expect((await acc.client.get('/api/cms/_auth/email')).body).toEqual({ pending: null })
    expect((await confirm(anonymous(), secondLink)).status).toBe(410)

    // A new password cancels a pending change (what the notice to the old address advises).
    const third = fresh()
    await ask(acc.client, third, acc.password)
    const thirdLink = await linkTo(third)
    expect((await acc.client.post('/api/cms/_auth/password', { current: acc.password, password: 'a different password' })).status).toBe(200)
    expect((await anonymous().get(`/api/cms/_auth/email/${tokenOf(thirdLink)}`)).status).toBe(410)
    expect((await confirm(anonymous(), thirdLink)).status).toBe(410)

    // Expired.
    const fourth = fresh()
    await ask(acc.client, fourth, 'a different password')
    const fourthLink = await linkTo(fourth)
    await db.query(`update cms_tokens set expires_at = now() - interval '1 minute' where user_id = $1 and kind = 'email' and used_at is null`, [acc.id])
    expect((await confirm(anonymous(), fourthLink)).status).toBe(410)
    expect((await acc.client.get('/api/cms/_auth/email')).body).toEqual({ pending: null })
    await login(acc.email, 'a different password')

    expect((await confirm(anonymous(), 'made-up')).status).toBe(410)
  })

  it('a password-reset link sent to the old address stops working once the address changes', async () => {
    const acc = await newAccount('editor')
    await anonymous().post('/api/cms/_auth/forgot', { email: acc.email })
    const reset = linkIn((await waitForMail(acc.email, (m) => m.text.includes('/admin/reset/'))).text)
    const to = fresh()
    await ask(acc.client, to, acc.password)
    expect((await confirm(anonymous(), await linkTo(to))).status).toBe(200)
    expect((await anonymous().post('/api/cms/_auth/reset', { token: tokenOf(reset), password: 'taken over by the old mailbox' })).status).toBe(410)
    await login(to, acc.password)
  })

  it('does not tell the person asking that an address is taken; its owner gets a notice instead of the link', async () => {
    const acc = await newAccount('editor')
    const admin = await signIn('admin')
    const invited = fresh('invited')
    await admin.post('/api/cms/_users', { email: invited, role: 'author' }) // invited, not accepted: still taken
    for (const taken of [accounts().author.email, invited]) {
      const before = sentMail(taken).length
      const res = await ask(acc.client, taken, acc.password)
      expect(res.status).toBe(200) // the same answer as for a free address
      expect(res.body.pending).toMatchObject({ email: taken })
      const mails = await eventually(async () => sentMail(taken), (m) => m.length > before)
      expect(mails.length).toBe(before + 1)
      expect(mails[0]!.text).not.toContain('/admin/email/')
    }
    const rows = await eventually(() => auditRows(`user_id = $1 and action = 'account.email_request'`, [acc.id]), (r) => r.length === 2)
    expect(rows.every((r) => r.meta.inUse === true)).toBe(true)
  })

  it('refuses at the link when the address was taken meanwhile; of two simultaneous changes to one address only one wins', async () => {
    const a = await newAccount('editor')
    const b = await newAccount('editor')
    const admin = await signIn('admin')
    const meanwhile = fresh()
    await ask(a.client, meanwhile, a.password)
    const link = await linkTo(meanwhile)
    expect((await admin.post('/api/cms/_users', { email: meanwhile, role: 'author' })).status).toBe(201)
    const refused = await confirm(anonymous(), link)
    expect(refused.status).toBe(409)
    expect(refused.body.data).toEqual({ code: 'email_taken' })
    await login(a.email, a.password)

    const both = fresh()
    await ask(a.client, both, a.password)
    await ask(b.client, both, b.password)
    const links = (await eventually(async () => sentMail(both).filter((m) => m.text.includes('/admin/email/')), (m) => m.length === 2)).map((m) => linkIn(m.text))
    expect(links).toHaveLength(2)
    const statuses = (await Promise.all(links.map((l) => confirm(anonymous(), l)))).map((r) => r.status).sort()
    expect(statuses).toEqual([200, 409])
    expect((await db.query('select count(*)::int as n from cms_users where email = $1', [both])).rows[0].n).toBe(1)
  })

  it('the demo account keeps its address, and nobody can move to it', async () => {
    const acc = await newAccount('editor')
    const res = await ask(acc.client, 'demo@test.local', acc.password)
    expect(res.status).toBe(200)
    await eventually(async () => sentMail('demo@test.local').filter((m) => m.text.includes('/admin/email/')), () => false, 300)
    expect(sentMail('demo@test.local').filter((m) => m.text.includes('/admin/email/'))).toEqual([])
    const demo = await login('demo@test.local', 'try it out please')
    expect((await ask(demo, fresh(), 'try it out please')).status).toBe(403)
  })
})

describe('an administrator changes someone’s email (Team)', () => {
  it('changes it at once, ends their sessions, tells both addresses and is audited', async () => {
    const acc = await newAccount('editor')
    const admin = await signIn('admin')
    const to = fresh()
    const res = await admin.patch(`/api/cms/_users/${acc.id}`, { email: ` ${to.toUpperCase()}` })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: acc.id, email: to, status: 'active' })
    expect(res.body).not.toHaveProperty('inviteUrl')
    expect((await acc.client.get('/api/cms/_graph')).status).toBe(401)
    await login(to, acc.password)
    expect((await anonymous().post('/api/cms/_auth/login', { email: acc.email, password: acc.password })).status).toBe(401)

    const old = await waitForMail(acc.email, (m) => m.text.includes(masked(to)))
    expect(old.text).not.toContain(to)
    const note = await waitForMail(to, (m) => m.text.includes('/admin/login'))
    expect(note.subject).toBeTruthy()

    const rows = await auditRows(`record_id = $1 and action = 'user.email'`, [acc.id])
    expect(rows).toEqual([{ action: 'user.email', user_id: accounts().admin.id, record_id: acc.id, meta: { email: to, previousEmail: acc.email } }])
  })

  it('is for administrators only, and not for your own account', async () => {
    const acc = await newAccount('author')
    expect((await (await signIn('editor')).patch(`/api/cms/_users/${acc.id}`, { email: fresh() })).status).toBe(403)
    expect((await (await signIn('author')).patch(`/api/cms/_users/${acc.id}`, { email: fresh() })).status).toBe(403)
    expect((await anonymous().patch(`/api/cms/_users/${acc.id}`, { email: fresh() })).status).toBe(401)
    const self = await (await signIn('admin')).patch(`/api/cms/_users/${accounts().admin.id}`, { email: fresh() })
    expect(self.status).toBe(409)
    expect(self.body.data).toEqual({ code: 'self' })
    await login(acc.email, acc.password) // nothing changed
  })

  it('refuses an address another account has (also an invited one, and the demo’s)', async () => {
    const acc = await newAccount('author')
    const admin = await signIn('admin')
    const invited = fresh('invited')
    await admin.post('/api/cms/_users', { email: invited, role: 'author' })
    for (const taken of [accounts().editor.email.toUpperCase(), invited, 'demo@test.local']) {
      const res = await admin.patch(`/api/cms/_users/${acc.id}`, { email: taken })
      expect(res.status).toBe(409)
      expect(res.body.data).toEqual([{ path: ['email'], code: 'unique', message: 'Already has access' }])
    }
    expect((await admin.patch(`/api/cms/_users/${acc.id}`, { email: 'nope' })).status).toBe(422)
  })

  it('for someone not yet accepted, sends the invitation to the new address and ends the old link', async () => {
    const admin = await signIn('admin')
    const typo = fresh('typo')
    const invited = await admin.post('/api/cms/_users', { email: typo, role: 'editor' })
    const to = fresh()
    const res = await admin.patch(`/api/cms/_users/${invited.body.user.id}`, { email: to })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ user: { email: to, status: 'invited' }, emailed: true, inviteUrl: expect.stringContaining('/admin/invite/') })
    expect((await anonymous().get(`/api/cms/_auth/invite/${tokenOf(invited.body.inviteUrl)}`)).status).toBe(410)
    expect((await anonymous().get(`/api/cms/_auth/invite/${tokenOf(res.body.inviteUrl)}`)).body).toMatchObject({ email: to })
    expect(linkIn(sentMail(to)[0]!.text)).toBe(res.body.inviteUrl)
    expect(sentMail(typo)).toHaveLength(1) // only the original invitation: the mistyped address hears nothing more
  })

  it('a pending change of the person’s own stops when an administrator changes the address', async () => {
    const acc = await newAccount('editor')
    const mine = fresh()
    await ask(acc.client, mine, acc.password)
    const link = await linkTo(mine)
    const theirs = fresh()
    expect((await (await signIn('admin')).patch(`/api/cms/_users/${acc.id}`, { email: theirs })).status).toBe(200)
    expect((await confirm(anonymous(), link)).status).toBe(410)
    await login(theirs, acc.password)
  })
})

describe('privacy', () => {
  it('finds the change by the old address, and erasing the person takes both addresses out of the log', async () => {
    const acc = await newAccount('editor')
    const admin = await signIn('admin')
    const mid = fresh('mid')
    await ask(acc.client, mid, acc.password)
    expect((await confirm(anonymous(), await linkTo(mid))).status).toBe(200)
    const last = fresh('last')
    expect((await admin.patch(`/api/cms/_users/${acc.id}`, { email: last })).status).toBe(200)
    await eventually(() => auditRows(`user_id = $1 and action = 'account.email_request'`, [acc.id]), (r) => r.length === 1)

    const byOld = await admin.post('/api/cms/_privacy/lookup', { email: acc.email })
    expect(byOld.body.audit.latest.map((a: any) => a.action)).toEqual(expect.arrayContaining(['account.email', 'account.email_request']))

    expect((await admin.post('/api/cms/_privacy/delete', { email: last })).status).toBe(200)
    for (const address of [acc.email, mid, last]) {
      expect((await db.query(`select action from cms_audit where meta::text ilike $1`, [`%${address}%`])).rows).toEqual([])
    }
    expect((await db.query(`select 1 from cms_state where key = $1`, [`email-change:${acc.id}`])).rowCount).toBe(0)
  })
})

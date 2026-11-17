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
  return `${local[0]}…${local.length > 3 ? local.at(-1) : ''}@${domain}`
}
/** The "your email was changed" notice to `to` (the newest), with its way-back link. */
const changedNotice = (to: string) => waitForMail(to, (m) => m.text.includes('/admin/email/revert/'))
const revertGet = (token: string) => anonymous().get(`/api/cms/_auth/email/revert/${token}`)
const revert = (c: Client, link: string, password: string) => c.post('/api/cms/_auth/email/revert', { token: tokenOf(link), password })
/** An administrator's change of someone's email, with the administrator's own password. */
const adminPassword = () => accounts().admin.password
const adminSets = async (id: string, email: string, password = adminPassword()) => (await signIn('admin')).patch(`/api/cms/_users/${id}`, { email, password })
/** Change `acc`'s address to `to` the person's own way (ask, then open the link); returns the way-back link from the notice to the old address. */
async function changeOwn(acc: { client: Client; email: string; password: string }, to: string): Promise<string> {
  expect((await ask(acc.client, to, acc.password)).status).toBe(200)
  expect((await confirm(anonymous(), await linkTo(to))).status).toBe(200)
  return linkIn((await changedNotice(acc.email)).text)
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
    // The old address is told it happened, with a way back.
    const changed = await changedNotice(acc.email)
    expect(changed.text).toContain(masked(to))
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

  it('refuses at the link when the address was taken meanwhile; of two simultaneous confirmations of one address only one wins', async () => {
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

  it('the unique index stops a confirmation that passed the check while another took the address', async () => {
    const a = await newAccount('editor')
    const b = await newAccount('editor')
    const both = fresh()
    await ask(a.client, both, a.password)
    await ask(b.client, both, b.password)
    const links = (await eventually(async () => sentMail(both).filter((m) => m.text.includes('/admin/email/')), (m) => m.length === 2)).map((m) => linkIn(m.text))
    // Whose link is whose: the token's account.
    const owner = async (link: string) => (await db.query(`select user_id from cms_tokens where token_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')`, [tokenOf(link)])).rows[0]?.user_id
    const mine = (await owner(links[0]!)) === a.id ? links[0]! : links[1]!
    const theirs = mine === links[0] ? links[1]! : links[0]!
    expect(await owner(theirs)).toBe(b.id)
    // Hold a's row: a's confirmation passes the "is it taken?" check (nobody has it yet) and then waits at its update.
    const lock = await db.connect()
    try {
      await lock.query('begin')
      await lock.query('select 1 from cms_users where id = $1 for update', [a.id])
      const first = confirm(anonymous(), mine)
      await eventually(async () => (await db.query(`select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock' and query ilike '%update "cms_users"%'`)).rows[0].n, (n) => n > 0)
      // Meanwhile b takes the address.
      expect((await confirm(anonymous(), theirs)).status).toBe(200)
      await lock.query('commit')
      const refused = await first
      expect(refused.status).toBe(409)
      expect(refused.body.data).toEqual({ code: 'email_taken' })
    }
    finally {
      await lock.query('rollback').catch(() => {})
      lock.release()
    }
    // Nothing of a's changed, and its claim on the link was rolled back with the rest.
    expect((await db.query('select email from cms_users where id = $1', [a.id])).rows[0].email).toBe(a.email)
    expect((await db.query('select count(*)::int as n from cms_users where email = $1', [both])).rows[0].n).toBe(1)
    await login(a.email, a.password)
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
    const res = await admin.patch(`/api/cms/_users/${acc.id}`, { email: ` ${to.toUpperCase()}`, password: adminPassword() })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: acc.id, email: to, status: 'active' })
    expect(res.body).not.toHaveProperty('inviteUrl')
    expect((await acc.client.get('/api/cms/_graph')).status).toBe(401)
    await login(to, acc.password)
    expect((await anonymous().post('/api/cms/_auth/login', { email: acc.email, password: acc.password })).status).toBe(401)

    const old = await waitForMail(acc.email, (m) => m.text.includes(masked(to)))
    expect(old.text).not.toContain(to)
    // No way back in it: the old mailbox is often why an administrator changes the address.
    expect(old.text).not.toContain('/admin/')
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
    const self = await (await signIn('admin')).patch(`/api/cms/_users/${accounts().admin.id}`, { email: fresh(), password: adminPassword() })
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
      const res = await admin.patch(`/api/cms/_users/${acc.id}`, { email: taken, password: adminPassword() })
      expect(res.status).toBe(409)
      expect(res.body.data).toEqual([{ path: ['email'], code: 'unique', message: 'Already has access' }])
    }
    expect((await admin.patch(`/api/cms/_users/${acc.id}`, { email: 'nope', password: adminPassword() })).status).toBe(422)
  })

  it('for someone not yet accepted, sends the invitation to the new address and ends the old link', async () => {
    const admin = await signIn('admin')
    const typo = fresh('typo')
    const invited = await admin.post('/api/cms/_users', { email: typo, role: 'editor' })
    const to = fresh()
    const res = await admin.patch(`/api/cms/_users/${invited.body.user.id}`, { email: to, password: adminPassword() })
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
    expect((await adminSets(acc.id, theirs)).status).toBe(200)
    expect((await confirm(anonymous(), link)).status).toBe(410)
    await login(theirs, acc.password)
  })
})

describe('privacy', () => {
  it('finds the change by the old address, and erasing the person takes both addresses out of the log', async () => {
    const acc = await newAccount('editor')
    const admin = await signIn('admin')
    const privacyAdmin = (await newAccount('admin')).client // privacy actions are limited per administrator: not the shared seeded one
    const mid = fresh('mid')
    await ask(acc.client, mid, acc.password)
    expect((await confirm(anonymous(), await linkTo(mid))).status).toBe(200)
    const last = fresh('last')
    expect((await adminSets(acc.id, last)).status).toBe(200)
    await eventually(() => auditRows(`user_id = $1 and action = 'account.email_request'`, [acc.id]), (r) => r.length === 1)

    const byOld = await privacyAdmin.post('/api/cms/_privacy/lookup', { email: acc.email })
    expect(byOld.body.audit.latest.map((a: any) => a.action)).toEqual(expect.arrayContaining(['account.email', 'account.email_request']))

    expect((await privacyAdmin.post('/api/cms/_privacy/delete', { email: last })).status).toBe(200)
    for (const address of [acc.email, mid, last]) {
      expect((await db.query(`select action from cms_audit where meta::text ilike $1`, [`%${address}%`])).rows).toEqual([])
    }
    expect((await db.query(`select 1 from cms_state where key = $1`, [`email-change:${acc.id}`])).rowCount).toBe(0)
    expect((await db.query(`select 1 from cms_state where key like $1`, [`email-revert:${acc.id}:%`])).rowCount).toBe(0)
  })
})

describe('a link of one kind opens nothing else', () => {
  it('email, reset, invitation and way-back links each work only where they belong', async () => {
    const admin = await signIn('admin')
    const acc = await newAccount('editor')
    // A way back (from a change made), a reset link and a pending email link, all of acc.
    const back = await changeOwn(acc, fresh('moved'))
    const now = (await db.query('select email from cms_users where id = $1', [acc.id])).rows[0].email as string
    await anonymous().post('/api/cms/_auth/forgot', { email: now })
    const reset = linkIn((await waitForMail(now, (m) => m.text.includes('/admin/reset/'))).text)
    const to = fresh()
    expect((await ask(await login(now, acc.password), to, acc.password)).status).toBe(200)
    const email = await linkTo(to)
    const invite = (await admin.post('/api/cms/_users', { email: fresh('invitee'), role: 'author' })).body.inviteUrl as string

    const tries = {
      reset: (l: string) => anonymous().post('/api/cms/_auth/reset', { token: tokenOf(l), password: 'somebody else’s password' }),
      accept: (l: string) => anonymous().post('/api/cms/_auth/accept', { token: tokenOf(l), name: 'Somebody', password: 'somebody else’s password' }),
      inviteGet: (l: string) => anonymous().get(`/api/cms/_auth/invite/${tokenOf(l)}`),
      confirm: (l: string) => confirm(anonymous(), l),
      emailGet: (l: string) => anonymous().get(`/api/cms/_auth/email/${tokenOf(l)}`),
      revert: (l: string) => revert(anonymous(), l, 'somebody else’s password'),
      revertGet: (l: string) => revertGet(tokenOf(l)),
    }
    const wrong: [string, string, (l: string) => Promise<{ status: number }>][] = [
      ['email', email, tries.reset], ['email', email, tries.accept], ['email', email, tries.inviteGet], ['email', email, tries.revert], ['email', email, tries.revertGet],
      ['reset', reset, tries.confirm], ['reset', reset, tries.emailGet], ['reset', reset, tries.revert], ['reset', reset, tries.accept],
      ['invite', invite, tries.confirm], ['invite', invite, tries.emailGet], ['invite', invite, tries.revert], ['invite', invite, tries.reset],
      ['email-revert', back, tries.reset], ['email-revert', back, tries.accept], ['email-revert', back, tries.confirm], ['email-revert', back, tries.emailGet],
    ]
    const names = new Map<unknown, string>(Object.entries(tries).map(([name, fn]) => [fn, name]))
    for (const [kind, link, attempt] of wrong) {
      expect((await attempt(link)).status, `a ${kind} link at ${names.get(attempt)}`).toBe(410)
    }
    // Each still works where it belongs.
    expect((await tries.emailGet(email)).status).toBe(200)
    expect((await tries.inviteGet(invite)).status).toBe(200)
    expect((await tries.revertGet(back)).status).toBe(200)
    expect((await tries.reset(reset)).status).toBe(200)
  })
})

describe('what stops a pending change', () => {
  it('disabling the account, or a new role, cancels it', async () => {
    const admin = await signIn('admin')
    for (const change of [{ status: 'disabled' }, { role: 'author' }]) {
      const acc = await newAccount('editor')
      const to = fresh()
      await ask(acc.client, to, acc.password)
      const link = await linkTo(to)
      expect((await admin.patch(`/api/cms/_users/${acc.id}`, change)).status).toBe(200)
      if (change.status) expect((await admin.patch(`/api/cms/_users/${acc.id}`, { status: 'active' })).status).toBe(200)
      expect((await anonymous().get(`/api/cms/_auth/email/${tokenOf(link)}`)).status).toBe(410)
      expect((await confirm(anonymous(), link)).status).toBe(410)
      expect((await db.query('select email from cms_users where id = $1', [acc.id])).rows[0].email).toBe(acc.email)
    }
  })

  it('a session that has ended cannot ask (401), and nothing is sent', async () => {
    const acc = await newAccount('editor')
    await db.query('update cms_users set session_version = session_version + 1 where id = $1', [acc.id])
    const to = fresh()
    expect((await ask(acc.client, to, acc.password)).status).toBe(401)
    expect((await readState(acc.id))).toBeNull()
    await new Promise((r) => setTimeout(r, 300))
    expect(sentMail(to)).toEqual([])
  })

  it('a change that can no longer happen is deleted when read; expired ones by the daily retention run', async () => {
    const acc = await newAccount('editor')
    await ask(acc.client, fresh(), acc.password)
    expect(await readState(acc.id)).not.toBeNull()
    expect((await acc.client.post('/api/cms/_auth/password', { current: acc.password, password: 'a different password' })).status).toBe(200)
    expect((await acc.client.get('/api/cms/_auth/email')).body).toEqual({ pending: null })
    expect(await readState(acc.id)).toBeNull()

    // Expired and never read again: the retention run (every few seconds in the test server) sweeps it, and a dead way back too.
    const other = await newAccount('editor')
    await ask(other.client, fresh(), other.password)
    await db.query(`update cms_state set value = jsonb_set(value, '{expiresAt}', to_jsonb('2001-01-01T00:00:00.000Z'::text)) where key = $1`, [`email-change:${other.id}`])
    const revertKey = `email-revert:${other.id}:00000000-0000-4000-8000-000000000000`
    await db.query(`insert into cms_state (key, value) values ($1, $2)`, [revertKey, { email: other.email, expiresAt: '2001-01-01T00:00:00.000Z' }])
    const live = `email-revert:${other.id}:00000000-0000-4000-8000-000000000001`
    await db.query(`insert into cms_state (key, value) values ($1, $2)`, [live, { email: other.email, expiresAt: '2999-01-01T00:00:00.000Z' }])
    const left = await eventually(async () => (await db.query(`select key from cms_state where key like $1 or key = $2`, [`email-revert:${other.id}:%`, `email-change:${other.id}`])).rows.map((r) => r.key), (k) => k.length === 1, 10_000)
    expect(left).toEqual([live])
    await db.query('delete from cms_state where key = $1', [live])
  })
})

async function readState(userId: string) {
  return (await db.query('select value from cms_state where key = $1', [`email-change:${userId}`])).rows[0]?.value ?? null
}

describe('limits on asking', () => {
  it('five requests an hour per account', async () => {
    const acc = await newAccount('editor')
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) statuses.push((await ask(acc.client, fresh(), acc.password)).status)
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
  })

  it('three an hour to one address, whoever asks (no flooding a stranger’s mailbox)', async () => {
    const target = fresh('target')
    const statuses: number[] = []
    for (let i = 0; i < 4; i++) {
      const acc = await newAccount('author')
      statuses.push((await ask(acc.client, target, acc.password)).status)
    }
    expect(statuses).toEqual([200, 200, 200, 429])
    await eventually(async () => sentMail(target), (m) => m.length === 3)
    await new Promise((r) => setTimeout(r, 300))
    expect(sentMail(target)).toHaveLength(3)
  })

  it('ten an hour from one client address', async () => {
    const accs = await Promise.all([0, 1, 2].map(() => newAccount('author')))
    for (const a of accs) a.client.ip = accs[0]!.client.ip
    const statuses: number[] = []
    for (const a of accs) for (let i = 0; i < 4; i++) statuses.push((await ask(a.client, fresh(), a.password)).status)
    expect(statuses.filter((s) => s === 200)).toHaveLength(10)
    expect(statuses.slice(10)).toEqual([429, 429])
  })
})

describe('cross-site requests', () => {
  it('are refused on every route that changes something', async () => {
    const acc = await newAccount('editor')
    const crossSite = { 'sec-fetch-site': 'cross-site' }
    const routes: [string, string, unknown][] = [
      ['POST', '/api/cms/_auth/email', { email: fresh(), password: acc.password }],
      ['DELETE', '/api/cms/_auth/email', undefined],
      ['POST', '/api/cms/_auth/email/confirm', { token: 'x' }],
      ['POST', '/api/cms/_auth/email/revert', { token: 'x', password: 'a long enough password' }],
      ['PATCH', `/api/cms/_users/${acc.id}`, { email: fresh(), password: adminPassword() }],
    ]
    const admin = await signIn('admin')
    for (const [method, path, json] of routes) {
      const c = path.startsWith('/api/cms/_users') ? admin : acc.client
      const res = await c.request(method, path, { json, headers: crossSite })
      expect(res.status, `${method} ${path}`).toBe(403)
    }
    expect(await readState(acc.id)).toBeNull()
    expect((await db.query('select email from cms_users where id = $1', [acc.id])).rows[0].email).toBe(acc.email)
  })
})

describe('undoing a change from the old mailbox', () => {
  it('someone with only the password changes the address and confirms at once; the old mailbox takes the account back', async () => {
    const victim = await newAccount('editor')
    const victimBrowser = await login(victim.email, victim.password)
    // The intruder knows the password, not the mailbox.
    const intruder = await login(victim.email, victim.password)
    const theirs = fresh('intruder')
    expect((await ask(intruder, theirs, victim.password)).status).toBe(200)
    const intruderBrowser = new Client()
    expect((await confirm(intruderBrowser, await linkTo(theirs))).status).toBe(200)
    const intruderSession = await login(theirs, victim.password)
    // A reset link they asked for at the new address, and a further change they started.
    await anonymous().post('/api/cms/_auth/forgot', { email: theirs })
    const theirReset = linkIn((await waitForMail(theirs, (m) => m.text.includes('/admin/reset/'))).text)
    const further = fresh('further')
    expect((await ask(intruderSession, further, victim.password)).status).toBe(200)
    const furtherLink = await linkTo(further)

    // The notice in the old mailbox carries the way back. Opening it changes nothing.
    const notice = await changedNotice(victim.email)
    expect(notice.text).toContain(masked(theirs))
    expect(notice.text).not.toContain(theirs)
    const back = linkIn(notice.text)
    expect(back.startsWith(`${new Client().baseURL}/admin/email/revert/`)).toBe(true)
    expect((await revertGet(tokenOf(back))).body).toEqual({ email: victim.email })
    expect((await db.query('select email from cms_users where id = $1', [victim.id])).rows[0].email).toBe(theirs)

    // A new password is required, and must be a valid one.
    expect((await revert(anonymous(), back, 'short')).status).toBe(422)

    const phone = new Client()
    const res = await revert(phone, back, 'the owner’s new password')
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: victim.id, email: victim.email })
    // This browser is signed in; every other session ended (the owner's own old ones too).
    expect((await phone.get('/api/cms/_auth/me')).body.user.email).toBe(victim.email)
    for (const c of [intruder, intruderSession, victimBrowser, victim.client]) expect((await c.get('/api/cms/_graph')).status).toBe(401)
    // The old password and the intruder's address are done with.
    expect((await anonymous().post('/api/cms/_auth/login', { email: victim.email, password: victim.password })).status).toBe(401)
    expect((await anonymous().post('/api/cms/_auth/login', { email: theirs, password: victim.password })).status).toBe(401)
    await login(victim.email, 'the owner’s new password')
    // Their links are dead: the reset at their address and the further change.
    expect((await anonymous().post('/api/cms/_auth/reset', { token: tokenOf(theirReset), password: 'the intruder again' })).status).toBe(410)
    expect((await confirm(anonymous(), furtherLink)).status).toBe(410)
    expect(await readState(victim.id)).toBeNull()
    // Once only.
    expect((await revert(anonymous(), back, 'another new password')).status).toBe(410)
    expect((await revertGet(tokenOf(back))).status).toBe(410)

    const rows = await auditRows(`user_id = $1 and action = 'account.email_revert'`, [victim.id])
    expect(rows.map((r) => r.meta)).toEqual([{ email: victim.email, previousEmail: theirs }])
  })

  it('after two changes, the oldest mailbox still gets the account back, and using it ends the later way back', async () => {
    const acc = await newAccount('editor')
    const b = fresh('b')
    const c = fresh('c')
    const backToA = await changeOwn(acc, b)
    const atB = { client: await login(b, acc.password), email: b, password: acc.password }
    const backToB = await changeOwn(atB, c)
    // The later way back (to b) is used first: the earlier one (to a) still works.
    expect((await revert(anonymous(), backToB, 'password for b')).status).toBe(200)
    expect((await revertGet(tokenOf(backToA))).status).toBe(200)
    expect((await revert(anonymous(), backToA, 'password for a')).status).toBe(200)
    await login(acc.email, 'password for a')

    // And the other way round: using the earliest ends the later one.
    const acc2 = await newAccount('editor')
    const b2 = fresh('b')
    const back2A = await changeOwn(acc2, b2)
    const back2B = await changeOwn({ client: await login(b2, acc2.password), email: b2, password: acc2.password }, fresh('c'))
    expect((await revert(anonymous(), back2A, 'password for a')).status).toBe(200)
    expect((await revertGet(tokenOf(back2B))).status).toBe(410)
    expect((await revert(anonymous(), back2B, 'password for b')).status).toBe(410)
    await login(acc2.email, 'password for a')
  })

  it('is refused when expired, and when the old address belongs to another account now', async () => {
    const admin = await signIn('admin')
    const acc = await newAccount('editor')
    const to = fresh()
    const back = await changeOwn(acc, to)
    // Someone else has the old address now: nothing changes.
    const invited = await admin.post('/api/cms/_users', { email: acc.email, role: 'author' })
    expect(invited.status).toBe(201)
    const taken = await revert(anonymous(), back, 'the owner’s new password')
    expect(taken.status).toBe(409)
    expect(taken.body.data).toEqual({ code: 'email_taken' })
    await login(to, acc.password)
    // Freed again, but expired.
    expect((await admin.delete(`/api/cms/_users/${invited.body.user.id}`)).status).toBe(200)
    await db.query(`update cms_tokens set expires_at = now() - interval '1 minute' where user_id = $1 and kind = 'email-revert' and used_at is null`, [acc.id])
    expect((await revertGet(tokenOf(back))).status).toBe(410)
    expect((await revert(anonymous(), back, 'the owner’s new password')).status).toBe(410)
    await login(to, acc.password)
    expect((await revert(anonymous(), 'made-up', 'the owner’s new password')).status).toBe(410)
  })

  it('goes with the account when it is removed', async () => {
    const acc = await newAccount('author')
    await changeOwn(acc, fresh())
    expect((await db.query(`select 1 from cms_state where key like $1`, [`email-revert:${acc.id}:%`])).rowCount).toBe(1)
    expect((await (await signIn('admin')).delete(`/api/cms/_users/${acc.id}`)).status).toBe(200)
    expect((await db.query(`select 1 from cms_state where key like $1`, [`email-revert:${acc.id}:%`])).rowCount).toBe(0)
  })
})

describe('an administrator needs their own password to change someone’s email', () => {
  it('without it, or with a wrong one, nothing changes; the failure is audited and counts like a failed sign-in', async () => {
    const acc = await newAccount('editor')
    const admin = await signIn('admin')
    const to = fresh()
    const missing = await admin.patch(`/api/cms/_users/${acc.id}`, { email: to })
    expect(missing.status).toBe(422)
    expect(missing.body.data).toEqual([{ path: ['password'], message: 'Required' }])
    const wrong = await adminSets(acc.id, to, 'not the admin password')
    expect(wrong.status).toBe(422)
    expect(wrong.body.data).toEqual([{ path: ['password'], message: 'Wrong password' }])
    expect((await db.query('select email from cms_users where id = $1', [acc.id])).rows[0].email).toBe(acc.email)
    await login(acc.email, acc.password) // still signs in, sessions untouched
    expect((await acc.client.get('/api/cms/_graph')).status).toBe(200)
    expect(sentMail(to)).toEqual([])
    const rows = await auditRows(`user_id = $1 and action = 'account.email_failed' and created_at > now() - interval '1 minute'`, [accounts().admin.id])
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(rows.every((r) => Object.keys(r.meta).join() === 'ip')).toBe(true)
    // Role and access changes don't ask for it.
    expect((await admin.patch(`/api/cms/_users/${acc.id}`, { role: 'author' })).status).toBe(200)
    // With the right one it works.
    expect((await adminSets(acc.id, to)).status).toBe(200)
  })

  it('a disabled account’s new address is not told to sign in, nor the old one', async () => {
    const admin = await signIn('admin')
    const acc = await newAccount('editor')
    expect((await admin.patch(`/api/cms/_users/${acc.id}`, { status: 'disabled' })).status).toBe(200)
    const before = sentMail(acc.email).length
    const to = fresh()
    const res = await adminSets(acc.id, to)
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ email: to, status: 'disabled' })
    await new Promise((r) => setTimeout(r, 400))
    expect(sentMail(to)).toEqual([])
    expect(sentMail(acc.email)).toHaveLength(before)
  })
})

describe('privacy of a change of address', () => {
  it('erasing the person who has an old address now takes only that address out of the other account’s change', async () => {
    const admin = (await newAccount('admin')).client // privacy actions are limited per administrator: not the shared seeded one
    const a = await newAccount('editor')
    const moved = fresh('moved')
    await changeOwn(a, moved)
    // Someone else gets a's old address.
    const c = await admin.post('/api/cms/_users', { email: a.email, role: 'author' })
    expect(c.status).toBe(201)

    // Exported for the old address (c's now): a's new address is not c's to see.
    const exported = (await admin.post('/api/cms/_privacy/export', { email: a.email })).body
    const change = exported.auditEntries.find((e: any) => e.action === 'account.email' && e.userId === a.id)
    expect(change.meta).toEqual({ email: '(another person’s address)', previousEmail: a.email })
    expect(JSON.stringify(exported)).not.toContain(moved)
    // Exported for a: both addresses are a's own.
    const own = (await admin.post('/api/cms/_privacy/export', { email: moved })).body
    expect(own.auditEntries.find((e: any) => e.action === 'account.email').meta).toEqual({ email: moved, previousEmail: a.email })

    expect((await admin.post('/api/cms/_privacy/delete', { email: a.email })).status).toBe(200)
    const rows = await auditRows(`user_id = $1 and action in ('account.email_request', 'account.email')`, [a.id])
    expect(rows.map((r) => r.meta)).toEqual([{ email: moved }, { email: moved }])
    // The way back to that address went with it.
    expect((await db.query(`select 1 from cms_state where key like $1`, [`email-revert:${a.id}:%`])).rowCount).toBe(0)
  })

  it('a request for another account’s address (inUse): each side keeps or loses only its own address, in export and erasure', async () => {
    const a = await newAccount('editor')
    const b = await newAccount('author')
    await ask(a.client, b.email, a.password)
    await eventually(() => auditRows(`user_id = $1 and action = 'account.email_request'`, [a.id]), (r) => r.length === 1)
    const admin = (await newAccount('admin')).client // privacy actions are limited per administrator: not the shared seeded one

    const forB = (await admin.post('/api/cms/_privacy/export', { email: b.email })).body
    expect(forB.auditEntries.find((e: any) => e.action === 'account.email_request').meta).toEqual({ email: b.email, previousEmail: '(another person’s address)', inUse: true })
    const forA = (await admin.post('/api/cms/_privacy/export', { email: a.email })).body
    expect(forA.auditEntries.find((e: any) => e.action === 'account.email_request').meta).toEqual({ email: '(another person’s address)', previousEmail: a.email, inUse: true })

    // Erasing b takes b's address out of a's request, and leaves a's.
    expect((await admin.post('/api/cms/_privacy/delete', { email: b.email })).status).toBe(200)
    expect((await auditRows(`user_id = $1 and action = 'account.email_request'`, [a.id])).map((r) => r.meta)).toEqual([{ previousEmail: a.email, inUse: true }])
  })

  it('erasing the person who asked for another account’s address leaves that address', async () => {
    const a = await newAccount('editor')
    const b = await newAccount('author')
    await ask(a.client, b.email, a.password)
    await eventually(() => auditRows(`user_id = $1 and action = 'account.email_request'`, [a.id]), (r) => r.length === 1)
    expect((await (await newAccount('admin')).client.post('/api/cms/_privacy/delete', { email: a.email })).status).toBe(200)
    expect((await auditRows(`user_id = $1 and action = 'account.email_request'`, [a.id])).map((r) => r.meta)).toEqual([{ email: b.email, inUse: true }])
  })

  it('a change waiting for an address is found, exported and erased by that address', async () => {
    const acc = await newAccount('editor')
    const to = fresh('waiting')
    await ask(acc.client, to, acc.password)
    const link = await linkTo(to)
    const admin = (await newAccount('admin')).client // privacy actions are limited per administrator: not the shared seeded one
    const found = await admin.post('/api/cms/_privacy/lookup', { email: to })
    expect(found.body.emailChanges).toBe(1)
    const exported = (await admin.post('/api/cms/_privacy/export', { email: to })).body
    expect(exported.emailChanges).toEqual([{ kind: 'waiting for confirmation', accountId: acc.id, expiresAt: expect.any(String) }])
    expect((await admin.post('/api/cms/_privacy/delete', { email: to })).status).toBe(200)
    expect(await readState(acc.id)).toBeNull()
    expect((await confirm(anonymous(), link)).status).toBe(410)
    expect((await admin.post('/api/cms/_privacy/lookup', { email: to })).body.emailChanges).toBe(0)
  })
})

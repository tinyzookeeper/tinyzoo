import { describe, expect, it } from 'vitest'
import { accounts, anonymous, Client, linkIn, login, newAccount, sentMail, signIn, tokenOf } from '../helpers/api'

describe('first run', () => {
  it('reports that setup is done once an account exists, and refuses a second setup', async () => {
    expect((await anonymous().get('/api/cms/_auth/status')).body).toEqual({ mode: 'builtin', needsSetup: false })
    const res = await anonymous().post('/api/cms/_auth/setup', { name: 'Mallory', email: 'mallory@test.local', password: 'a long enough password' })
    expect(res.status).toBe(409)
  })
})

describe('sign in', () => {
  it('signs in with email and password (case-insensitive email) and serves the admin API', async () => {
    const acc = await newAccount('editor')
    const c = new Client()
    const res = await c.post('/api/cms/_auth/login', { email: acc.email.toUpperCase(), password: acc.password })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: acc.id, email: acc.email, role: 'editor' })
    expect(res.body.user).not.toHaveProperty('passwordHash')
    expect((await c.get('/api/cms/_graph')).status).toBe(200)
  })

  it('answers every failure the same way: unknown email, wrong password', async () => {
    const acc = await newAccount('editor')
    const wrong = await anonymous().post('/api/cms/_auth/login', { email: acc.email, password: 'not the password' })
    const unknown = await anonymous().post('/api/cms/_auth/login', { email: 'nobody@test.local', password: 'whatever it is' })
    expect([wrong.status, unknown.status]).toEqual([401, 401])
    expect(wrong.body.statusMessage).toBe(unknown.body.statusMessage)
  })

  it('does not let an invited person sign in before accepting', async () => {
    const admin = await signIn('admin')
    const email = `pending-${Date.now()}@test.local`
    await admin.post('/api/cms/_users', { email, role: 'editor' })
    expect((await anonymous().post('/api/cms/_auth/login', { email, password: '' })).status).toBe(401)
  })

  it('locks an address out after repeated failures (429)', async () => {
    const email = `brute-${Date.now()}@test.local`
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) statuses.push((await anonymous().post('/api/cms/_auth/login', { email, password: `guess-${i}` })).status)
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true)
    expect(statuses[10]).toBe(429)
  })

  it('signs out', async () => {
    const { client } = await newAccount('editor')
    expect((await client.post('/api/cms/_auth/logout')).status).toBe(200)
    expect((await client.get('/api/cms/_graph')).status).toBe(401)
  })

  it('refuses the admin API without a session', async () => {
    expect((await anonymous().get('/api/cms/_graph')).status).toBe(401)
    expect((await anonymous().get('/api/cms/_auth/me')).status).toBe(401)
  })
})

describe('sessions follow the account, not the cookie', () => {
  it('stops working the moment an administrator disables the account', async () => {
    const acc = await newAccount('editor')
    const admin = await signIn('admin')
    expect((await admin.patch(`/api/cms/_users/${acc.id}`, { status: 'disabled' })).status).toBe(200)
    expect((await acc.client.get('/api/cms/_graph')).status).toBe(401)
    expect((await anonymous().post('/api/cms/_auth/login', { email: acc.email, password: acc.password })).status).toBe(401)
  })

  it('uses the role from the database, not the one in the cookie', async () => {
    const acc = await newAccount('admin')
    const admin = await signIn('admin')
    expect((await acc.client.get('/api/cms/_users')).status).toBe(200)
    await admin.patch(`/api/cms/_users/${acc.id}`, { role: 'editor' })
    // The role change also ends sessions; signing in again gets the new role.
    const again = await login(acc.email, acc.password)
    expect((await again.get('/api/cms/_users')).status).toBe(403)
  })

  it('changing the password signs out other browsers but keeps this one', async () => {
    const acc = await newAccount('editor')
    const other = await login(acc.email, acc.password)
    const res = await acc.client.post('/api/cms/_auth/password', { current: acc.password, password: 'a brand new password' })
    expect(res.status).toBe(200)
    expect((await acc.client.get('/api/cms/_graph')).status).toBe(200)
    expect((await other.get('/api/cms/_graph')).status).toBe(401)
    await login(acc.email, 'a brand new password')
  })

  it('requires the current password to change it', async () => {
    const acc = await newAccount('editor')
    const res = await acc.client.post('/api/cms/_auth/password', { current: 'wrong', password: 'a brand new password' })
    expect(res.status).toBe(422)
    expect(res.body.data).toEqual([{ path: ['current'], message: 'Wrong password' }])
  })
})

describe('password reset', () => {
  it('emails a link from the configured public URL; it sets a new password once', async () => {
    const acc = await newAccount('editor')
    expect((await anonymous().post('/api/cms/_auth/forgot', { email: acc.email })).status).toBe(200)

    const [mail] = sentMail(acc.email)
    expect(mail?.subject).toBeTruthy() // in the admin's default language (Czech in the playground)
    const link = linkIn(mail!.text)
    expect(link.startsWith(`${new Client().baseURL}/admin/reset/`)).toBe(true)

    const c = new Client()
    const res = await c.post('/api/cms/_auth/reset', { token: tokenOf(link), password: 'reset to something new' })
    expect(res.status).toBe(200)
    expect((await c.get('/api/cms/_graph')).status).toBe(200) // signed in
    expect((await acc.client.get('/api/cms/_graph')).status).toBe(401) // old sessions ended
    expect((await anonymous().post('/api/cms/_auth/reset', { token: tokenOf(link), password: 'and once more again' })).status).toBe(410)
    await login(acc.email, 'reset to something new')
  })

  it('answers the same for an unknown address and sends nothing', async () => {
    const before = sentMail().length
    const res = await anonymous().post('/api/cms/_auth/forgot', { email: 'ghost@test.local' })
    expect(res.status).toBe(200)
    expect(sentMail().length).toBe(before)
  })

  it('rejects a made-up token and a weak password', async () => {
    expect((await anonymous().post('/api/cms/_auth/reset', { token: 'made-up', password: 'a long enough password' })).status).toBe(410)
    expect((await anonymous().post('/api/cms/_auth/reset', { token: 'made-up', password: 'short' })).status).toBe(422)
  })
})

describe('invitations', () => {
  it('shows who is invited and by whom, accepts once, and signs in', async () => {
    const admin = await signIn('admin')
    const email = `invitee-${Date.now()}@test.local`
    const invited = await admin.post('/api/cms/_users', { email, name: 'Iva', role: 'author' })
    expect(invited.status).toBe(201)
    expect(invited.body.emailed).toBe(true)
    const token = tokenOf(invited.body.inviteUrl)
    expect(linkIn(sentMail(email)[0]!.text)).toBe(invited.body.inviteUrl)

    const info = await anonymous().get(`/api/cms/_auth/invite/${token}`)
    expect(info.body).toEqual({ email, name: 'Iva', role: 'author', inviter: 'Ada Admin' })

    const c = new Client()
    expect((await c.post('/api/cms/_auth/accept', { token, name: 'Iva Nováková', password: 'a long enough password' })).status).toBe(200)
    expect((await c.get('/api/cms/_auth/me')).body.user).toMatchObject({ email, name: 'Iva Nováková', role: 'author' })
    expect((await anonymous().get(`/api/cms/_auth/invite/${token}`)).status).toBe(410)
    expect((await anonymous().post('/api/cms/_auth/accept', { token, name: 'x', password: 'a long enough password' })).status).toBe(410)
  })

  it('a resent invitation replaces the old link', async () => {
    const admin = await signIn('admin')
    const invited = await admin.post('/api/cms/_users', { email: `resend-${Date.now()}@test.local`, role: 'editor' })
    const resent = await admin.post(`/api/cms/_users/${invited.body.user.id}/resend`)
    expect(resent.status).toBe(200)
    expect((await anonymous().get(`/api/cms/_auth/invite/${tokenOf(invited.body.inviteUrl)}`)).status).toBe(410)
    expect((await anonymous().get(`/api/cms/_auth/invite/${tokenOf(resent.body.inviteUrl)}`)).status).toBe(200)
  })
})

describe('your account', () => {
  it('changes your name and interface language', async () => {
    const acc = await newAccount('editor')
    const res = await acc.client.patch('/api/cms/_auth/me', { name: 'Renamed', locale: 'cs' })
    expect(res.body.user).toMatchObject({ name: 'Renamed', locale: 'cs' })
    expect((await acc.client.get('/api/cms/_auth/me')).body.user).toMatchObject({ name: 'Renamed', locale: 'cs' })
  })

  it('exposes the seeded accounts as expected', () => {
    expect(Object.keys(accounts())).toEqual(['admin', 'editor', 'author'])
  })
})

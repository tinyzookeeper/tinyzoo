import { describe, expect, it } from 'vitest'
import { accounts, anonymous, newAccount, signIn } from '../helpers/api'

describe('team management', () => {
  it('is for administrators only', async () => {
    expect((await (await signIn('editor')).get('/api/cms/_users')).status).toBe(403)
    expect((await (await signIn('author')).post('/api/cms/_users', { email: 'x@test.local', role: 'admin' })).status).toBe(403)
    expect((await anonymous().get('/api/cms/_users')).status).toBe(401)
  })

  it('lists people with role, status and pending invitations — never password hashes', async () => {
    const admin = await signIn('admin')
    const email = `listed-${Date.now()}@test.local`
    await admin.post('/api/cms/_users', { email, role: 'author' })
    const { users } = (await admin.get('/api/cms/_users')).body
    const pending = users.find((u: any) => u.email === email)
    expect(pending).toMatchObject({ role: 'author', status: 'invited', invite: { expiresAt: expect.any(String) } })
    expect(users.find((u: any) => u.id === accounts().admin.id)).toMatchObject({ role: 'admin', status: 'active', invite: null })
    expect(JSON.stringify(users)).not.toMatch(/password/i)
  })

  it('refuses to invite an address that already has access, and validates the role', async () => {
    const admin = await signIn('admin')
    const dup = await admin.post('/api/cms/_users', { email: accounts().editor.email.toUpperCase(), role: 'editor' })
    expect(dup.status).toBe(409)
    expect(dup.body.data).toEqual([{ path: ['email'], code: 'unique', message: 'Already has access' }])
    expect((await admin.post('/api/cms/_users', { email: 'role@test.local', role: 'owner' })).status).toBe(422)
  })

  it('changes a role', async () => {
    const acc = await newAccount('author')
    const admin = await signIn('admin')
    const res = await admin.patch(`/api/cms/_users/${acc.id}`, { role: 'editor' })
    expect(res.body.user.role).toBe('editor')
  })

  it('never lets you change your own role, disable or remove yourself', async () => {
    const admin = await signIn('admin')
    const me = accounts().admin.id
    expect((await admin.patch(`/api/cms/_users/${me}`, { role: 'editor' })).status).toBe(409)
    expect((await admin.patch(`/api/cms/_users/${me}`, { status: 'disabled' })).status).toBe(409)
    expect((await admin.delete(`/api/cms/_users/${me}`)).status).toBe(409)
  })

  // The "last active administrator" guard cannot be reached through the API alone
  // (whoever acts is an active admin and cannot target themselves); it protects
  // against concurrent changes. Demoting another admin works and ends their sessions.
  it('demotes another administrator and ends their sessions', async () => {
    const a = await newAccount('admin')
    const b = await newAccount('admin')
    expect((await a.client.patch(`/api/cms/_users/${b.id}`, { role: 'editor' })).status).toBe(200)
    expect((await b.client.get('/api/cms/_graph')).status).toBe(401)
  })

  it('removes a person; their invitation link dies with them', async () => {
    const admin = await signIn('admin')
    const invited = await admin.post('/api/cms/_users', { email: `gone-${Date.now()}@test.local`, role: 'editor' })
    expect((await admin.delete(`/api/cms/_users/${invited.body.user.id}`)).status).toBe(200)
    expect((await anonymous().get(`/api/cms/_auth/invite/${String(invited.body.inviteUrl).split('/').pop()}`)).status).toBe(410)
  })
})

import { describe, expect, it } from 'vitest'
import { anonymous, signIn } from '../helpers/api'

describe('admin API authentication', () => {
  it('refuses anonymous access to the admin API', async () => {
    const res = await anonymous().get('/api/cms/_graph')
    expect(res.status).toBe(401)
  })

  it('rejects a wrong password', async () => {
    const res = await anonymous().post('/api/_cms/login', { email: 'admin@demo.test', password: 'nope' })
    expect(res.status).toBe(401)
  })

  it('serves the schema graph to a signed-in user, with per-entity permissions', async () => {
    const admin = await signIn('admin')
    const res = await admin.get('/api/cms/_graph')
    expect(res.status).toBe(200)
    const names = res.body.map((g: any) => g.name).sort()
    expect(names).toEqual(['author', 'post', 'siteSettings', 'tag'])
    expect(res.body.find((g: any) => g.name === 'post').can).toEqual({ create: true, update: true, delete: true })
  })

  it('signs out', async () => {
    const admin = await signIn('admin')
    await admin.post('/api/_cms/logout')
    expect((await admin.get('/api/cms/_graph')).status).toBe(401)
  })
})

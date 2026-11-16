import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anonymous, type Client, login, sentMail, signIn, testDb } from '../helpers/api'

// The public demo admin (cms.demo / NUXT_PUBLIC_CMS_DEMO_*; set for the test server).
const DEMO = { email: 'demo@test.local', password: 'try it out please' }
const db = testDb()
let admin: Client
beforeAll(async () => { admin = await signIn('admin') })
afterAll(async () => { await db.query('delete from cms_users where email = $1', [DEMO.email]); await db.end() })
const account = async () => (await db.query('select role, status, name from cms_users where email = $1', [DEMO.email])).rows[0]

describe('the demo account', () => {
  it('is created as an editor the first time someone signs in with the published details', async () => {
    await db.query('delete from cms_users where email = $1', [DEMO.email])
    expect((await anonymous().post('/api/cms/_auth/login', { email: DEMO.email, password: 'a guess' })).status).toBe(401)
    expect(await account()).toBeUndefined() // a wrong password creates nothing
    const demo = await login(DEMO.email, DEMO.password)
    expect(await account()).toMatchObject({ role: 'editor', status: 'active' })
    expect((await demo.get('/api/cms/_auth/me')).body.user.email).toBe(DEMO.email)
  })

  it('keeps its name and password, may change its language, and gets no reset emails', async () => {
    const demo = await login(DEMO.email, DEMO.password)
    expect((await demo.post('/api/cms/_auth/password', { current: DEMO.password, password: 'something else entirely' })).status).toBe(403)
    expect((await demo.patch('/api/cms/_auth/me', { name: 'Hacker' })).status).toBe(403)
    expect((await demo.patch('/api/cms/_auth/me', { locale: 'en' })).status).toBe(200)
    const before = sentMail(DEMO.email).length
    expect((await anonymous().post('/api/cms/_auth/forgot', { email: DEMO.email })).status).toBeLessThan(300)
    await new Promise((r) => setTimeout(r, 500))
    expect(sentMail(DEMO.email).length).toBe(before)
  })

  it('works again after an administrator changed or disabled it', async () => {
    await login(DEMO.email, DEMO.password)
    const { rows } = await db.query('select id from cms_users where email = $1', [DEMO.email])
    expect((await admin.patch(`/api/cms/_users/${rows[0].id}`, { role: 'admin' })).status).toBe(200)
    await db.query(`update cms_users set status = 'disabled', password_hash = null where email = $1`, [DEMO.email])
    await login(DEMO.email, DEMO.password)
    expect(await account()).toMatchObject({ role: 'editor', status: 'active' })
  })
})

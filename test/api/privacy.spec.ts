import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, login, newAccount, signIn, testDb, truncateAll } from '../helpers/api'

// GDPR: retention (form submissions, the audit log) and one person's data (export, delete).
const db = testDb()
let admin: Client
let editor: Client
beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

/** The form's table (its name depends on the table naming convention in force). */
async function formTable(): Promise<string> {
  const { rows } = await db.query(`select table_name from information_schema.columns where table_schema = 'public' and column_name = 'consent'`)
  const name = rows.map((r) => r.table_name as string).find((t) => t.replaceAll('_', '').toLowerCase() === 'contactform')
  if (!name) throw new Error('contact form table not found')
  return `"${name}"`
}

let n = 0
async function submit(email: string, message = 'Kdy je další závod?') {
  const res = await anonymous().post('/api/content/_form/contactForm', { name: `Visitor ${++n}`, email, message, _t: 5000 })
  expect(res.status).toBe(201)
  const { rows } = await db.query(`select id from ${await formTable()} order by created_at desc limit 1`)
  return rows[0].id as string
}

describe('one person’s data', () => {
  it('finds form submissions by email, whatever the case', async () => {
    const id = await submit('Jana@Example.com')
    await submit('someone-else@example.com')
    const res = await admin.post('/api/cms/_privacy/lookup', { email: '  JANA@example.COM ' })
    expect(res.status).toBe(200)
    expect(res.body.email).toBe('jana@example.com')
    expect(res.body.submissions).toHaveLength(1)
    expect(res.body.submissions[0]).toMatchObject({ form: 'contactForm', id, data: { email: 'Jana@Example.com', message: 'Kdy je další závod?' } })
    expect(res.body.account).toBeNull()
    // an address that merely contains it is another address
    expect((await admin.post('/api/cms/_privacy/lookup', { email: 'ana@example.com' })).body.submissions).toEqual([])
  })

  it('is for administrators only, and validates the address', async () => {
    expect((await editor.post('/api/cms/_privacy/lookup', { email: 'a@b.cz' })).status).toBe(403)
    expect((await editor.post('/api/cms/_privacy/export', { email: 'a@b.cz' })).status).toBe(403)
    expect((await editor.post('/api/cms/_privacy/delete', { email: 'a@b.cz' })).status).toBe(403)
    expect((await anonymous().post('/api/cms/_privacy/lookup', { email: 'a@b.cz' })).status).toBe(401)
    expect((await admin.post('/api/cms/_privacy/lookup', { email: 'not an address' })).status).toBe(422)
    expect((await admin.request('GET', '/api/cms/_privacy/lookup')).status).toBeGreaterThanOrEqual(400)
  })

  it('exports everything as a JSON download, without secrets, and audits the export without the address', async () => {
    const person = await newAccount('editor')
    await submit(person.email, 'From someone with an account')
    const res = await admin.post('/api/cms/_privacy/export', { email: person.email })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('attachment')
    const doc = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    expect(doc.email).toBe(person.email)
    expect(doc.formSubmissions).toHaveLength(1)
    expect(doc.account).toMatchObject({ id: person.id, email: person.email, role: 'editor', status: 'active' })
    expect(JSON.stringify(doc)).not.toMatch(/passwordHash|password_hash|sessionVersion/)
    expect(doc.auditEntries.some((a: any) => a.action === 'auth.invite_accept' && a.userId === person.id)).toBe(true)

    const { rows } = await db.query(`select meta from cms_audit where action = 'privacy.export'`)
    expect(rows).toHaveLength(1)
    expect(JSON.stringify(rows[0].meta)).not.toContain(person.email)
    expect(rows[0].meta).toMatchObject({ submissions: 1, account: true })
  })

  it('deletes submissions with their saved versions and search rows, and nothing of anyone else', async () => {
    const mine = await submit('gone@example.com')
    const other = await submit('stays@example.com')
    // Opening it and marking it read leaves a saved version and a search row.
    expect((await admin.patch(`/api/cms/contactForm/${mine}`, { status: 'read' })).status).toBe(200)
    const count = async (table: string, id: string) => (await db.query(`select count(*)::int as n from ${table} where record_id = $1`, [id])).rows[0].n
    expect(await count('cms_revisions', mine)).toBeGreaterThan(0)
    expect(await count('cms_search', mine)).toBeGreaterThan(0)

    const res = await admin.post('/api/cms/_privacy/delete', { email: 'GONE@example.com' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, submissions: 1, account: false })
    const table = await formTable()
    expect((await db.query(`select id from ${table}`)).rows.map((r) => r.id)).toEqual([other])
    expect(await count('cms_revisions', mine)).toBe(0)
    expect(await count('cms_search', mine)).toBe(0)
    expect(await count('cms_revisions', other)).toBeGreaterThanOrEqual(0)
    expect((await admin.post('/api/cms/_privacy/lookup', { email: 'gone@example.com' })).body.submissions).toEqual([])

    // Audited with counts, never the address.
    const { rows } = await db.query(`select meta, user_id from cms_audit where action = 'privacy.delete'`)
    expect(rows).toHaveLength(1)
    expect(rows[0].meta).toEqual({ submissions: 1, account: false, auditEntries: 0 })
    expect(JSON.stringify(rows)).not.toContain('gone@example.com')
  })

  it('anonymises an account: it cannot sign in any more, the log keeps who-did-what without the personal fields', async () => {
    const person = await newAccount('editor')
    // A failed sign-in with the address leaves an audit entry naming it.
    const stranger = anonymous()
    expect((await stranger.post('/api/cms/_auth/login', { email: person.email, password: 'wrong password!!' })).status).toBe(401)
    expect((await db.query(`select 1 from cms_audit where meta->>'email' = $1`, [person.email])).rowCount).toBeGreaterThan(0)
    expect((await person.client.get('/api/cms/_auth/me')).status).toBe(200)

    const res = await admin.post('/api/cms/_privacy/delete', { email: person.email })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ account: true })
    expect(res.body.auditEntries).toBeGreaterThan(0)

    const { rows: [u] } = await db.query('select * from cms_users where id = $1', [person.id])
    expect(u).toMatchObject({ email: `deleted-${person.id}@anonymised.invalid`, name: '', status: 'disabled', password_hash: null, locale: null, last_login_at: null })
    expect((await db.query(`select 1 from cms_tokens where user_id = $1`, [person.id])).rowCount).toBe(0)
    // The log keeps the link, loses the personal fields.
    const { rows: mine } = await db.query(`select action, meta from cms_audit where user_id = $1`, [person.id])
    expect(mine.length).toBeGreaterThan(0)
    expect(JSON.stringify(mine)).not.toContain(person.email)
    expect((await db.query(`select action, user_id, record_id, meta from cms_audit where meta::text ilike $1`, [`%${person.email}%`])).rows).toEqual([])
    // Signed out everywhere, and the old password opens nothing (this attempt is logged afresh, as any would be).
    expect((await person.client.get('/api/cms/_auth/me')).status).toBe(401)
    await expect(login(person.email, person.password)).rejects.toThrow()
    // And the address now finds nothing.
    expect((await admin.post('/api/cms/_privacy/lookup', { email: person.email })).body).toMatchObject({ submissions: [], account: null })
  })

  it('refuses to erase your own account', async () => {
    const me = await newAccount('admin')
    const res = await me.client.post('/api/cms/_privacy/delete', { email: me.email })
    expect(res.status).toBe(409)
    expect((await db.query('select status from cms_users where id = $1', [me.id])).rows[0].status).toBe('active')
  })

  it('erases another administrator while an active one remains', async () => {
    // The last-administrator guard (as in Team) cannot be tripped through the API: the person
    // asking is an active administrator, and never the one erased. Check the happy side of it.
    const other = await newAccount('admin')
    expect((await admin.post('/api/cms/_privacy/delete', { email: other.email })).status).toBe(200)
    expect((await db.query(`select count(*)::int as n from cms_users where role = 'admin' and status = 'active'`)).rows[0].n).toBeGreaterThanOrEqual(1)
  })

  it('limits how often deletion can be asked for', async () => {
    const throwaway = await newAccount('admin')
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) statuses.push((await throwaway.client.post('/api/cms/_privacy/delete', { email: `nobody${i}@example.com` })).status)
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true)
    expect(statuses[10]).toBe(429)
  })
})

describe('retention', () => {
  it('shows a form’s retention in the admin graph', async () => {
    const graph = (await admin.get('/api/cms/_graph')).body as any[]
    expect(graph.find((g) => g.name === 'contactForm')).toMatchObject({ preset: 'form', retentionDays: 180 })
    expect(graph.find((g) => g.name === 'post').retentionDays).toBeNull()
  })

  it('deletes submissions past their form’s retention and old audit entries, and audits the counts', async () => {
    const old = await submit('old@example.com')
    const fresh = await submit('fresh@example.com')
    const table = await formTable()
    await db.query(`update ${table} set created_at = now() - interval '200 days' where id = $1`, [old])
    await db.query(`update ${table} set created_at = now() - interval '100 days' where id = $1`, [fresh])
    await admin.patch(`/api/cms/contactForm/${old}`, { status: 'read' }) // history + search row to go with it
    await db.query(`insert into cms_audit (action, created_at) values ('test.ancient', now() - interval '400 days'), ('test.recent', now() - interval '300 days')`)

    // The test server runs the task every few seconds.
    // (It may take two runs if one lands between the lines above: add the counts up.)
    const until = Date.now() + 20_000
    const total = { forms: 0, audit: 0 }
    while (Date.now() < until && !(total.forms >= 1 && total.audit >= 1)) {
      const { rows } = await db.query(`select meta from cms_audit where action = 'retention.purge'`)
      total.forms = rows.reduce((a, r) => a + Number(r.meta.forms?.contactForm ?? 0), 0)
      total.audit = rows.reduce((a, r) => a + Number(r.meta.audit ?? 0), 0)
      if (!(total.forms >= 1 && total.audit >= 1)) await new Promise((r) => setTimeout(r, 300))
    }
    expect(total).toEqual({ forms: 1, audit: 1 })
    expect((await db.query(`select id from ${table}`)).rows.map((r) => r.id)).toEqual([fresh])
    expect((await db.query(`select count(*)::int as n from cms_revisions where record_id = $1`, [old])).rows[0].n).toBe(0)
    expect((await db.query(`select count(*)::int as n from cms_search where record_id = $1`, [old])).rows[0].n).toBe(0)
    expect((await db.query(`select action from cms_audit where action like 'test.%'`)).rows.map((r) => r.action)).toEqual(['test.recent'])
  }, 30_000)
})

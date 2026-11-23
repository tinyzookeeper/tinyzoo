import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { Client, tokenOf } from '../helpers/api'
import { ACCOUNT_CALLBACK_PATH, Browser, startAccountIssuer, type AccountIssuer, type IssuerPerson } from '../helpers/accountIssuer'
import { scratchDatabase, startServer, type SpawnedServer } from '../helpers/server'

// Sign-in with the tinyzoo account, the site's side (docs/multi-tenant-plan.md 2.15;
// packages/cms/server/utils/cmsAccount.ts and server/api/cms/_auth/account/*).
//
// A server of its own with the three settings (the shared test server has none: the last
// block shows that nothing exists there), against a stand-in issuer that lives in this
// process (test/helpers/accountIssuer.ts). A `Browser` follows the redirects between the
// two with a cookie jar per origin, as a person's browser does.
const SETUP = 'account-setup-code'
const PASSWORD = 'a long enough password'
const CLIENT_ID = 'site-under-test'
const CLIENT_SECRET = 'client-secret-that-must-never-reach-a-browser-7c1f'
const OTHER_SECRET = 'secret-of-the-sister-website-0123456789'

let db: Awaited<ReturnType<typeof scratchDatabase>>
let server: SpawnedServer
let issuer: AccountIssuer
let pool: pg.Pool
let mailDir: string
let site: string
let admin: Client
let seq = 0

const freePort = () => new Promise<number>((resolve, reject) => {
  const srv = createServer()
  srv.unref()
  srv.on('error', reject)
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address() as { port: number }; srv.close(() => resolve(port)) })
})

beforeAll(async () => {
  issuer = await startAccountIssuer()
  db = await scratchDatabase('account')
  mailDir = mkdtempSync(join(tmpdir(), 'cms-account-mail-'))
  const port = await freePort()
  site = `http://127.0.0.1:${port}`
  issuer.addClient({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, owner: 'owner-1', name: 'Site under test', url: site })
  // A sister website of the same owner, and a stranger's: the switcher shows the first only.
  issuer.addClient({ clientId: 'sister', clientSecret: OTHER_SECRET, owner: 'owner-1', name: 'Sister website', url: 'https://sister.example' })
  issuer.addClient({ clientId: 'stranger', owner: 'owner-2', name: 'Somebody else’s website', url: 'https://stranger.example' })
  server = await startServer(db.url, {
    PORT: String(port),
    NUXT_CMS_AUTH_SETUP_TOKEN: SETUP,
    NUXT_CMS_AUTH_ACCOUNT_ISSUER: issuer.url,
    NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID: CLIENT_ID,
    NUXT_CMS_AUTH_ACCOUNT_CLIENT_SECRET: CLIENT_SECRET,
    NUXT_CMS_MAIL_TRANSPORT: 'file', NUXT_CMS_MAIL_FILE_DIR: mailDir,
    // The issuer gets a second to answer here (five in production): the "slow issuer" test waits it out.
    CMS_TEST_ACCOUNT_TIMEOUT_MS: '1000',
  })
  pool = new pg.Pool({ connectionString: db.url, max: 2 })
  admin = new Client(site)
  const made = await admin.post('/api/cms/_auth/setup', { name: 'Ada Admin', email: 'ada@test.local', password: PASSWORD, token: SETUP })
  expect(made.status).toBe(201)
}, 120_000)

afterAll(async () => {
  await pool?.end()
  await server?.stop()
  await issuer?.stop()
  await db?.drop()
  if (mailDir) rmSync(mailDir, { recursive: true, force: true })
})

// ── helpers ──

const START = '/api/cms/_auth/account/start'

/** A person at the issuer. */
function person(over: Partial<IssuerPerson> = {}): IssuerPerson {
  const n = ++seq
  return issuer.addPerson({ sub: `sub-${n}`, email: `person-${n}@test.local`, name: `Person ${n}`, ...over })
}

/** Invite an e-mail address on the site; `accept` makes the user active with a password. */
async function invite(email: string, role = 'editor', accept = false): Promise<{ id: string; inviteUrl: string }> {
  const res = await admin.post('/api/cms/_users', { email, role })
  if (res.status !== 201) throw new Error(`invite ${email}: ${res.status} ${JSON.stringify(res.body)}`)
  if (accept) {
    const accepted = await new Client(site).post('/api/cms/_auth/accept', { token: tokenOf(res.body.inviteUrl), name: 'Their own name', password: PASSWORD })
    if (accepted.status !== 200) throw new Error(`accept ${email}: ${accepted.status} ${JSON.stringify(accepted.body)}`)
  }
  return { id: res.body.user.id, inviteUrl: res.body.inviteUrl }
}

/** A browser whose person is signed in at the issuer. */
function browserOf(p?: IssuerPerson): Browser {
  const b = new Browser()
  if (p) b.setCookie(issuer.url, issuer.sessionCookie(p.sub))
  return b
}

const me = async (b: Browser) => b.fetch(site + '/api/cms/_auth/me')
const links = async () => (await pool.query<{ key: string; value: any }>(`select key, value from cms_state where key like 'account:%' or key like 'account-of:%' order by key`)).rows
const linkOf = async (userId: string) => (await pool.query(`select value from cms_state where key = $1`, [`account-of:${userId}`])).rows[0]?.value as { issuer: string; sub: string } | undefined
const userRow = async (id: string) => (await pool.query(`select * from cms_users where id = $1`, [id])).rows[0]
/** The details of the audit entries of one action about a user (null: about nobody), newest first. */
const auditOf = async (userId: string | null, action: string) => (userId
  ? await pool.query(`select meta from cms_audit where action = $1 and user_id = $2 order by created_at desc, id desc`, [action, userId])
  : await pool.query(`select meta from cms_audit where action = $1 and user_id is null order by created_at desc, id desc`, [action])
).rows.map((r) => r.meta)

/** An active user of the site with a linked account, signed in through the account. */
async function linkedUser(role = 'editor') {
  const p = person()
  const { id } = await invite(p.email, role, true)
  const b = browserOf(p)
  const end = await b.visit(`${site}${START}`)
  expect(end.url).toBe(`${site}/admin`)
  return { p, id, b }
}

describe('sign-in with the account: the round trip', () => {
  it('the sign-in page learns that the account is on, and nothing else about it', async () => {
    const status = await new Client(site).get('/api/cms/_auth/status')
    expect(status.status).toBe(200)
    expect(status.body.account).toEqual({ enabled: true })
    expect(JSON.stringify(status.body)).not.toContain(CLIENT_ID)
  })

  it('an active user whose e-mail the account has verified signs in, is linked, and lands on `next`', async () => {
    const p = person({ email: 'Mixed.Case@Test.Local ' }) // compared the way password sign-in compares
    const { id } = await invite('mixed.case@test.local', 'editor', true)
    const b = browserOf(p)
    const mark = issuer.calls.length

    const end = await b.visit(`${site}${START}?next=${encodeURIComponent('/admin/account?tab=1')}`)
    expect(end.url).toBe(`${site}/admin/account?tab=1`)
    expect(end.status).toBe(200)
    // The way there: the site, the issuer, the site's callback, the page.
    expect(end.chain[1]).toMatch(new RegExp(`^${issuer.url}/oauth/authorize\\?`))
    const authorize = new URL(end.chain[1]!)
    expect(authorize.searchParams.get('redirect_uri')).toBe(site + ACCOUNT_CALLBACK_PATH)
    expect(authorize.searchParams.get('client_id')).toBe(CLIENT_ID)
    expect(authorize.searchParams.get('response_type')).toBe('code')
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authorize.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/)
    expect(authorize.searchParams.get('state')).toMatch(/^[\w-]{43}$/)
    expect(authorize.searchParams.has('prompt')).toBe(false)
    expect(end.chain[2]).toMatch(new RegExp(`^${site}${ACCOUNT_CALLBACK_PATH}\\?code=`))

    // Signed in as the site's own user, with the site's role and name.
    const who = await me(b)
    expect(who.status).toBe(200)
    expect(who.json.user).toMatchObject({ id, email: 'mixed.case@test.local', role: 'editor', name: 'Their own name' })
    // The flow cookie is gone; the session cookie is the normal one.
    expect(b.cookie(site, 'cms-account-flow')).toBeUndefined()
    expect(b.cookie(site, 'nuxt-auth-session')).toBeTruthy()

    // The link: two rows of cms_state, as 2.15 names them.
    expect(await linkOf(id)).toEqual({ issuer: issuer.url, sub: p.sub })
    const rows = await links()
    const forward = rows.find((r) => r.key.startsWith('account:') && r.value.userId === id)!
    expect(forward.key).toMatch(/^account:[0-9a-f]{64}$/)
    expect(forward.value).toMatchObject({ userId: id, issuer: issuer.url, sub: p.sub })
    expect(Date.parse(forward.value.linkedAt)).toBeGreaterThan(Date.now() - 60_000)

    // The audit log: a sign-in as password sign-in writes it, saying it was through the account.
    expect((await auditOf(id, 'auth.login'))[0]).toEqual({ via: 'account' })
    expect((await auditOf(id, 'auth.account_link'))[0]).toEqual({ issuer: issuer.url })
    expect((await userRow(id)).last_login_at).toBeTruthy()

    // The issuer was asked once for the code, and told the role afterwards.
    const token = issuer.callsTo('/oauth/token', mark)
    expect(token).toHaveLength(1)
    expect(token[0]!.body).toMatchObject({ grant_type: 'authorization_code', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: site + ACCOUNT_CALLBACK_PATH })
    expect(token[0]!.body.code_verifier).toMatch(/^[\w-]{43}$/)
    const [report] = await issuer.waitForCalls('/oauth/membership', 1, mark)
    expect(report!.body).toEqual({ sub: p.sub, role: 'editor', active: true })
    expect(report!.basicClient).toBe(CLIENT_ID)
    expect(issuer.member(CLIENT_ID, p.sub)).toEqual({ role: 'editor', active: true })
  })

  it('the link holds when the e-mail changes at the issuer: the person is found by `sub`', async () => {
    const { p, id } = await linkedUser()
    // Another address, not even verified, and another name: the site's user stays who it was.
    issuer.people.set(p.sub, { ...p, email: 'moved-away@elsewhere.test', email_verified: false, name: 'Renamed' })
    const b = browserOf(p)
    const end = await b.visit(`${site}${START}`)
    expect(end.url).toBe(`${site}/admin`)
    expect((await me(b)).json.user).toMatchObject({ id, email: p.email, name: 'Their own name' })
    expect(await links()).toSatisfy((rows: any[]) => rows.filter((r) => r.value.sub === p.sub).length === 2)
  })

  it('an invited user is accepted without a password: active, with the account’s name, the invitation used up', async () => {
    const p = person({ name: '  Ivana Invited  ', locale: 'cs-CZ' })
    const { id, inviteUrl } = await invite(p.email, 'author')
    expect((await userRow(id)).status).toBe('invited')
    // The invitation says that the account works too (the page and the e-mail).
    const page = await new Client(site).get(`/api/cms/_auth/invite/${tokenOf(inviteUrl)}`)
    expect(page.body.account).toEqual({ enabled: true })
    const mail = readdirSync(mailDir).map((f) => JSON.parse(readFileSync(join(mailDir, f), 'utf8'))).find((m) => m.to === p.email)
    // One sentence more, in the administrator's language (the playground's admin is Czech by default).
    expect(mail.text).toMatch(/tinyzoo (účet s touto e-mailovou adresou|account uses this email address)/)
    expect(mail.html).toMatch(/tinyzoo (účet|account)/)

    const b = browserOf(p)
    const mark = issuer.calls.length
    const end = await b.visit(`${site}${START}`)
    expect(end.url).toBe(`${site}/admin`)
    expect((await me(b)).json.user).toMatchObject({ id, email: p.email, role: 'author', name: 'Ivana Invited', locale: 'cs' })

    const row = await userRow(id)
    expect(row).toMatchObject({ status: 'active', name: 'Ivana Invited', password_hash: null })
    expect(await linkOf(id)).toEqual({ issuer: issuer.url, sub: p.sub })
    // The invitation link no longer works, and there is no password to sign in with.
    expect((await new Client(site).get(`/api/cms/_auth/invite/${tokenOf(inviteUrl)}`)).status).toBe(410)
    expect((await new Client(site).post('/api/cms/_auth/accept', { token: tokenOf(inviteUrl), name: 'Late', password: PASSWORD })).status).toBe(410)
    expect((await new Client(site).post('/api/cms/_auth/login', { email: p.email, password: PASSWORD })).status).toBe(401)
    expect((await auditOf(id, 'auth.invite_accept'))[0]).toEqual({ via: 'account' })
    expect((await issuer.waitForCalls('/oauth/membership', 1, mark))[0]!.body).toEqual({ sub: p.sub, role: 'author', active: true })

    // Later, in another browser: the same person signs in again.
    const later = browserOf(p)
    expect((await later.visit(`${site}${START}`)).url).toBe(`${site}/admin`)
    expect((await me(later)).json.user.id).toBe(id)
  })

  it('an invitation that ran out is not accepted by the account either', async () => {
    const p = person()
    const { id } = await invite(p.email)
    await pool.query(`update cms_tokens set expires_at = now() - interval '1 minute' where user_id = $1`, [id])
    const b = browserOf(p)
    expect((await b.visit(`${site}${START}`)).url).toBe(`${site}/admin/login?account=no-access`)
    expect((await userRow(id)).status).toBe('invited')
    expect(await linkOf(id)).toBeUndefined()
    expect((await auditOf(id, 'auth.login_failed'))[0]).toMatchObject({ via: 'account', reason: 'invitation-expired' })
  })

  it('someone already signed in here goes straight on when the switcher brings them (silent), without asking the issuer', async () => {
    const { b } = await linkedUser()
    const mark = issuer.calls.length
    const end = await b.visit(`${site}${START}?next=/admin/media&silent=1`)
    expect(end.chain).toEqual([`${site}${START}?next=/admin/media&silent=1`, `${site}/admin/media`])
    expect(issuer.callsTo('/oauth/authorize', mark)).toHaveLength(0)
  })
})

describe('sign-in with the account: who gets no access', () => {
  it('a person with no user on this site: `no-access`, no session, and the issuer is told', async () => {
    const p = person()
    const b = browserOf(p)
    const mark = issuer.calls.length
    const end = await b.visit(`${site}${START}`)
    expect(end.url).toBe(`${site}/admin/login?account=no-access`)
    expect(end.status).toBe(200)
    expect((await me(b)).status).toBe(401)
    expect(b.cookie(site, 'cms-account-flow')).toBeUndefined()
    expect(await links()).toSatisfy((rows: any[]) => !rows.some((r) => r.value.sub === p.sub))
    // The exchange made them a member at the issuer; the site says it does not let them in.
    expect((await issuer.waitForCalls('/oauth/membership', 1, mark))[0]!.body).toEqual({ sub: p.sub, role: '', active: false })
    expect((await auditOf(null, 'auth.login_failed')).some((m) => m.via === 'account' && m.reason === 'no-user' && m.email === p.email)).toBe(true)
  })

  it('an e-mail the issuer has not verified never links, even to an existing user', async () => {
    const victim = `victim-${++seq}@test.local`
    const { id } = await invite(victim, 'admin', true)
    for (const verified of [false, 'true', 1, undefined] as const) {
      const p = person({ email: victim, email_verified: verified as any })
      const b = browserOf(p)
      expect((await b.visit(`${site}${START}`)).url, `email_verified: ${String(verified)}`).toBe(`${site}/admin/login?account=no-access`)
      expect((await me(b)).status).toBe(401)
    }
    expect(await linkOf(id)).toBeUndefined()
    expect((await auditOf(null, 'auth.login_failed')).some((m) => m.reason === 'email-not-verified' && m.email === victim)).toBe(true)
  })

  it('a disabled user: refused whether linked before or matched by e-mail now, and the issuer hears `active: false`', async () => {
    // Linked while active, disabled afterwards.
    const { p, id, b } = await linkedUser('author')
    let mark = issuer.calls.length
    expect((await admin.patch(`/api/cms/_users/${id}`, { status: 'disabled' })).status).toBe(200)
    expect((await issuer.waitForCalls('/oauth/membership', 1, mark))[0]!.body).toEqual({ sub: p.sub, role: 'author', active: false })
    expect((await me(b)).status).toBe(401) // the session ended with the account, as always
    mark = issuer.calls.length
    const again = browserOf(p)
    expect((await again.visit(`${site}${START}`)).url).toBe(`${site}/admin/login?account=no-access`)
    expect((await me(again)).status).toBe(401)
    expect((await auditOf(id, 'auth.login_failed'))[0]).toMatchObject({ via: 'account', reason: 'disabled' })
    expect((await issuer.waitForCalls('/oauth/membership', 1, mark))[0]!.body).toEqual({ sub: p.sub, role: 'author', active: false })

    // Enabled again: let in, and the issuer hears that too.
    mark = issuer.calls.length
    expect((await admin.patch(`/api/cms/_users/${id}`, { status: 'active' })).status).toBe(200)
    expect((await issuer.waitForCalls('/oauth/membership', 1, mark))[0]!.body).toEqual({ sub: p.sub, role: 'author', active: true })
    expect((await browserOf(p).visit(`${site}${START}`)).url).toBe(`${site}/admin`)

    // Never linked, disabled, and the account's verified e-mail matches: no link is made.
    const q = person()
    const other = await invite(q.email, 'editor', true)
    expect((await admin.patch(`/api/cms/_users/${other.id}`, { status: 'disabled' })).status).toBe(200)
    expect((await browserOf(q).visit(`${site}${START}`)).url).toBe(`${site}/admin/login?account=no-access`)
    expect(await linkOf(other.id)).toBeUndefined()
  })

  it('a user already linked to another account is not handed to a second one with the same e-mail', async () => {
    const { p, id } = await linkedUser()
    // The address changed hands at the issuer: a second account now holds it, verified.
    issuer.people.set(p.sub, { ...p, email: 'first-owner-moved@elsewhere.test' })
    const second = person({ email: p.email })
    const b = browserOf(second)
    expect((await b.visit(`${site}${START}`)).url).toBe(`${site}/admin/login?account=no-access`)
    expect((await me(b)).status).toBe(401)
    expect(await linkOf(id)).toEqual({ issuer: issuer.url, sub: p.sub })
    expect((await auditOf(id, 'auth.login_failed'))[0]).toMatchObject({ via: 'account', reason: 'linked-to-another-account' })
    // The first account still gets in.
    expect((await browserOf(p).visit(`${site}${START}`)).url).toBe(`${site}/admin`)
  })

  it('a role change is told to the issuer; deleting the user removes the link, and a new invitation links anew', async () => {
    const { p, id } = await linkedUser('author')
    let mark = issuer.calls.length
    expect((await admin.patch(`/api/cms/_users/${id}`, { role: 'editor' })).status).toBe(200)
    expect((await issuer.waitForCalls('/oauth/membership', 1, mark))[0]!.body).toEqual({ sub: p.sub, role: 'editor', active: true })

    mark = issuer.calls.length
    expect((await admin.delete(`/api/cms/_users/${id}`)).status).toBe(200)
    expect(await links()).toSatisfy((rows: any[]) => !rows.some((r) => r.value.sub === p.sub || r.key === `account-of:${id}`))
    expect((await issuer.waitForCalls('/oauth/membership', 1, mark))[0]!.body).toEqual({ sub: p.sub, role: 'editor', active: false })
    expect((await browserOf(p).visit(`${site}${START}`)).url).toBe(`${site}/admin/login?account=no-access`)

    // Invited again (a new user row): the account accepts the invitation and is linked to the new user.
    const next = await invite(p.email, 'author')
    expect(next.id).not.toBe(id)
    const b = browserOf(p)
    expect((await b.visit(`${site}${START}`)).url).toBe(`${site}/admin`)
    expect((await me(b)).json.user.id).toBe(next.id)
    expect(await linkOf(next.id)).toEqual({ issuer: issuer.url, sub: p.sub })
  })
})

describe('sign-in with the account: the state, the flow cookie and `next`', () => {
  /** Start a flow and stop before the callback: the callback address the issuer sent the browser to. */
  async function untilCallback(b: Browser, query = ''): Promise<string> {
    const start = await b.fetch(`${site}${START}${query}`)
    expect(start.status).toBe(302)
    const authorize = await b.fetch(start.headers.get('location')!)
    expect(authorize.status).toBe(302)
    const callback = authorize.headers.get('location')!
    expect(callback.startsWith(site + ACCOUNT_CALLBACK_PATH)).toBe(true)
    return callback
  }

  it('the flow cookie is sealed, httpOnly, SameSite=Lax, for these routes, for ten minutes', async () => {
    const b = browserOf(person())
    const start = await b.fetch(`${site}${START}`)
    const cookie = start.headers.getSetCookie().find((c) => c.startsWith('cms-account-flow='))!
    expect(cookie).toMatch(/; HttpOnly/i)
    expect(cookie).toMatch(/; SameSite=Lax/i)
    expect(cookie).toMatch(/; Path=\/api\/cms\/_auth\/account/i)
    expect(cookie).toMatch(/; Max-Age=600/i)
    // Sealed: neither the state nor anything readable is in it.
    const state = new URL(start.headers.get('location')!).searchParams.get('state')!
    const value = cookie.split(';')[0]!.slice('cms-account-flow='.length)
    expect(value).not.toContain(state)
    expect(Buffer.from(value, 'base64url').toString('latin1')).not.toMatch(/verifier|state|admin/)
    expect(start.headers.get('cache-control')).toContain('no-store')
  })

  it('a callback without the flow cookie, with a wrong state or with none signs nobody in', async () => {
    const p = person()
    await invite(p.email, 'editor', true)

    // No cookie at all (the address opened in another browser).
    const b = browserOf(p)
    const callback = await untilCallback(b)
    const stranger = new Browser()
    const mark = issuer.calls.length
    expect((await stranger.visit(callback)).url).toBe(`${site}/admin/login?account=expired`)
    expect((await me(stranger)).status).toBe(401)
    expect(issuer.callsTo('/oauth/token', mark)).toHaveLength(0) // the code was never spent

    // The right cookie, a state that is not its own.
    const wrong = new URL(callback)
    wrong.searchParams.set('state', 'x'.repeat(43))
    const b2 = browserOf(p)
    await untilCallback(b2)
    expect((await b2.visit(wrong.toString())).url).toBe(`${site}/admin/login?account=expired`)
    expect((await me(b2)).status).toBe(401)
    expect(b2.cookie(site, 'cms-account-flow')).toBeUndefined() // dropped either way

    // No state.
    const none = new URL(callback)
    none.searchParams.delete('state')
    const b3 = browserOf(p)
    await untilCallback(b3)
    expect((await b3.visit(none.toString())).url).toBe(`${site}/admin/login?account=expired`)
    expect(issuer.callsTo('/oauth/token', mark)).toHaveLength(0)
  })

  it('a flow cookie from another browser does not finish this browser’s sign-in (and the other way round)', async () => {
    const p = person()
    await invite(p.email, 'editor', true)
    const victim = browserOf(p)
    const victimCallback = await untilCallback(victim)
    // The attacker has a flow of their own (a valid cookie of this site) and the victim's callback address.
    const attacker = browserOf(person())
    await untilCallback(attacker)
    expect((await attacker.visit(victimCallback)).url).toBe(`${site}/admin/login?account=expired`)
    expect((await me(attacker)).status).toBe(401)
    // The victim's own browser still finishes (the code was not spent by the attempt).
    expect((await victim.visit(victimCallback)).url).toBe(`${site}/admin`)
  })

  it('a callback address used twice works once, even with the flow cookie put back', async () => {
    const p = person()
    await invite(p.email, 'editor', true)
    const b = browserOf(p)
    const start = await b.fetch(`${site}${START}`)
    const flowCookie = 'cms-account-flow=' + b.cookie(site, 'cms-account-flow')
    const callback = (await b.fetch(start.headers.get('location')!)).headers.get('location')!
    expect((await b.visit(callback)).url).toBe(`${site}/admin`)

    const replay = new Browser()
    replay.setCookie(site, flowCookie)
    const mark = issuer.calls.length
    expect((await replay.visit(callback)).url).toBe(`${site}/admin/login?account=expired`)
    expect((await me(replay)).status).toBe(401)
    expect(issuer.callsTo('/oauth/token', mark)).toHaveLength(0)
  })

  it('`next` that tries to leave the site ends on /admin of this site', async () => {
    const p = person()
    await invite(p.email, 'editor', true)
    const outside = ['//evil.test/admin', 'https://evil.test/admin', '/\\evil.test', '/admin/../..//evil.test', '\\\\evil.test', 'javascript:alert(1)', '/admin\r\nx: y', 'admin', ' /admin', '/%0d%0aevil'] as const
    for (const next of outside.slice(0, 9)) {
      const b = browserOf(p)
      const end = await b.visit(`${site}${START}?next=${encodeURIComponent(next)}`)
      expect(end.url, next).toBe(`${site}/admin`)
      expect(end.chain.every((u) => u.startsWith(site) || u.startsWith(issuer.url)), next).toBe(true)
    }
    // A path of the site that only looks odd stays a path of the site.
    const b = browserOf(p)
    const odd = await b.fetch(`${site}${START}?next=${encodeURIComponent(outside[9])}`)
    const callback = (await b.fetch(odd.headers.get('location')!)).headers.get('location')!
    const done = await b.fetch(callback)
    expect(done.status).toBe(302)
    expect(new URL(done.headers.get('location')!, site).origin).toBe(site)
    // And the callback's own redirect never carries a header made from `next`.
    expect(done.headers.get('x')).toBeNull()
  })

  it('`login_required` from the issuer shows the sign-in page, which starts nothing by itself', async () => {
    const b = new Browser() // nobody is signed in at the issuer
    const mark = issuer.calls.length
    const end = await b.visit(`${site}${START}?next=/admin/media&silent=1`)
    // Silent: the issuer is asked not to show its form, and says nobody is signed in.
    expect(new URL(end.chain[1]!).searchParams.get('prompt')).toBe('none')
    expect(end.chain[2]).toContain('error=login_required')
    expect(end.url).toBe(`${site}/admin/login?account=signin&redirect=${encodeURIComponent('/admin/media')}`)
    expect(end.status).toBe(200)
    // The page is the sign-in page with the button, and that is where it stops: one authorize, no more.
    expect(end.body).toContain('data-cms-account-sign-in')
    expect(end.body).toContain(`${START}?next=${encodeURIComponent('/admin/media')}`)
    expect(end.body).not.toContain('data-cms-account-notice')
    // (Counted by endpoint: a role report of an earlier test may still arrive in between.)
    const asked = () => issuer.calls.slice(mark).filter((c) => c.path !== '/oauth/membership').map((c) => c.path)
    expect(asked()).toEqual(['/oauth/authorize'])
    expect((await me(b)).status).toBe(401)
    // Opening the page again asks the issuer nothing either.
    await b.visit(end.url)
    expect(asked()).toEqual(['/oauth/authorize'])
  })

  it('the sign-in page says why an attempt did not get in', async () => {
    for (const [result, text] of [['no-access', 'has no access to this website'], ['unavailable', 'did not answer'], ['expired', 'took too long']] as const) {
      const page = await new Browser().fetch(`${site}/admin/login?account=${result}`, { headers: { 'accept-language': 'en' } })
      expect(page.status).toBe(200)
      expect(page.body, result).toContain('data-cms-account-notice')
      expect(page.body, result).toContain(text)
    }
  })
})

describe('sign-in with the account: an issuer that fails', () => {
  it.each([
    ['is down', { down: true }],
    ['answers 400', { tokenStatus: 400 }],
    ['answers 500', { tokenStatus: 500 }],
    ['answers something that is not JSON', { garbage: true }],
    ['is slower than the site waits', { slowMs: 2500 }],
  ] as const)('an issuer that %s: back to the sign-in page with `unavailable`, never an error page', async (_name, fault) => {
    const p = person()
    await invite(p.email, 'editor', true)
    const b = browserOf(p)
    const start = await b.fetch(`${site}${START}`)
    const callback = (await b.fetch(start.headers.get('location')!)).headers.get('location')!
    Object.assign(issuer.fault, fault)
    try {
      const started = Date.now()
      const done = await b.fetch(callback)
      expect(done.status).toBe(302)
      expect(done.headers.get('location')).toBe('/admin/login?account=unavailable')
      // A slow issuer costs the person the site's patience (one second here), not the issuer's.
      expect(Date.now() - started).toBeLessThan(2300)
      expect((await me(b)).status).toBe(401)
      expect(b.cookie(site, 'cms-account-flow')).toBeUndefined()
    }
    finally {
      for (const key of Object.keys(issuer.fault)) delete (issuer.fault as any)[key]
      // A slow answer still under way must not run into the next test.
      if ('slowMs' in fault) await new Promise((r) => setTimeout(r, 1800))
    }
  })

  it('an issuer that refuses the site’s secret (401) is `unavailable` too', async () => {
    const p = person()
    await invite(p.email, 'editor', true)
    const b = browserOf(p)
    const start = await b.fetch(`${site}${START}`)
    const callback = (await b.fetch(start.headers.get('location')!)).headers.get('location')!
    const client = issuer.clients.get(CLIENT_ID)!
    issuer.clients.set(CLIENT_ID, { ...client, clientSecret: 'rotated-at-the-issuer' })
    try {
      const done = await b.fetch(callback)
      expect(done.headers.get('location')).toBe('/admin/login?account=unavailable')
    }
    finally {
      issuer.clients.set(CLIENT_ID, client)
    }
  })
})

describe('the person’s websites (the switcher)', () => {
  const SITES = '/api/cms/_auth/account/sites'

  it('lists the websites of the same owner the person is let into, the current one marked, and is kept for a minute', async () => {
    const { p, b } = await linkedUser('editor')
    issuer.members.set(`sister\n${p.sub}`, { role: 'admin', active: true })
    issuer.members.set(`stranger\n${p.sub}`, { role: 'admin', active: true })
    const mark = issuer.calls.length

    const first = await b.fetch(site + SITES)
    expect(first.status).toBe(200)
    expect(first.json).toEqual({
      linked: true,
      sites: [
        { id: CLIENT_ID, name: 'Site under test', url: site, role: 'editor', current: true },
        { id: 'sister', name: 'Sister website', url: 'https://sister.example', role: 'admin', current: false },
      ],
      account: `${issuer.url}/sites`,
    })
    expect(first.headers.get('cache-control')).toContain('no-store')
    const asked = issuer.callsTo('/oauth/sites', mark)
    expect(asked).toHaveLength(1)
    expect(asked[0]!.body).toEqual({ sub: p.sub })
    expect(asked[0]!.basicClient).toBe(CLIENT_ID)

    // Again, and from another browser of the same person: the issuer is not asked again.
    expect((await b.fetch(site + SITES)).json).toEqual(first.json)
    const other = browserOf(p)
    await other.visit(`${site}${START}`)
    expect((await other.fetch(site + SITES)).json).toEqual(first.json)
    expect(issuer.callsTo('/oauth/sites', mark)).toHaveLength(1)
  })

  it('somebody who is not linked to an account gets an empty list, and the issuer is not asked', async () => {
    const mark = issuer.calls.length
    const res = await admin.get(SITES) // the first administrator signed in with a password
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ linked: false, sites: [], account: null })
    expect(issuer.callsTo('/oauth/sites', mark)).toHaveLength(0)
    expect((await new Client(site).get(SITES)).status).toBe(401)
  })

  it('an issuer that is down gives an empty list (not an error), which is not kept for the whole minute', async () => {
    const { b } = await linkedUser()
    issuer.fault.down = true
    let mark: number
    try {
      mark = issuer.calls.length
      const res = await b.fetch(site + SITES)
      expect(res.status).toBe(200)
      expect(res.json).toEqual({ linked: true, sites: [], account: null })
      // Asked once; the empty answer is kept for a moment so every page does not wait for the issuer.
      expect((await b.fetch(site + SITES)).json).toEqual({ linked: true, sites: [], account: null })
      expect(issuer.callsTo('/oauth/sites', mark)).toHaveLength(1)
    }
    finally {
      delete issuer.fault.down
    }
  })

  it('what the issuer sends is not passed on blindly: only websites with an http(s) address and a name', async () => {
    const { p, b } = await linkedUser()
    issuer.addClient({ clientId: `odd-${p.sub}`, owner: 'owner-1', name: 'Odd address', url: 'javascript:alert(1)' })
    issuer.members.set(`odd-${p.sub}\n${p.sub}`, { role: 'admin', active: true })
    const res = await b.fetch(site + SITES)
    expect(res.json.sites.map((s: any) => s.name)).toEqual(['Site under test'])
    issuer.clients.delete(`odd-${p.sub}`)
  })
})

describe('what never leaves the server', () => {
  it('the client secret is in no response a browser got, and not in the server’s log', async () => {
    // One more of everything, in one browser, then look through all it ever received.
    const p = person()
    await invite(p.email, 'editor', true)
    const b = browserOf(p)
    await b.visit(`${site}${START}`)
    for (const path of ['/api/cms/_auth/status', '/api/cms/_auth/me', '/api/cms/_auth/account/sites', '/admin/account', '/admin/login?account=no-access', '/admin']) await b.fetch(site + path)
    const everything = b.seen.join('\n')
    expect(b.seen.length).toBeGreaterThan(8)
    for (const secret of [CLIENT_SECRET, OTHER_SECRET]) expect(everything).not.toContain(secret)
    // Nor what the issuer answered the site with (the code exchange is the server's own business).
    expect(everything).not.toContain('email_verified')
    expect(server.logs.join('')).not.toContain(CLIENT_SECRET)
    // And a server that works never answered with an error page on the way.
    expect(b.seen.filter((r) => r.startsWith('5'))).toEqual([])
  })
})

describe('a site without the account’s settings (the shared test server)', () => {
  it('has no such routes, no `account` in its status, and its sign-in page has no button', async () => {
    const plain = new Client()
    for (const path of ['/api/cms/_auth/account/start', '/api/cms/_auth/account/start?next=/admin&silent=1', '/api/cms/_auth/account/callback?code=x&state=y', '/api/cms/_auth/account/sites']) {
      const res = await plain.get(path)
      expect(res.status, path).toBe(404)
      expect(res.headers.get('location'), path).toBeNull()
      expect(res.headers.getSetCookie(), path).toEqual([])
    }
    const status = await plain.get('/api/cms/_auth/status')
    expect(status.body).not.toHaveProperty('account')
    expect(Object.keys(status.body).sort()).toEqual(['mode', 'needsSetup', 'needsToken'])
    const page = await fetch(`${plain.baseURL}/admin/login?account=no-access`)
    const html = await page.text()
    expect(html).not.toContain('data-cms-account-sign-in')
    expect(html).not.toContain('data-cms-account-notice')
    expect(html).not.toContain('/api/cms/_auth/account/')
  })

  it('`me` and an invitation say nothing about an account there', async () => {
    const { signIn } = await import('../helpers/api')
    const adminThere = await signIn('admin')
    const who = await adminThere.get('/api/cms/_auth/me')
    expect(who.status).toBe(200)
    expect(who.body).not.toHaveProperty('account')
    const invited = await adminThere.post('/api/cms/_users', { email: `no-account-${Date.now().toString(36)}@test.local`, role: 'author' })
    expect(invited.status).toBe(201)
    const page = await new Client().get(`/api/cms/_auth/invite/${tokenOf(invited.body.inviteUrl)}`)
    expect(page.body).not.toHaveProperty('account')
    expect((await adminThere.delete(`/api/cms/_users/${invited.body.user.id}`)).status).toBe(200)
  })
})

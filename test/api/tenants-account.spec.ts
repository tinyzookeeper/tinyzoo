import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ACCOUNT_CALLBACK_PATH, Browser, issuerSub, startAccountIssuer, type AccountIssuer, type IssuerPerson } from '../helpers/accountIssuer'
import { expectNoSiteErrors, siteQuery, startTenants, tenantGet, type Tenants, type TenantSite } from '../helpers/tenants'

// Sign-in with the tinyzoo account in multi-tenant mode (docs/multi-tenant-plan.md 2.15):
// two sites in one process, whose databases hold the SAME user ids (site B is a copy of
// site A). Each site is a client of its own at the issuer, with its own id and secret in
// its row of the site directory. What is one site's stays that site's: its client, a
// sign-in under way, the link between an account and a user, and the list of websites.
const START = '/api/cms/_auth/account/start'
const SITES = '/api/cms/_auth/account/sites'
const secretOf = (site: string) => `secret-of-client-${site}-never-shown-to-a-browser-51ab`

let issuer: AccountIssuer
let t: Tenants
let seq = 0

beforeAll(async () => {
  issuer = await startAccountIssuer()
  t = await startTenants('account', {
    // Settings in the PROCESS's environment are not a site's: a site without its own has none.
    NUXT_CMS_AUTH_ACCOUNT_ISSUER: issuer.url,
    NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID: 'client-of-the-process',
    NUXT_CMS_AUTH_ACCOUNT_CLIENT_SECRET: 'secret-of-the-process-0123456789abcdef',
    CMS_TEST_ACCOUNT_TIMEOUT_MS: '1500',
  }, {
    siteConfig: (site, publicUrl): Record<string, Record<string, unknown>> => {
      if (site === 'c') return {} // the third site has no account settings of its own
      // A and B belong to two different owners; each owner has one more website.
      issuer.addClient({ clientId: `client-${site}`, clientSecret: secretOf(site), owner: `owner-${site}`, name: `Site ${site.toUpperCase()}`, url: publicUrl })
      issuer.addClient({ clientId: `sister-of-${site}`, owner: `owner-${site}`, name: `Sister of ${site.toUpperCase()}`, url: `https://sister-of-${site}.example` })
      return { auth: { account: { issuer: issuer.url, clientId: `client-${site}`, clientSecret: secretOf(site) } } }
    },
  })
}, 180_000)

afterAll(async () => {
  try { expectNoSiteErrors(t) }
  finally {
    await t?.stop()
    await issuer?.stop()
  }
})

/** A person at the issuer whose verified e-mail is one of the three accounts both sites hold. */
function personFor(role: 'admin' | 'editor' | 'author'): IssuerPerson {
  const n = ++seq
  return issuer.addPerson({ sub: issuerSub(n), email: `${role}@test.local`, name: `Account of ${role}` })
}
function browserOf(p?: IssuerPerson): Browser {
  const b = new Browser()
  if (p) b.setCookie(issuer.url, issuer.sessionCookie(p.sub))
  return b
}
const accountRows = (site: TenantSite) => siteQuery<{ key: string; value: any }>(site, `select key, value from cms_state where key like 'account:%' or key like 'account-of:%' order by key`)
const clearLinks = async () => { for (const site of [t.a, t.b]) await siteQuery(site, `delete from cms_state where key like 'account:%' or key like 'account-of:%'`) }
/** A flow on `site` up to the callback address the issuer sends the browser to. */
async function untilCallback(b: Browser, site: TenantSite): Promise<string> {
  const start = await b.fetch(`${site.url}${START}`)
  expect(start.status).toBe(302)
  const callback = (await b.fetch(start.headers.get('location')!)).headers.get('location')!
  expect(callback.startsWith(site.url + ACCOUNT_CALLBACK_PATH)).toBe(true)
  return callback
}

describe('each site is a client of its own', () => {
  it('each site sends the browser with its own client id and public address, and exchanges with its own secret', async () => {
    const p = personFor('editor')
    for (const [site, name] of [[t.a, 'a'], [t.b, 'b']] as const) {
      const b = browserOf(p)
      const mark = issuer.calls.length
      const end = await b.visit(`${site.url}${START}?next=/admin/media`)
      expect(end.url, name).toBe(`${site.url}/admin/media`)
      const authorize = new URL(end.chain[1]!)
      expect(authorize.searchParams.get('client_id')).toBe(`client-${name}`)
      expect(authorize.searchParams.get('redirect_uri')).toBe(site.url + ACCOUNT_CALLBACK_PATH)
      const [token] = issuer.callsTo('/oauth/token', mark)
      expect(token!.body).toMatchObject({ client_id: `client-${name}`, client_secret: secretOf(name), redirect_uri: site.url + ACCOUNT_CALLBACK_PATH })
      const who = await b.fetch(`${site.url}/api/cms/_auth/me`)
      expect(who.json.user).toMatchObject({ id: site.users.editor, email: 'editor@test.local' })
      const [report] = await issuer.waitForCalls('/oauth/membership', 1, mark)
      expect(report!.basicClient).toBe(`client-${name}`)
      expect(report!.body).toEqual({ sub: p.sub, role: 'editor', active: true })
      // Neither site's secret is in anything the browser received.
      for (const secret of [secretOf('a'), secretOf('b'), 'secret-of-the-process']) expect(b.seen.join('\n')).not.toContain(secret)
    }
    await clearLinks()
  })

  it('a site without settings of its own has none of it, whatever the process’s environment says', async () => {
    const third = await t.makeThirdSite()
    await t.writeDirectory([...t.rows, third.row])
    try {
      const status = await tenantGet(third.site.url, '/api/cms/_auth/status')
      expect(status.status).toBe(200)
      expect(status.body).not.toHaveProperty('account')
      for (const path of [START, `${ACCOUNT_CALLBACK_PATH}?code=x&state=y`, SITES]) {
        const res = await tenantGet(third.site.url, path)
        expect(res.status, path).toBe(404)
        expect(res.headers.get('location'), path).toBeNull()
      }
      // The two others say so themselves.
      expect((await tenantGet(t.a.url, '/api/cms/_auth/status')).body.account).toEqual({ enabled: true })
      expect((await tenantGet(t.b.url, '/api/cms/_auth/status')).body.account).toEqual({ enabled: true })
      expect(issuer.calls.some((c) => c.query.client_id === 'client-of-the-process' || c.body?.client_id === 'client-of-the-process' || c.basicClient === 'client-of-the-process')).toBe(false)
    }
    finally {
      await t.writeDirectory(t.rows)
    }
  })
})

describe('a sign-in started on one site cannot be finished on another', () => {
  it('site A’s flow cookie and callback address do nothing on site B', async () => {
    const p = personFor('admin')
    const b = browserOf(p)
    const callbackA = await untilCallback(b, t.a)
    const flow = b.cookie(t.a.url, 'cms-account-flow')!
    const onB = new URL(callbackA)
    onB.host = new URL(t.b.url).host

    const other = new Browser()
    other.setCookie(t.b.url, `cms-account-flow=${flow}`)
    const mark = issuer.calls.length
    const end = await other.visit(onB.toString())
    expect(end.url).toBe(`${t.b.url}/admin/login?account=expired`)
    expect((await other.fetch(`${t.b.url}/api/cms/_auth/me`)).status).toBe(401)
    expect(issuer.callsTo('/oauth/token', mark)).toHaveLength(0)
    expect(await accountRows(t.b)).toEqual([])

    // On its own site the same flow still finishes.
    expect((await b.visit(callbackA)).url).toBe(`${t.a.url}/admin`)
    await clearLinks()
  })

  it('a code the issuer gave for site A is refused when site B brings it (its own state and cookie are in order)', async () => {
    const p = personFor('admin')
    const a = browserOf(p)
    const codeA = new URL(await untilCallback(a, t.a)).searchParams.get('code')!
    const b = browserOf(p)
    const callbackB = new URL(await untilCallback(b, t.b))
    callbackB.searchParams.set('code', codeA)

    const mark = issuer.calls.length
    const end = await b.visit(callbackB.toString())
    expect(end.url).toBe(`${t.b.url}/admin/login?account=unavailable`)
    // Site B asked with ITS client, and the issuer said no: the code belongs to another client.
    const [token] = issuer.callsTo('/oauth/token', mark)
    expect(token!.body.client_id).toBe('client-b')
    expect(token!.status).toBe(400)
    expect((await b.fetch(`${t.b.url}/api/cms/_auth/me`)).status).toBe(401)
    expect(await accountRows(t.b)).toEqual([])
    expect(await accountRows(t.a)).toEqual([])
  })

  it('a session opened through the account on A is A’s: B does not accept it', async () => {
    const p = personFor('author')
    const b = browserOf(p)
    expect((await b.visit(`${t.a.url}${START}`)).url).toBe(`${t.a.url}/admin`)
    const session = `nuxt-auth-session=${b.cookie(t.a.url, 'nuxt-auth-session')}`
    expect((await tenantGet(t.a.url, '/api/cms/_auth/me', session)).status).toBe(200)
    expect((await tenantGet(t.b.url, '/api/cms/_auth/me', session)).status).toBe(401)
    await clearLinks()
  })
})

describe('the link and the list of websites are the site’s own', () => {
  it('a link made on A does not exist on B, although the same user id is there', async () => {
    const p = personFor('editor')
    const b = browserOf(p)
    expect((await b.visit(`${t.a.url}${START}`)).url).toBe(`${t.a.url}/admin`)

    const onA = await accountRows(t.a)
    expect(onA).toHaveLength(2)
    expect(onA.find((r) => r.key === `account-of:${t.a.users.editor}`)!.value).toEqual({ issuer: issuer.url, sub: p.sub })
    expect(await accountRows(t.b)).toEqual([])
    expect(t.b.users.editor).toBe(t.a.users.editor)

    // The same person's password session on B (the same user id): not linked there, and the issuer is not asked.
    const mark = issuer.calls.length
    const listB = await tenantGet(t.b.url, SITES, t.b.cookies.editor)
    expect(listB.body).toEqual({ linked: false, sites: [], account: null })
    expect(issuer.callsTo('/oauth/sites', mark)).toHaveLength(0)
    // On A it is.
    const listA = await tenantGet(t.a.url, SITES, t.a.cookies.editor)
    expect(listA.body.linked).toBe(true)

    // Signing in on B makes B's own link, in B's database.
    const b2 = browserOf(p)
    expect((await b2.visit(`${t.b.url}${START}`)).url).toBe(`${t.b.url}/admin`)
    const onB = await accountRows(t.b)
    expect(onB).toHaveLength(2)
    expect(onB.find((r) => r.key.startsWith('account:'))!.value).toMatchObject({ userId: t.b.users.editor, sub: p.sub })
    // Removing A's does not touch B's.
    await siteQuery(t.a, `delete from cms_state where key like 'account:%' or key like 'account-of:%'`)
    expect(await accountRows(t.b)).toHaveLength(2)
    await clearLinks()
  })

  it('the switcher’s list of A is A’s and B’s is B’s, for the same user id, whichever is asked first', async () => {
    const p = personFor('admin')
    const a = browserOf(p)
    const b = browserOf(p)
    const before = issuer.calls.length
    expect((await a.visit(`${t.a.url}${START}`)).url).toBe(`${t.a.url}/admin`)
    expect((await b.visit(`${t.b.url}${START}`)).url).toBe(`${t.b.url}/admin`)
    // Both sites have told the issuer the role by now (they do it after the response).
    await issuer.waitForCalls('/oauth/membership', 2, before)
    issuer.members.set(`sister-of-a\n${p.sub}`, { role: 'editor', active: true, confirmed: true })
    issuer.members.set(`sister-of-b\n${p.sub}`, { role: 'author', active: true, confirmed: true })

    const expected = (site: 'a' | 'b', url: string) => ({
      linked: true,
      sites: [
        { id: `client-${site}`, name: `Site ${site.toUpperCase()}`, url, role: 'admin', current: true },
        { id: `sister-of-${site}`, name: `Sister of ${site.toUpperCase()}`, url: `https://sister-of-${site}.example`, role: site === 'a' ? 'editor' : 'author', current: false },
      ],
      account: `${issuer.url}/sites`,
    })
    const mark = issuer.calls.length
    // A first, then B: B must not be served what was kept for the same user id on A.
    expect((await a.fetch(`${t.a.url}${SITES}`)).json).toEqual(expected('a', t.a.url))
    expect((await b.fetch(`${t.b.url}${SITES}`)).json).toEqual(expected('b', t.b.url))
    // And again, the other way round, now from what each site kept.
    expect((await b.fetch(`${t.b.url}${SITES}`)).json).toEqual(expected('b', t.b.url))
    expect((await a.fetch(`${t.a.url}${SITES}`)).json).toEqual(expected('a', t.a.url))
    const asked = issuer.callsTo('/oauth/sites', mark)
    expect(asked.map((c) => c.basicClient).sort()).toEqual(['client-a', 'client-b'])
    // Nothing of the other owner's websites reaches a site.
    expect(JSON.stringify((await a.fetch(`${t.a.url}${SITES}`)).json)).not.toContain('sister-of-b')
    await clearLinks()
  })

  it('disabling the user on A tells the issuer as A’s client; B’s user and link stay', async () => {
    const p = personFor('author')
    const before = issuer.calls.length
    expect((await browserOf(p).visit(`${t.a.url}${START}`)).url).toBe(`${t.a.url}/admin`)
    expect((await browserOf(p).visit(`${t.b.url}${START}`)).url).toBe(`${t.b.url}/admin`)
    await issuer.waitForCalls('/oauth/membership', 2, before)
    const mark = issuer.calls.length
    const res = await fetch(`${t.a.url}/api/cms/_users/${t.a.users.author}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie: t.a.cookies.admin, origin: t.a.url }, body: JSON.stringify({ status: 'disabled' }),
    })
    expect(res.status).toBe(200)
    const [report] = await issuer.waitForCalls('/oauth/membership', 1, mark)
    expect(report!.basicClient).toBe('client-a')
    expect(report!.body).toEqual({ sub: p.sub, role: 'author', active: false })
    expect(issuer.member('client-b', p.sub)).toEqual({ role: 'author', active: true, confirmed: true })
    expect((await browserOf(p).visit(`${t.a.url}${START}`)).url).toBe(`${t.a.url}/admin/login?account=no-access`)
    expect((await browserOf(p).visit(`${t.b.url}${START}`)).url).toBe(`${t.b.url}/admin`)
    // Put back as it was, for whatever runs after.
    await fetch(`${t.a.url}/api/cms/_users/${t.a.users.author}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie: t.a.cookies.admin, origin: t.a.url }, body: JSON.stringify({ status: 'active' }),
    })
    await clearLinks()
  })
})

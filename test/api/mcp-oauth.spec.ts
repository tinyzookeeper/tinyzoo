import { createHash, randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { Client as McpClient, StreamableHTTPClientTransport, UnauthorizedError } from '@modelcontextprotocol/client'
import { anonymous, type Client, signIn, testDb } from '../helpers/api'
import { createAuthor } from '../helpers/fixtures'

// Signing in to the MCP server over OAuth (server/utils/cmsOAuth.ts): discovery, registration,
// the admin's connect page, PKCE, tokens, refresh and revocation. Once with the SDK's own client
// (as a program would), then by hand for each refusal.

const CB = 'http://127.0.0.1:8976/callback'
let editor: Client
let author: Client
const db = testDb()
let ip = 0
const base = () => inject('baseURL') as string
const visitor = () => ({ 'x-forwarded-for': `198.19.9.${++ip}` })

const pkce = () => {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

async function register(redirect = CB, name = 'Test program') {
  const res = await fetch(`${base()}/api/mcp/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json', ...visitor() }, body: JSON.stringify({ client_name: name, redirect_uris: [redirect] }) })
  return { status: res.status, body: await res.json() as any }
}

/** Authorize as `who` with these rights; answers the callback's parameters and the verifier. */
async function signInAs(who: Client, clientId: string, rights: Record<string, unknown>, opts: { scope?: string } = {}) {
  const { verifier, challenge } = pkce()
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: CB, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', state: 'st', ...(opts.scope ? { scope: opts.scope } : {}) })
  const start = await fetch(`${base()}/api/mcp/oauth/authorize?${q}`, { redirect: 'manual', headers: visitor() })
  expect(start.status).toBe(302)
  const consent = new URL(start.headers.get('location')!, base())
  expect(consent.pathname).toBe('/admin/connect')
  const id = consent.searchParams.get('request')!
  const shown = await who.get(`/api/cms/_auth/oauth/${id}`)
  const decided = await who.post(`/api/cms/_auth/oauth/${id}`, { approve: true, name: 'Laptop', rights })
  expect(decided.status, JSON.stringify(decided.body)).toBe(200)
  return { shown: shown.body, params: new URL(decided.body.redirectTo).searchParams, verifier, id }
}

const token = (body: Record<string, string>) => fetch(`${base()}/api/mcp/oauth/token`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...visitor() }, body: new URLSearchParams(body),
}).then(async (r) => ({ status: r.status, body: await r.json() as any }))

const mcpStatus = (accessToken: string) => fetch(`${base()}/api/mcp`, {
  method: 'POST',
  headers: { 'authorization': `Bearer ${accessToken}`, 'content-type': 'application/json', 'accept': 'application/json, text/event-stream', ...visitor() },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
}).then((r) => r.status)

let authorId: string
beforeAll(async () => {
  editor = await signIn('editor')
  author = await signIn('author')
  authorId = (await createAuthor(editor)).id
})
afterAll(() => db.end())

describe('discovery', () => {
  it('serves both documents at the bare and the path-aware address, and the 401 points to them', async () => {
    for (const p of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/api/mcp']) {
      const res = await anonymous().get(p)
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ resource: `${base()}/api/mcp`, authorization_servers: [base()] })
    }
    for (const p of ['/.well-known/oauth-authorization-server', '/.well-known/oauth-authorization-server/api/mcp']) {
      const res = await anonymous().get(p)
      expect(res.body).toMatchObject({ issuer: base(), code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'] })
    }
    const unauth = await fetch(`${base()}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', ...visitor() }, body: '{}' })
    expect(unauth.status).toBe(401)
    expect(unauth.headers.get('www-authenticate')).toContain(`resource_metadata="${base()}/.well-known/oauth-protected-resource/api/mcp"`)
  })

  it('answers other origins on the MCP and OAuth endpoints only, never with credentials', async () => {
    const pre = await fetch(`${base()}/api/mcp`, { method: 'OPTIONS', headers: { 'origin': 'https://claude.ai', 'access-control-request-method': 'POST' } })
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-origin')).toBe('*')
    expect(pre.headers.get('access-control-allow-credentials')).toBeNull()
    const admin = await fetch(`${base()}/api/cms/_auth/tokens`, { headers: { origin: 'https://claude.ai' } })
    expect(admin.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('a program signs in', () => {
  it('with the SDK client: registers, is sent to the connect page, gets tokens and works with the rights given', async () => {
    const store: Record<string, any> = {}
    const provider = {
      get redirectUrl() { return CB },
      get clientMetadata() { return { client_name: 'SDK program', redirect_uris: [CB], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' } },
      clientInformation: () => store.client, saveClientInformation: (c: any) => { store.client = c },
      tokens: () => store.tokens, saveTokens: (t: any) => { store.tokens = t },
      saveCodeVerifier: (v: string) => { store.verifier = v }, codeVerifier: () => store.verifier,
      saveDiscoveryState: (s: any) => { store.discovery = s }, discoveryState: () => store.discovery,
      state: () => 'sdk-state',
      redirectToAuthorization: (url: URL) => { store.url = url },
    }
    const url = new URL(`${base()}/api/mcp`)
    const transport = new StreamableHTTPClientTransport(url, { authProvider: provider as any, requestInit: { headers: visitor() } })
    await expect(new McpClient({ name: 'sdk', version: '1' }).connect(transport)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(store.client?.client_id).toBeTruthy()

    const start = await fetch(store.url, { redirect: 'manual', headers: visitor() })
    const id = new URL(start.headers.get('location')!, base()).searchParams.get('request')!
    const shown = await editor.get(`/api/cms/_auth/oauth/${id}`)
    expect(shown.body).toMatchObject({ client: 'SDK program', redirectHost: '127.0.0.1:8976', write: true, can: { publish: true } })
    const decided = await editor.post(`/api/cms/_auth/oauth/${id}`, { approve: true, name: 'SDK laptop', rights: { write: true, publish: false, delete: false, media: false, entities: null } })
    await transport.finishAuth(new URL(decided.body.redirectTo).searchParams)
    expect(store.tokens).toMatchObject({ token_type: 'Bearer', expires_in: 3600 })

    const client = new McpClient({ name: 'sdk', version: '1' })
    await client.connect(new StreamableHTTPClientTransport(url, { authProvider: provider as any, requestInit: { headers: visitor() } }))
    const created: any = await client.callTool({ name: 'create_entry', arguments: { collection: 'post', data: { title: 'Over OAuth', slug: `oauth-${Date.now()}`, author: authorId, body: 'Written by a program that signed in.' } } })
    expect(created.isError, created.content[0].text).toBeFalsy()
    const id2 = JSON.parse(created.content[0].text).created.id
    const pub: any = await client.callTool({ name: 'publish_entry', arguments: { collection: 'post', id: id2 } })
    expect(pub.isError).toBe(true)
    await client.close()

    // The account page lists it as a connection, not a prefix.
    const list = await editor.get('/api/cms/_auth/tokens')
    expect(list.body.tokens.find((t: any) => t.name === 'SDK laptop')).toMatchObject({ origin: 'oauth', client: 'SDK program' })
  })

  it('refreshes (the old access token stops), and revoking ends access and refresh', async () => {
    const { body: c } = await register()
    const { params, verifier } = await signInAs(editor, c.client_id, { write: false, publish: false, delete: false, media: false, entities: null })
    expect(params.get('state')).toBe('st')
    const first = await token({ grant_type: 'authorization_code', code: params.get('code')!, client_id: c.client_id, redirect_uri: CB, code_verifier: verifier })
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ token_type: 'Bearer', scope: 'mcp:read' })
    expect(await mcpStatus(first.body.access_token)).toBe(200)
    const { rows } = await db.query('select token_hash, refresh_hash, origin from cms_access_tokens where refresh_hash is not null order by created_at desc limit 1')
    expect(rows[0]).toMatchObject({ origin: 'oauth' })
    expect(JSON.stringify(rows[0])).not.toContain(first.body.access_token)

    const second = await token({ grant_type: 'refresh_token', refresh_token: first.body.refresh_token, client_id: c.client_id })
    expect(second.status).toBe(200)
    expect(second.body.access_token).not.toBe(first.body.access_token)
    expect(await mcpStatus(first.body.access_token)).toBe(401)
    expect(await mcpStatus(second.body.access_token)).toBe(200)

    const revoked = await fetch(`${base()}/api/mcp/oauth/revoke`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: first.body.refresh_token }) })
    expect(revoked.status).toBe(200)
    expect(await mcpStatus(second.body.access_token)).toBe(401)
    expect((await token({ grant_type: 'refresh_token', refresh_token: first.body.refresh_token })).body.error).toBe('invalid_grant')
  })

  it('an access token past its hour is refused', async () => {
    const { body: c } = await register()
    const { params, verifier } = await signInAs(editor, c.client_id, { write: false, publish: false, delete: false, media: false, entities: null })
    const t = await token({ grant_type: 'authorization_code', code: params.get('code')!, client_id: c.client_id, code_verifier: verifier })
    await db.query(`update cms_access_tokens set access_expires_at = now() - interval '1 second' where refresh_hash is not null and access_expires_at > now()`)
    expect(await mcpStatus(t.body.access_token)).toBe(401)
  })

  it('gives no writing to a program that asked only to read, and nothing beyond the role', async () => {
    const { body: c } = await register()
    const read = await signInAs(editor, c.client_id, { write: true, publish: true, delete: true, media: true, entities: null }, { scope: 'mcp:read' })
    expect(read.shown.write).toBe(false)
    const { rows: [code] } = await db.query('select rights from cms_oauth_codes order by created_at desc limit 1')
    expect(code.rights).toMatchObject({ write: false, publish: false })
    // An author cannot hand out publishing.
    const asAuthor = await signInAs(author, c.client_id, { write: true, publish: true, delete: false, media: false, entities: null })
    expect(asAuthor.params.get('code')).toBeTruthy()
    const { rows: [authorCode] } = await db.query('select rights from cms_oauth_codes order by created_at desc limit 1')
    expect(authorCode.rights).toMatchObject({ write: true, publish: false })
  })
})

describe('refusals', () => {
  it('registers only redirects a code may safely go to', async () => {
    expect((await register('http://example.com/cb')).status).toBe(400)
    expect((await register('https://example.com/cb#x')).status).toBe(400)
    expect((await register('javascript:alert(1)')).status).toBe(400)
    expect((await register('cursor://anysphere.cursor-retrieval/oauth/callback')).status).toBe(201)
  })

  it('shows a page, not a redirect, for an unknown client or an unregistered redirect', async () => {
    const unknown = await fetch(`${base()}/api/mcp/oauth/authorize?client_id=00000000-0000-4000-8000-000000000000&redirect_uri=${encodeURIComponent(CB)}`, { redirect: 'manual' })
    expect(unknown.status).toBe(400)
    expect(unknown.headers.get('content-type')).toContain('text/html')
    const { body: c } = await register()
    const elsewhere = await fetch(`${base()}/api/mcp/oauth/authorize?client_id=${c.client_id}&redirect_uri=${encodeURIComponent('http://127.0.0.1:8976/other')}`, { redirect: 'manual' })
    expect(elsewhere.status).toBe(400)
    // Without PKCE: back to the (registered) client with the error.
    const noPkce = await fetch(`${base()}/api/mcp/oauth/authorize?client_id=${c.client_id}&redirect_uri=${encodeURIComponent(CB)}&state=s`, { redirect: 'manual' })
    expect(noPkce.status).toBe(302)
    expect(new URL(noPkce.headers.get('location')!).searchParams.get('error')).toBe('invalid_request')
  })

  it('checks a code before claiming it: a wrong verifier does not spend it, a second use is refused', async () => {
    const { body: c } = await register()
    const { params, verifier } = await signInAs(editor, c.client_id, { write: false, publish: false, delete: false, media: false, entities: null })
    const code = params.get('code')!
    expect((await token({ grant_type: 'authorization_code', code, client_id: c.client_id, code_verifier: 'x'.repeat(43) })).body.error).toBe('invalid_grant')
    expect((await token({ grant_type: 'authorization_code', code, client_id: c.client_id, code_verifier: verifier })).status).toBe(200)
    expect((await token({ grant_type: 'authorization_code', code, client_id: c.client_id, code_verifier: verifier })).body.error).toBe('invalid_grant')
  })

  it('decides a request once, and only for the person signed in', async () => {
    const { body: c } = await register()
    const { id } = await signInAs(editor, c.client_id, { write: false, publish: false, delete: false, media: false, entities: null })
    expect((await editor.get(`/api/cms/_auth/oauth/${id}`)).status).toBe(410)
    expect((await anonymous().get(`/api/cms/_auth/oauth/${id}`)).status).toBe(401)
  })
})

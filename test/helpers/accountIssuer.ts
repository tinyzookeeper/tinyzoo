import { createHash, randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

/**
 * A stand-in for the tinyzoo account service (the issuer of docs/multi-tenant-plan.md 2.15):
 * a small HTTP server that answers the issuer's endpoints the way the contract says, for the
 * site-side suites (test/api/account.spec.ts, tenants-account.spec.ts) and for trying the
 * admin in a browser (scripts of .preview). The cloud app's real issuer can be compared
 * with it: what a site sends and expects is exactly what is implemented here.
 *
 *   GET  /oauth/authorize              the browser, sent by a site
 *   POST /oauth/token                  the site's server: the code for the person
 *   POST /oauth/sites                  the site's server (Basic): the person's websites
 *   POST /oauth/membership             the site's server (Basic): the role, or "no longer let in"
 *   GET  /.well-known/tinyzoo-account  the addresses of the above
 *   GET  /signin                       the stand-in's own sign-in page (not part of the contract)
 *   GET  /sites                        where `account` of the sites answer leads (a plain page)
 *
 * A person is signed in at the issuer when the browser carries the cookie `issuer_session=<sub>`
 * (set by /signin?as=<sub>, or put into a test's cookie jar with `sessionCookie`).
 *
 * Kept true to the real issuer (cloud/server/routes/oauth/*, cloud/server/utils/account.ts),
 * which `pnpm --filter tinyzoo-cloud e2e:signin` runs real sites against:
 *  - a person's id (`sub`) is a lower-case uuid; `sites` and `membership` answer 400 to anything else;
 *  - the code exchange makes the person KNOWN to the client, not listed: they are listed (in the
 *    switcher of the owner's other websites) once the client reported `membership` with
 *    `active: true`, and until it reports `active: false`;
 *  - `membership` about a person who never exchanged a code at that client is 404 `not_found`;
 *    a role that is left out, empty or not a short plain text leaves the role as it was;
 *    `active` left out means true, anything but a boolean is 400;
 *  - `sites` answers `role: null` for a website that has not said the role yet (or no longer
 *    lets the person in), and nothing at all for a person the asking website does not let in.
 * What stays simpler here: a client id is any text (the real one is a uuid), an owner is
 * named by a text, there are no rate limits, and the sign-in page is a list of people.
 */
export const ACCOUNT_CALLBACK_PATH = '/api/cms/_auth/account/callback'

export interface IssuerPerson {
  sub: string
  email: string
  email_verified: boolean
  name: string
  locale: string
}

export interface IssuerClient {
  clientId: string
  clientSecret: string
  /** The account that owns the client: a site only learns about websites of its own owner. */
  owner: string
  name: string
  /** The site's address (an origin, no trailing slash). */
  url: string
}

/** What the issuer keeps about a person at a client: the role the website last said (null until it has), whether it lets them in, and whether it ever said so (`confirmed`: only then is the person listed). */
export interface IssuerMember { role: string | null; active: boolean; confirmed: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/** The n-th person's id, in the form the issuer's ids have (a lower-case uuid). */
export const issuerSub = (n: number): string => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')

/** The role a website reports, as the issuer keeps it for showing: a short plain text, or null (cloud/shared/account.ts, memberRole). */
function memberRole(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const role = value.trim()
  if (!role || role.length > 60 || /[\u0000-\u001f\u007f<>]/.test(role)) return null
  return role
}

export interface IssuerCall {
  method: string
  path: string
  query: Record<string, string>
  /** The parsed JSON body of a POST (null when it was not JSON). */
  body: any
  /** The client id of the Basic authorization, when there was one. */
  basicClient: string | null
  status: number
}

export interface AccountIssuer {
  /** The issuer's address: what a site gets as `cms.auth.account.issuer`. */
  url: string
  people: Map<string, IssuerPerson>
  clients: Map<string, IssuerClient>
  /** `<clientId>\n<sub>` → what the site last said. */
  members: Map<string, IssuerMember>
  /** Every request the issuer got, oldest first. */
  calls: IssuerCall[]
  /**
   * How the issuer misbehaves, for the tests of a site that must cope:
   * `down` drops every connection; `tokenStatus` answers the token endpoint with that
   * status and `{ error: "invalid_grant" }`; `slowMs` waits before every answer to a
   * site's server (the POST endpoints); `garbage` answers them with text that is not JSON.
   */
  fault: { down?: boolean; tokenStatus?: number; slowMs?: number; garbage?: boolean }
  addPerson(person: Partial<IssuerPerson> & { sub: string; email: string }): IssuerPerson
  addClient(client: Partial<IssuerClient> & { clientId: string; url: string }): IssuerClient
  member(clientId: string, sub: string): IssuerMember | undefined
  /** The cookie that signs `sub` in at the issuer (for a test's cookie jar). */
  sessionCookie(sub: string): string
  /** The calls of one endpoint, optionally only those since `mark` (a length of `calls`). */
  callsTo(path: string, since?: number): IssuerCall[]
  /** Wait until `count` calls of an endpoint arrived since `mark` (reports are sent after the response). */
  waitForCalls(path: string, count: number, since?: number, timeoutMs?: number): Promise<IssuerCall[]>
  stop(): Promise<void>
}

interface Code { clientId: string; redirectUri: string; challenge: string; sub: string; expiresAt: number }

const memberKey = (clientId: string, sub: string) => clientId + '\n' + sub

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => resolve(body))
  })
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!))

export async function startAccountIssuer(): Promise<AccountIssuer> {
  const people = new Map<string, IssuerPerson>()
  const clients = new Map<string, IssuerClient>()
  const members = new Map<string, IssuerMember>()
  const codes = new Map<string, Code>()
  const calls: IssuerCall[] = []
  const fault: AccountIssuer['fault'] = {}
  let url = ''

  const send = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    const text = typeof body === 'string' ? body : JSON.stringify(body)
    res.writeHead(status, { 'content-type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json', 'cache-control': 'no-store', ...headers })
    res.end(text)
    return status
  }
  const redirect = (res: ServerResponse, to: string, headers: Record<string, string> = {}) => {
    res.writeHead(302, { location: to, 'cache-control': 'no-store', ...headers })
    res.end()
    return 302
  }
  const signedIn = (req: IncomingMessage): IssuerPerson | undefined => {
    const cookie = String(req.headers.cookie ?? '').split(';').map((c) => c.trim()).find((c) => c.startsWith('issuer_session='))
    return cookie ? people.get(decodeURIComponent(cookie.slice('issuer_session='.length))) : undefined
  }
  /** The client of a Basic authorization, or null when the id or the secret is wrong. */
  const basicClient = (req: IncomingMessage): IssuerClient | null => {
    const header = String(req.headers.authorization ?? '')
    if (!header.startsWith('Basic ')) return null
    const [id, ...rest] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(':')
    const client = clients.get(id ?? '')
    return client && client.clientSecret === rest.join(':') ? client : null
  }

  const server = createServer(async (req, res) => {
    const at = new URL(req.url ?? '/', url)
    const query = Object.fromEntries(at.searchParams)
    const raw = req.method === 'POST' ? await readBody(req) : ''
    let body: any = null
    try { body = raw ? JSON.parse(raw) : null } catch { /* not JSON */ }
    const basicId = String(req.headers.authorization ?? '').startsWith('Basic ')
      ? Buffer.from(String(req.headers.authorization).slice(6), 'base64').toString('utf8').split(':')[0] ?? null
      : null
    const call: IssuerCall = { method: req.method ?? 'GET', path: at.pathname, query, body, basicClient: basicId, status: 0 }
    calls.push(call)

    if (fault.down) { req.socket.destroy(); return }
    if (req.method === 'POST' && fault.slowMs) await new Promise((r) => setTimeout(r, fault.slowMs))
    if (req.method === 'POST' && fault.garbage) { call.status = send(res, 200, '<html>not the issuer</html>'); return }

    // ── the browser ──
    if (req.method === 'GET' && at.pathname === '/oauth/authorize') {
      const client = clients.get(query.client_id ?? '')
      // A wrong client or redirect address gets an error page, never a redirect.
      if (!client) { call.status = send(res, 400, '<h1>Unknown client</h1>'); return }
      if (query.redirect_uri !== client.url + ACCOUNT_CALLBACK_PATH) { call.status = send(res, 400, '<h1>Wrong redirect address</h1>'); return }
      const back = (params: Record<string, string>) => {
        const to = new URL(query.redirect_uri!)
        for (const [k, v] of Object.entries(params)) to.searchParams.set(k, v)
        if (query.state) to.searchParams.set('state', query.state)
        return to.toString()
      }
      if (query.response_type !== 'code' || !query.code_challenge || query.code_challenge_method !== 'S256') {
        call.status = redirect(res, back({ error: 'invalid_request' }))
        return
      }
      const person = signedIn(req)
      if (!person) {
        if (query.prompt === 'none') { call.status = redirect(res, back({ error: 'login_required' })); return }
        call.status = redirect(res, url + '/signin?return=' + encodeURIComponent(at.pathname + at.search))
        return
      }
      const code = randomBytes(24).toString('base64url')
      codes.set(code, { clientId: client.clientId, redirectUri: query.redirect_uri, challenge: query.code_challenge, sub: person.sub, expiresAt: Date.now() + 60_000 })
      call.status = redirect(res, back({ code }))
      return
    }
    if (req.method === 'GET' && at.pathname === '/signin') {
      // The stand-in's sign-in page: `?as=<sub>` signs that person in and goes back to `return`.
      const back = query.return && query.return.startsWith('/') && !query.return.startsWith('//') ? query.return : '/sites'
      if (query.as && people.has(query.as)) {
        call.status = redirect(res, url + back, { 'set-cookie': 'issuer_session=' + encodeURIComponent(query.as) + '; Path=/; HttpOnly; SameSite=Lax' })
        return
      }
      const list = [...people.values()].map((p) => '<li><a href="/signin?as=' + encodeURIComponent(p.sub) + '&return=' + encodeURIComponent(back) + '">' + escapeHtml(p.name || p.email) + ' (' + escapeHtml(p.email) + ')</a></li>').join('')
      call.status = send(res, 200, '<!doctype html><meta charset="utf-8"><title>Account (stand-in)</title><body style="font-family:system-ui;max-width:32rem;margin:15vh auto;padding:0 1rem"><h1>Sign in to your account</h1><p>The stand-in account service of the tests. Choose who you are:</p><ul>' + list + '</ul></body>')
      return
    }
    if (req.method === 'GET' && at.pathname === '/signout') {
      call.status = redirect(res, url + '/signin', { 'set-cookie': 'issuer_session=; Path=/; Max-Age=0' })
      return
    }
    if (req.method === 'GET' && at.pathname === '/sites') {
      const person = signedIn(req)
      call.status = send(res, 200, '<!doctype html><meta charset="utf-8"><title>All my websites (stand-in)</title><body style="font-family:system-ui;max-width:32rem;margin:15vh auto;padding:0 1rem"><h1>All my websites</h1><p>' + (person ? escapeHtml(person.email) : 'Not signed in') + '</p></body>')
      return
    }
    if (req.method === 'GET' && at.pathname === '/.well-known/tinyzoo-account') {
      call.status = send(res, 200, {
        issuer: url,
        authorization_endpoint: url + '/oauth/authorize',
        token_endpoint: url + '/oauth/token',
        sites_endpoint: url + '/oauth/sites',
        membership_endpoint: url + '/oauth/membership',
      })
      return
    }

    // ── a site's server ──
    if (req.method === 'POST' && at.pathname === '/oauth/token') {
      if (fault.tokenStatus) { call.status = send(res, fault.tokenStatus, { error: 'invalid_grant' }); return }
      const client = clients.get(String(body?.client_id ?? ''))
      if (!client || client.clientSecret !== body?.client_secret) { call.status = send(res, 401, { error: 'invalid_client' }); return }
      const code = codes.get(String(body?.code ?? ''))
      // The code works once, whatever comes of it.
      codes.delete(String(body?.code ?? ''))
      const verifier = String(body?.code_verifier ?? '')
      const ok = body?.grant_type === 'authorization_code' && code && code.expiresAt > Date.now()
        && code.clientId === client.clientId && code.redirectUri === body?.redirect_uri
        && createHash('sha256').update(verifier).digest('base64url') === code.challenge
      const person = ok ? people.get(code.sub) : undefined
      if (!person) { call.status = send(res, 400, { error: 'invalid_grant' }); return }
      // On success the person is known to the client. Listed they are once the site says it lets them in.
      if (!members.has(memberKey(client.clientId, person.sub))) members.set(memberKey(client.clientId, person.sub), { role: null, active: true, confirmed: false })
      call.status = send(res, 200, { user: { sub: person.sub, email: person.email, email_verified: person.email_verified, name: person.name, locale: person.locale } })
      return
    }
    if (req.method === 'POST' && (at.pathname === '/oauth/sites' || at.pathname === '/oauth/membership')) {
      const client = basicClient(req)
      if (!client) { call.status = send(res, 401, { error: 'invalid_client' }); return }
      const sub = body?.sub
      if (typeof sub !== 'string' || !UUID.test(sub)) { call.status = send(res, 400, { error: 'invalid_request' }); return }
      const own = members.get(memberKey(client.clientId, sub))
      if (at.pathname === '/oauth/membership') {
        if (body.active !== undefined && typeof body.active !== 'boolean') { call.status = send(res, 400, { error: 'invalid_request' }); return }
        // A website can only speak about people who signed in to it through the account.
        if (!own) { call.status = send(res, 404, { error: 'not_found' }); return }
        const active = body.active !== false
        members.set(memberKey(client.clientId, sub), { role: memberRole(body.role) ?? own.role, active, confirmed: own.confirmed || active })
        call.status = send(res, 200, { ok: true })
        return
      }
      // The clients of the SAME OWNER as the asking client that the person is a member of, or owns
      // (here an owner is named by the sub of the owning person). Nothing for a person the asking
      // website does not let in; the other websites are listed once they confirmed the person.
      const owns = client.owner === sub
      const shown = (m: IssuerMember | undefined) => !!m?.active && m.confirmed
      const sites = !(owns || own?.active) ? [] : [...clients.values()]
        .filter((c) => c.owner === client.owner && (c.clientId === client.clientId || owns || shown(members.get(memberKey(c.clientId, sub)))))
        .map((c) => {
          const m = members.get(memberKey(c.clientId, sub))
          return { id: c.clientId, name: c.name, url: c.url, role: m?.active ? m.role : null, current: c.clientId === client.clientId }
        })
      call.status = send(res, 200, { sites, account: url + '/sites' })
      return
    }
    call.status = send(res, 404, { error: 'not_found' })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = 'http://127.0.0.1:' + (server.address() as { port: number }).port

  const callsTo = (path: string, since = 0) => calls.slice(since).filter((c) => c.path === path)
  return {
    url, people, clients, members, calls, fault,
    addPerson(person) {
      const full: IssuerPerson = { email_verified: true, name: '', locale: 'en', ...person }
      people.set(full.sub, full)
      return full
    },
    addClient(client) {
      const full: IssuerClient = { clientSecret: 'secret-of-' + client.clientId + '-0123456789abcdef', owner: 'owner-1', name: client.clientId, ...client, url: client.url.replace(/\/+$/, '') }
      clients.set(full.clientId, full)
      return full
    },
    member: (clientId, sub) => members.get(memberKey(clientId, sub)),
    sessionCookie: (sub) => 'issuer_session=' + encodeURIComponent(sub),
    callsTo,
    async waitForCalls(path, count, since = 0, timeoutMs = 5000) {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        // Answered ones only: a call still being handled has no status yet.
        const got = callsTo(path, since).filter((c) => c.status > 0)
        if (got.length >= count) return got
        if (Date.now() > deadline) throw new Error('the issuer got ' + got.length + ' of ' + count + ' calls to ' + path + ' within ' + timeoutMs + ' ms')
        await new Promise((r) => setTimeout(r, 25))
      }
    },
    async stop() {
      server.closeAllConnections?.()
      await new Promise((resolve) => server.close(resolve))
    },
  }
}

// ── a browser for the round trip ───────────────────────────────────────────────

export interface Visit {
  /** Where the browser ended (the last address asked for). */
  url: string
  status: number
  body: string
  /** Every address on the way, the last one included. */
  chain: string[]
}

let visitor = 0

/**
 * What a browser does with a sign-in that crosses origins: follows the redirects and keeps
 * a cookie jar per origin (the site's session and flow cookie, the issuer's session).
 * `seen` keeps every response (status line, headers and body) for looking through afterwards.
 */
export class Browser {
  jars = new Map<string, Map<string, string>>()
  seen: string[] = []
  /** Each browser is its own visitor: the test servers trust one proxy hop, so this is the address their rate limits count. */
  ip = '198.19.' + (Math.floor(++visitor / 250) % 250) + '.' + (visitor % 250 + 1)

  cookies(origin: string): string {
    return [...(this.jars.get(new URL(origin).origin) ?? new Map()).entries()].map(([k, v]) => k + '=' + v).join('; ')
  }

  cookie(origin: string, name: string): string | undefined {
    return this.jars.get(new URL(origin).origin)?.get(name)
  }

  setCookie(origin: string, pair: string): void {
    const jar = this.jars.get(new URL(origin).origin) ?? new Map<string, string>()
    this.jars.set(new URL(origin).origin, jar)
    jar.set(pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1))
  }

  /** One request, no redirect followed. */
  async fetch(url: string, init: { method?: string; json?: unknown; headers?: Record<string, string> } = {}): Promise<{ status: number; headers: Headers; body: string; json: any }> {
    const origin = new URL(url).origin
    const headers: Record<string, string> = { accept: 'text/html,application/json', 'x-forwarded-for': this.ip, ...init.headers }
    const cookie = this.cookies(origin)
    if (cookie && !headers.cookie) headers.cookie = cookie
    let body: string | undefined
    if (init.json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(init.json) }
    const res = await fetch(url, { method: init.method ?? 'GET', headers, body, redirect: 'manual' })
    const jar = this.jars.get(origin) ?? new Map<string, string>()
    this.jars.set(origin, jar)
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';').map((p) => p.trim())
      const name = pair!.slice(0, pair!.indexOf('='))
      const value = pair!.slice(pair!.indexOf('=') + 1)
      const gone = !value || attrs.some((a) => /^max-age=0$/i.test(a) || (/^expires=/i.test(a) && Date.parse(a.slice(8)) < Date.now()))
      if (gone) jar.delete(name)
      else jar.set(name, value)
    }
    const text = await res.text()
    const lines: string[] = []
    res.headers.forEach((value, key) => { lines.push(key + ': ' + value) })
    this.seen.push(res.status + ' ' + url + '\n' + lines.join('\n') + '\n\n' + text)
    let json: any = null
    try { json = text ? JSON.parse(text) : null } catch { /* a page */ }
    return { status: res.status, headers: res.headers, body: text, json }
  }

  /** Open an address and follow its redirects, as a browser's address bar does. */
  async visit(url: string, max = 12): Promise<Visit> {
    const chain: string[] = []
    let at = url
    for (let hop = 0; hop <= max; hop++) {
      chain.push(at)
      const res = await this.fetch(at)
      const location = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && location) { at = new URL(location, at).toString(); continue }
      return { url: at, status: res.status, body: res.body, chain }
    }
    throw new Error('too many redirects:\n' + chain.join('\n'))
  }
}

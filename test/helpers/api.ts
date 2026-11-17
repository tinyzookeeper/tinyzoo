import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inject } from 'vitest'
import pg from 'pg'

export interface ApiResponse<T = any> {
  status: number
  headers: Headers
  body: T
}

/**
 * What a browser's cookie jar does with a response's `Set-Cookie` lines: a cookie of the same
 * name is replaced, one that is emptied or expired (Max-Age=0) is dropped, the others stay.
 * (An admin page also sets the sidebar's cookie; that must not cost the client its session.)
 */
function mergeCookies(jar: string, setCookie: string[]): string {
  const cookies = new Map(jar.split('; ').filter(Boolean).map((c) => [c.slice(0, c.indexOf('=')), c] as const))
  for (const line of setCookie) {
    const [pair, ...attrs] = line.split(';').map((p) => p.trim())
    const name = pair!.slice(0, pair!.indexOf('='))
    const value = pair!.slice(pair!.indexOf('=') + 1)
    const gone = !value || attrs.some((a) => /^max-age=0$/i.test(a) || (/^expires=/i.test(a) && Date.parse(a.slice(8)) < Date.now()))
    if (gone) cookies.delete(name)
    else cookies.set(name, pair!)
  }
  return [...cookies.values()].join('; ')
}

/**
 * A tiny HTTP client for the test server that keeps a session cookie, so one
 * instance = one signed-in (or anonymous) browser.
 */
let visitor = 0

export class Client {
  cookie = ''
  /**
   * Each client is its own visitor: the test server trusts one proxy hop (like
   * production behind an ingress), so this X-Forwarded-For entry is the client IP
   * its rate limits count against.
   */
  ip = `198.18.${Math.floor(++visitor / 250) % 250}.${visitor % 250 + 1}`
  constructor(readonly baseURL = inject('baseURL')) {}

  async request<T = any>(method: string, path: string, init: { json?: unknown; body?: BodyInit; headers?: Record<string, string> } = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { 'accept': 'application/json', 'x-forwarded-for': this.ip, ...init.headers }
    if (this.cookie) headers.cookie = this.cookie
    let body = init.body
    if (init.json !== undefined) {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(init.json)
    }
    const res = await fetch(this.baseURL + path, { method, headers, body, redirect: 'manual' })
    const setCookie = res.headers.getSetCookie()
    if (setCookie.length) this.cookie = mergeCookies(this.cookie, setCookie)
    const text = await res.text()
    let parsed: any = text
    try { parsed = text ? JSON.parse(text) : null }
    catch { /* not JSON (e.g. a TS file or HTML) */ }
    return { status: res.status, headers: res.headers, body: parsed }
  }

  get<T = any>(path: string, headers?: Record<string, string>) { return this.request<T>('GET', path, { headers }) }
  post<T = any>(path: string, json?: unknown) { return this.request<T>('POST', path, { json }) }
  patch<T = any>(path: string, json?: unknown) { return this.request<T>('PATCH', path, { json }) }
  put<T = any>(path: string, json?: unknown) { return this.request<T>('PUT', path, { json }) }
  delete<T = any>(path: string) { return this.request<T>('DELETE', path) }

  async upload<T = any>(path: string, file: { name: string; type: string; data: Uint8Array }) {
    const form = new FormData()
    form.append('file', new Blob([file.data as Uint8Array<ArrayBuffer>], { type: file.type }), file.name)
    return this.request<T>('POST', path, { body: form })
  }
}

/** The seeded accounts (see test/setup/server.ts): one per role. */
export const accounts = () => inject('accounts')

/** A client signed in as the seeded account for `role` (shares that account's session). */
export async function signIn(role: 'admin' | 'editor' | 'author'): Promise<Client> {
  const c = new Client()
  c.cookie = inject('accounts')[role].cookie
  return c
}

/** Sign in with email + password, as a browser would. Throws unless it succeeds. */
export async function login(email: string, password: string): Promise<Client> {
  const c = new Client()
  const res = await c.post('/api/cms/_auth/login', { email, password })
  if (res.status !== 200) throw new Error(`login ${email} failed: ${res.status} ${JSON.stringify(res.body)}`)
  return c
}

/**
 * A fresh account with the given role, invited by the seeded admin and accepted
 * (signed in). For specs that sign out, change passwords or disable people, so the
 * shared seeded sessions stay valid.
 */
let seq = 0
export async function newAccount(role: 'admin' | 'editor' | 'author', password = 'a long enough password'): Promise<{ client: Client; id: string; email: string; password: string }> {
  const admin = await signIn('admin')
  const email = `${role}-${Date.now().toString(36)}-${seq++}@test.local`
  const invited = await admin.post('/api/cms/_users', { email, role })
  if (invited.status !== 201) throw new Error(`invite: ${invited.status} ${JSON.stringify(invited.body)}`)
  const client = new Client()
  const accepted = await client.post('/api/cms/_auth/accept', { token: tokenOf(invited.body.inviteUrl), name: `Person ${seq}`, password })
  if (accepted.status !== 200) throw new Error(`accept: ${accepted.status} ${JSON.stringify(accepted.body)}`)
  return { client, id: accepted.body.user.id, email, password }
}

/** The secret at the end of an invite/reset link. */
export const tokenOf = (url: string) => String(url).split('/').pop()!

/** Emails the server wrote (file transport), newest first, optionally only to `to`. */
export function sentMail(to?: string): { to: string; subject: string; text: string; html: string }[] {
  const dir = inject('mailDir')
  return readdirSync(dir).sort().reverse()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .filter((m) => !to || m.to === to)
}

/** Wait for an email to `to` matching `match` (some are sent after the response, e.g. password resets). */
export async function waitForMail(to: string, match: (m: { subject: string; text: string }) => boolean = () => true, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const mail = sentMail(to).find(match)
    if (mail) return mail
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`no email to ${to} within ${timeoutMs}ms`)
}

/** The first link in an email's text. */
export const linkIn = (text: string) => /https?:\/\/\S+/.exec(text)?.[0] ?? ''

export const anonymous = () => new Client()

/** Direct database access for arranging state and asserting on what the API wrote. */
export function testDb(): pg.Pool {
  return new pg.Pool({ connectionString: inject('databaseUrl'), max: 2 })
}

/** Tables the seeded accounts live in — never truncated, so the shared sessions stay valid. */
const KEEP = new Set(['cms_users', 'cms_tokens', 'cms_state'])

/**
 * The server's background tasks run every few seconds in the test server (see
 * test/setup/server.ts) and each holds an advisory lock for the whole of its transaction,
 * which reads or deletes in several tables one after the other: the scheduler
 * (`cmsScheduler.ts`, 72_011_004) and retention (`cmsRetention.ts`, 72_011_040). They only
 * *try* for the lock, so a second runner skips its round.
 */
const BACKGROUND_TASK_LOCKS = [72_011_004, 72_011_040]

/**
 * Empty every content table (keeps accounts and the migrations journal). Call in beforeEach/beforeAll.
 *
 * TRUNCATE takes its tables' locks one at a time, in the order it is given them. A task
 * that holds one of those tables and then reaches for another that TRUNCATE already holds
 * is a deadlock (Postgres ends one of the two: `deadlock detected`, now and then, in
 * whichever spec truncated at that moment — retention does the forms' table first and the
 * audit log second). So the truncate waits for any running task first, by taking the same
 * advisory locks the tasks use, inside the same transaction: a task that is running
 * finishes, one that starts meanwhile finds the lock taken and skips its round.
 */
export async function truncateAll(pool: pg.Pool, options: { strict?: boolean } = {}): Promise<void> {
  // A query of the server that joins several tables (the heartbeats' access checks run
  // every second in the test server) can still meet the truncate halfway through taking
  // its locks: Postgres ends one of the two. The truncate is the one to try again; nothing
  // of it was applied. `strict` (truncate.spec, which tests exactly this) does not retry.
  for (let attempt = 1; ; attempt++) {
    try { return await truncateOnce(pool) }
    catch (err) {
      if (options.strict || (err as { code?: string }).code !== '40P01' || attempt >= 5) throw err
      await new Promise((r) => setTimeout(r, 50 * attempt))
    }
  }
}

async function truncateOnce(pool: pg.Pool): Promise<void> {
  const { rows: all } = await pool.query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`,
  )
  const rows = all.filter((r) => !KEEP.has(r.tablename))
  if (!rows.length) return
  const client = await pool.connect()
  try {
    await client.query('begin')
    // One order for everybody who takes both (the tasks never wait for a lock, so none of them can be on the other end).
    for (const lock of BACKGROUND_TASK_LOCKS) await client.query('select pg_advisory_xact_lock($1)', [lock])
    await client.query(`truncate ${rows.map((r) => `"${r.tablename}"`).join(', ')} restart identity cascade`)
    await client.query('commit')
  }
  catch (err) {
    await client.query('rollback').catch(() => {})
    throw err
  }
  finally { client.release() }
}

/** A 1×1 PNG (valid header, so image-size can read its dimensions). */
export const PNG_1x1 = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
))

/** A rich-text doc with optional embedded image (carries the media id like the editor does). */
export function doc(text: string, image?: { mediaId: string; src: string }) {
  const content: any[] = [{ type: 'paragraph', content: [{ type: 'text', text }] }]
  if (image) content.push({ type: 'image', attrs: { src: image.src, mediaId: image.mediaId, alt: '' } })
  return { type: 'doc', content }
}

export interface ReceivedHook { file: string; path: string; headers: Record<string, string>; body: string; failed: boolean; json: any }

/** Publish webhooks the test receiver got (oldest first), after `since` (a file name from an earlier call). */
export function receivedHooks(since = ''): ReceivedHook[] {
  const dir = inject('hooksDir')
  return readdirSync(dir).sort().filter((f) => f > since).map((file) => {
    const h = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    return { file, ...h, json: JSON.parse(h.body) }
  })
}

/** The newest received webhook's file name: pass it to receivedHooks/waitForHooks to see only later ones. */
export const hooksMark = () => receivedHooks().at(-1)?.file ?? ''

/** Wait until `match` holds for the hooks received after `since`. */
export async function waitForHooks(since: string, match: (hooks: ReceivedHook[]) => boolean, timeoutMs = 10_000): Promise<ReceivedHook[]> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const hooks = receivedHooks(since)
    if (match(hooks)) return hooks
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`webhooks did not arrive within ${timeoutMs}ms: ${JSON.stringify(receivedHooks(since).map((h) => [h.path, h.json.type]))}`)
}

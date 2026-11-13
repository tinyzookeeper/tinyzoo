import { inject } from 'vitest'
import pg from 'pg'

export interface ApiResponse<T = any> {
  status: number
  headers: Headers
  body: T
}

/**
 * A tiny HTTP client for the test server that keeps a session cookie, so one
 * instance = one signed-in (or anonymous) browser.
 */
export class Client {
  cookie = ''
  constructor(readonly baseURL = inject('baseURL')) {}

  async request<T = any>(method: string, path: string, init: { json?: unknown; body?: BodyInit; headers?: Record<string, string> } = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { accept: 'application/json', ...init.headers }
    if (this.cookie) headers.cookie = this.cookie
    let body = init.body
    if (init.json !== undefined) {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(init.json)
    }
    const res = await fetch(this.baseURL + path, { method, headers, body, redirect: 'manual' })
    const setCookie = res.headers.getSetCookie()
    if (setCookie.length) this.cookie = setCookie.map((c) => c.split(';')[0]).join('; ')
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

/** Demo accounts the playground ships with (`playground/server/utils/users.ts`). */
export const DEMO = {
  admin: { id: '11111111-1111-4111-8111-111111111111', email: 'admin@demo.test', password: 'admin' },
  editor: { id: '22222222-2222-4222-8222-222222222222', email: 'editor@demo.test', password: 'editor' },
} as const

export async function signIn(who: keyof typeof DEMO): Promise<Client> {
  const c = new Client()
  const res = await c.post('/api/_cms/login', { email: DEMO[who].email, password: DEMO[who].password })
  if (res.status !== 200) throw new Error(`login as ${who} failed: ${res.status} ${JSON.stringify(res.body)}`)
  return c
}

export const anonymous = () => new Client()

/** Direct database access for arranging state and asserting on what the API wrote. */
export function testDb(): pg.Pool {
  return new pg.Pool({ connectionString: inject('databaseUrl'), max: 2 })
}

/** Empty every content table (keeps the migrations journal). Call in beforeEach/beforeAll. */
export async function truncateAll(pool: pg.Pool): Promise<void> {
  const { rows } = await pool.query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public'`,
  )
  if (!rows.length) return
  await pool.query(`truncate ${rows.map((r) => `"${r.tablename}"`).join(', ')} restart identity cascade`)
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

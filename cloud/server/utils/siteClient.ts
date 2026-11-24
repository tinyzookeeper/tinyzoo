// A small client for a website's admin API that keeps the session cookie between requests,
// as tinyzoo's own seed does (packages/cms/cli/seed.ts). The admin API takes only the cookie;
// state-changing requests are JSON, and carry no Sec-Fetch-Site (a server is not a browser).

export class SiteHttpError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) { super(message) }
}

export class SiteClient {
  private cookie = ''
  readonly base: string
  constructor(base: string) { this.base = base.replace(/\/+$/, '') }

  async request<T = any>(method: string, path: string, body?: unknown, opts: { headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json', origin: this.base, ...opts.headers }
    if (this.cookie) headers.cookie = this.cookie
    let payload: string | undefined
    if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body) }
    const res = await fetch(this.base + path, { method, headers, body: payload, redirect: 'manual', signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000) })
    const set = res.headers.getSetCookie?.() ?? []
    if (set.length) this.cookie = set.map((c) => c.split(';')[0]).join('; ')
    const text = await res.text()
    let json: any = null
    try { json = text ? JSON.parse(text) : null } catch { /* not JSON */ }
    if (res.status >= 300) {
      const why = json?.statusMessage ?? json?.message ?? text.slice(0, 200)
      throw new SiteHttpError(`${method} ${path} → ${res.status} ${why}`.trim(), res.status, json)
    }
    return json as T
  }

  get<T = any>(path: string, opts?: { headers?: Record<string, string>; timeoutMs?: number }) { return this.request<T>('GET', path, undefined, opts) }
  post<T = any>(path: string, body?: unknown) { return this.request<T>('POST', path, body) }
  put<T = any>(path: string, body?: unknown) { return this.request<T>('PUT', path, body) }

  /** Sign in with the admin's own sign-in; the cookie is kept for what follows. */
  async signIn(email: string, password: string): Promise<void> {
    await this.post('/api/cms/_auth/login', { email, password })
  }
}

/** Whether a site answers its readiness check. */
export async function siteIsReady(base: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/api/health/ready`, { signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' })
    return res.status === 200
  }
  catch {
    return false
  }
}

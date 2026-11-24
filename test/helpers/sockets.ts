import WebSocket from 'ws'
import * as Y from 'yjs'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap'
import type { Client } from './api'

/**
 * The two admin sockets as a browser tab opens them, for specs that need them on more than
 * one server or site (the two-site suite): the realtime hub (/api/cms/_live) and shared
 * editing (/api/cms/_collab/socket). The same clients as live.spec.ts and collab.spec.ts
 * use, taking the address and the session from a `Client`.
 */

const wsUrl = (base: string, path: string) => `${base.replace(/^http/, 'ws')}${path}`

/** A realtime socket as a browser tab would open it; collects what the server sends. */
export class LiveTab {
  ws: WebSocket
  messages: any[] = []
  /** Everything received, never taken out by `next` (for "this was never sent" assertions). */
  all: any[] = []
  closed: { code: number } | null = null
  constructor(readonly client: Client, headers: Record<string, string> = {}) {
    const base = client.baseURL
    this.ws = new WebSocket(wsUrl(base, '/api/cms/_live'), {
      headers: { origin: base, ...(client.cookie ? { cookie: client.cookie } : {}), ...headers },
    })
    this.ws.on('message', (d) => {
      const m = JSON.parse(String(d))
      this.messages.push(m)
      this.all.push(m)
    })
    this.ws.on('close', (code) => { this.closed = { code } })
  }

  opened(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve()
      this.ws.once('open', () => resolve())
      this.ws.once('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)))
      this.ws.once('error', reject)
    })
  }

  send(msg: unknown) { this.ws.send(JSON.stringify(msg)) }

  async next(match: (m: any) => boolean, timeoutMs = 5000): Promise<any> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const i = this.messages.findIndex(match)
      if (i >= 0) return this.messages.splice(i, 1)[0]
      await new Promise((r) => setTimeout(r, 25))
    }
    throw new Error(`no matching message in ${timeoutMs}ms; got ${JSON.stringify(this.messages)}`)
  }

  /** The latest presence for a topic once `match` holds for it. */
  presence(topic: string, match: (people: any[]) => boolean) {
    return this.next((m) => m.type === 'presence' && m.topic === topic && match(m.people))
  }

  /** Resolves once the socket is closed (by either side). */
  async ended(timeoutMs = 5000): Promise<{ code: number }> {
    const deadline = Date.now() + timeoutMs
    while (!this.closed && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25))
    if (!this.closed) throw new Error(`the socket was still open after ${timeoutMs}ms`)
    return this.closed
  }

  close() { this.ws.close() }
}

/** A browser tab joining a shared document, as the admin does. */
export class Collaborator {
  doc = new Y.Doc()
  socket: HocuspocusProviderWebsocket
  provider: HocuspocusProvider
  failed: string | null = null
  constructor(client: Client, session: { name: string; epoch: string }) {
    const headers = { origin: client.baseURL, cookie: client.cookie }
    class AuthedWebSocket extends WebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols, { headers })
        // A refused upgrade (401/403) surfaces as an error event: the provider sees the close.
        this.on('error', () => {})
      }
    }
    this.socket = new HocuspocusProviderWebsocket({ url: wsUrl(client.baseURL, '/api/cms/_collab/socket'), WebSocketPolyfill: AuthedWebSocket, maxAttempts: 1, autoConnect: false })
    this.provider = new HocuspocusProvider({
      websocketProvider: this.socket,
      name: session.name,
      document: this.doc,
      token: session.epoch,
      onAuthenticationFailed: ({ reason }) => { this.failed = reason || 'denied' },
    })
    this.provider.attach()
    // A refused connection rejects; the test reads that from `synced()`.
    this.socket.connect().catch(() => {})
  }

  async synced(timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs
    while (!this.provider.isSynced && !this.failed && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25))
    if (this.failed) throw new Error(`refused: ${this.failed}`)
    if (!this.provider.isSynced) throw new Error('not synced')
  }

  text(field = 'body') { return JSON.stringify(yXmlFragmentToProsemirrorJSON(this.doc.getXmlFragment(field))) }

  /** Append a paragraph to a field, as typing would. */
  type(text: string, field = 'body') {
    const p = new Y.XmlElement('paragraph')
    p.insert(0, [new Y.XmlText(text)])
    this.doc.getXmlFragment(field).push([p])
  }

  /** The names on the cursors this tab sees (its own included, once it set one). */
  cursors(): string[] {
    return [...this.provider.awareness!.getStates().values()].map((st: any) => st.user?.name).filter(Boolean)
  }

  close() {
    this.provider.destroy()
    this.socket.destroy()
  }
}

/**
 * The answer to a WebSocket upgrade on `path` of `base`: 101 when the socket opens (it is
 * closed again at once), else the HTTP status the server refused it with; 0 when the
 * connection itself failed. `headers` as a browser would send them (origin, cookie).
 */
export function upgradeStatus(base: string, path: string, headers: Record<string, string> = {}): Promise<number> {
  return new Promise<number>((resolve) => {
    const ws = new WebSocket(wsUrl(base, path), { headers })
    const timer = setTimeout(() => { ws.terminate(); resolve(0) }, 5000)
    const done = (status: number) => { clearTimeout(timer); resolve(status) }
    ws.on('unexpected-response', (_req, res) => { res.resume(); done(res.statusCode ?? 0) })
    ws.on('open', () => { ws.close(); done(101) })
    ws.on('error', () => done(0))
  })
}

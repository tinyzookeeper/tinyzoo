import { createHash } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createRequire } from 'node:module'

// aws4fetch is a dependency of the tinyzoo package, not of the workspace root.
export const { AwsClient } = createRequire(new URL('../../packages/cms/package.json', import.meta.url))('aws4fetch') as { AwsClient: new (opts: Record<string, unknown>) => any }

/**
 * A small S3 on localhost (path-style, one set of credentials) for the storage tests: PUT,
 * GET and HEAD with ranges and entity tags, DELETE, and a private bucket — every request
 * must carry a SigV4 signature (header or query string) that checks out, otherwise 403.
 * Objects can also be *generated* (a byte pattern of any size that is produced as it is
 * read), to push gigabytes through a server without holding them anywhere.
 */
export interface FakeS3 {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  /** Requests as the store saw them (method, path, whether the signature was in the query). */
  requests: { method: string; path: string; range?: string; ifNoneMatch?: string; query: boolean; ok: boolean }[]
  objects: Map<string, { body?: Buffer; size: number; type: string; etag: string }>
  /** Answer the next `count` object requests (default: all of them) with this status, e.g. 500. 0 turns it off. */
  failWith(status: number, count?: number): void
  /** An object of `size` bytes whose byte at offset i is `i % 251`; never in memory. */
  putGenerated(key: string, size: number, type: string): void
  /** Requests whose generated body is being sent right now. */
  inFlight(): number
  /** Bytes of generated bodies written to sockets so far. */
  bytesSent(): number
  close(): Promise<void>
}

const patternChunk = (from: number, to: number) => {
  const out = Buffer.allocUnsafe(to - from)
  for (let i = 0; i < out.length; i++) out[i] = (from + i) % 251
  return out
}

export async function startFakeS3(opts: { bucket?: string } = {}): Promise<FakeS3> {
  const bucket = opts.bucket ?? 'media'
  const accessKeyId = 'AKIAFAKEFAKEFAKE'
  const secretAccessKey = 'fake-secret-access-key-never-in-a-response'
  const region = 'us-east-1'
  const objects: FakeS3['objects'] = new Map()
  const requests: FakeS3['requests'] = []
  let failStatus = 0
  let failLeft = 0
  let inFlight = 0
  let bytesSent = 0

  const verify = async (req: IncomingMessage, body: Buffer, url: URL): Promise<{ ok: boolean; query: boolean }> => {
    const signer = new AwsClient({ accessKeyId, secretAccessKey, region, service: 's3' })
    const query = url.searchParams.has('X-Amz-Signature')
    if (query) {
      const given = url.searchParams.get('X-Amz-Signature')!
      const unsigned = new URL(url)
      unsigned.searchParams.delete('X-Amz-Signature')
      for (const k of ['X-Amz-Algorithm', 'X-Amz-Credential', 'X-Amz-Date', 'X-Amz-SignedHeaders']) unsigned.searchParams.delete(k)
      const signed = await signer.sign(unsigned.toString(), { method: req.method, aws: { signQuery: true, datetime: url.searchParams.get('X-Amz-Date')! } })
      const expires = Number(url.searchParams.get('X-Amz-Expires'))
      const when = url.searchParams.get('X-Amz-Date')!
      const issued = Date.UTC(+when.slice(0, 4), +when.slice(4, 6) - 1, +when.slice(6, 8), +when.slice(9, 11), +when.slice(11, 13), +when.slice(13, 15))
      const live = Number.isFinite(expires) && expires > 0 && Date.now() <= issued + expires * 1000
      return { ok: live && new URL(signed.url).searchParams.get('X-Amz-Signature') === given, query }
    }
    const auth = String(req.headers.authorization ?? '')
    const m = /^AWS4-HMAC-SHA256 Credential=([^/]+)\/\d{8}\/([^/]+)\/s3\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]{64})$/.exec(auth)
    if (!m || m[1] !== accessKeyId || m[2] !== region) return { ok: false, query }
    const headers: Record<string, string> = {}
    for (const name of m[3]!.split(';')) if (name !== 'host') headers[name] = String(req.headers[name] ?? '')
    const signed = await signer.sign(url.toString(), { method: req.method, headers, body: body.length ? body : undefined, aws: { datetime: String(req.headers['x-amz-date']) } })
    return { ok: signed.headers.get('authorization') === auth, query }
  }

  const send = (res: ServerResponse, status: number, text = '') => {
    res.writeHead(status, { 'content-type': 'application/xml' })
    res.end(text)
  }

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url!, `http://${req.headers.host}`)
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const body = Buffer.concat(chunks)
    const { ok, query } = await verify(req, body, url)
    requests.push({ method: req.method!, path: url.pathname, range: req.headers.range as string | undefined, ifNoneMatch: req.headers['if-none-match'] as string | undefined, query, ok })
    if (!ok) return send(res, 403, '<Error><Code>SignatureDoesNotMatch</Code></Error>')
    const prefix = `/${bucket}/`
    if (!url.pathname.startsWith(prefix)) return send(res, 404, '<Error><Code>NoSuchBucket</Code></Error>')
    const key = decodeURIComponent(url.pathname.slice(prefix.length))
    if (failLeft !== 0 && failStatus) {
      if (failLeft > 0) failLeft--
      return send(res, failStatus, '<Error><Code>InternalError</Code></Error>')
    }
    if (req.method === 'PUT') {
      objects.set(key, { body, size: body.length, type: String(req.headers['content-type'] ?? 'binary/octet-stream'), etag: `"${createHash('md5').update(body).digest('hex')}"` })
      return send(res, 200)
    }
    if (req.method === 'DELETE') {
      objects.delete(key)
      return send(res, 204)
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405)
    const obj = objects.get(key)
    if (!obj) return send(res, 404, '<Error><Code>NoSuchKey</Code></Error>')
    const base = { 'content-type': obj.type, etag: obj.etag, 'accept-ranges': 'bytes', 'last-modified': 'Mon, 02 Nov 2026 10:00:00 GMT' }
    if (String(req.headers['if-none-match'] ?? '').split(',').map((t) => t.trim()).includes(obj.etag)) {
      res.writeHead(304, { etag: obj.etag })
      return res.end()
    }
    let start = 0
    let end = obj.size - 1
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''))
    if (range && (range[1] || range[2])) {
      start = range[1] ? Number(range[1]) : Math.max(0, obj.size - Number(range[2]))
      end = range[1] && range[2] ? Math.min(Number(range[2]), obj.size - 1) : obj.size - 1
      if (start >= obj.size || start > end) {
        // Like S3 itself: no Content-Range on a 416 (the size has to be asked for with a HEAD).
        res.writeHead(416, { 'content-type': 'application/xml' })
        return res.end('<Error><Code>InvalidRange</Code></Error>')
      }
      res.writeHead(206, { ...base, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${obj.size}` })
    }
    else res.writeHead(200, { ...base, 'content-length': obj.size })
    if (req.method === 'HEAD') return res.end()
    if (obj.body) return res.end(obj.body.subarray(start, end + 1))
    // Generated: produced chunk by chunk, waiting for the reader (so nothing piles up here either).
    inFlight++
    res.on('close', () => { inFlight-- })
    for (let at = start; at <= end && !res.destroyed; at += 1 << 20) {
      const part = patternChunk(at, Math.min(end + 1, at + (1 << 20)))
      bytesSent += part.length
      if (!res.write(part)) {
        await new Promise<void>((done) => {
          const finish = () => { res.off('drain', finish); res.off('close', finish); done() }
          res.on('drain', finish)
          res.on('close', finish)
        })
      }
    }
    res.end()
  }

  const server: Server = createServer((req, res) => { handle(req, res).catch(() => { res.destroy() }) })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const port = (server.address() as { port: number }).port
  return {
    endpoint: `http://127.0.0.1:${port}`, bucket, accessKeyId, secretAccessKey, region, requests, objects,
    failWith(status, count = -1) { failStatus = status; failLeft = status ? count : 0 },
    putGenerated(key, size, type) { objects.set(key, { size, type, etag: `"generated-${size}"` }) },
    inFlight: () => inFlight,
    bytesSent: () => bytesSent,
    close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()) }),
  }
}

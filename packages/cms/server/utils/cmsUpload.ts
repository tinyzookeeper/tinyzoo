// The Fastify team's maintained fork of busboy (also what undici, Node's fetch, uses); types built in.
import Busboy, { type BusboyInstance } from '@fastify/busboy'
import { createHash, randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

// Receiving an upload without holding it in memory.
//
// The multipart body is parsed as it arrives and the file part goes straight to a temp
// file on disk (while its SHA-256 and first bytes are taken on the way). From there the
// storage driver moves or streams it on, so a 100 MB video costs the process a few
// buffers, not a few hundred megabytes — the pods have 256 MiB.
//
// The size cap counts the bytes that really arrive, not the Content-Length header: a
// chunked body has none, and a client may lie. The moment the cap is crossed the
// upload is refused with 413 and nothing more is read into the process.

/** What the sniffers look at: the first bytes of the file (a JPEG's size can sit after a large EXIF block). */
export const UPLOAD_HEAD_BYTES = 512 * 1024
/** Multipart framing (boundaries, part headers, the small fields) on top of the file's own bytes. */
const FRAMING_BYTES = 1024 * 1024

export interface ReceivedFile {
  /** The name the browser sent (display only: never used as a path). */
  filename: string
  /** The type the browser sent, lower case. */
  type: string
  /** Where the bytes are, in the storage driver's temp folder. The caller moves or removes it. */
  path: string
  size: number
  sha256: string
  /** The first bytes (up to UPLOAD_HEAD_BYTES). */
  head: Buffer
}

export interface ReceivedUpload {
  file: ReceivedFile | null
  /** Text fields (folder, library), each short. */
  fields: Record<string, string>
}

const tooLarge = (maxBytes: number) => createError({
  statusCode: 413,
  statusMessage: 'File too large (max ' + Math.round(maxBytes / 1024 / 1024) + 'MB)',
  data: { code: 'file_too_large', maxMb: Math.round(maxBytes / 1024 / 1024) },
})

// Process-wide: one temp folder is shared by every site.
const swept = cmsProcessWide({ done: false }, 'one shared temp folder, swept once')
/** Leftovers of uploads a crashed process never finished (once per process; an hour old at least). */
function sweepOldTemp(dir: string) {
  if (swept.done) return
  swept.done = true
  readdir(dir).then((names) => Promise.all(names.filter((n) => n.endsWith('.part')).map(async (n) => {
    const file = join(dir, n)
    const info = await stat(file).catch(() => null)
    if (info && Date.now() - info.mtimeMs > 60 * 60 * 1000) await unlink(file).catch(() => {})
  }))).catch(() => {})
}

const tempDirWarned = cmsProcessWide({ done: false }, 'one log line per process')

/**
 * Creates the folder uploads are staged in. A container with a read-only filesystem and
 * no writable /tmp (some hosts run every app that way) fails here on the first upload;
 * the log then says what to set instead of a bare ENOENT/EROFS, once per process.
 */
async function prepareTempDir(tempDir: string): Promise<void> {
  try {
    await mkdir(tempDir, { recursive: true })
  }
  catch (err: any) {
    if (!tempDirWarned.done) {
      tempDirWarned.done = true
      console.error(`[cms] uploads are staged on disk, but ${tempDir} cannot be created (${err?.code ?? err}). `
        + 'The filesystem is probably read-only: mount a writable volume and point TMPDIR at it '
        + '(or at /dev/shm, which counts against the memory limit, for small files only). '
        + 'See https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/deploying.md#media')
    }
    throw createError({ statusCode: 500, statusMessage: 'The server has no writable folder for uploads' })
  }
}

/**
 * Read the multipart upload of `event`: the first part named `file` with a filename is
 * written to `tempDir`, the small text fields are returned. Throws 413 when more than
 * `maxBytes` of file (or, with the framing, more than `maxBytes` + 1 MB of body) arrive,
 * 400 for a body that is not multipart. Removes its temp file on every failure.
 */
export async function receiveUpload(event: any, opts: { maxBytes: number; tempDir: string }): Promise<ReceivedUpload> {
  const req = event.node.req
  const { maxBytes, tempDir } = opts
  await prepareTempDir(tempDir)
  sweepOldTemp(tempDir)

  let parser: BusboyInstance
  try {
    parser = Busboy({
      headers: req.headers,
      // Field values and file names without a charset of their own are UTF-8.
      defCharset: 'utf8',
      // One file, a handful of short fields; a byte over the cap shows as the file's 'limit'.
      limits: { files: 1, fields: 12, fieldSize: 4096, parts: 16, fileSize: maxBytes + 1 },
    })
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded (expected multipart field "file")' })
  }

  return new Promise<ReceivedUpload>((resolve, reject) => {
    const fields: Record<string, string> = {}
    let received: ReceivedFile | null = null
    let tempPath = ''
    let writing: Promise<void> | null = null
    let finished = false
    let total = 0

    const stop = (err: unknown) => {
      if (finished) return
      finished = true
      req.removeListener('data', count)
      req.unpipe(parser)
      // Answer now; the rest of the body is read and thrown away by Node (or the socket
      // is closed after the answer), never kept: see the Connection header below.
      if (!event.node.res.headersSent) event.node.res.setHeader('Connection', 'close')
      const cleanup = writing ? writing.catch(() => {}) : Promise.resolve()
      cleanup.then(() => (tempPath ? unlink(tempPath).catch(() => {}) : undefined)).finally(() => reject(err))
      // The temp file may still be open: end its stream first (the pipeline ends with the error below).
      parser.destroy()
    }

    // Counts what arrives on the socket, whatever the framing.
    const cap = maxBytes + FRAMING_BYTES
    const count = (chunk: Buffer) => {
      total += chunk.length
      if (total > cap) stop(tooLarge(maxBytes))
    }

    parser.on('field', (name: string, value: string, nameTruncated: boolean, valueTruncated: boolean) => {
      if (valueTruncated || nameTruncated) return stop(createError({ statusCode: 400, statusMessage: 'A form field is too long' }))
      fields[name] = value
    })

    parser.on('file', (name: string, stream: NodeJS.ReadableStream & { resume(): void }, filename: string, _encoding: string, mimeType: string) => {
      if (name !== 'file' || !filename || received || writing) {
        stream.resume() // a second or unexpected file: read past it
        return
      }
      tempPath = join(tempDir, randomUUID() + '.part')
      const hash = createHash('sha256')
      const head: Buffer[] = []
      let headBytes = 0
      let size = 0
      const meter = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          size += chunk.length
          // The cap is ours, not the parser's: refuse the moment the file passes it.
          if (size > maxBytes) {
            stop(tooLarge(maxBytes))
            return cb(tooLarge(maxBytes))
          }
          hash.update(chunk)
          if (headBytes < UPLOAD_HEAD_BYTES) {
            const part = chunk.subarray(0, UPLOAD_HEAD_BYTES - headBytes)
            head.push(part)
            headBytes += part.length
          }
          cb(null, chunk)
        },
      })
      stream.on('limit', () => stop(tooLarge(maxBytes)))
      writing = pipeline(stream, meter, createWriteStream(tempPath)).then(() => {
        received = { filename: filename ?? '', type: String(mimeType || '').toLowerCase(), path: tempPath, size, sha256: hash.digest('hex'), head: Buffer.concat(head) }
      })
      writing.catch((err) => stop(err))
    })

    parser.on('error', () => stop(createError({ statusCode: 400, statusMessage: 'The upload could not be read' })))
    parser.on('partsLimit', () => stop(createError({ statusCode: 400, statusMessage: 'Too many parts in the upload' })))
    parser.on('fieldsLimit', () => stop(createError({ statusCode: 400, statusMessage: 'Too many fields in the upload' })))

    // 'finish': every part has been read (the file part's stream may still be writing).
    parser.on('finish', async () => {
      if (finished) return
      try { await writing } catch { return } // stop() has already answered
      if (finished) return
      finished = true
      req.removeListener('data', count)
      resolve({ file: received, fields })
    })

    // A request made inside this process (the MCP server's upload_media) holds its whole body
    // already and never streams it: the same parser and checks, from that buffer.
    const held = (req as any).body
    if (Buffer.isBuffer(held) || held instanceof Uint8Array) {
      count(Buffer.from(held))
      if (!finished) parser.end(held)
      return
    }
    // The visitor went away mid-upload: nobody to answer; drop the half file.
    req.once('close', () => { if (!req.complete) stop(createError({ statusCode: 499, statusMessage: 'Upload cancelled' })) })
    req.on('data', count)
    req.pipe(parser)
  })
}

/** Remove a received file that was not stored (refused, or the store failed). */
export async function discardReceived(file: ReceivedFile | null | undefined): Promise<void> {
  if (file) await unlink(file.path).catch(() => {})
}

const startsWith = (head: Buffer, bytes: number[], at = 0) => bytes.every((b, i) => head[at + i] === b)

/**
 * Does the content look like what its type says? The pictures are checked by the size
 * reader; for the rest the first bytes must carry the format's signature — a renamed
 * text file or a download cut off before its header is not a PDF or a video.
 */
export function looksLike(mime: string, head: Buffer): boolean {
  switch (mime) {
    case 'application/pdf':
      // The header may follow a little junk, but within the first KB.
      return head.subarray(0, 1024).includes('%PDF-')
    case 'video/mp4':
      return head.length >= 12 && head.subarray(4, 8).toString('latin1') === 'ftyp'
    case 'video/webm':
      return startsWith(head, [0x1a, 0x45, 0xdf, 0xa3]) // EBML
    case 'audio/mpeg':
      // An ID3 tag, or an MPEG audio frame (11 bits of sync).
      return head.subarray(0, 3).toString('latin1') === 'ID3' || (head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0)
    default:
      return true
  }
}

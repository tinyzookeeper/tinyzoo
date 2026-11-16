import busboy from 'busboy'
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

let swept = false
/** Leftovers of uploads a crashed process never finished (once per process; an hour old at least). */
function sweepOldTemp(dir: string) {
  if (swept) return
  swept = true
  readdir(dir).then((names) => Promise.all(names.filter((n) => n.endsWith('.part')).map(async (n) => {
    const file = join(dir, n)
    const info = await stat(file).catch(() => null)
    if (info && Date.now() - info.mtimeMs > 60 * 60 * 1000) await unlink(file).catch(() => {})
  }))).catch(() => {})
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
  await mkdir(tempDir, { recursive: true })
  sweepOldTemp(tempDir)

  let parser: busboy.Busboy
  try {
    parser = busboy({
      headers: req.headers,
      defParamCharset: 'utf8',
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

    parser.on('field', (name, value, info) => {
      if (info.valueTruncated || info.nameTruncated) return stop(createError({ statusCode: 400, statusMessage: 'A form field is too long' }))
      fields[name] = value
    })

    parser.on('file', (name, stream, info) => {
      if (name !== 'file' || !info.filename || received || writing) {
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
        received = { filename: info.filename, type: String(info.mimeType || '').toLowerCase(), path: tempPath, size, sha256: hash.digest('hex'), head: Buffer.concat(head) }
      })
      writing.catch((err) => stop(err))
    })

    parser.on('error', () => stop(createError({ statusCode: 400, statusMessage: 'The upload could not be read' })))
    parser.on('partsLimit', () => stop(createError({ statusCode: 400, statusMessage: 'Too many parts in the upload' })))
    parser.on('fieldsLimit', () => stop(createError({ statusCode: 400, statusMessage: 'Too many fields in the upload' })))

    parser.on('close', async () => {
      if (finished) return
      try { await writing } catch { return } // stop() has already answered
      if (finished) return
      finished = true
      req.removeListener('data', count)
      resolve({ file: received, fields })
    })

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

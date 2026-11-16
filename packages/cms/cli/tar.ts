/**
 * A minimal tar.gz writer and reader (ustar, regular files only) for the content
 * archive — enough for our own archives and for what `tar` writes, without a
 * dependency. Files are streamed from and to disk, so a large library of media never
 * sits in memory.
 */
import { createReadStream, createWriteStream, type WriteStream } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { once } from 'node:events'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip, createGzip } from 'node:zlib'

export interface TarEntry {
  /** Path inside the archive, with `/` separators and no leading slash. */
  name: string
  /** A file on disk to read the content from… */
  path?: string
  /** …or the content itself. */
  data?: Buffer
}

const BLOCK = 512

/** A name that stays inside the folder it is extracted to. */
export function safeArchivePath(name: string): string {
  const parts = name.split('/')
  if (!name || name.startsWith('/') || name.includes('\\') || name.includes('\0') || parts.some((p) => p === '..' || p === '')) {
    throw new Error(`The archive contains an unsafe path: ${JSON.stringify(name)}`)
  }
  return name
}

function octal(value: number, length: number): string {
  return value.toString(8).padStart(length - 1, '0') + '\0'
}

/** ustar splits a long path into prefix (≤155) and name (≤100) at a slash. */
function splitName(name: string): { prefix: string; base: string } {
  if (Buffer.byteLength(name) <= 100) return { prefix: '', base: name }
  for (let i = name.indexOf('/'); i !== -1; i = name.indexOf('/', i + 1)) {
    const prefix = name.slice(0, i)
    const base = name.slice(i + 1)
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(base) <= 100) return { prefix, base }
  }
  throw new Error(`Path too long for the archive: ${name}`)
}

function header(name: string, size: number, mtime: Date): Buffer {
  if (size > 0o77777777777) throw new Error(`File too large for the archive: ${name}`)
  const { prefix, base } = splitName(name)
  const h = Buffer.alloc(BLOCK)
  h.write(base, 0, 100, 'utf8')
  h.write(octal(0o644, 8), 100, 8, 'ascii')
  h.write(octal(0, 8), 108, 8, 'ascii')
  h.write(octal(0, 8), 116, 8, 'ascii')
  h.write(octal(size, 12), 124, 12, 'ascii')
  h.write(octal(Math.floor(mtime.getTime() / 1000), 12), 136, 12, 'ascii')
  h.fill(0x20, 148, 156) // the checksum is computed with this field as spaces
  h.write('0', 156, 1, 'ascii')
  h.write('ustar\0', 257, 6, 'ascii')
  h.write('00', 263, 2, 'ascii')
  if (prefix) h.write(prefix, 345, 155, 'utf8')
  let sum = 0
  for (const byte of h) sum += byte
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')
  return h
}

async function* tarChunks(entries: Iterable<TarEntry>): AsyncGenerator<Buffer> {
  const mtime = new Date()
  for (const entry of entries) {
    safeArchivePath(entry.name)
    const size = entry.data ? entry.data.length : (await stat(entry.path!)).size
    yield header(entry.name, size, mtime)
    if (entry.data) yield entry.data
    else {
      let sent = 0
      for await (const chunk of createReadStream(entry.path!)) {
        sent += (chunk as Buffer).length
        yield chunk as Buffer
      }
      if (sent !== size) throw new Error(`${entry.path} changed while it was being archived`)
    }
    const pad = (BLOCK - (size % BLOCK)) % BLOCK
    if (pad) yield Buffer.alloc(pad)
  }
  yield Buffer.alloc(BLOCK * 2) // end of archive
}

/**
 * Write `entries` as a gzip-compressed tar archive at `out`. The file is created
 * readable by its owner only (`mode`, 0600 unless asked otherwise) from the first
 * byte — an archive of a whole site is not something other users of the machine
 * should be able to read while it is being written. An existing `out` is replaced.
 */
export async function writeTarGz(out: string, entries: Iterable<TarEntry>, mode = 0o600): Promise<void> {
  // Remove first: a leftover file keeps its old (maybe wider) permissions when reopened.
  await rm(out, { force: true })
  await pipeline(Readable.from(tarChunks(entries)), createGzip(), createWriteStream(out, { mode, flags: 'wx' }))
}

function field(h: Buffer, from: number, length: number): string {
  const raw = h.subarray(from, from + length)
  const end = raw.indexOf(0)
  return raw.subarray(0, end === -1 ? raw.length : end).toString('utf8')
}

function parseSize(h: Buffer): number {
  // GNU base-256 sizes (files over 8 GiB): big-endian after the marker byte.
  if (h[124]! & 0x80) {
    if (h[124] !== 0x80) throw new Error('The archive is damaged (bad file size)')
    let size = 0
    for (let i = 125; i < 136; i++) size = size * 256 + h[i]!
    if (!Number.isSafeInteger(size)) throw new Error('The archive holds a file too large to read')
    return size
  }
  const text = h.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim()
  const size = parseInt(text || '0', 8)
  if (!Number.isFinite(size) || size < 0) throw new Error('The archive is damaged (bad file size)')
  return size
}

function checksumOk(h: Buffer): boolean {
  const stored = parseInt(h.subarray(148, 156).toString('ascii').replace(/\0.*$/, '').trim() || '-1', 8)
  let sum = 0
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i]!
  return stored === sum
}

/** The `path` and `size` records of a pax extended header ("<length> <key>=<value>\n" each). */
function paxRecords(data: Buffer): { path: string | null; size: number | null } {
  const out = { path: null as string | null, size: null as number | null }
  let i = 0
  while (i < data.length) {
    const space = data.indexOf(0x20, i)
    if (space === -1) break
    const length = parseInt(data.subarray(i, space).toString('ascii'), 10)
    if (!length) break
    const record = data.subarray(space + 1, i + length - 1).toString('utf8')
    if (record.startsWith('path=')) out.path = record.slice(5)
    else if (record.startsWith('size=')) { const n = Number(record.slice(5)); if (Number.isSafeInteger(n) && n >= 0) out.size = n }
    i += length
  }
  return out
}

/** The most a pax or GNU long-name header may hold: a path is at most a few KiB, never more than this. */
export const MAX_HEADER_BODY = 64 * 1024

/** The default cap on the bytes one archive may unpack to (20 GiB). */
export const DEFAULT_MAX_EXTRACT_BYTES = 20 * 1024 ** 3

/**
 * The cap on unpacked bytes: `TINYZOO_MAX_ARCHIVE_BYTES` (a number of bytes), else 20 GiB.
 * A gzip file of a few kilobytes can unpack to gigabytes; this stops it filling the disk.
 */
export function archiveLimit(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.TINYZOO_MAX_ARCHIVE_BYTES)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_EXTRACT_BYTES
}

export interface ExtractOptions {
  /** Most bytes the archive may unpack to (default: `archiveLimit()`). */
  maxBytes?: number
  /**
   * Refuse anything that is not a plain file or folder (symbolic and hard links,
   * devices…) instead of skipping it. Links are never created either way.
   */
  strict?: boolean
}

const gib = (n: number) => (n >= 1024 ** 3 ? `${+(n / 1024 ** 3).toFixed(1)} GiB` : `${+(n / 1024 ** 2).toFixed(1)} MiB`)

/**
 * Extract a .tar.gz into `dest` (created). Only regular files are written (links and
 * devices are never created); paths that would leave `dest` are refused, as is an
 * archive that would unpack to more than `maxBytes`. Returns the extracted paths,
 * relative to `dest`.
 */
export async function extractTarGz(file: string, dest: string, opts: ExtractOptions = {}): Promise<string[]> {
  return extractFrom(file, dest, true, opts)
}

/** The same for an uncompressed .tar (what `tinyzoo backup` writes). */
export async function extractTar(file: string, dest: string, opts: ExtractOptions = {}): Promise<string[]> {
  return extractFrom(file, dest, false, opts)
}

async function extractFrom(file: string, dest: string, gzip: boolean, opts: ExtractOptions): Promise<string[]> {
  const maxBytes = opts.maxBytes ?? archiveLimit()
  const source = createReadStream(file)
  let input: AsyncIterable<Buffer> = source
  if (gzip) {
    const gunzip = createGunzip()
    source.on('error', (err) => gunzip.destroy(err))
    source.pipe(gunzip)
    input = gunzip
  }

  const extracted: string[] = []
  let head = Buffer.alloc(0)
  type Body = { left: number; pad: number; kind: 'file' | 'skip' | 'pax' | 'gnuname'; name: string; out?: WriteStream; parts: Buffer[] }
  let body = null as Body | null
  let nextName: string | null = null
  let nextSize: number | null = null // a pax `size` (members over 8 GiB, as bsdtar writes them)
  let ended = false
  let total = 0
  let outError: Error | null = null

  const finish = async () => {
    const b = body!
    body = null
    if (b.kind === 'file') {
      if (outError) throw outError
      await new Promise<void>((resolve, reject) => { b.out!.once('error', reject); b.out!.end(resolve) })
      extracted.push(b.name)
    }
    else if (b.kind === 'pax') { const r = paxRecords(Buffer.concat(b.parts)); nextName = r.path; nextSize = r.size }
    else if (b.kind === 'gnuname') nextName = Buffer.concat(b.parts).toString('utf8').replace(/\0.*$/, '')
  }

  const start = async (h: Buffer) => {
    if (!checksumOk(h)) throw new Error('The archive is damaged (bad header checksum)')
    const type = String.fromCharCode(h[156] || 0x30)
    let size = parseSize(h)
    if (nextSize !== null && (type === '0' || type === '7')) { size = nextSize; nextSize = null }
    const ustar = h.subarray(257, 262).toString('ascii') === 'ustar'
    const prefix = ustar ? field(h, 345, 155) : ''
    let name = prefix ? `${prefix}/${field(h, 0, 100)}` : field(h, 0, 100)
    if (nextName && (type === '0' || type === '5' || type === '7')) { name = nextName; nextName = null }
    const pad = (BLOCK - (size % BLOCK)) % BLOCK
    if (type === '0' || type === '7') {
      // The declared size counts before a byte is written: a bomb is refused at its header.
      total += size
      if (total > maxBytes) throw new Error(`The archive would unpack to more than ${gib(maxBytes)} (the limit). If it is genuine, raise the limit with TINYZOO_MAX_ARCHIVE_BYTES=<bytes>.`)
      const clean = safeArchivePath(name.replace(/^\.\//, ''))
      const target = join(dest, clean)
      await mkdir(dirname(target), { recursive: true })
      // `wx`: never open an existing path (a name listed twice; a link that was somehow there).
      const out = createWriteStream(target, { flags: 'wx' })
      out.on('error', (err: NodeJS.ErrnoException) => { outError = err.code === 'EEXIST' ? new Error(`The archive lists ${JSON.stringify(clean)} more than once`) : err })
      body = { left: size, pad, kind: 'file', name: clean, out, parts: [] }
    }
    else if (type === 'x' || type === 'L') {
      if (size > MAX_HEADER_BODY) throw new Error(`The archive is damaged or hostile (a ${type === 'x' ? 'pax' : 'long-name'} header of ${size} bytes; the limit is ${MAX_HEADER_BODY / 1024} KiB)`)
      body = { left: size, pad, kind: type === 'x' ? 'pax' : 'gnuname', name, parts: [] }
    }
    else {
      // Folders and the pax "global" header are harmless. A link or a device is never
      // created; strict readers (backups) do not accept an archive that holds one.
      if (opts.strict && type !== '5' && type !== 'g') {
        const what = type === '2' ? 'a symbolic link' : type === '1' ? 'a hard link' : `an entry of type "${type}"`
        throw new Error(`The archive contains ${what} (${JSON.stringify(name)}); only plain files are accepted.`)
      }
      body = { left: size, pad, kind: 'skip', name, parts: [] }
    }
    // An empty file has no body and no padding: it is complete right here.
    if (body.left === 0) await finish()
  }

  await mkdir(dest, { recursive: true })
  try {
    for await (let chunk of input) {
      while (chunk.length && !ended) {
        if (outError) throw outError
        if (body) {
          if (body.left > 0) {
            const part = chunk.subarray(0, body.left)
            chunk = chunk.subarray(part.length)
            body.left -= part.length
            if (body.kind === 'file') { if (!body.out!.write(part)) await once(body.out!, 'drain') }
            else if (body.kind !== 'skip') body.parts.push(Buffer.from(part))
            if (body.left === 0 && body.pad === 0) await finish()
          }
          else {
            const skip = Math.min(body.pad, chunk.length)
            body.pad -= skip
            chunk = chunk.subarray(skip)
            if (body.pad === 0) await finish()
          }
          continue
        }
        const need = BLOCK - head.length
        head = Buffer.concat([head, chunk.subarray(0, need)])
        chunk = chunk.subarray(Math.min(need, chunk.length))
        if (head.length < BLOCK) continue
        const h = head
        head = Buffer.alloc(0)
        if (h.every((byte) => byte === 0)) { ended = true; continue }
        await start(h)
      }
    }
    if (body || head.length) throw new Error('The archive is incomplete (it ends in the middle of a file)')
    if (outError) throw outError
    return extracted
  }
  finally {
    // A refused archive stops reading at once and leaves nothing open.
    source.destroy()
    ;(body as Body | null)?.out?.destroy()
  }
}

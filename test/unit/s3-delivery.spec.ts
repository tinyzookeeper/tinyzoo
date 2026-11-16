import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { byteRange, etagMatches, singleRange } from '../../packages/cms/server/utils/cmsRange'
import { createLocalDriver, createS3Driver, type StorageDriver, type StorageRead } from '../../packages/cms/server/utils/cmsStorage'
import { isSafeStorageKey, resolveS3Delivery, storedMediaUrl } from '../../packages/cms/shared/storage-delivery'
import { mediaStore, settingsFrom } from '../../packages/cms/cli/backup'
import { storageFromEnv } from '../../packages/cms/cli/transfer'
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3'

// Nitro provides createError; here it is an Error that carries the same fields.
beforeAll(() => {
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.statusMessage ?? o.message), o))
})
afterAll(() => vi.unstubAllGlobals())

const text = async (r: StorageRead | null) => (r?.body ? Buffer.from(await new Response(r.body).arrayBuffer()) : Buffer.alloc(0)).toString('utf8')

describe('delivery setting', () => {
  it('defaults to public with a public address and to proxy without one', () => {
    expect(resolveS3Delivery('', 'https://cdn.example.com')).toBe('public')
    expect(resolveS3Delivery(undefined, '')).toBe('proxy')
    expect(resolveS3Delivery(undefined, undefined)).toBe('proxy')
  })

  it('takes what is asked for, in any case, and refuses other words', () => {
    expect(resolveS3Delivery('redirect', 'https://cdn.example.com')).toBe('redirect')
    expect(resolveS3Delivery('Proxy ', '')).toBe('proxy')
    expect(resolveS3Delivery('public', '')).toBe('public')
    expect(() => resolveS3Delivery('cdn', '')).toThrow(/'public', 'proxy' or 'redirect'/)
  })

  it('stores the bucket address under public and the app path under proxy and redirect', () => {
    const base = { endpoint: 'http://s3.local:9000/', bucket: 'media' }
    const key = '2026/11/0a1b.png'
    expect(storedMediaUrl({ ...base, delivery: 'public' }, key)).toBe('http://s3.local:9000/media/2026/11/0a1b.png')
    expect(storedMediaUrl({ ...base, delivery: 'public', publicBaseUrl: 'https://cdn.example.com/' }, key)).toBe('https://cdn.example.com/2026/11/0a1b.png')
    for (const delivery of ['proxy', 'redirect'] as const) {
      expect(storedMediaUrl({ ...base, delivery }, key)).toBe('/api/cms/_media/raw/2026/11/0a1b.png')
      // The local driver's address, whatever the site mounted it at: switching drivers keeps old rows working.
      expect(storedMediaUrl({ ...base, delivery, appBase: '/files/' }, key)).toBe('/files/2026/11/0a1b.png')
    }
  })

  it('knows which keys stay inside the bucket', () => {
    expect(isSafeStorageKey('2026/11/0a1b.png')).toBe(true)
    expect(isSafeStorageKey('_w/640/2026/11/0a1b.png.webp')).toBe(true)
    for (const bad of ['', '../other/x.png', 'a/../../b', './x', 'a//b', '/x', 'a\\b', 'a\u0000b']) expect(isSafeStorageKey(bad), JSON.stringify(bad)).toBe(false)
  })
})

describe('byte ranges and entity tags', () => {
  it('reads one range in its three forms, and gives the whole file for anything else', () => {
    expect(byteRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 })
    expect(byteRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 })
    expect(byteRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 })
    expect(byteRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 })
    expect(byteRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 })
    expect(byteRange('bytes=0-1,5-6', 100)).toBeNull()
    expect(byteRange('items=0-1', 100)).toBeNull()
    expect(byteRange('bytes=-', 100)).toBeNull()
    expect(byteRange(undefined, 100)).toBeNull()
    expect(singleRange(' bytes=0-1 ')).toBe('bytes=0-1')
    expect(singleRange('bytes=0-1,3-4')).toBeUndefined()
  })

  it('says unsatisfiable for a range outside the file', () => {
    expect(byteRange('bytes=100-', 100)).toBe('unsatisfiable')
    expect(byteRange('bytes=20-10', 100)).toBe('unsatisfiable')
    expect(byteRange('bytes=-0', 100)).toBe('unsatisfiable')
    expect(byteRange('bytes=0-', 0)).toBe('unsatisfiable')
  })

  it('matches If-None-Match against lists, weak tags and *', () => {
    expect(etagMatches('"abc"', '"abc"')).toBe(true)
    expect(etagMatches('W/"abc", "def"', '"abc"')).toBe(true)
    expect(etagMatches('"def", "abc"', 'W/"abc"')).toBe(true)
    expect(etagMatches('*', '"abc"')).toBe(true)
    expect(etagMatches('"nope"', '"abc"')).toBe(false)
    expect(etagMatches('', '"abc"')).toBe(false)
    expect(etagMatches('"abc"', undefined)).toBe(false)
  })
})

describe('local driver: streams, with ranges', () => {
  let dir: string
  let driver: StorageDriver
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cms-local-read-'))
    writeFileSync(join(dir, 'a.txt'), '0123456789')
    writeFileSync(join(dir, 'empty.txt'), '')
    driver = createLocalDriver(dir)
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('reads the whole file as a stream with its size and a type from the extension', async () => {
    const r = await driver.read('a.txt')
    expect(r).toMatchObject({ status: 200, contentType: 'text/plain', contentLength: 10 })
    expect(r!.etag).toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/)
    expect(await text(r)).toBe('0123456789')
  })

  it('reads a range (and the suffix and open-ended forms)', async () => {
    const r = await driver.read('a.txt', { range: 'bytes=2-5' })
    expect(r).toMatchObject({ status: 206, contentLength: 4, contentRange: 'bytes 2-5/10' })
    expect(await text(r)).toBe('2345')
    expect(await text(await driver.read('a.txt', { range: 'bytes=-3' }))).toBe('789')
    expect(await text(await driver.read('a.txt', { range: 'bytes=7-' }))).toBe('789')
  })

  it('answers 416 with the size for a range outside the file, and 304 for the tag it has', async () => {
    expect(await driver.read('a.txt', { range: 'bytes=50-' })).toMatchObject({ status: 416, contentRange: 'bytes */10', body: null })
    const etag = (await driver.read('a.txt'))!.etag!
    expect(await driver.read('a.txt', { ifNoneMatch: etag })).toMatchObject({ status: 304, body: null })
  })

  it('serves an empty file, and returns null for a missing file, a folder or a key that leaves the folder', async () => {
    expect(await text(await driver.read('empty.txt'))).toBe('')
    expect(await driver.read('nope.txt')).toBeNull()
    expect(await driver.read('.')).toBeNull()
    expect(await driver.read('../etc/passwd')).toBeNull()
  })
})

describe('S3 driver against a private bucket', () => {
  let s3: FakeS3
  const cfg = () => ({ endpoint: s3.endpoint, region: s3.region, bucket: s3.bucket, accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey })
  const driver = (extra: Record<string, unknown> = {}) => createS3Driver({ ...cfg(), ...extra } as any)
  beforeEach(async () => { s3 = await startFakeS3() })
  afterEach(() => s3.close())

  it('stores the app path under proxy and redirect, so the address never expires', async () => {
    for (const delivery of ['proxy', 'redirect'] as const) {
      const d = driver({ delivery })
      const stored = await d.put('2026/11/x.png', Buffer.from('png'), 'image/png')
      expect(stored).toEqual({ key: '2026/11/x.png', url: '/api/cms/_media/raw/2026/11/x.png', size: 3 })
      expect(d.url('2026/11/x.png')).toBe('/api/cms/_media/raw/2026/11/x.png')
      expect(d.delivery).toBe(delivery)
    }
    expect(s3.objects.get('2026/11/x.png')).toMatchObject({ type: 'image/png', size: 3 })
  })

  it('without a delivery setting: proxy, or public when a public address is given', () => {
    expect(driver().delivery).toBe('proxy')
    expect(driver().url('a/b.png')).toBe('/api/cms/_media/raw/a/b.png')
    expect(driver({ publicBaseUrl: 'https://cdn.example.com' }).delivery).toBe('public')
  })

  it('keeps today\'s address under public', () => {
    expect(driver({ delivery: 'public' }).url('a/b.png')).toBe(`${s3.endpoint}/media/a/b.png`)
    expect(driver({ delivery: 'public', publicBaseUrl: 'https://cdn.example.com/' }).url('a/b.png')).toBe('https://cdn.example.com/a/b.png')
  })

  it('reads a whole object as a stream, signed, with its type, size and tag', async () => {
    const d = driver()
    await d.put('k/a.txt', Buffer.from('hello world'), 'text/plain')
    const r = await d.read('k/a.txt')
    expect(r).toMatchObject({ status: 200, contentType: 'text/plain', contentLength: 11 })
    expect(r!.etag).toMatch(/^"[0-9a-f]{32}"$/)
    expect(await text(r)).toBe('hello world')
    expect(s3.requests.at(-1)).toMatchObject({ method: 'GET', ok: true, query: false })
  })

  it('forwards the range to the bucket and reports 206 with Content-Range', async () => {
    const d = driver()
    await d.put('k/a.txt', Buffer.from('0123456789'), 'text/plain')
    const r = await d.read('k/a.txt', { range: 'bytes=2-5' })
    expect(r).toMatchObject({ status: 206, contentLength: 4, contentRange: 'bytes 2-5/10' })
    expect(await text(r)).toBe('2345')
    expect(s3.requests.at(-1)).toMatchObject({ range: 'bytes=2-5', ok: true })
    expect(await text(await d.read('k/a.txt', { range: 'bytes=-3' }))).toBe('789')
    // Several ranges are not forwarded: the whole file, as the local driver does.
    const multi = await d.read('k/a.txt', { range: 'bytes=0-1,4-5' })
    expect(multi!.status).toBe(200)
    expect(s3.requests.at(-1)!.range).toBeUndefined()
  })

  it('passes on 416 with the size, and 304 for a tag the bucket knows', async () => {
    const d = driver()
    await d.put('k/a.txt', Buffer.from('0123456789'), 'text/plain')
    expect(await d.read('k/a.txt', { range: 'bytes=50-' })).toMatchObject({ status: 416, contentRange: 'bytes */10', body: null })
    const etag = (await d.read('k/a.txt'))!.etag!
    expect(await d.read('k/a.txt', { ifNoneMatch: etag })).toMatchObject({ status: 304, etag, body: null })
  })

  it('says null for a missing object (404)', async () => {
    expect(await driver().read('k/missing.png')).toBeNull()
  })

  it('takes the type from the key when the bucket has none', async () => {
    const d = driver()
    await d.put('k/a.png', Buffer.from('x'), 'binary/octet-stream')
    expect((await d.read('k/a.png'))!.contentType).toBe('image/png')
  })

  it('turns any other answer into 502, without the address, the key or the credentials', async () => {
    const d = driver()
    await d.put('k/secret-name.png', Buffer.from('x'), 'image/png')
    for (const status of [500, 403, 503]) {
      s3.failWith(status)
      const err: any = await d.read('k/secret-name.png').catch((e) => e)
      expect(err.statusCode, String(status)).toBe(502)
      const shown = JSON.stringify({ message: err.message, statusMessage: err.statusMessage, cause: err.cause?.message })
      expect(shown).toContain(String(status))
      for (const leak of [s3.endpoint, s3.bucket, s3.accessKeyId, s3.secretAccessKey, 'secret-name']) expect(shown).not.toContain(leak)
    }
  })

  it('turns a store that does not answer into 502 without its address', async () => {
    const d = createS3Driver({ ...cfg(), endpoint: 'http://127.0.0.1:1' })
    const err: any = await d.read('k/a.png').catch((e) => e)
    expect(err.statusCode).toBe(502)
    expect(JSON.stringify({ m: err.message, c: err.cause?.message })).not.toContain('127.0.0.1')
  })

  it('refuses a key that would leave the bucket, before any request', async () => {
    const d = driver()
    for (const key of ['../other/x.png', 'a/../../b.png', 'a//b']) {
      expect(((await d.read(key).catch((e) => e)) as any).statusCode, key).toBe(400)
      expect(((await d.presign!(key, 60).catch((e) => e)) as any).statusCode, key).toBe(400)
    }
    expect(s3.requests).toHaveLength(0)
  })

  it('signs a GET address that lives five minutes and works without credentials', async () => {
    const d = driver({ delivery: 'redirect' })
    await d.put('k/a.txt', Buffer.from('hello'), 'text/plain')
    const address = new URL(await d.presign!('k/a.txt', 300))
    expect(address.origin).toBe(s3.endpoint)
    expect(address.pathname).toBe('/media/k/a.txt')
    expect(address.searchParams.get('X-Amz-Expires')).toBe('300')
    expect(address.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256')
    expect(address.searchParams.get('X-Amz-Credential')).toMatch(new RegExp(`^${s3.accessKeyId}/\\d{8}/us-east-1/s3/aws4_request$`))
    expect(address.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)

    const res = await fetch(address)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('hello')
    expect(s3.requests.at(-1)).toMatchObject({ method: 'GET', query: true, ok: true })

    // Changing anything breaks the signature.
    const forged = new URL(address)
    forged.pathname = '/media/k/other.txt'
    expect((await fetch(forged)).status).toBe(403)
    const longer = new URL(address)
    longer.searchParams.set('X-Amz-Expires', '86400')
    expect((await fetch(longer)).status).toBe(403)
  })

  it('removes an object, and an object that is already gone is fine', async () => {
    const d = driver()
    await d.put('k/a.txt', Buffer.from('x'), 'text/plain')
    await d.delete('k/a.txt')
    await d.delete('k/a.txt')
    expect(s3.objects.has('k/a.txt')).toBe(false)
  })

  describe('public delivery over a private bucket', () => {
    let warn: ReturnType<typeof vi.spyOn>
    beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
    afterEach(() => warn.mockRestore())
    const warned = () => vi.waitFor(() => expect(warn).toHaveBeenCalled())

    it('warns once, after the first upload, that anonymous reads answer 403', async () => {
      const d = driver({ delivery: 'public' })
      await d.put('k/a.png', Buffer.from('x'), 'image/png')
      await warned()
      expect(String(warn.mock.calls[0]![0])).toMatch(/403.*NUXT_CMS_STORAGE_S3_DELIVERY=proxy/)
      await d.put('k/b.png', Buffer.from('x'), 'image/png')
      await new Promise((r) => setTimeout(r, 100))
      expect(warn).toHaveBeenCalledTimes(1)
    })

    it('stays quiet under proxy and redirect', async () => {
      await driver({ delivery: 'proxy' }).put('k/a.png', Buffer.from('x'), 'image/png')
      await driver({ delivery: 'redirect' }).put('k/b.png', Buffer.from('x'), 'image/png')
      await new Promise((r) => setTimeout(r, 100))
      expect(warn).not.toHaveBeenCalled()
    })
  })
})

describe('storage settings of the command line', () => {
  const env = (extra: Record<string, string>) => ({
    NUXT_CMS_STORAGE_DRIVER: 's3', NUXT_CMS_STORAGE_S3_ENDPOINT: 'https://s3.example.com', NUXT_CMS_STORAGE_S3_BUCKET: 'media',
    NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID: 'k', NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY: 's', ...extra,
  })

  it('writes the addresses the running app would: app path for proxy and redirect, bucket address for public', () => {
    const cwd = tmpdir()
    expect(storageFromEnv(cwd, env({})).url('2026/11/a.png')).toBe('/api/cms/_media/raw/2026/11/a.png')
    expect(storageFromEnv(cwd, env({ NUXT_CMS_STORAGE_S3_DELIVERY: 'redirect' })).url('2026/11/a.png')).toBe('/api/cms/_media/raw/2026/11/a.png')
    expect(storageFromEnv(cwd, env({ NUXT_CMS_STORAGE_S3_DELIVERY: 'public' })).url('2026/11/a.png')).toBe('https://s3.example.com/media/2026/11/a.png')
    expect(storageFromEnv(cwd, env({ NUXT_CMS_STORAGE_S3_PUBLIC_BASE_URL: 'https://cdn.example.com' })).url('2026/11/a.png')).toBe('https://cdn.example.com/2026/11/a.png')
    expect(storageFromEnv(cwd, env({ NUXT_CMS_STORAGE_S3_PUBLIC_BASE_URL: 'https://cdn.example.com', NUXT_CMS_STORAGE_S3_DELIVERY: 'proxy' })).url('2026/11/a.png')).toBe('/api/cms/_media/raw/2026/11/a.png')
  })

  it('takes the delivery from the module options too, and refuses a word that is none of the three', () => {
    const cms = { storage: { driver: 's3', s3: { endpoint: 'https://s3.example.com', bucket: 'm', accessKeyId: 'k', secretAccessKey: 's', delivery: 'redirect' } } }
    expect(storageFromEnv(tmpdir(), {}, {}, cms).url('a.png')).toBe('/api/cms/_media/raw/a.png')
    expect(() => storageFromEnv(tmpdir(), env({ NUXT_CMS_STORAGE_S3_DELIVERY: 'cdn' }))).toThrow(/Unknown storage delivery/)
  })

  it('ignores the platform\'s FORCE_PATH_STYLE: the address is path-style either way', () => {
    const s = storageFromEnv(tmpdir(), env({ NUXT_CMS_STORAGE_S3_FORCE_PATH_STYLE: 'false', NUXT_CMS_STORAGE_S3_DELIVERY: 'public' }))
    expect(s.url('a.png')).toBe('https://s3.example.com/media/a.png')
  })
})

describe('backup and restore of a private bucket', () => {
  it('copy the files with signed requests, whatever the delivery', async () => {
    const s3 = await startFakeS3()
    try {
      const env = {
        NUXT_CMS_STORAGE_DRIVER: 's3', NUXT_CMS_STORAGE_S3_ENDPOINT: s3.endpoint, NUXT_CMS_STORAGE_S3_BUCKET: s3.bucket,
        NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID: s3.accessKeyId, NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY: s3.secretAccessKey, NUXT_CMS_STORAGE_S3_DELIVERY: 'redirect',
      }
      const settings = settingsFrom(tmpdir(), env, {})
      expect(settings.storage.s3.delivery).toBe('redirect')
      const store = mediaStore(settings.storage)
      await store.write('2026/11/a.png', Buffer.from('png bytes'), 'image/png')
      expect((await store.read('2026/11/a.png'))!.body.toString()).toBe('png bytes')
      expect(await store.read('2026/11/missing.png')).toBeNull()
      expect(s3.requests.every((r) => r.ok && !r.query)).toBe(true)
    }
    finally { await s3.close() }
  })
})

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyMedia, mediaStore, settingsFrom } from '../../packages/cms/cli/backup'
import { storageFromEnv, storageFromSettings } from '../../packages/cms/cli/transfer'
import { createS3Driver, type StorageDriver, type StorageRead } from '../../packages/cms/server/utils/cmsStorage'
import { cleanS3Prefix, isSafeStorageKey, s3ObjectPath, storedMediaUrl } from '../../packages/cms/shared/storage-delivery'
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3'

// A site's place inside a bucket it shares with others (cms.storage.s3.prefix): every object
// of the site is <prefix>/<key>; the key everywhere else is the same as without a prefix.

beforeAll(() => {
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.statusMessage ?? o.message), o))
})
afterAll(() => vi.unstubAllGlobals())

const text = async (r: StorageRead | null) => (r?.body ? Buffer.from(await new Response(r.body).arrayBuffer()) : Buffer.alloc(0)).toString('utf8')

describe('the prefix setting', () => {
  it('takes path segments of a-z, 0-9, dash, underscore and dot, and drops one trailing slash', () => {
    expect(cleanS3Prefix('')).toBe('')
    expect(cleanS3Prefix(undefined)).toBe('')
    expect(cleanS3Prefix('  ')).toBe('')
    expect(cleanS3Prefix('sites')).toBe('sites')
    expect(cleanS3Prefix('sites/7f3a')).toBe('sites/7f3a')
    expect(cleanS3Prefix('sites/7f3a/')).toBe('sites/7f3a')
    expect(cleanS3Prefix(' a_b-c.d/e.1 ')).toBe('a_b-c.d/e.1')
    expect(cleanS3Prefix('...')).toBe('...')
  })

  it('refuses the rest, and names the setting', () => {
    for (const bad of ['/sites', '/', 'sites//7f3a', 'sites/7f3a//', 'a/./b', 'a/../b', '..', '.', './a', 'Sites', 'a b', 'a\\b', 'sites/é', 'a?b', 'a#b', 'a%2e', 'a\u0000b', 'x'.repeat(201)]) {
      expect(() => cleanS3Prefix(bad), JSON.stringify(bad)).toThrow(/cms\.storage\.s3\.prefix.*NUXT_CMS_STORAGE_S3_PREFIX/)
    }
  })

  it('puts the prefix in front of a key, and nothing in front of it without one', () => {
    expect(s3ObjectPath('', '2026/11/a.png')).toBe('2026/11/a.png')
    expect(s3ObjectPath('sites/7f3a', '2026/11/a.png')).toBe('sites/7f3a/2026/11/a.png')
  })

  it('a key can never climb out of its prefix', () => {
    for (const key of ['../other/x.png', 'a/../../b.png', '2026/../../x', '..', 'a//b', '/x', './x']) expect(isSafeStorageKey(key), key).toBe(false)
  })
})

describe('the address a file is stored under', () => {
  const base = { endpoint: 'http://s3.local:9000/', bucket: 'media' }
  const key = '2026/11/0a1b.png'

  it('has the prefix under public, after the bucket address or the public address', () => {
    expect(storedMediaUrl({ ...base, delivery: 'public', prefix: 'sites/7f3a' }, key)).toBe('http://s3.local:9000/media/sites/7f3a/2026/11/0a1b.png')
    expect(storedMediaUrl({ ...base, delivery: 'public', publicBaseUrl: 'https://cdn.example.com/', prefix: 'sites/7f3a' }, key)).toBe('https://cdn.example.com/sites/7f3a/2026/11/0a1b.png')
  })

  it('is the same app path under proxy and redirect, with or without a prefix', () => {
    for (const delivery of ['proxy', 'redirect'] as const) {
      expect(storedMediaUrl({ ...base, delivery, prefix: 'sites/7f3a' }, key)).toBe('/api/cms/_media/raw/2026/11/0a1b.png')
      expect(storedMediaUrl({ ...base, delivery }, key)).toBe('/api/cms/_media/raw/2026/11/0a1b.png')
    }
  })

  it('without a prefix is today\'s address, byte for byte', () => {
    expect(storedMediaUrl({ ...base, delivery: 'public' }, key)).toBe('http://s3.local:9000/media/2026/11/0a1b.png')
    expect(storedMediaUrl({ ...base, delivery: 'public', prefix: '' }, key)).toBe('http://s3.local:9000/media/2026/11/0a1b.png')
    expect(storedMediaUrl({ ...base, delivery: 'public', publicBaseUrl: 'https://cdn.example.com' }, key)).toBe('https://cdn.example.com/2026/11/0a1b.png')
  })
})

describe('the S3 driver with a prefix', () => {
  let s3: FakeS3
  const cfg = () => ({ endpoint: s3.endpoint, region: s3.region, bucket: s3.bucket, accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey })
  const driver = (extra: Record<string, unknown> = {}): StorageDriver => createS3Driver({ ...cfg(), ...extra } as any)
  const keys = () => [...s3.objects.keys()].sort()
  beforeEach(async () => { s3 = await startFakeS3() })
  afterEach(() => s3.close())

  it('without a prefix stores the key as it is (nothing changes)', async () => {
    const d = driver()
    expect(await d.put('2026/11/a.png', Buffer.from('x'), 'image/png')).toEqual({ key: '2026/11/a.png', url: '/api/cms/_media/raw/2026/11/a.png', size: 1 })
    expect(keys()).toEqual(['2026/11/a.png'])
    // An empty prefix is no prefix.
    await driver({ prefix: '' }).put('2026/11/b.png', Buffer.from('x'), 'image/png')
    expect(keys()).toEqual(['2026/11/a.png', '2026/11/b.png'])
  })

  it('writes, reads, deletes and signs under the prefix, and returns the same key', async () => {
    const d = driver({ prefix: 'sites/7f3a' })
    const stored = await d.put('2026/11/a.txt', Buffer.from('0123456789'), 'text/plain')
    expect(stored).toEqual({ key: '2026/11/a.txt', url: '/api/cms/_media/raw/2026/11/a.txt', size: 10 })
    expect(keys()).toEqual(['sites/7f3a/2026/11/a.txt'])
    expect(s3.objects.get('sites/7f3a/2026/11/a.txt')).toMatchObject({ type: 'text/plain', size: 10 })

    expect((await d.get('2026/11/a.txt'))!.body.toString()).toBe('0123456789')
    const r = await d.read('2026/11/a.txt')
    expect(r).toMatchObject({ status: 200, contentLength: 10 })
    expect(await text(r)).toBe('0123456789')
    expect(await text(await d.read('2026/11/a.txt', { range: 'bytes=2-5' }))).toBe('2345')
    expect(await d.read('a.txt')).toBeNull()

    const address = new URL(await d.presign!('2026/11/a.txt', 300))
    expect(address.origin).toBe(s3.endpoint)
    expect(address.pathname).toBe('/media/sites/7f3a/2026/11/a.txt')
    const res = await fetch(address)
    expect([res.status, await res.text()]).toEqual([200, '0123456789'])

    await d.delete('2026/11/a.txt')
    await d.delete('2026/11/a.txt')
    expect(keys()).toEqual([])
    // Every request carried a valid signature.
    expect(s3.requests.filter((q) => !q.ok)).toEqual([])
    expect(s3.requests.every((q) => q.path.startsWith('/media/sites/7f3a/'))).toBe(true)
  })

  it('puts a file from the disk under the prefix too (the upload path)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'prefix-put-'))
    try {
      const { writeFileSync } = await import('node:fs')
      const { createHash } = await import('node:crypto')
      const body = Buffer.from('a file from the disk')
      writeFileSync(join(dir, 'in.bin'), body)
      const d = driver({ prefix: 'sites/7f3a' })
      const stored = await d.putFile('2026/11/f.pdf', join(dir, 'in.bin'), { size: body.length, sha256: createHash('sha256').update(body).digest('hex'), contentType: 'application/pdf' })
      expect(stored).toMatchObject({ key: '2026/11/f.pdf', size: body.length })
      expect(keys()).toEqual(['sites/7f3a/2026/11/f.pdf'])
      expect(s3.objects.get('sites/7f3a/2026/11/f.pdf')!.body!.toString()).toBe('a file from the disk')
    }
    finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('takes a trailing slash as no slash', async () => {
    await driver({ prefix: 'sites/7f3a/' }).put('2026/11/a.png', Buffer.from('x'), 'image/png')
    expect(keys()).toEqual(['sites/7f3a/2026/11/a.png'])
    expect(driver({ prefix: 'sites/7f3a/', delivery: 'public' }).url('2026/11/a.png')).toBe(`${s3.endpoint}/media/sites/7f3a/2026/11/a.png`)
  })

  it('refuses a prefix that is not clean when the driver is made, naming the setting', () => {
    for (const prefix of ['/sites', 'sites//a', 'a/../b', 'Sites', 'a b']) {
      expect(() => driver({ prefix }), prefix).toThrow(/cms\.storage\.s3\.prefix/)
    }
  })

  it('stores the address of each delivery mode: the app path, or the bucket\'s own with the prefix', () => {
    const prefix = 'sites/7f3a'
    expect(driver({ prefix, delivery: 'proxy' }).url('2026/11/a.png')).toBe('/api/cms/_media/raw/2026/11/a.png')
    expect(driver({ prefix, delivery: 'redirect' }).url('2026/11/a.png')).toBe('/api/cms/_media/raw/2026/11/a.png')
    expect(driver({ prefix, delivery: 'public' }).url('2026/11/a.png')).toBe(`${s3.endpoint}/media/sites/7f3a/2026/11/a.png`)
    expect(driver({ prefix, publicBaseUrl: 'https://cdn.example.com/' }).url('2026/11/a.png')).toBe('https://cdn.example.com/sites/7f3a/2026/11/a.png')
  })

  it('a key cannot leave the prefix: refused before any request', async () => {
    const d = driver({ prefix: 'sites/a' })
    await driver({ prefix: 'sites/b' }).put('2026/11/secret.png', Buffer.from('b\'s'), 'image/png')
    s3.requests.length = 0
    for (const key of ['../b/2026/11/secret.png', '2026/../../b/2026/11/secret.png', '..', 'a//b', '/sites/b/2026/11/secret.png']) {
      for (const call of [() => d.read(key), () => d.get(key), () => d.put(key, Buffer.from('x'), 'image/png'), () => d.delete(key), () => d.presign!(key, 60)]) {
        expect(((await call().catch((e: any) => e)) as any).statusCode, key).toBe(400)
      }
    }
    expect(s3.requests).toHaveLength(0)
    expect(keys()).toEqual(['sites/b/2026/11/secret.png'])
  })

  it('two prefixes in one bucket never see each other\'s objects', async () => {
    const a = driver({ prefix: 'sites/a' })
    const b = driver({ prefix: 'sites/b' })
    const bare = driver()
    // The same key on each: three different objects.
    await a.put('2026/11/same.txt', Buffer.from('from a'), 'text/plain')
    await b.put('2026/11/same.txt', Buffer.from('from b'), 'text/plain')
    await bare.put('2026/11/same.txt', Buffer.from('from the root'), 'text/plain')
    await a.put('2026/11/only-a.txt', Buffer.from('only a'), 'text/plain')
    expect(keys()).toEqual(['2026/11/same.txt', 'sites/a/2026/11/only-a.txt', 'sites/a/2026/11/same.txt', 'sites/b/2026/11/same.txt'])

    expect((await a.get('2026/11/same.txt'))!.body.toString()).toBe('from a')
    expect((await b.get('2026/11/same.txt'))!.body.toString()).toBe('from b')
    expect((await bare.get('2026/11/same.txt'))!.body.toString()).toBe('from the root')
    // A file of one is not there for the other, however it is asked for.
    expect(await b.get('2026/11/only-a.txt')).toBeNull()
    expect(await b.read('2026/11/only-a.txt')).toBeNull()
    expect(await bare.read('2026/11/only-a.txt')).toBeNull()
    expect(await text(await a.read('2026/11/only-a.txt'))).toBe('only a')
    // A prefix that merely starts the same is another place.
    const longer = driver({ prefix: 'sites/a2' })
    expect(await longer.get('2026/11/only-a.txt')).toBeNull()

    // Deleting on b leaves a's and the root's.
    await b.delete('2026/11/same.txt')
    await b.delete('2026/11/only-a.txt')
    expect(keys()).toEqual(['2026/11/same.txt', 'sites/a/2026/11/only-a.txt', 'sites/a/2026/11/same.txt'])
    expect((await a.get('2026/11/same.txt'))!.body.toString()).toBe('from a')

    // A signed address of a is a's object, not b's.
    expect(new URL(await a.presign!('2026/11/same.txt', 60)).pathname).toBe('/media/sites/a/2026/11/same.txt')
    expect(new URL(await b.presign!('2026/11/same.txt', 60)).pathname).toBe('/media/sites/b/2026/11/same.txt')
  })
})

describe('the command line with a prefix (backup, restore, export, import)', () => {
  let s3: FakeS3
  beforeEach(async () => { s3 = await startFakeS3() })
  afterEach(() => s3.close())
  const s3Settings = (prefix?: string) => ({ endpoint: s3.endpoint, region: s3.region, bucket: s3.bucket, accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey, prefix })
  const env = (extra: Record<string, string> = {}) => ({
    NUXT_CMS_STORAGE_DRIVER: 's3', NUXT_CMS_STORAGE_S3_ENDPOINT: s3.endpoint, NUXT_CMS_STORAGE_S3_REGION: s3.region, NUXT_CMS_STORAGE_S3_BUCKET: s3.bucket,
    NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID: s3.accessKeyId, NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY: s3.secretAccessKey, ...extra,
  })

  it('reads the prefix from the environment and from the module options, the environment first', () => {
    expect(settingsFrom('/site', env({ NUXT_CMS_STORAGE_S3_PREFIX: 'sites/7f3a' }), {}).storage.s3.prefix).toBe('sites/7f3a')
    expect(settingsFrom('/site', env(), { storage: { s3: { prefix: 'sites/from-config' } } }).storage.s3.prefix).toBe('sites/from-config')
    expect(settingsFrom('/site', env({ NUXT_CMS_STORAGE_S3_PREFIX: 'sites/env' }), { storage: { s3: { prefix: 'sites/from-config' } } }).storage.s3.prefix).toBe('sites/env')
    expect(settingsFrom('/site', env(), {}).storage.s3.prefix).toBe('')
  })

  it('a backup of a prefixed site holds exactly its files, under their keys without the prefix; a restore puts them back under the target\'s prefix', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'prefix-backup-'))
    try {
      // The bucket is shared: two sites' files, and one at the root, under the same keys.
      const put = (path: string, body: string) => s3.objects.set(path, { body: Buffer.from(body), size: body.length, type: 'text/plain', etag: '"x"' })
      put('sites/a/2026/11/one.txt', 'a one')
      put('sites/a/2026/11/two.txt', 'a two')
      put('sites/b/2026/11/one.txt', 'b one')
      put('2026/11/one.txt', 'root one')

      // What `tinyzoo backup` does with the rows of site a's database.
      const source = mediaStore({ driver: 's3', localDir: '', s3: { ...s3Settings('sites/a') } })
      const rows = [{ key: '2026/11/one.txt', mime: 'text/plain' }, { key: '2026/11/two.txt', mime: 'text/plain' }, { key: '2026/11/gone.txt', mime: 'text/plain' }]
      const { media, missing } = await copyMedia(source, rows, join(dir, 'media'))
      expect(media.map((m) => m.key).sort()).toEqual(['2026/11/one.txt', '2026/11/two.txt'])
      expect(missing).toEqual(['2026/11/gone.txt'])
      expect(readFileSync(join(dir, 'media/2026/11/one.txt'), 'utf8')).toBe('a one')
      expect(readFileSync(join(dir, 'media/2026/11/two.txt'), 'utf8')).toBe('a two')
      expect((await source.read('2026/11/one.txt'))!.body.toString()).toBe('a one')

      // A restore into site c's place (another prefix, same bucket): its files land there and nowhere else.
      const target = mediaStore({ driver: 's3', localDir: '', s3: { ...s3Settings('sites/c') } })
      await target.write('2026/11/one.txt', readFileSync(join(dir, 'media/2026/11/one.txt')), 'text/plain')
      await target.write('2026/11/two.txt', readFileSync(join(dir, 'media/2026/11/two.txt')), 'text/plain')
      expect([...s3.objects.keys()].sort()).toEqual([
        '2026/11/one.txt', 'sites/a/2026/11/one.txt', 'sites/a/2026/11/two.txt', 'sites/b/2026/11/one.txt', 'sites/c/2026/11/one.txt', 'sites/c/2026/11/two.txt',
      ])
      expect(s3.objects.get('sites/c/2026/11/two.txt')!.body!.toString()).toBe('a two')
      expect(s3.objects.get('sites/a/2026/11/one.txt')!.body!.toString()).toBe('a one')
      expect(s3.requests.filter((r) => !r.ok)).toEqual([])
    }
    finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('a backup store without a prefix reads and writes the bucket\'s root, as before', async () => {
    const store = mediaStore({ driver: 's3', localDir: '', s3: s3Settings() })
    await store.write('2026/11/a.txt', Buffer.from('root'), 'text/plain')
    expect([...s3.objects.keys()]).toEqual(['2026/11/a.txt'])
    expect((await store.read('2026/11/a.txt'))!.body.toString()).toBe('root')
  })

  it('refuses a prefix that is not clean', () => {
    expect(() => mediaStore({ driver: 's3', localDir: '', s3: s3Settings('../other') })).toThrow(/cms\.storage\.s3\.prefix/)
    expect(() => storageFromSettings({ driver: 's3', localDir: '', s3: s3Settings('/sites') })).toThrow(/cms\.storage\.s3\.prefix/)
  })

  it('the export and import storage reads, writes and addresses files the way the running site does', async () => {
    const proxy = storageFromEnv(tmpdir(), env({ NUXT_CMS_STORAGE_S3_PREFIX: 'sites/7f3a/' }))
    await proxy.put('2026/11/a.png', Buffer.from('png'), 'image/png')
    expect([...s3.objects.keys()]).toEqual(['sites/7f3a/2026/11/a.png'])
    expect((await proxy.get('2026/11/a.png'))!.toString()).toBe('png')
    expect(await proxy.get('2026/11/other.png')).toBeNull()
    expect(proxy.url('2026/11/a.png')).toBe('/api/cms/_media/raw/2026/11/a.png')
    const pub = storageFromEnv(tmpdir(), env({ NUXT_CMS_STORAGE_S3_PREFIX: 'sites/7f3a', NUXT_CMS_STORAGE_S3_DELIVERY: 'public' }))
    expect(pub.url('2026/11/a.png')).toBe(`${s3.endpoint}/media/sites/7f3a/2026/11/a.png`)
    // Another prefix in the same bucket is another place: an archive records which one it came from.
    const other = storageFromEnv(tmpdir(), env({ NUXT_CMS_STORAGE_S3_PREFIX: 'sites/other' }))
    const root = storageFromEnv(tmpdir(), env())
    expect(new Set([proxy.identity, other.identity, root.identity]).size).toBe(3)
    expect(proxy.identity).toBe(pub.identity)
    expect(proxy.describe).toContain('sites/7f3a')
  })
})

import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pickStaticImage } from '../../packages/cms/app/image/pick'
import { CMS_IMAGE_WIDTHS } from '../../packages/cms/shared/image-widths'
import { prepareStaticImages, staticImageWidths } from '../../packages/cms/src/staticImages'

// The pictures in a site's public/ folder get their smaller copies when the site is built, and
// <NuxtImg> (tinyzoo's provider for @nuxt/image) only picks one: nothing is resized while a
// visitor waits (src/staticImages.ts, app/image/provider.ts).

const sharp = createRequire(join(process.cwd(), 'packages/cms/package.json'))('sharp')
let root: string
const publicDir = () => join(root, 'public')
const outDir = () => join(root, 'out')

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'tz-static-images-'))
  mkdirSync(join(publicDir(), 'img', 'team'), { recursive: true })
  writeFileSync(join(publicDir(), 'img', 'team', 'Hala č. 2.jpg'), await sharp({ create: { width: 1000, height: 500, channels: 3, background: '#f4a' } }).jpeg().toBuffer())
  // Taken upright on a phone: stored 800 × 600 with EXIF orientation 6 (turn 90°).
  writeFileSync(join(publicDir(), 'img', 'portrait.jpg'), await sharp({ create: { width: 800, height: 600, channels: 3, background: '#4af' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer())
  writeFileSync(join(publicDir(), 'icon.png'), await sharp({ create: { width: 64, height: 64, channels: 4, background: '#000' } }).png().toBuffer())
  writeFileSync(join(publicDir(), 'notes.txt'), 'not a picture')
  writeFileSync(join(publicDir(), 'broken.jpg'), 'not a picture either')
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('copies made at build', () => {
  it('makes WebP copies at the widths smaller than each picture and at its own, and lists the pictures by their address', async () => {
    const manifest = await prepareStaticImages(publicDir(), outDir())
    expect(Object.keys(manifest).sort()).toEqual(['/img/portrait.jpg', '/img/team/Hala č. 2.jpg'])
    const team = manifest['/img/team/Hala č. 2.jpg']!
    expect(team).toMatchObject({ width: 1000, height: 500, w: [...CMS_IMAGE_WIDTHS.filter((w) => w < 1000), 1000] })
    expect(readdirSync(join(outDir(), team.h)).sort()).toEqual(team.w.map((w) => `${w}.webp`).sort())
    const meta = await sharp(join(outDir(), team.h, '480.webp')).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 480, 240])
  })

  it('makes a photo its camera turned upright, and gives its upright size', async () => {
    const manifest = await prepareStaticImages(publicDir(), outDir())
    const portrait = manifest['/img/portrait.jpg']!
    expect([portrait.width, portrait.height]).toEqual([600, 800])
    const meta = await sharp(join(outDir(), portrait.h, '600.webp')).metadata()
    expect([meta.width, meta.height]).toEqual([600, 800])
  })

  it('makes only what is missing on the next build', async () => {
    const manifest = await prepareStaticImages(publicDir(), outDir())
    const file = join(outDir(), manifest['/img/team/Hala č. 2.jpg']!.h, '640.webp')
    const before = statSync(file).mtimeMs
    await prepareStaticImages(publicDir(), outDir())
    expect(statSync(file).mtimeMs).toBe(before)
  })

  it('removes the copies of a picture that changed, so a build never ships its old version', async () => {
    const file = join(publicDir(), 'img', 'changing.jpg')
    writeFileSync(file, await sharp({ create: { width: 700, height: 400, channels: 3, background: '#111' } }).jpeg().toBuffer())
    const first = (await prepareStaticImages(publicDir(), outDir()))['/img/changing.jpg']!.h
    writeFileSync(file, await sharp({ create: { width: 700, height: 400, channels: 3, background: '#eee' } }).jpeg().toBuffer())
    const second = (await prepareStaticImages(publicDir(), outDir()))['/img/changing.jpg']!.h
    expect(second).not.toBe(first) // new contents, new addresses
    expect(readdirSync(outDir())).toContain(second)
    expect(readdirSync(outDir())).not.toContain(first)
    rmSync(file)
    await prepareStaticImages(publicDir(), outDir())
    expect(readdirSync(outDir())).not.toContain(second)
  })

  it('has no copies for a picture no wider than the smallest width', () => {
    expect(staticImageWidths(320)).toEqual([320])
    expect(staticImageWidths(700)).toEqual([320, 480, 640, 700])
  })
})

describe('the copy <NuxtImg> gets', () => {
  const manifest = { '/img/team.jpg': { h: 'abc', width: 1000, height: 500, w: [320, 480, 640, 750, 828, 960, 1000] } }

  it('is the smallest copy at least as wide as asked, the largest when none is, the full one when no size is asked', () => {
    expect(pickStaticImage(manifest, '/img/team.jpg', { width: 700 })).toBe('/_tz/img/abc/750.webp')
    expect(pickStaticImage(manifest, '/img/team.jpg', { width: 640 })).toBe('/_tz/img/abc/640.webp')
    expect(pickStaticImage(manifest, '/img/team.jpg', { width: 2880 })).toBe('/_tz/img/abc/1000.webp')
    expect(pickStaticImage(manifest, '/img/team.jpg', {})).toBe('/_tz/img/abc/1000.webp')
    // only a height: the width that goes with it (240 high is 480 wide)
    expect(pickStaticImage(manifest, '/img/team.jpg', { height: 240 })).toBe('/_tz/img/abc/480.webp')
  })

  it('finds the picture by its address however it was written, under the site\'s base', () => {
    expect(pickStaticImage({ '/img/Hala č. 2.jpg': manifest['/img/team.jpg'] }, '/img/Hala%20%C4%8D.%202.jpg?v=2', { width: 300 }, '/web/')).toBe('/web/_tz/img/abc/320.webp')
  })

  it('knows nothing of other pictures: they are served as they are', () => {
    expect(pickStaticImage(manifest, '/img/other.jpg', { width: 300 })).toBeNull()
    expect(pickStaticImage(manifest, 'https://example.com/img/team.jpg', { width: 300 })).toBeNull()
    expect(pickStaticImage(manifest, '/api/cms/_media/raw/2026/01/x.jpg', { width: 300 })).toBeNull()
  })
})

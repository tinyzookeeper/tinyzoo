/**
 * Smaller copies of the pictures in a site's `public/` folder, made when the site is built
 * (and when the dev server starts), never while a visitor waits.
 *
 * `@nuxt/image` resizes with IPX by default: every `<NuxtImg>` request decodes the original
 * on the server, nothing is kept, and a page full of photos decodes them all at once. On a
 * small instance that is how a site runs out of memory. tinyzoo's layer points `@nuxt/image`
 * at its own provider instead (app/image/provider.ts), which only picks one of the copies
 * made here: WebP at the widths of `CMS_IMAGE_WIDTHS` smaller than the picture, plus one at
 * the picture's own width. They are served as static files under `/_tz/img/<hash>/<width>.webp`
 * (the hash is the file's content, so a changed picture gets new addresses), cached for a year.
 *
 * Build-time only (module.ts); never part of a site's server bundle.
 *
 * @internal
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { extname, join, relative, sep } from 'node:path'
import { imageSize } from 'image-size'
import { CMS_IMAGE_WIDTHS } from '../shared/image-widths'

/** Where the copies are served from (a public asset folder of the build). */
export const STATIC_IMAGES_BASE = '/_tz/img'

/** One picture of `public/`: the hash its copies are filed under, its size, and the widths it has copies at (ascending, the last is its own width). */
export interface StaticImage {
  h: string
  width: number
  height: number
  w: number[]
}

/** `/img/team.jpg` (the path a page uses) → the picture. */
export type StaticImageManifest = Record<string, StaticImage>

const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
/** Smaller than this, a picture is served as it is (an icon, a logo): no copies. */
const MIN_WIDTH = CMS_IMAGE_WIDTHS[0] + 1
const QUALITY = 78

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (entry.isFile() && EXTENSIONS.has(extname(entry.name).toLowerCase())) yield path
  }
}

/** The widths a picture `width` px wide gets copies at: the list's smaller ones, and its own. */
export function staticImageWidths(width: number): number[] {
  return [...CMS_IMAGE_WIDTHS.filter((w) => w < width), width]
}

/**
 * Make the copies of every picture in `publicDir` that `outDir` does not have yet, and say
 * which pictures there are. One picture at a time: decoded once, every width drawn from it.
 * Copies already made (an earlier build on this machine) are kept, so only new or changed
 * pictures cost time.
 */
export async function prepareStaticImages(publicDir: string, outDir: string, log: (message: string) => void = () => {}): Promise<StaticImageManifest> {
  const manifest: StaticImageManifest = {}
  if (!existsSync(publicDir)) return manifest
  const { default: sharp } = await import('sharp')
  let made = 0
  for await (const file of walk(publicDir)) {
    const bytes = await readFile(file)
    let width = 0
    let height = 0
    try {
      const size = imageSize(new Uint8Array(bytes))
      // A photo its camera turned (EXIF orientation 5–8) is upright in the copies: so is its size.
      const turned = (size.orientation ?? 1) >= 5
      width = (turned ? size.height : size.width) ?? 0
      height = (turned ? size.width : size.height) ?? 0
    }
    catch { continue } // not a picture after all
    if (width < MIN_WIDTH || !height) continue
    const h = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
    const widths = staticImageWidths(width)
    const dir = join(outDir, h)
    const missing = widths.filter((w) => !existsSync(join(dir, `${w}.webp`)))
    if (missing.length) {
      await mkdir(dir, { recursive: true })
      const base = await sharp(bytes, { failOn: 'none' }).rotate().raw().toBuffer({ resolveWithObject: true })
      const channels = base.info.channels as 1 | 2 | 3 | 4
      for (const w of missing) {
        const raw = sharp(base.data, { raw: { width: base.info.width, height: base.info.height, channels } })
        const out = await (w >= base.info.width ? raw : raw.resize({ width: w })).webp({ quality: QUALITY }).toBuffer()
        // Written under another name first: a build stopped half-way leaves no broken copy behind.
        const target = join(dir, `${w}.webp`)
        await writeFile(`${target}.tmp`, out)
        await rename(`${target}.tmp`, target)
      }
      made++
    }
    // The address a page writes: `/` and forward slashes, whatever the OS.
    const path = '/' + relative(publicDir, file).split(sep).join('/')
    manifest[path] = { h, width, height, w: widths }
  }
  if (made) log(`made the smaller copies of ${made} picture${made === 1 ? '' : 's'} in public/`)
  return manifest
}

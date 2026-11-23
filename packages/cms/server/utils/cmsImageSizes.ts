import { Readable } from 'node:stream'
import { sql } from 'tinyzoo'
import { CMS_IMAGE_WIDTHS } from '../../shared/image-widths'
import { cmsSweepDue } from './cmsBackground'
import { cmsImageJob, cmsSharp } from './cmsImageQueue'

// Smaller copies of uploaded pictures (WebP, at the widths of shared/image-widths.ts), kept
// in storage next to the original: a phone photo shown 300 px wide should not cost the
// visitor 4 MB. <CmsImage> lists them in srcset and the browser picks one.
//
// They are made after the upload, in the background (`makeMediaSizes`): the picture is
// decoded once and every width is drawn from that, one step at a time through the picture
// queue (cmsImageQueue.ts). A visitor never waits for a resize, and a page full of new
// pictures never decodes a dozen of them at once. A width asked for before it exists (a
// picture from before sizes were made at upload, a width added later) is made on the spot,
// alone, and kept: `imageVariant`.
//
// What was made for which picture is written in `cms_media_sizes` (tinyzoo's own table, in
// the site's schema like `cms_media`): the background worker picks up every picture that has no row,
// or whose row lacks a width added since. A site's older pictures are caught up that way,
// newest first, a few seconds each, without anyone doing anything.
export { CMS_IMAGE_WIDTHS }
const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
/** The mime types the server makes smaller copies of, for SQL. */
const RESIZABLE_LIST = [...RESIZABLE]

/**
 * The most pixels a picture may have (width × height): sharp refuses more. Checked at upload,
 * so a picture that could never be shown at a smaller size is not accepted in the first place.
 * A JPEG is decoded straight at a fraction of its size when only a smaller copy is wanted
 * (shrink-on-load), so even one near the limit does not have to fit in memory whole.
 */
export const MAX_IMAGE_PIXELS = 80_000_000

/** WebP quality of the copies: no visible loss on photos, a third of a JPEG's size. */
const QUALITY = 78

export const isResizableImage = (mime: string | null | undefined) => !!mime && RESIZABLE.has(mime)
const variantKey = (key: string, width: number) => `_w/${width}/${key}.webp`

/** The widths a picture gets copies at: those smaller than the picture itself (the original is the largest candidate). */
export function cmsImageWidthsFor(pictureWidth: number | null | undefined): number[] {
  return CMS_IMAGE_WIDTHS.filter((w) => !pictureWidth || w < pictureWidth)
}

/**
 * The original, read from the store as it is decoded: never held whole in memory (a phone photo
 * is several MB, and a page of them waiting in turn would add up). `null` when it is missing.
 */
async function openOriginal(key: string): Promise<ReturnType<ReturnType<typeof cmsSharp>> | null> {
  const file = await useCmsStorage().read(key)
  if (!file || file.status !== 200 || !file.body) return null
  const decoder = cmsSharp()({ failOn: 'none', limitInputPixels: MAX_IMAGE_PIXELS, sequentialRead: true })
  const source = Readable.fromWeb(file.body as any)
  source.on('error', (err) => decoder.destroy(err))
  source.pipe(decoder)
  return decoder.rotate() // honour the camera's orientation
}

/** One copy at `width`, straight from the original. `null` when the original is missing. */
async function drawWidth(key: string, width: number): Promise<Buffer | null> {
  const original = await openOriginal(key)
  return original ? original.resize({ width, withoutEnlargement: true }).webp({ quality: QUALITY }).toBuffer() : null
}

// One resize per picture and width at a time, even when many visitors ask at once.
// (Per site: each site has its own files.)
const inflight = cmsSiteScoped(() => new Map<string, Promise<Buffer | null>>())

/**
 * The picture `key` at `width` px as WebP: from storage, or made now (in the queue's `now`
 * lane, ahead of background work) and stored for the next visitor.
 */
export async function imageVariant(key: string, width: number): Promise<Buffer | null> {
  const storage = useCmsStorage()
  const vk = variantKey(key, width)
  const stored = await storage.get(vk)
  if (stored) return stored.body
  let job = inflight().get(vk)
  if (!job) {
    job = (async () => {
      // The original is read in its turn, not before: a page of new pictures waiting in the
      // queue must not hold all their originals in memory meanwhile.
      const out = await cmsImageJob(() => drawWidth(key, width), 'now')
      if (out) await storage.put(vk, out, 'image/webp')
      return out
    })().finally(() => inflight().delete(vk))
    inflight().set(vk, job)
  }
  const out = await job
  // The picture's other widths are probably missing too: make them in the background.
  if (out) kickMediaSizes()
  return out
}

// Pictures whose sizes this instance is making now, and those deleted meanwhile: a delete
// waits for the step that is running and stops the rest, so no copy is written after the
// picture's copies were removed. (Another replica's worker may still leave one behind in
// that moment; it is a stray file in the store, never served: the row is gone.)
// Per site: each site has its own files and worker run.
const working = cmsSiteScoped(() => new Map<string, Promise<unknown>>())
const deleted = cmsSiteScoped(() => new Set<string>())

/** Remove the smaller copies of a picture (with the original). Missing ones are fine. */
export async function deleteImageVariants(key: string): Promise<void> {
  const storage = useCmsStorage()
  const busy = working().get(key)
  if (busy) {
    deleted().add(key)
    await busy.catch(() => {})
  }
  await Promise.all(CMS_IMAGE_WIDTHS.map((w) => storage.delete(variantKey(key, w)).catch(() => {})))
}

interface PictureRow { id: string; key: string; mime: string; width: number | null; height: number | null; made: string | null }

/**
 * Make every missing width of one picture: decode it once (at the largest width it needs,
 * a JPEG straight at that size), then draw each width from that. Every step is its own job
 * in the background lane, so a visitor's resize goes between two of them. Widths already
 * made (`made`) are left as they are.
 */
export async function makeMediaSizes(picture: { key: string; width: number | null; height: number | null }, made: readonly number[] = []): Promise<number[]> {
  const wanted = cmsImageWidthsFor(picture.width).filter((w) => !made.includes(w))
  if (!wanted.length) return []
  if (picture.width && picture.height && picture.width * picture.height > MAX_IMAGE_PIXELS) return []
  const job = drawAll(picture.key, wanted)
  working().set(picture.key, job)
  try {
    return await job
  }
  finally {
    working().delete(picture.key)
    deleted().delete(picture.key)
  }
}

async function drawAll(key: string, wanted: number[]): Promise<number[]> {
  const storage = useCmsStorage()
  const largest = Math.max(...wanted)
  // The decoded picture at the largest wanted width: raw pixels, at most 2560 wide (about
  // 13 MB for a photo), held while its widths are drawn.
  const base = await cmsImageJob(async () => {
    const original = await openOriginal(key)
    return original ? original.resize({ width: largest, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true }) : null
  }, 'background')
  if (!base) return []
  const { width, height } = base.info
  const channels = base.info.channels as 1 | 2 | 3 | 4
  const done: number[] = []
  for (const w of [...wanted].sort((a, b) => b - a)) {
    if (deleted().has(key)) break
    const out = await cmsImageJob(() => {
      const raw = cmsSharp()(base.data, { raw: { width, height, channels } })
      return (w >= width ? raw : raw.resize({ width: w })).webp({ quality: QUALITY }).toBuffer()
    }, 'background')
    if (deleted().has(key)) break
    await storage.put(variantKey(key, w), out, 'image/webp')
    done.push(w)
  }
  return done
}

// ── the background worker ────────────────────────────────────────────────

/** How long a picture may stay claimed by an instance before another one takes it over (that one stopped mid-way). */
const CLAIM_MINUTES = 10
/** A picture that failed is tried again this many times in all, an hour apart; then it is left (its original still shows). */
const MAX_ATTEMPTS = 3
/** One run of the worker stops after this long; the next one (every minute, or the next upload) goes on. */
const RUN_BUDGET_MS = 50_000

const WIDTHS_TEXT = () => CMS_IMAGE_WIDTHS.join(',')
const parseWidths = (s: string | null | undefined) => String(s ?? '').split(',').map(Number).filter((n) => n > 0)

// Per site: each site has its own table and its own worker run.
// `pending` (multi-tenant mode, for the scheduled task): this instance has a reason to run the worker
// here: nothing is known yet, a picture was uploaded (or asked for) since the last run began, or the
// last run did not get to the end (its time ran out, or it failed). `lastRunAt`: when a run last ended.
const sizes = cmsSiteScoped(() => ({ tableExists: null as boolean | null, running: null as Promise<number> | null, again: false, pending: true, lastRunAt: 0 }))

/** The table exists: a site that updated tinyzoo but has not applied its migration yet only makes sizes on request. */
async function hasTable(db: any): Promise<boolean> {
  const state = sizes()
  if (state.tableExists) return true
  const res: any = await db.execute(sql`select to_regclass('cms_media_sizes') is not null as ok`)
  state.tableExists = Boolean((res.rows ?? res)[0]?.ok)
  return state.tableExists
}

/**
 * The next picture that needs sizes, claimed for this instance (two replicas never work on
 * the same one): one without a row, one whose row lacks widths added since, one another
 * instance left half done, or one that failed less than three times (an hour apart).
 * Newest first: what was just uploaded is on a page soonest.
 */
async function claimNext(db: any): Promise<PictureRow | null> {
  const widths = WIDTHS_TEXT()
  let res: any
  try {
    res = await db.execute(sql`
    with next as (
      select m.id from cms_media m
      left join cms_media_sizes s on s.media_id = m.id
      where m.mime in (${sql.join(RESIZABLE_LIST.map((t) => sql`${t}`), sql`, `)})
        and (m.width is null or m.height is null or m.width * m.height <= ${MAX_IMAGE_PIXELS})
        and (
          s.media_id is null
          or (s.state = 'done' and s.widths <> ${widths})
          or (s.state = 'working' and s.updated_at < now() - make_interval(mins => ${CLAIM_MINUTES}))
          or (s.state = 'failed' and s.attempts < ${MAX_ATTEMPTS} and s.updated_at < now() - interval '1 hour')
        )
      order by m.created_at desc
      limit 1
    )
    insert into cms_media_sizes (media_id, state, attempts, updated_at)
    select id, 'working', 1, now() from next
    on conflict (media_id) do update set state = 'working', updated_at = now(),
      -- tries count again from 1 when only new widths are wanted of a picture that was done
      attempts = case when cms_media_sizes.state = 'done' then 1 else cms_media_sizes.attempts + 1 end
      where cms_media_sizes.state <> 'working' or cms_media_sizes.updated_at < now() - make_interval(mins => ${CLAIM_MINUTES})
    returning media_id`)
  }
  catch (err: any) {
    // The picture was deleted between choosing it and claiming it: nothing to do this round.
    if (err?.code === '23503' || err?.cause?.code === '23503') return null
    throw err
  }
  const id = (res.rows ?? res)[0]?.media_id
  if (!id) return null
  const rows: any = await db.execute(sql`
    select m.id, m.key, m.mime, m.width, m.height, s.widths as made
    from cms_media m join cms_media_sizes s on s.media_id = m.id where m.id = ${id}`)
  return ((rows.rows ?? rows)[0] as PictureRow) ?? null
}

/**
 * Make the sizes of pictures that need them until none is left or the run's time is up. Returns how many
 * pictures were done, and whether it got to the end (false: the time ran out, there may be more).
 */
async function workOnce(): Promise<{ pictures: number; finished: boolean }> {
  await cmsMigrationsReady()
  const { db } = useCms()
  if (!(await hasTable(db))) return { pictures: 0, finished: true }
  const until = Date.now() + RUN_BUDGET_MS
  let pictures = 0
  let finished = false
  while (Date.now() < until) {
    // Multi-tenant mode: the site left the directory while this ran. Its database and folder are being removed: stop.
    if (cmsSiteHasLeft()) { finished = true; break }
    const picture = await claimNext(db)
    if (!picture) { finished = true; break }
    // Widths made on an earlier run (a row that lacks only the ones added since) are kept:
    // only the missing ones are drawn. A row without widths (new, or never finished) makes them all.
    const made = picture.made ? parseWidths(picture.made) : []
    try {
      await makeMediaSizes(picture, made)
      await db.execute(sql`update cms_media_sizes set state = 'done', widths = ${WIDTHS_TEXT()}, error = null, updated_at = now() where media_id = ${picture.id}`)
    }
    catch (err: any) {
      if (cmsSiteHasLeft()) { finished = true; break }
      // A picture the decoder cannot read: its original still shows. Not reported as a server
      // error (nothing is wrong with the site); the status counts it.
      const message = String(err?.message ?? err).slice(0, 300)
      console.warn('[cms] could not make the smaller copies of a picture:', message)
      await db.execute(sql`update cms_media_sizes set state = 'failed', error = ${message}, updated_at = now() where media_id = ${picture.id}`)
    }
    pictures++
  }
  return { pictures, finished }
}

/**
 * Run the worker now (the scheduled task does, every minute). One run per instance at a time:
 * a call while one is running makes it go round once more instead of starting a second.
 */
export function runMediaSizes(): Promise<number> {
  const state = sizes()
  if (state.running) { state.again = true; return state.running }
  state.running = (async () => {
    let total = 0
    try {
      do {
        state.again = false
        // Cleared as the pass begins: a kick during it sets it again (and `again`).
        state.pending = false
        const { pictures, finished } = await workOnce()
        total += pictures
        if (!finished) state.pending = true
      } while (state.again)
    }
    catch (err) {
      state.pending = true
      throw err
    }
    finally {
      state.lastRunAt = Date.now()
    }
    return total
  })().finally(() => { state.running = null })
  return state.running
}

/**
 * Multi-tenant mode: is there a reason to run the worker in the current site now? Not while a run is
 * going. Otherwise: a kick or an unfinished run (`pending`), or the site's turn in the slow rotation,
 * which finds what another instance left (pictures it uploaded, a claim it never finished).
 */
export function mediaSizesMayWantRun(): boolean {
  const state = sizes()
  if (state.running) return false
  return state.pending || cmsSweepDue(useCmsSite().id, state.lastRunAt)
}

/** Start the worker without waiting for it (after an upload): failures are only logged. */
export function kickMediaSizes(): void {
  sizes().pending = true
  runMediaSizes().catch((err) => console.warn('[cms] picture sizes:', String(err?.message ?? err).slice(0, 300)))
}

/** How many pictures have their sizes, wait for them, or could not be resized (for the status). `null`: the table does not exist yet. */
export async function mediaSizesCounts(): Promise<{ done: number; waiting: number; failed: number } | null> {
  const { db } = useCms()
  if (!(await hasTable(db))) return null
  const res: any = await db.execute(sql`
    select
      count(*) filter (where s.state = 'done' and s.widths = ${WIDTHS_TEXT()})::int as done,
      count(*) filter (where s.state = 'failed' and s.attempts >= ${MAX_ATTEMPTS})::int as failed,
      count(*)::int as total
    from cms_media m left join cms_media_sizes s on s.media_id = m.id
    where m.mime in (${sql.join(RESIZABLE_LIST.map((t) => sql`${t}`), sql`, `)})
      and (m.width is null or m.height is null or m.width * m.height <= ${MAX_IMAGE_PIXELS})`)
  const row = (res.rows ?? res)[0] ?? {}
  const done = Number(row.done ?? 0)
  const failed = Number(row.failed ?? 0)
  return { done, failed, waiting: Math.max(0, Number(row.total ?? 0) - done - failed) }
}

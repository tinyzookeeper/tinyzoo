import { eq } from '@my-cms/core'

// PATCH /api/cms/_media/:id — update a file's editable details: alt text (and per
// content language: altLocales { en: '…' }), its library folder, and its focal point
// ({ x, y } in percent; null clears it). Only the fields sent change. Authors may
// change only files they uploaded.
export default defineEventHandler(async (event) => {
  const user = requireCmsUser(event)
  const { db, reg } = useCms()
  const id = getIdParam(event)

  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown> ?? {}
  const text = (v: unknown) => {
    const raw = typeof v === 'string' ? v.trim().slice(0, 1000) : ''
    return raw.length ? raw : null
  }
  const set: Record<string, unknown> = {}
  if ('alt' in body) set.alt = text(body.alt)
  if ('altLocales' in body) {
    const langs = new Set(reg.locales?.locales ?? [])
    const given = body.altLocales && typeof body.altLocales === 'object' ? body.altLocales as Record<string, unknown> : {}
    const clean = Object.fromEntries(Object.entries(given).filter(([k]) => langs.has(k) && k !== reg.locales?.default).map(([k, v]) => [k, text(v)]).filter(([, v]) => v))
    set.altLocales = Object.keys(clean).length ? clean : null
  }
  if ('folder' in body) set.folder = cleanFolder(body.folder)
  if ('focal' in body) {
    const f = body.focal as { x?: unknown; y?: unknown } | null
    const pct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : null)
    const x = f ? pct(f.x) : null
    const y = f ? pct(f.y) : null
    if (f && (x === null || y === null)) throw createError({ statusCode: 422, statusMessage: 'Focal point needs x and y between 0 and 100' })
    set.focalX = x
    set.focalY = y
  }
  if (!Object.keys(set).length) throw createError({ statusCode: 422, statusMessage: 'Nothing to change' })

  const [existing] = await db.select().from(reg.cmsMedia).where(eq(reg.cmsMedia.id, id))
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Media not found' })
  assertMediaOwner(user, existing)

  const [media] = await db.update(reg.cmsMedia).set(set).where(eq(reg.cmsMedia.id, id)).returning()
  if (!media) throw createError({ statusCode: 404, statusMessage: 'Media not found' })
  return media
})

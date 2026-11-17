import { eq } from 'tinyzoo'

// PATCH /api/cms/_media/:id — update a file's editable details: alt text (and per
// content language: altLocales { en: '…' }), its library folder, and its focal point
// ({ x, y } in percent; null clears it). Only the fields sent change. Authors may
// change only files they uploaded.
export default defineEventHandler(async (event) => {
  const user = requireCmsUser(event)
  assertMediaLibrary(user)
  const { db, reg } = useCms()
  const id = getIdParam(event)

  const raw = await readBody(event).catch(() => null)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw createError({ statusCode: 422, statusMessage: 'Expected an object' })
  const body = raw as Record<string, unknown>
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
  // Edited on the library page (`keep`): someone cares about it, so it stays.
  if (body.keep === true) set.inLibrary = true
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
  // What visitors see of a file (description, focal point) is live content: people who
  // may not publish cannot change it while the website shows the file.
  const publicChange = 'alt' in set || 'altLocales' in set || 'focalX' in set
  if (publicChange && !canPublish(user) && await isMediaLive(db, reg, id, existing.key)) {
    throw createError({ statusCode: 403, statusMessage: 'This file is on the website; your role cannot change what visitors see' })
  }

  const [media] = await db.update(reg.cmsMedia).set(set).where(eq(reg.cmsMedia.id, id)).returning()
  if (!media) throw createError({ statusCode: 404, statusMessage: 'Media not found' })
  await audit(event, 'media.update', { recordId: id, meta: { fields: Object.keys(set) } })
  // Entries showing the file changed for visitors: tell the website (webhooks, caches).
  if (publicChange) {
    for (const u of await mediaUsage(db, reg, { id: 'system', role: 'admin' }, id, existing.key, 50)) {
      const e = reg.byName.get(u.entity)
      if (!e || u.locale) continue
      const seen = await changeSnapshot(e, u.id)
      if (seen.live) await reportChange(event, { type: 'entry.updated', entity: e, id: u.id, before: seen, noRevision: true })
    }
  }
  return media
})

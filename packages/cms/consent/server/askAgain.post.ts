import { sql } from 'drizzle-orm'
import { forgetConsentSettings, requireConsentReader } from './state'

// POST /api/cms/_p/consent/ask-again — "Ask everyone again": the version of the texts goes up
// by one, so every visitor whose choice was given under an older one sees the banner again.
// For when what the cookies are used for changes (a new tool, a new purpose).
export default defineEventHandler(async (event) => {
  requireConsentReader(event)
  const { db, reg } = useCms()
  const e = reg.byName.get('consent_settings')
  if (!e) throw createError({ statusCode: 404, statusMessage: 'Cookie consent is not set up' })
  const t = e.table as any
  const lock = 'cms-global:' + e.name
  const version = await db.transaction(async (tx: any) => {
    // The same lock a save of the settings takes: one change at a time.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lock}))`)
    const [row]: any[] = await tx.select({ id: t.id, version: t.version }).from(t).orderBy(t.createdAt).limit(1).for('update')
    if (!row) {
      const [made]: any[] = await tx.insert(t).values({ version: 2 }).returning({ version: t.version })
      return Number(made.version)
    }
    const next = (Number(row.version) || 1) + 1
    await tx.update(t).set({ version: next, updatedAt: new Date() }).where(sql`${t.id} = ${row.id}`)
    return next
  })
  forgetConsentSettings()
  await audit(event, 'consent.ask-again', { entity: e.name, meta: { version } }).catch(() => {})
  return { version }
})

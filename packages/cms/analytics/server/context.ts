import { eq, sql } from 'drizzle-orm'
import type { ResolvedAnalyticsOptions } from '../options'
import { analyticsOptionsOf } from '../options'
import { timeZoneOf } from '../runtime'
import { cleanPath } from '../core/enrich'
import { localDay, saltFor, type StoredSalt } from '../core/visitor'
import { SALT_KEY } from '../rollup'

/**
 * What the plugin's routes share on one server: its options, whether it collects, the day's
 * salt and which entry each address shows. Each is kept briefly in memory and read again.
 */

/** The plugin's options; 404 when the site does not use the plugin (the routes are not there then anyway). */
export function analyticsOptions(): ResolvedAnalyticsOptions {
  const opts = analyticsOptionsOf(useCms().reg)
  if (!opts) throw createError({ statusCode: 404, statusMessage: 'Analytics are not set up' })
  return opts
}

export const siteTimeZone = (): string => timeZoneOf(analyticsOptionsOf(useCms().reg))

export const today = (): string => localDay(new Date(), siteTimeZone())

/** `NUXT_CMS_ANALYTICS_ENABLED=false` (or 0, off, no) stops collecting on this server. */
export function serverAllowsCollecting(): boolean {
  const v = String(process.env.NUXT_CMS_ANALYTICS_ENABLED ?? '').trim().toLowerCase()
  return !['false', '0', 'off', 'no'].includes(v)
}

// ── the settings (analytics_settings): collect or not ─────────────────────────────
const SETTINGS = 'analytics_settings'
const SETTINGS_MS = 30_000
let settings: { at: number; collect: boolean } | null = null

export function forgetSettings(): void {
  settings = null
}

/** Whether an administrator left collecting on (true until the settings say otherwise). */
export async function settingsAllowCollecting(): Promise<boolean> {
  if (settings && Date.now() - settings.at < SETTINGS_MS) return settings.collect
  const { db, reg } = useCms()
  const e = reg.byName.get(SETTINGS)
  let collect = true
  if (e) {
    const [row]: any[] = await db.select({ collect: (e.table as any).collect }).from(e.table).limit(1)
    if (row && row.collect === false) collect = false
  }
  settings = { at: Date.now(), collect }
  return collect
}

/** Who may read the reports (the plugin's `access`); 403 for anyone else. */
export function requireAnalyticsReader(event: any) {
  const opts = analyticsOptions()
  const user = requireCmsUser(event)
  const role = roleOf(user)
  const accessUser = { ...user, email: user.email ?? '', name: user.name ?? user.email ?? '', locale: user.locale ?? null, base: role?.legacy ? null : role?.base ?? null }
  if (!opts.access({ user: accessUser as any })) {
    throw createError({ statusCode: 403, statusMessage: 'The analytics are for administrators and editors', data: { code: 'analytics-access' } })
  }
  return { opts, user }
}

// ── the day's salt ─────────────────────────────────────────────────────────────────
let salt: StoredSalt | null = null
let saltLoading: Promise<StoredSalt> | null = null

/**
 * The salt of `day`. One row in `cms_state`, replaced on the first visit of a new day (the old
 * one is gone with it), so every server of the site hashes with the same salt.
 */
export async function saltOf(day: string): Promise<string> {
  if (salt && salt.day >= day) return salt.salt
  saltLoading ??= loadSalt(day).finally(() => { saltLoading = null })
  return (await saltLoading).salt
}

async function loadSalt(day: string): Promise<StoredSalt> {
  const { db, reg } = useCms()
  const s = reg.cmsState
  const [row]: any[] = await db.select({ value: s.value }).from(s).where(eq(s.key, SALT_KEY))
  const next = saltFor(row?.value, day)
  if (!next.changed) return (salt = next.salt)
  // Replace only an older day's salt: when two servers start a day at once, the first one wins.
  const value = JSON.stringify(next.salt)
  const res: any = await db.execute(sql`insert into ${s} (key, value, updated_at) values (${SALT_KEY}, ${value}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
    where (${s.value}->>'day') < (excluded.value->>'day') returning value`)
  if (res?.rows?.length) return (salt = next.salt)
  const [won]: any[] = await db.select({ value: s.value }).from(s).where(eq(s.key, SALT_KEY))
  return (salt = saltFor(won?.value, day).salt)
}

// ── which entry an address shows ───────────────────────────────────────────────────
export interface EntryRef { entity: string; id: string; locale: string | null }

const PATHS_MS = 10 * 60_000
let paths: { at: number; map: Map<string, EntryRef> } | null = null
let pathsLoading: Promise<Map<string, EntryRef>> | null = null

export function forgetEntryPaths(): void {
  paths = null
}

/**
 * The entry at an address of the website: every entry of a public collection with a page
 * (`content.path`), at its address in each language (a page tree's nested ones too), as the
 * sitemap and links resolve them. Kept for ten minutes, and forgotten when content changes.
 */
export async function entryAt(path: string): Promise<EntryRef | null> {
  if (!paths || Date.now() - paths.at > PATHS_MS) {
    pathsLoading ??= loadEntryPaths().finally(() => { pathsLoading = null })
    const map = await pathsLoading
    paths = { at: Date.now(), map }
  }
  return paths.map.get(path) ?? null
}

async function loadEntryPaths(): Promise<Map<string, EntryRef>> {
  const { db, reg } = useCms()
  const map = new Map<string, EntryRef>()
  for (const e of reg.entities) {
    if (!e.content?.public || e.singleton || !e.content.path) continue
    const rows: any[] = await db.select({ id: e.table.id }).from(e.table).limit(50_000)
    if (!rows.length) continue
    const found = await localePaths(db, reg, e, rows.map((r) => String(r.id)))
    for (const [id, byLocale] of found) {
      for (const [locale, p] of Object.entries(byLocale)) {
        const clean = cleanPath(p)
        if (clean && !map.has(clean)) map.set(clean, { entity: e.name, id: String(id), locale: locale || null })
      }
    }
  }
  return map
}

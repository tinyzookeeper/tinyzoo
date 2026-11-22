import { createHash } from 'node:crypto'
import { eq, inArray, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { chooseLogos, iconCandidates, LOGO_MAX_BYTES, logoRef, sniffImage, type ChosenLogo, type LogoFit, type LogoRef } from '#keeper/logo'
import type { CmsStatus } from '#keeper/types/status'

/**
 * Logos: a site's comes from the site itself (its status's brand icon, else the icons its home
 * page names); a team or a workspace may have an uploaded one, and otherwise borrows (chooseLogos
 * in shared/logo.ts). Pictures are stored once by their content (schema.logos) and served at
 * /api/logos/<hash>.
 */

const TIMEOUT_MS = 10_000
const USER_AGENT = 'tinyzoo-keeper/0.1 (+logo)'
// A site whose logo did not change is asked again at most this often (its home page and icons).
const RECHECK_MS = 24 * 60 * 60_000

/** Read a response body up to `max` bytes; null when it is longer. */
async function readCapped(res: Response, max: number): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get('content-length'))
  if (declared > max) return null
  const reader = res.body?.getReader()
  if (!reader) return new Uint8Array()
  const parts: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => {})
      return null
    }
    parts.push(value)
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.byteLength
  }
  return out
}

async function get(url: string, accept: string): Promise<Response | null> {
  if (!/^https?:\/\//i.test(url)) return null
  try {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) })
    return res.ok ? res : null
  }
  catch {
    return null
  }
}

/** A picture at an address: its bytes and type (read from the bytes), or null. */
export async function fetchImage(url: string): Promise<{ bytes: Buffer; type: string } | null> {
  const res = await get(url, 'image/*')
  if (!res) return null
  const bytes = await readCapped(res, LOGO_MAX_BYTES).catch(() => null)
  const type = bytes?.byteLength ? sniffImage(bytes) : null
  return bytes && type ? { bytes: Buffer.from(bytes), type } : null
}

/** Keep a picture (once per content) and answer its hash. */
export async function storeLogo(bytes: Buffer, type: string, fit: LogoFit): Promise<string> {
  const hash = createHash('sha256').update(bytes).digest('hex')
  await useDb().insert(schema.logos).values({ hash, type, bytes, fit }).onConflictDoNothing()
  return hash
}

/** Remove a stored picture that no site, team or workspace points at any more. */
export async function dropUnusedLogo(hash: string | null | undefined): Promise<void> {
  if (!hash) return
  await useDb().execute(sql`
    delete from "logos" l where l."hash" = ${hash}
      and not exists (select 1 from "sites" s where s."logo_hash" = l."hash")
      and not exists (select 1 from "teams" t where t."logo_hash" = l."hash")
      and not exists (select 1 from "workspaces" w where w."logo_hash" = l."hash")`)
}

/** Remove every stored picture nothing points at (a deleted site, team or workspace): the daily task. */
export async function pruneLogos(): Promise<void> {
  await useDb().execute(sql`
    delete from "logos" l where
      not exists (select 1 from "sites" s where s."logo_hash" = l."hash")
      and not exists (select 1 from "teams" t where t."logo_hash" = l."hash")
      and not exists (select 1 from "workspaces" w where w."logo_hash" = l."hash")`)
}

/** The address a site's brand icon is at (tinyzoo 1.9+), or null. */
export function brandIconUrl(siteUrl: string, status: CmsStatus | null | undefined): string | null {
  const icon = status?.brand?.icon
  if (!icon) return null
  try {
    const u = new URL(icon, `${siteUrl}/`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  }
  catch {
    return null
  }
}

type SiteLogoRow = Pick<typeof schema.sites.$inferSelect, 'id' | 'url' | 'logoHash' | 'logoSource' | 'logoCheckedAt'>

/**
 * Look for the site's logo when it is due: at once when its brand icon has a new address (a new
 * logo: the address carries the file's version), otherwise once a day. The brand icon first
 * (tinyzoo's 180 px PNG on white), else the icons the home page names, else /favicon.ico. A failed
 * look keeps the logo Keeper has.
 */
export async function refreshSiteLogo(site: SiteLogoRow, status: CmsStatus | null | undefined, now = new Date()): Promise<void> {
  const brand = brandIconUrl(site.url, status)
  const stale = !site.logoCheckedAt || now.getTime() - site.logoCheckedAt.getTime() >= RECHECK_MS
  if (!(brand && brand !== site.logoSource) && !stale) return

  const candidates: { url: string; fit: LogoFit }[] = brand ? [{ url: brand, fit: 'fill' }] : []
  if (!brand) {
    const page = await get(`${site.url}/`, 'text/html')
    const html = page ? await readCapped(page, 512 * 1024).then((b) => (b ? new TextDecoder().decode(b) : ''), () => '') : ''
    candidates.push(...iconCandidates(html, page?.url || `${site.url}/`))
  }

  const db = useDb()
  for (const c of candidates) {
    const image = await fetchImage(c.url)
    if (!image) continue
    const hash = await storeLogo(image.bytes, image.type, c.fit)
    await db.update(schema.sites).set({ logoHash: hash, logoSource: c.url, logoCheckedAt: now }).where(eq(schema.sites.id, site.id))
    if (site.logoHash !== hash) await dropUnusedLogo(site.logoHash)
    return
  }
  await db.update(schema.sites).set({ logoCheckedAt: now }).where(eq(schema.sites.id, site.id))
}

/** An uploaded logo from a multipart form (field `file`): checked by its bytes, at most LOGO_MAX_BYTES. */
export async function readLogoUpload(event: H3Event): Promise<{ bytes: Buffer; type: string }> {
  const declared = Number(getHeader(event, 'content-length'))
  if (declared > LOGO_MAX_BYTES + 64 * 1024) throw createError({ statusCode: 413, statusMessage: 'The logo is larger than 512 KB' })
  const parts = await readMultipartFormData(event).catch(() => undefined)
  const file = parts?.find((p) => p.name === 'file' && p.data?.length)
  if (!file) throw createError({ statusCode: 422, statusMessage: 'Choose a picture' })
  if (file.data.length > LOGO_MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'The logo is larger than 512 KB' })
  const type = sniffImage(file.data)
  if (!type) throw createError({ statusCode: 422, statusMessage: 'That is not a picture Keeper can show: use an SVG, PNG, WebP, JPEG or GIF' })
  return { bytes: Buffer.from(file.data), type }
}

/** How each stored picture sits in its tile, by hash. */
async function fitsOf(hashes: (string | null | undefined)[]): Promise<Map<string, LogoFit>> {
  const ids = [...new Set(hashes.filter((h): h is string => !!h))]
  if (!ids.length) return new Map()
  const rows = await useDb().select({ hash: schema.logos.hash, fit: schema.logos.fit }).from(schema.logos).where(inArray(schema.logos.hash, ids))
  return new Map(rows.map((r) => [r.hash, r.fit]))
}

/** A chosen logo as the browser gets it, with where it was borrowed from. */
export interface ShownLogo {
  logo: LogoRef
  from: ChosenLogo['from'] | null
}

/**
 * The logos the teams and workspaces of these workspaces show (chooseLogos): every team of the
 * workspace counts, also those this person does not see, since the logo is the workspace's.
 */
export async function logosOf(workspaceIds: string[]): Promise<{ teams: Map<string, ShownLogo>; workspaces: Map<string, ShownLogo> }> {
  const empty = { teams: new Map<string, ShownLogo>(), workspaces: new Map<string, ShownLogo>() }
  if (!workspaceIds.length) return empty
  const db = useDb()
  const [workspaces, teams, sites] = await Promise.all([
    db.select({ id: schema.workspaces.id, logoHash: schema.workspaces.logoHash }).from(schema.workspaces).where(inArray(schema.workspaces.id, workspaceIds)),
    db.select({ id: schema.teams.id, workspaceId: schema.teams.workspaceId, name: schema.teams.name, isDefault: schema.teams.isDefault, logoHash: schema.teams.logoHash })
      .from(schema.teams).where(inArray(schema.teams.workspaceId, workspaceIds)),
    db.select({ teamId: schema.sites.teamId, name: schema.sites.name, logoHash: schema.sites.logoHash }).from(schema.sites).where(inArray(schema.sites.workspaceId, workspaceIds)),
  ])
  const chosen = chooseLogos({ workspaces, teams, sites })
  const fits = await fitsOf([...chosen.teams.values(), ...chosen.workspaces.values()].map((c) => c.hash))
  const shown = (c: ChosenLogo): ShownLogo => ({ logo: logoRef(c.hash, fits.get(c.hash))!, from: c.from ?? null })
  return {
    teams: new Map([...chosen.teams].map(([id, c]) => [id, shown(c)])),
    workspaces: new Map([...chosen.workspaces].map(([id, c]) => [id, shown(c)])),
  }
}

/** Put an uploaded logo on a team or workspace (null removes it), dropping the picture it had when nothing else uses it. */
export async function setOwnLogo(kind: 'team' | 'workspace', id: string, upload: { bytes: Buffer; type: string } | null): Promise<void> {
  const db = useDb()
  const table = kind === 'team' ? schema.teams : schema.workspaces
  const [row] = await db.select({ logoHash: table.logoHash }).from(table).where(eq(table.id, id))
  const hash = upload ? await storeLogo(upload.bytes, upload.type, 'pad') : null
  await db.update(table).set({ logoHash: hash }).where(eq(table.id, id))
  if (row?.logoHash && row.logoHash !== hash) await dropUnusedLogo(row.logoHash)
}

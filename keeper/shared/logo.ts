// Logos: the pure parts (what a picture is, which icons a page names, whose logo a team or a
// workspace shows). The server's side, which fetches, stores and serves them, is
// server/utils/logos.ts.

/** fill: a square icon that covers its tile (a home-screen icon, opaque). pad: a logo on a white tile, with room around it. */
export type LogoFit = 'fill' | 'pad'

/** A logo as the browser gets it: its address (`/api/logos/<hash>`) and how it sits in its tile. */
export interface LogoRef {
  src: string
  fit: LogoFit
}

/** The largest logo Keeper reads or takes as an upload. */
export const LOGO_MAX_BYTES = 512 * 1024

/** The address of a stored logo. Its hash is the content's, so the address never changes. */
export const logoSrc = (hash: string) => `/api/logos/${hash}`

/** A stored logo as the browser gets it, or null. */
export function logoRef(hash: string | null | undefined, fit: string | null | undefined): LogoRef | null {
  return hash ? { src: logoSrc(hash), fit: fit === 'fill' ? 'fill' : 'pad' } : null
}

/**
 * What a picture is, from its first bytes (never from what the server said it is): PNG, JPEG, GIF,
 * WebP, ICO or SVG; null for anything else (an HTML error page, a script).
 */
export function sniffImage(bytes: Uint8Array): string | null {
  const b = (i: number) => bytes[i] ?? -1
  const ascii = (from: number, text: string) => [...text].every((c, i) => b(from + i) === c.charCodeAt(0))
  if (b(0) === 0x89 && ascii(1, 'PNG')) return 'image/png'
  if (b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF) return 'image/jpeg'
  if (ascii(0, 'GIF8')) return 'image/gif'
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp'
  if (b(0) === 0 && b(1) === 0 && b(2) === 1 && b(3) === 0) return 'image/x-icon'
  // SVG: text whose first element is <svg (after a BOM, an XML declaration, comments, a doctype).
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 2048)).replace(/^﻿/, '')
  const rest = head.replace(/^(\s|<\?xml[\s\S]*?\?>|<!--[\s\S]*?-->|<!doctype[^>]*>)*/i, '')
  if (/^<svg[\s>]/i.test(rest)) return 'image/svg+xml'
  return null
}

/** One icon a page names: where it is and how it sits in a tile. */
export interface IconCandidate {
  url: string
  fit: LogoFit
}

/** A tag's attributes, lower-cased names (`<link rel="icon" href="/x.svg">` → { rel, href }). */
function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1]!.toLowerCase()] = (m[2] ?? m[3] ?? m[4] ?? '').trim()
  }
  return out
}

/** The largest side a `sizes` attribute names (`"32x32 180x180"` → 180, `any` → 1000), 0 when absent. */
function largest(sizes: string | undefined): number {
  if (!sizes) return 0
  if (/\bany\b/i.test(sizes)) return 1000
  return Math.max(0, ...[...sizes.matchAll(/(\d+)\s*x\s*(\d+)/gi)].map((m) => Math.min(Number(m[1]), Number(m[2]))))
}

/**
 * The icons a page names, best first, with the site's /favicon.ico last:
 * 1. `apple-touch-icon` (a square home-screen icon, opaque: it fills its tile), the largest first;
 * 2. `icon` as SVG (sharp at any size), then the other `icon`s, the largest first (these are drawn on a white tile).
 * Only http(s) addresses; relative ones are read against the page's address.
 */
export function iconCandidates(html: string, pageUrl: string): IconCandidate[] {
  const head = html.slice(0, 256 * 1024)
  const touch: { url: string; size: number }[] = []
  const svg: string[] = []
  const other: { url: string; size: number }[] = []
  const resolve = (href: string) => {
    try {
      const u = new URL(href, pageUrl)
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
    }
    catch {
      return null
    }
  }
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attributes(m[0])
    const rel = (a.rel ?? '').toLowerCase().split(/\s+/)
    const url = a.href ? resolve(a.href) : null
    if (!url) continue
    if (rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')) touch.push({ url, size: largest(a.sizes) || 180 })
    else if (rel.includes('icon')) {
      if ((a.type ?? '').toLowerCase() === 'image/svg+xml' || /\.svg(?:[?#]|$)/i.test(url)) svg.push(url)
      else other.push({ url, size: largest(a.sizes) })
    }
  }
  const bySize = (x: { size: number }, y: { size: number }) => y.size - x.size
  const list: IconCandidate[] = [
    ...touch.sort(bySize).map((t) => ({ url: t.url, fit: 'fill' as const })),
    ...svg.map((url) => ({ url, fit: 'pad' as const })),
    ...other.sort(bySize).map((o) => ({ url: o.url, fit: 'pad' as const })),
  ]
  const ico = resolve('/favicon.ico')
  if (ico) list.push({ url: ico, fit: 'pad' })
  return list.filter((c, i) => list.findIndex((d) => d.url === c.url) === i)
}

/** Whose logo something shows: its own upload, or one borrowed from a site or a team. */
export interface ChosenLogo {
  hash: string
  /** Borrowed: from which site or team (its name); absent for its own upload. */
  from?: { kind: 'site' | 'team'; name: string }
}

/**
 * The logo each team and workspace shows:
 * - a team: its own upload; else the logo of its first site by name that has one (a team of one
 *   site shows that site's logo; with several, the order is the one the list shows, so the choice
 *   is easy to predict and to change: upload one);
 * - a workspace: its own upload; else its default team's; else its first team's by name that has one.
 */
export function chooseLogos(input: {
  workspaces: { id: string; logoHash: string | null }[]
  teams: { id: string; workspaceId: string; name: string; isDefault: boolean; logoHash: string | null }[]
  sites: { teamId: string; name: string; logoHash: string | null }[]
}): { teams: Map<string, ChosenLogo>; workspaces: Map<string, ChosenLogo> } {
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
  const teams = new Map<string, ChosenLogo>()
  for (const t of input.teams) {
    if (t.logoHash) {
      teams.set(t.id, { hash: t.logoHash })
      continue
    }
    const site = input.sites.filter((s) => s.teamId === t.id && s.logoHash).sort(byName)[0]
    if (site) teams.set(t.id, { hash: site.logoHash!, from: { kind: 'site', name: site.name } })
  }
  const workspaces = new Map<string, ChosenLogo>()
  for (const w of input.workspaces) {
    if (w.logoHash) {
      workspaces.set(w.id, { hash: w.logoHash })
      continue
    }
    const own = input.teams.filter((t) => t.workspaceId === w.id)
    const team = [...own.filter((t) => t.isDefault), ...own.filter((t) => !t.isDefault).sort(byName)].find((t) => teams.has(t.id))
    if (!team) continue
    const chosen = teams.get(team.id)!
    // A team's own upload is borrowed from the team; a logo the team borrowed keeps naming its site.
    workspaces.set(w.id, { hash: chosen.hash, from: chosen.from ?? { kind: 'team', name: team.name } })
  }
  return { teams, workspaces }
}

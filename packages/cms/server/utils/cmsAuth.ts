import { and, eq, gt, isNull, ne, sql } from '@my-cms/core'
import type { CmsRegistry } from '@my-cms/core'
import { z } from 'zod'

/**
 * Built-in accounts: sessions (sealed cookie via nuxt-auth-utils), one-time links
 * for invites and password resets, and the helpers the auth and team endpoints share.
 *
 * Password hashing is nuxt-auth-utils' scrypt.
 */

export type CmsAuthMode = 'builtin' | 'external'

/** 'builtin' = the CMS owns users and sign-in; 'external' = the host sets event.context.cmsUser. */
export function cmsAuthMode(): CmsAuthMode {
  return ((useRuntimeConfig().cms as any)?.auth?.mode === 'external') ? 'external' : 'builtin'
}

export function assertBuiltinAuth(): void {
  if (cmsAuthMode() !== 'builtin') throw createError({ statusCode: 404, statusMessage: 'Not found' })
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

/** Password rules, shown to people up front: at least 10 characters. */
export const passwordSchema = z.string().min(10, 'At least 10 characters').max(200)
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email())

// ── one-time links ─────────────────────────────────────────────────────────────

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const RESET_TTL_MS = 60 * 60 * 1000

/**
 * Create a one-time link secret for a user. Earlier unused links of the same kind
 * stop working (a resent invite replaces the old one). Only the hash is stored.
 */
export async function issueToken(db: any, reg: CmsRegistry, opts: { userId: string; kind: 'invite' | 'reset'; ttlMs: number; createdBy?: string | null }): Promise<string> {
  const secret = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const t = reg.cmsTokens
  await db.transaction(async (tx: any) => {
    await tx.update(t).set({ usedAt: new Date() })
      .where(and(eq(t.userId, opts.userId), eq(t.kind, opts.kind), isNull(t.usedAt)))
    await tx.insert(t).values({
      userId: opts.userId,
      kind: opts.kind,
      tokenHash: await sha256Hex(secret),
      expiresAt: new Date(Date.now() + opts.ttlMs),
      createdBy: opts.createdBy ?? null,
    })
  })
  return secret
}

/** The valid (unused, unexpired) token row for a secret, with its user — or null. */
export async function findToken(db: any, reg: CmsRegistry, secret: string, kind: 'invite' | 'reset') {
  if (!secret || secret.length > 200) return null
  const t = reg.cmsTokens
  const [row] = await db.select().from(t).where(and(
    eq(t.tokenHash, await sha256Hex(secret)), eq(t.kind, kind), isNull(t.usedAt), gt(t.expiresAt, new Date()),
  ))
  if (!row) return null
  const [user] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.id, row.userId))
  return user ? { token: row, user } : null
}

// ── sessions ───────────────────────────────────────────────────────────────────

/** What the browser's session carries (and `useUserSession()` exposes). */
export function sessionUser(u: any) {
  return { id: u.id as string, email: u.email as string, name: (u.name as string) || u.email, role: u.role as string, locale: (u.locale as string | null) ?? null }
}

/** Sign the person in on this browser (replaces any previous session). */
export async function startCmsSession(event: any, u: any): Promise<void> {
  await replaceUserSession(event, { user: sessionUser(u), cms: { uid: u.id as string, sv: u.sessionVersion as number } } as any)
}

// ── links in emails ────────────────────────────────────────────────────────────

/**
 * Absolute URL of an admin page for links in emails. From `cms.publicUrl`
 * (NUXT_CMS_PUBLIC_URL) — never from the request's Host header, which a client
 * controls (a forged Host would put an attacker's domain in a reset link). Outside
 * production the request origin is accepted so local development needs no setup.
 */
export function adminLink(event: any, path: string): string {
  const configured = String((useRuntimeConfig().cms as any)?.publicUrl || '').replace(/\/+$/, '')
  if (configured) return configured + path
  if (import.meta.dev || process.env.NODE_ENV !== 'production' || process.env.CMS_ALLOW_REQUEST_ORIGIN === '1') {
    return getRequestURL(event).origin + path
  }
  throw createError({ statusCode: 500, statusMessage: 'cms.publicUrl (NUXT_CMS_PUBLIC_URL) must be set to send links by email' })
}

/**
 * The client IP for rate limiting. `cms.auth.ipHeader` (e.g. 'cf-connecting-ip' on
 * Cloudflare) wins when set; otherwise X-Forwarded-For is read through exactly
 * `cms.auth.trustedProxies` hops (default 1: one ingress / load balancer, as on
 * Pushbase). Set 0 when the app is reached directly.
 */
export function clientIp(event: any): string {
  const auth = ((useRuntimeConfig().cms as any)?.auth ?? {}) as { ipHeader?: string; trustedProxies?: number }
  if (auth.ipHeader) {
    const v = getRequestHeader(event, auth.ipHeader)
    if (v) return v.trim().slice(0, 64)
  }
  const socketIp = getRequestIP(event) || undefined
  return pickClientIp(getRequestHeader(event, 'x-forwarded-for'), socketIp, Number(auth.trustedProxies ?? 1))
}

/** Equal-time sign-in failures: verify against a fixed hash when the account does not exist. */
let dummyHash: Promise<string> | undefined
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword('not-a-real-password-just-for-timing')
  return dummyHash
}

/** Advisory lock serialising changes that could remove the last active administrator. */
export const ADMIN_GUARD_LOCK = 72_011_002

/** 409 unless some other active administrator exists (never lock everyone out). */
export async function assertAnotherActiveAdmin(db: any, reg: CmsRegistry, exceptId: string): Promise<void> {
  const u = reg.cmsUsers
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(u)
    .where(and(eq(u.role, 'admin'), eq(u.status, 'active'), ne(u.id, exceptId)))
  if ((row?.n ?? 0) === 0) {
    throw createError({ statusCode: 409, statusMessage: 'There must always be at least one active administrator' })
  }
}

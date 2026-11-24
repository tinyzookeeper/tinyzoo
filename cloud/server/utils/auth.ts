import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { z } from 'zod'
import type { Locale } from '#shared/templates'

export interface Me { id: string; name: string; email: string; locale: Locale; emailVerifiedAt: Date | null }

/**
 * The signed-in person, or 401. The account is read again on every request: a changed
 * password ends old sessions at once.
 */
export async function requireUser(event: H3Event): Promise<Me> {
  const me = await currentUser(event)
  if (!me) throw fail(401, 'auth.signin', 'Sign in first')
  return me
}

/** The signed-in person, or null (a stale session is cleared). */
export async function currentUser(event: H3Event): Promise<Me | null> {
  const session = await getUserSession(event)
  const user = session.user
  if (!user) return null
  const [row] = await useDb().select({
    id: schema.users.id, name: schema.users.name, email: schema.users.email, locale: schema.users.locale,
    emailVerifiedAt: schema.users.emailVerifiedAt, sv: schema.users.sessionVersion,
  }).from(schema.users).where(eq(schema.users.id, user.id))
  if (!row || row.sv !== session.sv) {
    await clearUserSession(event)
    return null
  }
  return { id: row.id, name: row.name, email: row.email, locale: row.locale, emailVerifiedAt: row.emailVerifiedAt }
}

/** Sign a person in. */
export async function startSession(event: H3Event, userId: string): Promise<void> {
  const db = useDb()
  const [row] = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, sv: schema.users.sessionVersion })
    .from(schema.users).where(eq(schema.users.id, userId))
  if (!row) throw fail(403, 'auth.none', 'No such account')
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, userId))
  await replaceUserSession(event, { user: { id: row.id, name: row.name, email: row.email }, sv: row.sv })
}

/**
 * An error the pages can put into words: `code` is a key of the dictionary (`error.<code>`),
 * the message is the English fallback for anything that is not the browser.
 */
export function fail(statusCode: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return createError({ statusCode, statusMessage: message, data: { code, ...extra } })
}

export const emailSchema = z.string().trim().toLowerCase().email().max(254)
export const passwordSchema = z.string().min(10).max(200)
export const nameSchema = z.string().trim().min(1).max(100)
export const localeSchema = z.enum(['cs', 'en'])

/** Parse a JSON body, or 422 naming the first field that is off. */
export async function readInput<T extends z.ZodTypeAny>(event: H3Event, schema: T): Promise<z.infer<T>> {
  const parsed = schema.safeParse(await readBody(event).catch(() => undefined))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path.join('.') || 'input'
    throw fail(422, `input.${field}`, issue ? `${field}: ${issue.message}` : 'Invalid input', { field })
  }
  return parsed.data
}

export const clientIp = (event: H3Event): string => getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'

// Small in-memory limits (the cloud runs as one instance).
const attempts = new Map<string, number[]>()

/** Count this try and say whether `key` is over its limit (sign-ups, reset requests: every try counts). */
export function tooManyAttempts(key: string, max = 10, windowMs = 10 * 60_000): boolean {
  const now = Date.now()
  const list = (attempts.get(key) ?? []).filter((t) => now - t < windowMs)
  list.push(now)
  attempts.set(key, list)
  if (attempts.size > 10_000) attempts.clear()
  return list.length > max
}

/** Failed tries only (sign-in): whether `key` has used them up, noting one more failure, and forgetting them. */
export function isLimited(key: string, max = 10, windowMs = 10 * 60_000): boolean {
  const now = Date.now()
  return (attempts.get(key) ?? []).filter((t) => now - t < windowMs).length >= max
}
export function noteFailure(key: string): void {
  attempts.set(key, [...(attempts.get(key) ?? []), Date.now()].slice(-50))
  if (attempts.size > 10_000) attempts.clear()
}
export function clearAttempts(key: string): void {
  attempts.delete(key)
}

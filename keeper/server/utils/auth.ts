import { and, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { z } from 'zod'

export interface SignedInMember {
  userId: string
  workspaceId: string
  role: 'owner' | 'member'
}

/**
 * The signed-in member of a workspace, or 401. The account and its membership are read
 * again on every request: a removed person or a changed password ends old sessions.
 */
export async function requireMember(event: H3Event): Promise<SignedInMember> {
  const session = await getUserSession(event)
  const user = session.user
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in first' })
  const db = useDb()
  const [row] = await db.select({ sv: schema.users.sessionVersion, role: schema.memberships.role })
    .from(schema.users)
    .innerJoin(schema.memberships, and(eq(schema.memberships.userId, schema.users.id), eq(schema.memberships.workspaceId, user.workspaceId)))
    .where(eq(schema.users.id, user.id))
  if (!row || row.sv !== session.sv) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Sign in again' })
  }
  return { userId: user.id, workspaceId: user.workspaceId, role: row.role }
}

export async function requireOwner(event: H3Event): Promise<SignedInMember> {
  const m = await requireMember(event)
  if (m.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only the owner can do this' })
  return m
}

/** Sign a person in to a workspace (their first one). */
export async function startSession(event: H3Event, userId: string): Promise<void> {
  const db = useDb()
  const [row] = await db.select({
    id: schema.users.id, name: schema.users.name, email: schema.users.email, sv: schema.users.sessionVersion,
    role: schema.memberships.role, workspaceId: schema.workspaces.id, workspaceName: schema.workspaces.name,
  })
    .from(schema.users)
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId))
    .where(eq(schema.users.id, userId))
    .orderBy(schema.memberships.createdAt)
    .limit(1)
  if (!row) throw createError({ statusCode: 403, statusMessage: 'This account is not in any team' })
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, userId))
  await replaceUserSession(event, {
    user: { id: row.id, name: row.name, email: row.email, role: row.role, workspaceId: row.workspaceId, workspaceName: row.workspaceName },
    sv: row.sv,
  })
}

export const emailSchema = z.string().trim().toLowerCase().email().max(254)
export const passwordSchema = z.string().min(10, 'At least 10 characters').max(200)

/** Parse a JSON body, or 422 with the first problem. */
export async function readInput<T extends z.ZodTypeAny>(event: H3Event, schema: T): Promise<z.infer<T>> {
  const parsed = schema.safeParse(await readBody(event).catch(() => undefined))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw createError({ statusCode: 422, statusMessage: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input' })
  }
  return parsed.data
}

// A small in-memory limit for sign-in attempts (Keeper runs as one instance).
const attempts = new Map<string, number[]>()
export function tooManyAttempts(key: string, max = 10, windowMs = 10 * 60_000): boolean {
  const now = Date.now()
  const list = (attempts.get(key) ?? []).filter((t) => now - t < windowMs)
  list.push(now)
  attempts.set(key, list)
  if (attempts.size > 10_000) attempts.clear()
  return list.length > max
}

/** Failed attempts only: whether `key` has used up its tries, noting one more failure, and forgetting them. */
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

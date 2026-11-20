import { and, eq, inArray, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { z } from 'zod'
import type { WorkspaceRole } from '../db/schema'

/**
 * Someone's place in one workspace: their role, and the teams whose sites they see (owners and
 * admins: every team; members and guests: the teams they are on). `leadTeamIds`: the teams they lead.
 */
export interface Membership {
  workspaceId: string
  slug: string
  name: string
  role: WorkspaceRole
  teamIds: string[]
  leadTeamIds: string[]
}

/**
 * Who is asking, and in which workspaces. A session may do whatever each role allows (a guest
 * only looks); a token may do no more than its maker, and a read token only reads.
 */
export interface Access {
  userId: string
  scope: 'read' | 'write'
  via: 'session' | 'token'
  tokenId: string | null
  memberships: Membership[]
}

/** Owners and admins: the workspace, its teams and people, every site. */
export const isManager = (m: Pick<Membership, 'role'>) => m.role === 'owner' || m.role === 'admin'

/** Whether this request may change the sites of a workspace: not a guest, and not a read token. */
export const canWriteIn = (access: Pick<Access, 'scope'>, m: Pick<Membership, 'role'>) => access.scope === 'write' && m.role !== 'guest'

/** Every team this person sees, in all their workspaces. */
export const visibleTeamIds = (access: Pick<Access, 'memberships'>) => access.memberships.flatMap((m) => m.teamIds)

/** All the workspaces someone is in, with what they see in each, by workspace name. */
export async function loadMemberships(userId: string): Promise<Membership[]> {
  const db = useDb()
  const rows = await db.select({ workspaceId: schema.workspaces.id, slug: schema.workspaces.slug, name: schema.workspaces.name, role: schema.workspaceMembers.role })
    .from(schema.workspaceMembers)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.workspaceMembers.workspaceId))
    .where(eq(schema.workspaceMembers.userId, userId))
    .orderBy(sql`lower(${schema.workspaces.name})`)
  if (!rows.length) return []
  const ids = rows.map((r) => r.workspaceId)
  const [teams, mine] = await Promise.all([
    db.select({ id: schema.teams.id, workspaceId: schema.teams.workspaceId }).from(schema.teams).where(inArray(schema.teams.workspaceId, ids)),
    db.select({ teamId: schema.teamMembers.teamId, role: schema.teamMembers.role }).from(schema.teamMembers).where(eq(schema.teamMembers.userId, userId)),
  ])
  const on = new Map(mine.map((t) => [t.teamId, t.role]))
  return rows.map((r) => {
    const all = teams.filter((t) => t.workspaceId === r.workspaceId).map((t) => t.id)
    return {
      ...r,
      teamIds: isManager(r) ? all : all.filter((id) => on.has(id)),
      leadTeamIds: all.filter((id) => on.get(id) === 'lead'),
    }
  })
}

/**
 * The signed-in person, or 401. The account is read again on every request: a changed password
 * ends old sessions, and a changed role or team applies at once.
 */
export async function requireUser(event: H3Event): Promise<{ id: string; name: string; email: string }> {
  const session = await getUserSession(event)
  const user = session.user
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in first' })
  const [row] = await useDb().select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, sv: schema.users.sessionVersion })
    .from(schema.users).where(eq(schema.users.id, user.id))
  if (!row || row.sv !== session.sv) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Sign in again' })
  }
  return { id: row.id, name: row.name, email: row.email }
}

/** The signed-in person (a session, never a token) with their workspaces. */
export async function requireMember(event: H3Event): Promise<Access> {
  const user = await requireUser(event)
  return { userId: user.id, scope: 'write', via: 'session', tokenId: null, memberships: await loadMemberships(user.id) }
}

/** My membership of a workspace named by its slug or id, or 404 (a workspace I am not in does not exist for me). */
export function membershipOf(access: Pick<Access, 'memberships'>, ref: string): Membership {
  const m = access.memberships.find((x) => x.slug === ref || x.workspaceId === ref)
  if (!m) throw createError({ statusCode: 404, statusMessage: 'No such workspace' })
  return m
}

/** The workspace in the address (`/api/w/:ws/…`) and my place in it; with `manager`, an owner or admin only (403). */
export async function requireWorkspace(event: H3Event, opts: { manager?: boolean } = {}): Promise<{ access: Access; m: Membership }> {
  const access = await requireMember(event)
  const m = membershipOf(access, getRouterParam(event, 'ws') ?? '')
  if (opts.manager && !isManager(m)) throw createError({ statusCode: 403, statusMessage: 'Only an owner or admin can do this' })
  return { access, m }
}

/** Sign a person in. The session holds only who they are; where they are is in the address. */
export async function startSession(event: H3Event, userId: string): Promise<void> {
  const db = useDb()
  const [row] = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, sv: schema.users.sessionVersion })
    .from(schema.users).where(eq(schema.users.id, userId))
  if (!row) throw createError({ statusCode: 403, statusMessage: 'No such account' })
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, userId))
  await replaceUserSession(event, { user: { id: row.id, name: row.name, email: row.email }, sv: row.sv })
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

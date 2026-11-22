import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { RESERVED_TEAM_SLUGS, slugify } from '#keeper/slug'
import type { LogoOrigin, Member, MeResponse, Team } from '#keeper/types/keeper'
import type { WorkspaceRole } from '../db/schema'
import type { ShownLogo } from './logos'

// Workspaces, teams and their people: Postyard's model. Workspace › team › site.

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type DbLike = Db | Tx

/** A slug no other workspace has: the name's, numbered when taken. */
export async function uniqueWorkspaceSlug(db: DbLike, name: string): Promise<string> {
  const base = slugify(name, 'workspace')
  const numbered = base + '-%'
  const taken = new Set((await db.select({ slug: schema.workspaces.slug }).from(schema.workspaces)
    .where(sql`${schema.workspaces.slug} = ${base} or ${schema.workspaces.slug} like ${numbered}`)).map((r) => r.slug))
  let slug = base
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
  return slug
}

/** A slug no other team of the workspace has (never "all", which means every team). */
export async function uniqueTeamSlug(db: DbLike, workspaceId: string, name: string): Promise<string> {
  const base = slugify(name, 'team')
  const taken = new Set((await db.select({ slug: schema.teams.slug }).from(schema.teams).where(eq(schema.teams.workspaceId, workspaceId))).map((r) => r.slug))
  let slug = base
  for (let n = 2; taken.has(slug) || RESERVED_TEAM_SLUGS.has(slug); n++) slug = `${base}-${n}`
  return slug
}

/** A new workspace, its owner and its default team "General". */
export async function createWorkspace(db: DbLike, userId: string, name: string): Promise<{ id: string; slug: string }> {
  const slug = await uniqueWorkspaceSlug(db, name)
  const [ws] = await db.insert(schema.workspaces).values({ name, slug }).returning({ id: schema.workspaces.id, slug: schema.workspaces.slug })
  await db.insert(schema.workspaceMembers).values({ workspaceId: ws!.id, userId, role: 'owner' })
  await db.insert(schema.teams).values({ workspaceId: ws!.id, name: 'General', slug: 'general', isDefault: true })
  return ws!
}

/** A team's or workspace's logo as its settings show it: its own, borrowed, or none. */
export function logoOrigin(shown: ShownLogo | undefined): LogoOrigin {
  return { logo: shown?.logo ?? null, ownLogo: !!shown && !shown.from, logoFrom: shown?.from ?? null }
}

/** A name already taken in the workspace (any case) is a 409 with a plain message. */
export function teamNameTaken(err: any): never {
  if (err?.code === '23505' || err?.cause?.code === '23505') throw createError({ statusCode: 409, statusMessage: 'There is already a team with this name' })
  throw err
}

/** Who may give or take which role: an admin never touches owners, and only an owner makes one. */
export function assertMayAssign(me: Pick<Membership, 'role'>, from: WorkspaceRole | null, to: WorkspaceRole): void {
  if (me.role === 'owner') return
  if (from === 'owner' || to === 'owner') throw createError({ statusCode: 403, statusMessage: 'Only an owner can make or change an owner' })
}

/** Team ids that are not this workspace's are refused (422). */
export async function assertTeamsOf(db: DbLike, workspaceId: string, ids: string[]): Promise<void> {
  if (!ids.length) return
  const found = await db.select({ id: schema.teams.id }).from(schema.teams)
    .where(and(eq(schema.teams.workspaceId, workspaceId), inArray(schema.teams.id, ids)))
  if (found.length !== new Set(ids).size) throw createError({ statusCode: 422, statusMessage: 'teamIds: some of these teams do not exist' })
}

/** Put someone on exactly these teams of a workspace (a lead stays a lead where they stay). */
export async function setMemberTeams(db: DbLike, workspaceId: string, userId: string, teamIds: string[]): Promise<void> {
  const ids = [...new Set(teamIds)]
  await assertTeamsOf(db, workspaceId, ids)
  const inWorkspace = db.select({ id: schema.teams.id }).from(schema.teams).where(eq(schema.teams.workspaceId, workspaceId))
  await db.delete(schema.teamMembers).where(and(
    eq(schema.teamMembers.userId, userId),
    inArray(schema.teamMembers.teamId, inWorkspace),
    ids.length ? sql`${schema.teamMembers.teamId} not in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})` : undefined,
  ))
  if (ids.length) await db.insert(schema.teamMembers).values(ids.map((teamId) => ({ teamId, userId, role: 'member' as const }))).onConflictDoNothing()
}

/** The default team of a workspace. */
export async function defaultTeamId(db: DbLike, workspaceId: string): Promise<string | null> {
  const [t] = await db.select({ id: schema.teams.id }).from(schema.teams).where(and(eq(schema.teams.workspaceId, workspaceId), eq(schema.teams.isDefault, true)))
  return t?.id ?? null
}

/** The people of a workspace with their role and teams. */
export async function listMembers(workspaceId: string): Promise<Member[]> {
  const db = useDb()
  const rows = await db.select({
    id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.workspaceMembers.role, lastLoginAt: schema.users.lastLoginAt,
  }).from(schema.workspaceMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.workspaceMembers.userId))
    .where(eq(schema.workspaceMembers.workspaceId, workspaceId))
    .orderBy(schema.workspaceMembers.createdAt)
  const on = await db.select({ userId: schema.teamMembers.userId, teamId: schema.teamMembers.teamId, role: schema.teamMembers.role })
    .from(schema.teamMembers).innerJoin(schema.teams, eq(schema.teams.id, schema.teamMembers.teamId))
    .where(eq(schema.teams.workspaceId, workspaceId))
  return rows.map((r) => ({
    ...r,
    teamIds: on.filter((t) => t.userId === r.id).map((t) => t.teamId),
    leadTeamIds: on.filter((t) => t.userId === r.id && t.role === 'lead').map((t) => t.teamId),
    lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
  }))
}

/** The teams of a workspace this person sees, with their sites and people. */
export async function listTeams(m: Membership): Promise<Team[]> {
  const db = useDb()
  if (!m.teamIds.length) return []
  const rows = await db.select({
    id: schema.teams.id, name: schema.teams.name, slug: schema.teams.slug, isDefault: schema.teams.isDefault,
    // Written out: inside a subquery drizzle leaves columns unqualified.
    sites: sql<number>`(select count(*)::int from "sites" s where s."team_id" = "teams"."id")`,
  }).from(schema.teams).where(inArray(schema.teams.id, m.teamIds)).orderBy(sql`${schema.teams.isDefault} desc`, sql`lower(${schema.teams.name})`)
  const [people, logos] = await Promise.all([
    db.select({ teamId: schema.teamMembers.teamId, userId: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.teamMembers.role })
      .from(schema.teamMembers).innerJoin(schema.users, eq(schema.users.id, schema.teamMembers.userId))
      .where(inArray(schema.teamMembers.teamId, m.teamIds)),
    logosOf([m.workspaceId]),
  ])
  return rows.map((t) => ({
    ...t,
    ...logoOrigin(logos.teams.get(t.id)),
    people: people.filter((p) => p.teamId === t.id).map(({ teamId: _t, ...p }) => p),
    canManage: isManager(m) || m.leadTeamIds.includes(t.id),
  }))
}

/** A team of this workspace I see, or 404. */
export async function teamOf(m: Membership, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !m.teamIds.includes(id)) throw createError({ statusCode: 404, statusMessage: 'No such team' })
  const [team] = await useDb().select().from(schema.teams).where(and(eq(schema.teams.id, id), eq(schema.teams.workspaceId, m.workspaceId)))
  if (!team) throw createError({ statusCode: 404, statusMessage: 'No such team' })
  return team
}

export const teamInput = z.object({
  name: z.string().trim().min(1, 'Give it a name').max(80),
})

/**
 * Move a team, with its sites, to another workspace (Postyard's rules). Every row keeps its id.
 * - Who: an owner or admin of both workspaces.
 * - The source's default team leaves only when it is the source's only team; an empty "General"
 *   is left behind. The target's untouched starting team (an empty "General") makes way, and the
 *   moved team becomes the default there.
 * - Its people join the target as members (guests as guests), never demoted where they already are.
 */
export async function moveTeam(access: Access, from: Membership, teamId: string, toRef: string): Promise<{ workspaceSlug: string; teamSlug: string }> {
  const to = membershipOf(access, toRef)
  if (!isManager(from) || !isManager(to)) throw createError({ statusCode: 403, statusMessage: 'Moving a team takes an owner or admin of both workspaces' })
  if (to.workspaceId === from.workspaceId) throw createError({ statusCode: 422, statusMessage: 'The team is already in this workspace' })
  return useDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4243)`)
    const [team] = await tx.select().from(schema.teams).where(and(eq(schema.teams.id, teamId), eq(schema.teams.workspaceId, from.workspaceId)))
    if (!team) throw createError({ statusCode: 404, statusMessage: 'No such team' })
    const others = await tx.select({ id: schema.teams.id }).from(schema.teams).where(and(eq(schema.teams.workspaceId, from.workspaceId), ne(schema.teams.id, teamId)))
    if (team.isDefault && others.length) throw createError({ statusCode: 422, statusMessage: 'Make another team the default first: the default team leaves only when it is the only one' })

    // The target's starting team, if nobody has used it: it makes way for the one that comes.
    const targetTeams = await tx.select({
      id: schema.teams.id, name: schema.teams.name, isDefault: schema.teams.isDefault,
      sites: sql<number>`(select count(*)::int from "sites" s where s."team_id" = "teams"."id")`,
      people: sql<number>`(select count(*)::int from "team_members" m where m."team_id" = "teams"."id")`,
    }).from(schema.teams).where(eq(schema.teams.workspaceId, to.workspaceId))
    const starter = targetTeams.length === 1 && targetTeams[0]!.isDefault && targetTeams[0]!.name === 'General' && !targetTeams[0]!.sites && !targetTeams[0]!.people ? targetTeams[0]! : null
    if (starter) await tx.delete(schema.teams).where(eq(schema.teams.id, starter.id))

    const slug = await uniqueTeamSlug(tx, to.workspaceId, team.slug)
    const nameClash = targetTeams.some((t) => t.id !== starter?.id && t.name.toLowerCase() === team.name.toLowerCase())
    if (nameClash) throw createError({ statusCode: 409, statusMessage: `${to.name} already has a team called ${team.name}: rename one first` })
    await tx.update(schema.teams).set({ workspaceId: to.workspaceId, slug, isDefault: !!starter || !targetTeams.length })
      .where(eq(schema.teams.id, team.id))
    await tx.update(schema.sites).set({ workspaceId: to.workspaceId, updatedAt: new Date() }).where(eq(schema.sites.teamId, team.id))

    // Its people come along: colleagues as members, guests as guests; nobody is demoted.
    const people = await tx.select({ userId: schema.teamMembers.userId, role: schema.workspaceMembers.role })
      .from(schema.teamMembers)
      .innerJoin(schema.workspaceMembers, and(eq(schema.workspaceMembers.userId, schema.teamMembers.userId), eq(schema.workspaceMembers.workspaceId, from.workspaceId)))
      .where(eq(schema.teamMembers.teamId, team.id))
    if (people.length) {
      await tx.insert(schema.workspaceMembers)
        .values(people.map((p) => ({ workspaceId: to.workspaceId, userId: p.userId, role: (p.role === 'guest' ? 'guest' : 'member') as WorkspaceRole })))
        .onConflictDoNothing()
    }
    // A workspace is never without a team.
    if (!others.length) await tx.insert(schema.teams).values({ workspaceId: from.workspaceId, name: 'General', slug: 'general', isDefault: true })
    const [target] = await tx.select({ slug: schema.workspaces.slug }).from(schema.workspaces).where(eq(schema.workspaces.id, to.workspaceId))
    return { workspaceSlug: target!.slug, teamSlug: slug }
  })
}

/** What the switchers need: every workspace and visible team, with how many sites are down or behind. */
export async function meResponse(user: { id: string; name: string; email: string }, access: Access): Promise<MeResponse> {
  const ids = visibleTeamIds(access)
  const db = useDb()
  const signatures = access.memberships.length
    ? new Map((await db.select({ id: schema.workspaces.id, signature: schema.workspaces.signature }).from(schema.workspaces)
        .where(inArray(schema.workspaces.id, access.memberships.map((m) => m.workspaceId)))).map((w) => [w.id, w.signature]))
    : new Map<string, string>()
  const [teams, sites, latest, logos] = await Promise.all([
    ids.length
      ? db.select({ id: schema.teams.id, workspaceId: schema.teams.workspaceId, name: schema.teams.name, slug: schema.teams.slug, isDefault: schema.teams.isDefault })
        .from(schema.teams).where(inArray(schema.teams.id, ids)).orderBy(sql`${schema.teams.isDefault} desc`, sql`lower(${schema.teams.name})`)
      : [],
    ids.length
      ? db.select({ teamId: schema.sites.teamId, state: schema.sites.state, version: sql<string | null>`${schema.sites.status}->>'tinyzoo'` }).from(schema.sites).where(inArray(schema.sites.teamId, ids))
      : [],
    latestRelease(),
    logosOf(access.memberships.map((m) => m.workspaceId)),
  ])
  const health = (teamIds: string[]) => {
    const own = sites.filter((s) => teamIds.includes(s.teamId))
    return {
      sites: own.length,
      down: own.filter((s) => s.state === 'down').length,
      behind: own.filter((s) => s.version && latest && compareVersions(s.version, latest) < 0).length,
    }
  }
  return {
    user,
    workspaces: access.memberships.map((m) => {
      const own = teams.filter((t) => t.workspaceId === m.workspaceId)
      return {
        id: m.workspaceId,
        slug: m.slug,
        name: m.name,
        logo: logos.workspaces.get(m.workspaceId)?.logo ?? null,
        signature: signatures.get(m.workspaceId) ?? '',
        role: m.role,
        ...health(own.map((t) => t.id)),
        teams: own.map((t) => ({ id: t.id, slug: t.slug, name: t.name, logo: logos.teams.get(t.id)?.logo ?? null, isDefault: t.isDefault, lead: m.leadTeamIds.includes(t.id), ...health([t.id]) })),
      }
    }),
  }
}

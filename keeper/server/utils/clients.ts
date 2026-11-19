import type { H3Event } from 'h3'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Client } from '#keeper/types/keeper'

// The team's clients: folders of sites, and what a person may be limited to.

const emails = z.array(emailSchema).max(20)

export const clientInput = z.object({
  name: z.string().trim().min(1, 'Give it a name').max(120),
  alertEmails: emails.optional(),
})

/** The clients this person sees, with how many sites each has. */
export async function listClients(m: SignedInMember): Promise<Client[]> {
  const rows = await useDb().select({
    id: schema.clients.id, name: schema.clients.name, alertEmails: schema.clients.alertEmails,
    // Written out: inside a subquery drizzle leaves columns unqualified, and "id" would be the site's.
    sites: sql<number>`(select count(*)::int from "sites" s where s."client_id" = "clients"."id")`,
  }).from(schema.clients).where(visibleClients(m)).orderBy(sql`lower(${schema.clients.name})`)
  // Alert addresses are the team's business: only owners and admins see them.
  return rows.map((r) => ({ ...r, alertEmails: isManager(m) ? r.alertEmails : [] }))
}

/** The client in the address, in this workspace, or 404. */
export async function clientOf(event: H3Event, workspaceId: string) {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, statusMessage: 'No such client' })
  const [row] = await useDb().select().from(schema.clients).where(and(eq(schema.clients.id, id), eq(schema.clients.workspaceId, workspaceId)))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such client' })
  return row
}

/** A name already taken in the workspace (any case) is a 409 with a plain message. */
export function nameTaken(err: any): never {
  if (err?.code === '23505' || err?.cause?.code === '23505') throw createError({ statusCode: 409, statusMessage: 'There is already a client with this name' })
  throw err
}

import { and, eq, or, propOf, sql } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'
import { z } from 'zod'

/**
 * Everything stored about one email address (GDPR access and erasure), for the
 * admin's Privacy screen: form submissions whose email fields match, the CMS account
 * with that address, and the audit entries about it.
 *
 * What counts as stored about a person:
 *  - form submissions: rows of a form (defineForm) whose `format: 'email'` text
 *    fields equal the address (case-insensitive, whitespace trimmed) — and their saved
 *    versions and search rows, which hold the same text;
 *  - the account: email, name, role, status, language, sign-in times;
 *  - audit entries: those the account made, those about it (invitation, role change)
 *    and failed sign-ins that tried the address.
 * Not covered: what an editor wrote under their own name in entries or media (that is
 * the site's content, not personal data about a visitor), and copies in backups.
 */

export const privacyBody = z.object({ email: emailSchema.pipe(z.string().max(254)) })

/** Rate limit per signed-in administrator (and per address of the client), so a stolen session cannot scrape quickly. */
export async function privacyRateLimit(event: any, userId: string, kind: 'read' | 'delete'): Promise<void> {
  const [max, windowMs] = kind === 'delete' ? [10, 10 * 60_000] : [60, 10 * 60_000]
  const ok = (await rateLimit(`privacy:${kind}:${userId}`, max, windowMs)) && (await rateLimit(`privacy-ip:${kind}:${clientIp(event)}`, max * 2, windowMs))
  if (!ok) throw createError({ statusCode: 429, statusMessage: 'Too many requests; try again in a few minutes' })
}

/** The text fields of a form that hold an email address. */
function emailFields(e: CmsEntity): string[] {
  const form = (e as any).form as { fields: string[] }
  return form.fields.filter((k) => (e.fields[k] as any)?.type === 'text' && (e.fields[k] as any)?.meta?.format === 'email')
}

const emailMatches = (e: CmsEntity, email: string) => {
  const keys = emailFields(e)
  if (!keys.length) return null
  return or(...keys.map((k) => sql`lower(btrim(${e.table[propOf(k, e.fields[k]!)]})) = ${email}`))
}

export interface FoundSubmission { form: CmsEntity; row: Record<string, any> }

export async function findSubmissions(db: any, reg: CmsRegistry, email: string): Promise<FoundSubmission[]> {
  const out: FoundSubmission[] = []
  for (const e of formEntities(reg)) {
    const where = emailMatches(e, email)
    if (!where) continue
    const rows: any[] = await db.select().from(e.table).where(where).orderBy(sql`${e.table.createdAt} desc`)
    for (const row of rows) out.push({ form: e, row })
  }
  return out
}

/** The condition that picks the audit entries touching a person: theirs, about them, or naming their address. */
export function auditCondition(reg: CmsRegistry, email: string, accountId: string | null) {
  const a = reg.cmsAudit
  const parts = [sql`lower(${a.meta}->>'email') = ${email}`]
  if (accountId) parts.push(eq(a.userId, accountId), and(eq(a.recordId, accountId), sql`${a.action} like 'user.%'`)!)
  return or(...parts)!
}

export async function findAccount(db: any, reg: CmsRegistry, email: string) {
  if (cmsAuthMode() !== 'builtin') return null
  const [row] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.email, email))
  return row ?? null
}

/** The submission as shown to the administrator: the form's own fields, when it arrived, its state. */
export function submissionView(e: CmsEntity, row: Record<string, any>) {
  const form = (e as any).form as { fields: string[] }
  const data: Record<string, unknown> = {}
  for (const k of form.fields) data[k] = row[propOf(k, e.fields[k]!)] ?? null
  return { form: e.name, id: row.id as string, createdAt: row.createdAt as Date, status: (row.status as string | null) ?? null, data }
}

/** The account without secrets (no password hash, no session counter). */
export function accountView(u: any) {
  return { id: u.id as string, email: u.email as string, name: u.name as string, role: u.role as string, status: u.status as string, language: (u.locale as string | null) ?? null, lastLoginAt: u.lastLoginAt as Date | null, createdAt: u.createdAt as Date }
}

export async function findAuditEntries(db: any, reg: CmsRegistry, email: string, accountId: string | null, limit?: number) {
  const a = reg.cmsAudit
  const q = db.select().from(a).where(auditCondition(reg, email, accountId)).orderBy(sql`${a.createdAt} desc`)
  return (limit ? await q.limit(limit) : await q) as any[]
}

/**
 * Erase one person: their form submissions go (with the saved versions and search
 * rows), the account is disabled and anonymised, and the audit entries about them lose
 * their personal fields (email, address, name) but keep who-did-what: the account id
 * stays on them, now pointing at an account with no name or address. Only the erased
 * person's own details go: an administrator's `user.invite` entries keep the invitees'
 * addresses (see `scrubAudit`).
 *
 * Why anonymise instead of delete the account: the history of the site ("saved by …",
 * entries' authors, uploaded files) refers to the account by id; deleting it would
 * leave that history pointing at nobody and break the "who changed this" trail the
 * audit log is for, while anonymising removes every personal detail.
 */
export async function erasePerson(db: any, reg: CmsRegistry, email: string, actorId: string): Promise<{ submissions: number; account: boolean; auditEntries: number }> {
  return db.transaction(async (tx: any) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_GUARD_LOCK})`)
    const account = await findAccount(tx, reg, email)
    if (account) {
      if (account.id === actorId) throw createError({ statusCode: 409, statusMessage: 'You cannot erase your own account; ask another administrator' })
      if (account.role === 'admin' && account.status === 'active') await assertAnotherActiveAdmin(tx, reg, account.id)
    }

    let submissions = 0
    for (const { form, ids } of groupByForm(await findSubmissions(tx, reg, email))) submissions += await purgeSubmissions(tx, reg, form, ids)

    // The audit entries lose what identifies the person — and only that; computed before the
    // account's email changes.
    const auditEntries = await scrubAudit(tx, reg, email, account)

    if (account) {
      const u = reg.cmsUsers
      await tx.update(u).set({
        email: `deleted-${account.id}@anonymised.invalid`,
        name: '', status: 'disabled', role: 'author', passwordHash: null, locale: null, lastLoginAt: null,
        sessionVersion: sql`${u.sessionVersion} + 1`, updatedAt: new Date(),
      }).where(eq(u.id, account.id))
      await tx.delete(reg.cmsTokens).where(eq(reg.cmsTokens.userId, account.id))
    }
    return { submissions, account: !!account, auditEntries }
  })
}

/**
 * Take the erased person's own details out of the audit log, and nobody else's:
 *  - entries that name their address (`meta.email`, any case, whitespace trimmed: a failed
 *    sign-in with it, their invitation, their deletion) and entries about their account
 *    (`user.*` on their id) lose email, IP address and name;
 *  - entries they made themselves lose their IP address and their name — but not an
 *    `email` that is someone else's: the `user.invite` entries of an administrator hold
 *    the invitees' addresses, which belong to the invitees.
 * Returns how many entries were changed.
 */
async function scrubAudit(tx: any, reg: CmsRegistry, email: string, account: { id: string; name: string } | null): Promise<number> {
  const a = reg.cmsAudit
  const isObject = sql`${a.meta} is not null and jsonb_typeof(${a.meta}) = 'object'`
  const touched = new Set<string>()
  const run = async (set: ReturnType<typeof sql>, where: ReturnType<typeof sql>) => {
    const res: any = await tx.execute(sql`update ${a} set meta = nullif(${set}, '{}'::jsonb) where ${isObject} and (${where}) returning ${a.id}`)
    for (const row of res?.rows ?? []) touched.add(String(row.id))
  }
  const strip = sql`${a.meta} - 'email' - 'ip' - 'name'`
  // Naming the address: a sign-in attempt (its IP address went with the attempt) or an entry by somebody
  // else about this person (the actor's own details are not ours to take).
  await run(sql`case when ${a.action} like 'auth.%' then ${strip} else ${a.meta} - 'email' end`, sql`lower(btrim(${a.meta}->>'email')) = ${email}`)
  if (account) {
    await run(strip, sql`${a.recordId} = ${account.id} and ${a.action} like 'user.%' and ${a.meta} ?| array['email', 'ip', 'name']`)
    // Their own entries: their client address, and their name if it is the one on the entry.
    const name = (account.name ?? '').trim().toLowerCase()
    await run(
      sql`case when ${name}::text <> '' and lower(btrim(${a.meta}->>'name')) = ${name} then ${a.meta} - 'ip' - 'name' else ${a.meta} - 'ip' end`,
      sql`${a.userId} = ${account.id} and (${a.meta} ? 'ip' or (${name}::text <> '' and lower(btrim(${a.meta}->>'name')) = ${name}))`,
    )
  }
  return touched.size
}

function groupByForm(found: FoundSubmission[]): { form: CmsEntity; ids: string[] }[] {
  const by = new Map<string, { form: CmsEntity; ids: string[] }>()
  for (const { form, row } of found) {
    const g = by.get(form.name) ?? { form, ids: [] }
    g.ids.push(row.id)
    by.set(form.name, g)
  }
  return [...by.values()]
}


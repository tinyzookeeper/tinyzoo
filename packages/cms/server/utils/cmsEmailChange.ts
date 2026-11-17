import { and, eq, gte, inArray, isNull, ne, sql } from 'tinyzoo'
import type { CmsRegistry } from 'tinyzoo'

/**
 * Changing an account's email address (the database side; the rules are in
 * cmsEmailChangeRules.ts).
 *
 * A person asks with their password; a one-time link (cms_tokens, kind 'email', only
 * its hash stored, 24 hours) goes to the new address, and the address it is for waits
 * in cms_state under `email-change:<userId>` — with the token's id, so only the newest
 * link counts, and the account's session version, so a password change cancels it.
 * Kept in cms_state rather than a new column so that sites need no migration for it;
 * there is at most one row per account, removed when the change is made or cancelled,
 * when it is found dead on reading, when the account is removed or erased, by the daily
 * retention run once expired, and replaced by the next request.
 *
 * Once a change is made, the notice to the old address carries a way back: a one-time
 * link (kind 'email-revert', 7 days) with the old address waiting in cms_state under
 * `email-revert:<userId>:<tokenId>`. Whoever still reads the old mailbox can restore it
 * and choose a new password (POST /api/cms/_auth/email/revert): the answer to someone who
 * knew the password and confirmed a change to their own address at once.
 */

/**
 * Lock the account's row for the rest of the transaction. The routes that claim a link
 * and then end the account's other links (confirm, revert) take it first, so two of
 * them at once wait for each other instead of deadlocking on each other's links.
 */
export async function lockUser(tx: any, reg: CmsRegistry, userId: string): Promise<void> {
  await tx.select({ id: reg.cmsUsers.id }).from(reg.cmsUsers).where(eq(reg.cmsUsers.id, userId)).for('update')
}

/** Ask for a change: a new link (earlier email links stop working) and the address it is for. Returns the link's secret. */
export async function startEmailChange(db: any, reg: CmsRegistry, opts: { userId: string; email: string; sessionVersion: number }): Promise<string> {
  const secret = newLinkSecret()
  const t = reg.cmsTokens
  const s = reg.cmsState
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS)
  await db.transaction(async (tx: any) => {
    await tx.update(t).set({ usedAt: new Date() }).where(and(eq(t.userId, opts.userId), eq(t.kind, 'email'), isNull(t.usedAt)))
    const [row] = await tx.insert(t).values({
      userId: opts.userId, kind: 'email', tokenHash: await sha256Hex(secret), expiresAt, createdBy: opts.userId,
    }).returning({ id: t.id })
    const value: PendingEmailChange = { tokenId: row.id, email: opts.email, sv: opts.sessionVersion, expiresAt: expiresAt.toISOString() }
    await tx.insert(s).values({ key: emailChangeStateKey(opts.userId), value })
      .onConflictDoUpdate({ target: s.key, set: { value, updatedAt: sql`now()` } })
  })
  return secret
}

/** The change an account is waiting for, if any (whether or not its link still works: see emailChangeUsable). */
export async function readEmailChange(db: any, reg: CmsRegistry, userId: string): Promise<PendingEmailChange | null> {
  const [row] = await db.select().from(reg.cmsState).where(eq(reg.cmsState.key, emailChangeStateKey(userId)))
  return asPendingEmailChange(row?.value)
}

/**
 * The change an account is waiting for, if it can still happen. One that can't (its link
 * used, replaced or expired, the password changed since) is deleted on the way: nothing
 * else would ever read it again.
 */
export async function readLiveEmailChange(db: any, reg: CmsRegistry, userId: string): Promise<PendingEmailChange | null> {
  const pending = await readEmailChange(db, reg, userId)
  if (!pending) return null
  const [token] = await db.select().from(reg.cmsTokens).where(eq(reg.cmsTokens.id, pending.tokenId))
  const [user] = await db.select().from(reg.cmsUsers).where(eq(reg.cmsUsers.id, userId))
  if (!emailChangeDead(pending, token, user)) return pending
  await forgetEmailChange(db, reg, userId, pending.tokenId)
  return null
}

/**
 * Delete an account's pending change — only the one for `tokenId` when given, so a
 * request that replaced it in the meantime stays.
 */
export async function forgetEmailChange(db: any, reg: CmsRegistry, userId: string, tokenId?: string): Promise<void> {
  const s = reg.cmsState
  const key = eq(s.key, emailChangeStateKey(userId))
  await db.delete(s).where(tokenId ? and(key, sql`${s.value}->>'tokenId' = ${tokenId}`) : key)
}

/**
 * After the address changed (or to cancel a change): links already sent stop working —
 * password resets and email changes always (a reset link in the old mailbox would
 * otherwise still open the account), `invite` too when asked — and the pending change
 * is forgotten. The ways back (`email-revert`) are not touched here: they belong to the
 * old mailboxes, see endRevertLinks.
 */
export async function endLinksOf(db: any, reg: CmsRegistry, userId: string, kinds: CmsTokenKind[] = ['reset', 'email']): Promise<void> {
  const t = reg.cmsTokens
  await db.update(t).set({ usedAt: new Date() }).where(and(eq(t.userId, userId), inArray(t.kind, kinds), isNull(t.usedAt)))
  await forgetEmailChange(db, reg, userId)
}

/**
 * Can't this account take the address? Another account has it (invited, active or
 * disabled alike), or it is the public demo account's (whoever signs in with the demo's
 * published details would get the account). The unique index on cms_users.email is
 * the backstop for two changes to the same address at the same moment.
 */
export async function emailTaken(db: any, reg: CmsRegistry, email: string, exceptUserId: string): Promise<boolean> {
  if (isDemoAccount(email)) return true
  const u = reg.cmsUsers
  const [row] = await db.select({ id: u.id }).from(u).where(and(eq(u.email, email), ne(u.id, exceptUserId)))
  return !!row || await emailReserved(db, reg, email, exceptUserId)
}

/**
 * Is the address held for another account's way back? While a link that undoes a change
 * still works, the old address stays reserved for that account: nobody can be invited
 * with it or move to it. Otherwise someone who changed the address with the password
 * alone could block the owner's way back by giving the old address to another account
 * (an administrator's session can invite one).
 */
export async function emailReserved(db: any, reg: CmsRegistry, email: string, exceptUserId?: string): Promise<boolean> {
  const s = reg.cmsState
  const rows: { key: string }[] = await db.select({ key: s.key }).from(s).where(and(
    sql`${s.key} like ${`${EMAIL_REVERT_STATE_PREFIX}%`}`,
    sql`lower(btrim(${s.value}->>'email')) = ${email}`,
    // expiresAt is always an ISO string written by toISOString(), so text comparison is time order.
    sql`coalesce(${s.value}->>'expiresAt', '') > ${new Date().toISOString()}`,
  ))
  return rows.some((r) => !exceptUserId || !r.key.startsWith(`${EMAIL_REVERT_STATE_PREFIX}${exceptUserId}:`))
}

// ── the way back ───────────────────────────────────────────────────────────────

/**
 * A link that undoes a change just made, for the notice to the old address. Unlike other
 * links, earlier ones of the same kind keep working: after A → B → C the oldest mailbox
 * (A, the owner's if anyone's) must still be able to take the account back.
 */
export async function issueEmailRevert(db: any, reg: CmsRegistry, opts: { userId: string; email: string; createdBy?: string | null }): Promise<string> {
  const secret = newLinkSecret()
  const t = reg.cmsTokens
  const expiresAt = new Date(Date.now() + EMAIL_REVERT_TTL_MS)
  const [row] = await db.insert(t).values({
    userId: opts.userId, kind: 'email-revert', tokenHash: await sha256Hex(secret), expiresAt, createdBy: opts.createdBy ?? null,
  }).returning({ id: t.id })
  const value: EmailRevert = { email: opts.email, expiresAt: expiresAt.toISOString() }
  await db.insert(reg.cmsState).values({ key: emailRevertStateKey(opts.userId, row.id), value })
  return secret
}

/** The address a way-back link restores, or null when it has none (any more). */
export async function readEmailRevert(db: any, reg: CmsRegistry, userId: string, tokenId: string): Promise<EmailRevert | null> {
  const [row] = await db.select().from(reg.cmsState).where(eq(reg.cmsState.key, emailRevertStateKey(userId, tokenId)))
  const revert = asEmailRevert(row?.value)
  return revert && new Date(revert.expiresAt).getTime() > Date.now() ? revert : null
}

/**
 * Ways back stop working: all of an account's (`since` omitted), or those issued at or
 * after `since` — when one is used, the links of later changes go (they would undo the
 * restore), while older ones stay valid (they lead further back, to an earlier owner).
 */
export async function endRevertLinks(db: any, reg: CmsRegistry, userId: string, since?: Date): Promise<void> {
  const t = reg.cmsTokens
  // A link already used keeps the time it was used; its row in cms_state goes all the same.
  const ended: { id: string }[] = await db.update(t).set({ usedAt: sql`coalesce(${t.usedAt}, now())` })
    .where(and(eq(t.userId, userId), eq(t.kind, 'email-revert'), since ? gte(t.createdAt, since) : undefined))
    .returning({ id: t.id })
  const s = reg.cmsState
  if (!since) await db.delete(s).where(sql`${s.key} like ${emailRevertStatePattern(userId)}`)
  else if (ended.length) await db.delete(s).where(inArray(s.key, ended.map((r) => emailRevertStateKey(userId, r.id))))
}

// ── privacy and housekeeping ───────────────────────────────────────────────────

const emailStateKeys = (s: CmsRegistry['cmsState']) =>
  sql`(${s.key} like ${`${EMAIL_CHANGE_STATE_PREFIX}%`} or ${s.key} like ${`${EMAIL_REVERT_STATE_PREFIX}%`})`

/**
 * The pending changes and ways back that name an address (privacy lookup, export and
 * erasure): a change waiting for it, or a way back that would restore it.
 */
export async function findEmailStates(db: any, reg: CmsRegistry, email: string): Promise<{ key: string; kind: 'change' | 'revert'; userId: string; expiresAt: string | null }[]> {
  const s = reg.cmsState
  const rows: any[] = await db.select().from(s).where(and(emailStateKeys(s), sql`lower(btrim(${s.value}->>'email')) = ${email}`))
  return rows.map((r) => {
    const change = r.key.startsWith(EMAIL_CHANGE_STATE_PREFIX)
    const rest = r.key.slice((change ? EMAIL_CHANGE_STATE_PREFIX : EMAIL_REVERT_STATE_PREFIX).length)
    return { key: r.key, kind: change ? 'change' : 'revert', userId: rest.split(':')[0]!, expiresAt: typeof r.value?.expiresAt === 'string' ? r.value.expiresAt : null }
  })
}

/** Delete expired pending changes and ways back (the daily retention run). Returns how many went. */
export async function sweepEmailStates(db: any, reg: CmsRegistry): Promise<number> {
  const s = reg.cmsState
  // expiresAt is always an ISO string written by toISOString(), so text comparison is time order.
  const gone: any[] = await db.delete(s).where(and(emailStateKeys(s), sql`coalesce(${s.value}->>'expiresAt', '') < ${new Date().toISOString()}`)).returning({ key: s.key })
  return gone.length
}

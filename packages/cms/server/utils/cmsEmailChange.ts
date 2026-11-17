import { and, eq, inArray, isNull, ne, sql } from 'tinyzoo'
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
 * when the account is removed or erased, and replaced by the next request.
 */

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
 * After the address changed (or to cancel a change): links already sent stop working —
 * password resets and email changes always (a reset link in the old mailbox would
 * otherwise still open the account), `invite` too when asked — and the pending change
 * is forgotten.
 */
export async function endLinksOf(db: any, reg: CmsRegistry, userId: string, kinds: CmsTokenKind[] = ['reset', 'email']): Promise<void> {
  const t = reg.cmsTokens
  await db.update(t).set({ usedAt: new Date() }).where(and(eq(t.userId, userId), inArray(t.kind, kinds), isNull(t.usedAt)))
  await db.delete(reg.cmsState).where(eq(reg.cmsState.key, emailChangeStateKey(userId)))
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
  return !!row
}

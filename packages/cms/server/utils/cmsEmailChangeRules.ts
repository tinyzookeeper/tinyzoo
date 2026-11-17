/**
 * The pure rules of changing an account's email address (no database, no Nitro):
 * what a pending change looks like, when its link may still be used, and how an
 * address is shown in a notice that goes to the *old* mailbox.
 */

/** A change waiting for its link to be opened, kept in cms_state under `email-change:<userId>`. */
export interface PendingEmailChange {
  /** The cms_tokens row whose secret was mailed to the new address. */
  tokenId: string
  /** The new address (normalised: trimmed, lower-cased). */
  email: string
  /** The account's session version when the change was asked for. */
  sv: number
  expiresAt: string
}

export const EMAIL_CHANGE_STATE_PREFIX = 'email-change:'
export const emailChangeStateKey = (userId: string) => `${EMAIL_CHANGE_STATE_PREFIX}${userId}`

/**
 * A way back from a change that was made, kept in cms_state under
 * `email-revert:<userId>:<tokenId>`: the address the account had before (the link went
 * there, in the "your email was changed" notice). One row per change, so after A → B → C
 * the link in A's mailbox still restores A.
 */
export interface EmailRevert {
  /** The address to restore (the account's address before the change). */
  email: string
  expiresAt: string
}

export const EMAIL_REVERT_STATE_PREFIX = 'email-revert:'
export const emailRevertStateKey = (userId: string, tokenId: string) => `${EMAIL_REVERT_STATE_PREFIX}${userId}:${tokenId}`
/** A LIKE pattern for every way back of one account (user ids are uuids: no `%` or `_` to escape). */
export const emailRevertStatePattern = (userId: string) => `${EMAIL_REVERT_STATE_PREFIX}${userId}:%`

export function asEmailRevert(value: unknown): EmailRevert | null {
  const v = value as Partial<EmailRevert> | null
  if (!v || typeof v !== 'object' || typeof v.email !== 'string' || typeof v.expiresAt !== 'string') return null
  return { email: v.email, expiresAt: v.expiresAt }
}

/** A stored value, if it has the shape of a pending change (cms_state is plain JSON). */
export function asPendingEmailChange(value: unknown): PendingEmailChange | null {
  const v = value as Partial<PendingEmailChange> | null
  if (!v || typeof v !== 'object') return null
  if (typeof v.tokenId !== 'string' || typeof v.email !== 'string' || typeof v.sv !== 'number' || typeof v.expiresAt !== 'string') return null
  return { tokenId: v.tokenId, email: v.email, sv: v.sv, expiresAt: v.expiresAt }
}

/**
 * May this link still change the address? Only the newest request counts (its token is
 * the one recorded), only before it expires, and only while the account's session
 * version is the one it had when the change was asked for: a password change or reset,
 * disabling the account or a role change since then cancels it. (That is how the owner
 * stops a change somebody else asked for: "change your password".)
 */
export function emailChangeUsable(
  pending: PendingEmailChange | null,
  token: { id: string; expiresAt: Date | string },
  user: { status: string; sessionVersion: number },
  now = new Date(),
): pending is PendingEmailChange {
  if (!pending) return false
  if (pending.tokenId !== token.id) return false
  if (user.status !== 'active' || user.sessionVersion !== pending.sv) return false
  return new Date(token.expiresAt).getTime() > now.getTime() && new Date(pending.expiresAt).getTime() > now.getTime()
}

/**
 * Is a pending change dead for good (so its cms_state row can go)? Its own link was
 * used, replaced or is gone, it expired, or the account moved on (session version,
 * status). Unlike emailChangeUsable this looks at the pending change's own token, not
 * at whichever link somebody opened: an older link must not delete a newer request.
 */
export function emailChangeDead(
  pending: PendingEmailChange,
  ownToken: { id: string; expiresAt: Date | string; usedAt: Date | string | null } | null | undefined,
  user: { status: string; sessionVersion: number } | null | undefined,
  now = new Date(),
): boolean {
  if (!ownToken || ownToken.usedAt || !user) return true
  return !emailChangeUsable(pending, ownToken, user, now)
}

/**
 * An address as a notice to the old mailbox shows it: enough for the owner to recognise
 * their own new address, not enough to hand it in full to whoever reads the old mailbox
 * now (a shared or handed-over work address is the usual reason to change it).
 * `jana.novakova@example.com` → `j…a@example.com`; `jan@x.cz` → `j…@x.cz` (a short local
 * part shows only its first character: two of three would all but spell it out).
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0) return '…'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const chars = [...local]
  const shown = chars.length <= 3 ? `${chars[0]}…` : `${chars[0]}…${chars[chars.length - 1]}`
  return `${shown}@${domain}`
}

/** Was this a Postgres unique violation (Drizzle keeps the driver's error as `cause`)? */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null
  return (e?.code ?? e?.cause?.code) === '23505'
}

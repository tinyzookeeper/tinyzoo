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
 * An address as a notice to the old mailbox shows it: enough for the owner to recognise
 * their own new address, not enough to hand it in full to whoever reads the old mailbox
 * now (a shared or handed-over work address is the usual reason to change it).
 * `jana.novakova@example.com` → `j…a@example.com`; `jo@x.cz` → `j…@x.cz`.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0) return '…'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const chars = [...local]
  const shown = chars.length <= 2 ? `${chars[0]}…` : `${chars[0]}…${chars[chars.length - 1]}`
  return `${shown}@${domain}`
}

/** Was this a Postgres unique violation (Drizzle keeps the driver's error as `cause`)? */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null
  return (e?.code ?? e?.cause?.code) === '23505'
}

/**
 * Audit log: who did what, when. Best effort — a failed audit write is logged and
 * never fails the request that triggered it.
 *
 * Actions: auth.setup, auth.setup_failed, auth.login, auth.login_failed, auth.logout, auth.reset_request,
 * auth.reset, auth.invite_accept, account.update, account.password, account.email_request,
 * account.email_failed, account.email_cancel, account.email, account.email_revert, user.invite, user.resend,
 * user.role, user.email, user.disable, user.enable, user.delete, entry.create,
 * entry.update, entry.delete, entry.publish, entry.unpublish, settings.update,
 * media.upload, media.delete, retention.purge, privacy.export, privacy.delete, token.create, token.revoke,
 * menu.update, menu.reset (the admin's menu arranged for the site, or put back).
 * A change made through the MCP server with a personal access token carries `meta.via: 'mcp'`
 * and the token's `meta.tokenId`.
 *
 * A change of sign-in email names the new address as `meta.email` and the old one as
 * `meta.previousEmail` (`account.email_request`: asked for, by the person; `account.email`:
 * made, when the link was opened; `account.email_revert`: undone from the old mailbox, `email`
 * being the address restored; `user.email`: made by an administrator, on the person's id).
 * `account.email_failed` is a wrong password when asking for a change (yours, or an
 * administrator's own for someone else's). The privacy tools find and erase both (cmsPrivacy.ts).
 */
export async function audit(
  event: any,
  action: string,
  data: { entity?: string | null; recordId?: string | null; meta?: Record<string, unknown> | null; userId?: string | null } = {},
): Promise<void> {
  try {
    const { db, reg } = useCms()
    // Done through the MCP server with a personal access token: which one.
    const token = data.userId === undefined ? event?.context?.cmsUser?.token?.id : undefined
    await db.insert(reg.cmsAudit).values({
      userId: data.userId !== undefined ? data.userId : (event?.context?.cmsUser?.id ?? null),
      action,
      entity: data.entity ?? null,
      recordId: data.recordId ?? null,
      meta: token ? { ...data.meta, via: 'mcp', tokenId: token } : data.meta ?? null,
    })
  }
  catch (err) {
    console.error('[cms] audit write failed', action, scrubError(err))
  }
}

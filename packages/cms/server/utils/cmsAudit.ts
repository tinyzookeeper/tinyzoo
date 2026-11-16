/**
 * Audit log: who did what, when. Best effort — a failed audit write is logged and
 * never fails the request that triggered it.
 *
 * Actions: auth.setup, auth.setup_failed, auth.login, auth.login_failed, auth.logout, auth.reset_request,
 * auth.reset, auth.invite_accept, account.update, account.password, user.invite,
 * user.resend, user.role, user.disable, user.enable, user.delete, entry.create,
 * entry.update, entry.delete, entry.publish, entry.unpublish, settings.update,
 * media.upload, media.delete, retention.purge, privacy.export, privacy.delete.
 */
export async function audit(
  event: any,
  action: string,
  data: { entity?: string | null; recordId?: string | null; meta?: Record<string, unknown> | null; userId?: string | null } = {},
): Promise<void> {
  try {
    const { db, reg } = useCms()
    await db.insert(reg.cmsAudit).values({
      userId: data.userId !== undefined ? data.userId : (event?.context?.cmsUser?.id ?? null),
      action,
      entity: data.entity ?? null,
      recordId: data.recordId ?? null,
      meta: data.meta ?? null,
    })
  }
  catch (err) {
    console.error('[cms] audit write failed', action, scrubError(err))
  }
}

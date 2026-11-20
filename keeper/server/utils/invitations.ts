import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, inArray } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { Invitation, InviteOutcome, WorkspaceRole } from '#keeper/types/keeper'

// Invitations, the way Postyard does them: an address, a role and what they will see, sent as a
// link that works for 7 days. Keeper has no open sign-up, so an invitation is the only way in
// besides the first account.

export const INVITE_DAYS = 7

export const hashInviteToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** A new link token and the hash that is stored for it. */
export function newInviteToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashInviteToken(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) }
}

export const inviteLink = (event: H3Event, token: string) => `${keeperBaseUrl(event)}/invite/${token}`

const WHAT_THEY_DO: Record<WorkspaceRole, string> = {
  owner: 'You will see every site and can change everything, including who is in the workspace.',
  admin: 'You will see every site and look after the workspace, its teams and people.',
  member: 'You will see your teams’ sites, whether each is up and which tinyzoo it runs, and can add and change them.',
  guest: 'You will see whether your sites are up, their uptime and visits. You can’t change anything.',
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]!)
const longDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** The invitation e-mail, as text and as a small HTML page in Keeper's look. */
export function invitationMail(p: { workspaceName: string; inviterName: string | null; role: WorkspaceRole; link: string; expiresAt: Date }) {
  const who = p.inviterName ? `${p.inviterName} invited you` : 'You are invited'
  const subject = `You're invited to ${p.workspaceName} on Keeper`
  const until = longDate(p.expiresAt)
  const text = [
    `${who} to ${p.workspaceName} on Keeper, the overview of every site the team looks after.`,
    '',
    WHAT_THEY_DO[p.role],
    '',
    `Accept the invitation: ${p.link}`,
    '',
    `The link works until ${until}. If you weren't expecting it, ignore this e-mail.`,
    '',
    '— Keeper',
  ].join('\n')
  const e = escapeHtml
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F9F5EF">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9F5EF;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #E7DDCD;border-radius:16px">
<tr><td style="padding:28px 28px 8px;font:800 18px/1 Manrope,Inter,Arial,sans-serif;color:#2E3035;letter-spacing:-0.01em">keeper</td></tr>
<tr><td style="padding:12px 28px 0;font:800 24px/1.25 Manrope,Inter,Arial,sans-serif;color:#131313;letter-spacing:-0.01em">Join ${e(p.workspaceName)}</td></tr>
<tr><td style="padding:10px 28px 0;font:400 15px/1.55 Inter,Arial,sans-serif;color:#4a4a4a">${e(who)} to ${e(p.workspaceName)} on Keeper, the overview of every site the team looks after. ${e(WHAT_THEY_DO[p.role])}</td></tr>
<tr><td style="padding:22px 28px 0"><a href="${e(p.link)}" style="display:inline-block;background:#2E3035;color:#ffffff;text-decoration:none;font:600 15px/1 Inter,Arial,sans-serif;padding:13px 20px;border-radius:10px">Accept the invitation</a></td></tr>
<tr><td style="padding:22px 28px 28px;font:400 13px/1.5 Inter,Arial,sans-serif;color:#6b6b6b">The link works until ${e(until)}. If you weren’t expecting it, ignore this e-mail.<br><span style="word-break:break-all;color:#8a8a8a">${e(p.link)}</span></td></tr>
</table>
<p style="font:400 12px/1.4 Inter,Arial,sans-serif;color:#6E675D;margin:16px 0 0">Keeper · part of tinyzoo</p>
</td></tr></table></body></html>`
  return { subject, text, html }
}

/** Send (or log) the e-mail for an invitation; the link comes back when it did not go out. */
export async function deliverInvitation(event: H3Event, p: { email: string; role: WorkspaceRole; token: string; expiresAt: Date; workspaceId: string; inviterName: string | null }): Promise<InviteOutcome> {
  const [ws] = await useDb().select({ name: schema.workspaces.name }).from(schema.workspaces).where(eq(schema.workspaces.id, p.workspaceId))
  const link = inviteLink(event, p.token)
  const mail = invitationMail({ workspaceName: ws?.name ?? 'Keeper', inviterName: p.inviterName, role: p.role, link, expiresAt: p.expiresAt })
  const result = await sendMail({ to: [p.email], ...mail })
  return { email: p.email, ok: true, mail: result.status, ...(result.status === 'sent' ? {} : { link }) }
}

/** The pending invitations of a workspace (expired ones too, to send again), newest first. */
export async function listInvitations(workspaceId: string): Promise<Invitation[]> {
  const rows = await useDb().select({
    id: schema.workspaceInvitations.id,
    email: schema.workspaceInvitations.email,
    role: schema.workspaceInvitations.role,
    teamIds: schema.workspaceInvitations.teamIds,
    expiresAt: schema.workspaceInvitations.expiresAt,
    createdAt: schema.workspaceInvitations.createdAt,
    invitedBy: schema.users.name,
  }).from(schema.workspaceInvitations)
    .leftJoin(schema.users, eq(schema.users.id, schema.workspaceInvitations.invitedBy))
    .where(and(eq(schema.workspaceInvitations.workspaceId, workspaceId), eq(schema.workspaceInvitations.status, 'pending')))
    .orderBy(desc(schema.workspaceInvitations.createdAt))
  const now = Date.now()
  return rows.map((r) => ({
    ...r,
    invitedBy: r.invitedBy || null,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    expired: r.expiresAt.getTime() < now,
  }))
}

/** An invitation of this workspace that I may touch (an admin leaves owner invitations alone), or 404/403. */
export async function invitationOf(me: Membership, id: string) {
  const [inv] = await useDb().select().from(schema.workspaceInvitations)
    .where(and(eq(schema.workspaceInvitations.id, id), eq(schema.workspaceInvitations.workspaceId, me.workspaceId), eq(schema.workspaceInvitations.status, 'pending')))
  if (!inv) throw createError({ statusCode: 404, statusMessage: 'No such invitation' })
  assertMayAssign(me, null, inv.role)
  return inv
}

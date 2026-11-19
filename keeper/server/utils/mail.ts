import { eq } from 'drizzle-orm'
import nodemailer, { type Transporter } from 'nodemailer'

let transporter: Transporter | undefined

/** Send one plain-text e-mail (NUXT_MAIL_TRANSPORT=smtp), or print it (log). Never throws. */
export async function sendMail(to: string[], subject: string, text: string): Promise<void> {
  if (!to.length) return
  const mail = (useRuntimeConfig().mail ?? {}) as any
  if (mail.transport !== 'smtp') {
    console.info(`[keeper] mail (log) to ${to.join(', ')}: ${subject}\n${text}`)
    return
  }
  try {
    transporter ??= nodemailer.createTransport({
      host: mail.smtp.host,
      port: Number(mail.smtp.port) || 587,
      secure: String(mail.smtp.secure) === 'true',
      auth: mail.smtp.user ? { user: mail.smtp.user, pass: mail.smtp.pass } : undefined,
    })
    await transporter.sendMail({ from: mail.from || mail.smtp.user, to, subject, text })
  }
  catch (err: any) {
    console.error('[keeper] mail failed', err?.message ?? err)
  }
}

/** Who hears about a workspace's sites: its alert addresses, or every member. */
async function recipients(workspaceId: string): Promise<string[]> {
  const db = useDb()
  const [ws] = await db.select({ alertEmails: schema.workspaces.alertEmails }).from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId))
  if (ws?.alertEmails?.length) return ws.alertEmails
  const members = await db.select({ email: schema.users.email }).from(schema.users)
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
    .where(eq(schema.memberships.workspaceId, workspaceId))
  return members.map((m) => m.email)
}

/** E-mail the team about a site (down, back up, certificate). */
export async function alertTeam(site: { id: string; workspaceId: string; name: string }, kind: 'down' | 'up' | 'cert', subject: string, text: string): Promise<void> {
  const base = String(useRuntimeConfig().publicUrl || '').replace(/\/+$/, '')
  const link = base ? `\n\n${base}/sites/${site.id}` : ''
  const icon = kind === 'down' ? '🔴' : kind === 'up' ? '🟢' : '🟡'
  await sendMail(await recipients(site.workspaceId), `${icon} ${subject}`, `${text}${link}\n\n— Keeper`)
}

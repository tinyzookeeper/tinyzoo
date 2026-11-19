import { and, eq, ne } from 'drizzle-orm'
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

interface AlertSite { id: string; workspaceId: string; name: string; clientId?: string | null }

/**
 * Who hears about a site: the team's alert addresses, or, without them, everyone on the team
 * who works on sites and sees this one (owners, admins, members of its client; not viewers).
 * The site's client adds its own addresses on top.
 */
async function recipients(site: AlertSite): Promise<string[]> {
  const db = useDb()
  const [ws] = await db.select({ alertEmails: schema.workspaces.alertEmails }).from(schema.workspaces).where(eq(schema.workspaces.id, site.workspaceId))
  let team = ws?.alertEmails ?? []
  if (!team.length) {
    const members = await db.select({ email: schema.users.email, role: schema.memberships.role, allClients: schema.memberships.allClients, userId: schema.users.id })
      .from(schema.users)
      .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
      .where(and(eq(schema.memberships.workspaceId, site.workspaceId), ne(schema.memberships.role, 'viewer')))
    const ofClient = site.clientId
      ? new Set((await db.select({ userId: schema.membershipClients.userId }).from(schema.membershipClients)
          .where(and(eq(schema.membershipClients.workspaceId, site.workspaceId), eq(schema.membershipClients.clientId, site.clientId)))).map((r) => r.userId))
      : new Set<string>()
    team = members.filter((m) => m.role === 'owner' || m.role === 'admin' || m.allClients || ofClient.has(m.userId)).map((m) => m.email)
  }
  const [client] = site.clientId
    ? await db.select({ alertEmails: schema.clients.alertEmails }).from(schema.clients).where(eq(schema.clients.id, site.clientId))
    : []
  return [...new Set([...team, ...(client?.alertEmails ?? [])].map((e) => e.toLowerCase()))]
}

export type AlertKind = 'down' | 'up' | 'cert' | 'traffic' | 'traffic-back'

const ICONS: Record<AlertKind, string> = { 'down': '🔴', 'up': '🟢', 'cert': '🟡', 'traffic': '🟡', 'traffic-back': '🟢' }

/** E-mail the team (and the site's client) about a site: down, back up, certificate, a drop in visitors and its end. */
export async function alertTeam(site: AlertSite, kind: AlertKind, subject: string, text: string): Promise<void> {
  const base = String(useRuntimeConfig().publicUrl || '').replace(/\/+$/, '')
  const link = base ? `\n\n${base}/sites/${site.id}` : ''
  const icon = ICONS[kind]
  const to = await recipients(site)
  if (to.length) await sendMail(to, `${icon} ${subject}`, `${text}${link}\n\n— Keeper`)
}

import { and, eq, ne } from 'drizzle-orm'
import nodemailer, { type Transporter } from 'nodemailer'
import type { MailStatus } from '#keeper/types/keeper'

/**
 * How Keeper sends e-mail (runtimeConfig.mail): NUXT_MAIL_TRANSPORT=smtp sends through an SMTP
 * server, `log` (the default) only prints each e-mail to the server log.
 *
 * The SMTP settings cover a mail server of your own such as Zimbra: submission on 587 with
 * STARTTLS (NUXT_MAIL_SMTP_REQUIRE_TLS=true refuses to send without it), or implicit TLS on 465
 * (NUXT_MAIL_SMTP_SECURE=true). NUXT_MAIL_SMTP_TLS_REJECT_UNAUTHORIZED=false accepts a server
 * whose certificate does not verify (a self-signed one); leave it on otherwise.
 */
interface MailConfig {
  transport: 'smtp' | 'log'
  from: string
  smtp: { host: string; port: number; secure: boolean; requireTls: boolean; tlsRejectUnauthorized: boolean; user: string; pass: string; name: string }
}

const flag = (v: unknown, fallback: boolean) => (v === undefined || v === null || v === '' ? fallback : String(v) === 'true')

function mailConfig(): MailConfig {
  const m = (useRuntimeConfig().mail ?? {}) as any
  const smtp = m.smtp ?? {}
  return {
    transport: m.transport === 'smtp' ? 'smtp' : 'log',
    from: String(m.from || smtp.user || ''),
    smtp: {
      host: String(smtp.host || ''),
      port: Number(smtp.port) || 587,
      secure: flag(smtp.secure, false),
      requireTls: flag(smtp.requireTls, false),
      tlsRejectUnauthorized: flag(smtp.tlsRejectUnauthorized, true),
      user: String(smtp.user || ''),
      pass: String(smtp.pass || ''),
      name: String(smtp.name || ''),
    },
  }
}

/** What Settings shows about e-mail: whether it is sent at all, and through what. Never the password. */
export function mailStatus(): MailStatus {
  const c = mailConfig()
  if (c.transport !== 'smtp') return { transport: 'log', ready: false, host: null, port: null, security: null, from: c.from || null }
  return {
    transport: 'smtp',
    ready: !!c.smtp.host && !!c.from,
    host: c.smtp.host || null,
    port: c.smtp.port,
    security: c.smtp.secure ? 'tls' : c.smtp.requireTls ? 'starttls' : 'opportunistic',
    from: c.from || null,
  }
}

let transporter: Transporter | undefined

function smtpTransport(c: MailConfig): Transporter {
  transporter ??= nodemailer.createTransport({
    host: c.smtp.host,
    port: c.smtp.port,
    secure: c.smtp.secure,
    requireTLS: !c.smtp.secure && c.smtp.requireTls,
    auth: c.smtp.user ? { user: c.smtp.user, pass: c.smtp.pass } : undefined,
    tls: { rejectUnauthorized: c.smtp.tlsRejectUnauthorized },
    ...(c.smtp.name ? { name: c.smtp.name } : {}),
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  })
  return transporter
}

export interface Mail {
  to: string[]
  subject: string
  text: string
  /** An HTML version beside the text one. */
  html?: string
}

/** What became of an e-mail: sent over SMTP, only printed (`log`), or not sent (`failed`, with why). */
export type MailResult = { status: 'sent' } | { status: 'logged' } | { status: 'failed'; error: string }

/** Send one e-mail (NUXT_MAIL_TRANSPORT=smtp), or print it (log). Never throws. */
export async function sendMail(mail: Mail): Promise<MailResult> {
  if (!mail.to.length) return { status: 'logged' }
  const c = mailConfig()
  if (c.transport !== 'smtp') {
    console.info(`[keeper] mail (log) to ${mail.to.join(', ')}: ${mail.subject}\n${mail.text}`)
    return { status: 'logged' }
  }
  try {
    if (!c.smtp.host) throw new Error('NUXT_MAIL_SMTP_HOST is not set')
    if (!c.from) throw new Error('NUXT_MAIL_FROM is not set')
    await smtpTransport(c).sendMail({ from: c.from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html })
    return { status: 'sent' }
  }
  catch (err: any) {
    const error = String(err?.message ?? err)
    console.error('[keeper] mail failed', error)
    return { status: 'failed', error }
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
  if (to.length) await sendMail({ to, subject: `${icon} ${subject}`, text: `${text}${link}\n\n— Keeper` })
}

import { and, eq, inArray, or, sql } from 'drizzle-orm'
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

interface AlertSite { id: string; workspaceId: string; teamId: string; name: string }

/**
 * Who hears about a site: its workspace's alert addresses, or, without them, everyone there who
 * works on it (owners and admins, and members of its team; never guests).
 */
async function recipients(site: AlertSite): Promise<string[]> {
  const db = useDb()
  const [ws] = await db.select({ alertEmails: schema.workspaces.alertEmails }).from(schema.workspaces).where(eq(schema.workspaces.id, site.workspaceId))
  if (ws?.alertEmails?.length) return [...new Set(ws.alertEmails.map((e) => e.toLowerCase()))]
  const rows = await db.select({ email: schema.users.email }).from(schema.workspaceMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.workspaceMembers.userId))
    .where(and(
      eq(schema.workspaceMembers.workspaceId, site.workspaceId),
      or(
        inArray(schema.workspaceMembers.role, ['owner', 'admin']),
        and(eq(schema.workspaceMembers.role, 'member'), sql`exists (select 1 from "team_members" tm where tm."team_id" = ${site.teamId} and tm."user_id" = ${schema.workspaceMembers.userId})`),
      ),
    ))
  return [...new Set(rows.map((r) => r.email.toLowerCase()))]
}

export type AlertKind = 'down' | 'up' | 'cert' | 'traffic' | 'traffic-back' | 'restart'

const ICONS: Record<AlertKind, string> = { 'down': '🔴', 'up': '🟢', 'cert': '🟡', 'traffic': '🟡', 'traffic-back': '🟢', 'restart': '🟠' }

/** E-mail the people of the site's workspace about it: down, back up, certificate, a drop in visitors and its end, a restart without a deploy. */
export async function alertTeam(site: AlertSite, kind: AlertKind, subject: string, text: string): Promise<void> {
  const base = String(useRuntimeConfig().publicUrl || '').replace(/\/+$/, '')
  // The site's page in its workspace and team (an older /sites/<id> link redirects there too).
  const [where] = await useDb().select({ ws: schema.workspaces.slug, team: schema.teams.slug }).from(schema.teams)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.teams.workspaceId)).where(eq(schema.teams.id, site.teamId))
  const path = where ? '/w/' + where.ws + '/t/' + where.team + '/sites/' + site.id : '/sites/' + site.id
  const link = base ? `\n\n${base}${path}` : ''
  const icon = ICONS[kind]
  const to = await recipients(site)
  if (to.length) await sendMail({ to, subject: `${icon} ${subject}`, text: `${text}${link}\n\n— Keeper` })
}

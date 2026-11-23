import nodemailer, { type Transporter } from 'nodemailer'
import type { Locale } from '#shared/templates'

/**
 * How the cloud sends e-mail (runtimeConfig.mail), as Keeper does: NUXT_MAIL_TRANSPORT=smtp
 * sends through an SMTP server, `log` (the default) only prints each e-mail to the server log.
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

export interface Mail { to: string; subject: string; text: string; html?: string }
export type MailResult = { status: 'sent' } | { status: 'logged' } | { status: 'failed'; error: string }

/** Send one e-mail (smtp), or print it (log). Never throws. */
export async function sendMail(mail: Mail): Promise<MailResult> {
  const c = mailConfig()
  if (c.transport !== 'smtp') {
    console.info(`[cloud] mail (log) to ${mail.to}: ${mail.subject}\n${mail.text}`)
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
    console.error('[cloud] mail failed', error)
    return { status: 'failed', error }
  }
}

// ── the e-mails, in both languages ──────────────────────────────────────────────

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** One plain e-mail: a greeting, a few lines, one button, a closing line. */
function letter(o: { hello: string; lines: string[]; button: string; url: string; after: string }): { text: string; html: string } {
  const text = [o.hello, '', ...o.lines, '', o.url, '', o.after, '', 'tinyzoo'].join('\n')
  const html = `<!doctype html><html><body style="margin:0;background:#F9F5EF;font-family:Inter,-apple-system,'Segoe UI',sans-serif;color:#2E3035">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:16px;padding:32px">
<tr><td style="font-size:16px;line-height:1.6">
<p style="margin:0 0 12px;font-size:20px;font-weight:700;color:#131313">${esc(o.hello)}</p>
${o.lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join('\n')}
<p style="margin:24px 0"><a href="${esc(o.url)}" style="display:inline-block;background:#2E3035;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">${esc(o.button)}</a></p>
<p style="margin:0;color:#6E675D;font-size:14px">${esc(o.after)}</p>
</td></tr></table>
<p style="margin:16px 0 0;color:#6E675D;font-size:12px">tinyzoo</p>
</td></tr></table></body></html>`
  return { text, html }
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''

export function verifyEmail(to: { email: string; name: string; locale: Locale }, url: string): Mail {
  const n = firstName(to.name)
  const body = to.locale === 'en'
    ? letter({ hello: n ? `Hello ${n},` : 'Hello,', lines: ['Open the link below to confirm the e-mail address for your tinyzoo account.'], button: 'Confirm e-mail', url, after: 'The link is valid for 3 days. If you didn’t create a tinyzoo account, you can ignore this e-mail.' })
    : letter({ hello: n ? `Dobrý den, ${n},` : 'Dobrý den,', lines: ['Otevřete odkaz níže a potvrďte e-mail k účtu v tinyzoo.'], button: 'Potvrdit e-mail', url, after: 'Odkaz platí 3 dny. Pokud jste si účet v tinyzoo nezakládali, nemusíte na tento e-mail reagovat.' })
  return { to: to.email, subject: to.locale === 'en' ? 'Confirm your e-mail' : 'Potvrďte svůj e-mail', ...body }
}

export function resetEmail(to: { email: string; name: string; locale: Locale }, url: string): Mail {
  const n = firstName(to.name)
  const body = to.locale === 'en'
    ? letter({ hello: n ? `Hello ${n},` : 'Hello,', lines: ['Use the link below to set a new password for your tinyzoo account.'], button: 'Set a new password', url, after: 'The link is valid for 1 hour. If you didn’t request it, you can ignore this e-mail.' })
    : letter({ hello: n ? `Dobrý den, ${n},` : 'Dobrý den,', lines: ['Přes odkaz níže si nastavíte nové heslo k účtu v tinyzoo.'], button: 'Nastavit nové heslo', url, after: 'Odkaz platí 1 hodinu. Pokud jste o nové heslo nežádali, nemusíte na tento e-mail reagovat.' })
  return { to: to.email, subject: to.locale === 'en' ? 'Reset your tinyzoo password' : 'Nové heslo k účtu v tinyzoo', ...body }
}

export function siteReadyEmail(to: { email: string; name: string; locale: Locale }, site: { name: string; publicUrl: string }, pageUrl: string): Mail {
  const n = firstName(to.name)
  const body = to.locale === 'en'
    ? letter({ hello: n ? `Hello ${n},` : 'Hello,', lines: [`Your website “${site.name}” is live at ${site.publicUrl}.`, 'Open the admin from your website’s details to edit your text and images.'], button: 'View website details', url: pageUrl, after: 'You can replace the demo content with your own in the admin.' })
    : letter({ hello: n ? `Dobrý den, ${n},` : 'Dobrý den,', lines: [`Váš web „${site.name}“ běží na adrese ${site.publicUrl}.`, 'Z přehledu webu otevřete administraci a můžete upravovat texty i obrázky.'], button: 'Otevřít přehled webu', url: pageUrl, after: 'Ukázkový obsah můžete v administraci nahradit vlastním.' })
  return { to: to.email, subject: to.locale === 'en' ? `${site.name} is ready` : `Web „${site.name}“ je připravený`, ...body }
}

// ── development: the links, to open by hand ─────────────────────────────────────

const devLinks = new Map<string, { verify?: string; reset?: string }>()

/** Remember a link for the page to show. Only where showsMailLinks() holds (development, e-mail only printed). */
export function rememberDevLink(userId: string, kind: 'verify' | 'reset', url: string): void {
  if (!showsMailLinks()) return
  devLinks.set(userId, { ...devLinks.get(userId), [kind]: url })
  if (devLinks.size > 500) devLinks.delete(devLinks.keys().next().value!)
}
export function devLink(userId: string, kind: 'verify' | 'reset'): string | null {
  return showsMailLinks() ? devLinks.get(userId)?.[kind] ?? null : null
}
export function forgetDevLink(userId: string, kind: 'verify' | 'reset'): void {
  const links = devLinks.get(userId)
  if (links) delete links[kind]
}

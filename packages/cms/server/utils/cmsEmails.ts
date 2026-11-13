import { INVITE_TTL_MS } from './cmsAuth'
import { resolveText } from 'tinyzoo'

// The emails the CMS sends: an invitation and a password-reset link. Plain, neutral
// HTML that survives every mail client, with a text version. Czech and English,
// chosen by the recipient's interface language (or the admin's default).

type Locale = 'cs' | 'en'

const copy = {
  en: {
    inviteSubject: (site: string) => `You're invited to ${site}`,
    inviteIntro: (inviter: string, site: string) => `${inviter} invited you to manage the content of ${site}.`,
    inviteAction: 'Accept the invitation',
    inviteExpiry: (days: number) => `The link works for ${days} days. If you weren't expecting this, you can ignore it.`,
    resetSubject: (site: string) => `Reset your password for ${site}`,
    resetIntro: 'Someone asked to reset the password for this email address. Choose a new password with the link below.',
    resetAction: 'Choose a new password',
    resetExpiry: 'The link works for 1 hour. If you didn’t ask for this, ignore this email — your password stays the same.',
    fallback: 'If the button does not work, copy this address into your browser:',
  },
  cs: {
    inviteSubject: (site: string) => `Pozvánka: ${site}`,
    inviteIntro: (inviter: string, site: string) => `${inviter} vás zve ke správě obsahu webu ${site}.`,
    inviteAction: 'Přijmout pozvánku',
    inviteExpiry: (days: number) => `Odkaz platí ${days} dní. Pokud jste pozvánku nečekali, můžete ji ignorovat.`,
    resetSubject: (site: string) => `Obnovení hesla: ${site}`,
    resetIntro: 'Někdo požádal o obnovení hesla k této e-mailové adrese. Nové heslo nastavíte přes odkaz níže.',
    resetAction: 'Nastavit nové heslo',
    resetExpiry: 'Odkaz platí 1 hodinu. Pokud jste o obnovení nežádali, e-mail ignorujte — vaše heslo zůstává stejné.',
    fallback: 'Pokud tlačítko nefunguje, zkopírujte tuto adresu do prohlížeče:',
  },
} satisfies Record<Locale, Record<string, unknown>>

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!))

/** The admin's settings that emails need: product name and default language. */
export function emailContext(locale?: string | null): { locale: Locale; site: string } {
  const admin = ((useAppConfig() as any)?.cms?.admin ?? {}) as Record<string, any>
  const wanted = (locale || admin.defaultLocale || 'en') as string
  const lang: Locale = wanted.startsWith('cs') ? 'cs' : 'en'
  return { locale: lang, site: resolveText(admin.name, lang, ['en']) || 'CMS' }
}

function layout(opts: { intro: string; action: string; url: string; footer: string; fallback: string }) {
  const url = escapeHtml(opts.url)
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717">
<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:28px">
<p style="margin:0 0 20px;font-size:15px;line-height:1.55">${escapeHtml(opts.intro)}</p>
<p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;font-weight:600">${escapeHtml(opts.action)}</a></p>
<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#737373">${escapeHtml(opts.footer)}</p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#a3a3a3">${escapeHtml(opts.fallback)}<br><span style="word-break:break-all">${url}</span></p>
</div></body></html>`
  const text = `${opts.intro}\n\n${opts.action}: ${opts.url}\n\n${opts.footer}\n`
  return { html, text }
}

export function inviteEmail(opts: { to: string; inviter: string; url: string; locale?: string | null }) {
  const { locale, site } = emailContext(opts.locale)
  const c = copy[locale]
  const days = Math.round(INVITE_TTL_MS / 86_400_000)
  return {
    to: opts.to,
    subject: c.inviteSubject(site),
    ...layout({ intro: c.inviteIntro(opts.inviter, site), action: c.inviteAction, url: opts.url, footer: c.inviteExpiry(days), fallback: c.fallback }),
  }
}

export function resetEmail(opts: { to: string; url: string; locale?: string | null }) {
  const { locale, site } = emailContext(opts.locale)
  const c = copy[locale]
  return {
    to: opts.to,
    subject: c.resetSubject(site),
    ...layout({ intro: c.resetIntro, action: c.resetAction, url: opts.url, footer: c.resetExpiry, fallback: c.fallback }),
  }
}

import { EMAIL_CHANGE_TTL_MS, INVITE_TTL_MS } from './cmsAuth'
import { maskEmail } from './cmsEmailChangeRules'
import { resolveText } from 'tinyzoo'

// The emails the CMS sends: an invitation, a password-reset link, and the ones about a
// change of email address (the link to the new address, notices to the old one). Plain, neutral
// HTML that survives every mail client, with a text version. Czech, English and German,
// chosen by the recipient's interface language (or the admin's default).

type Locale = 'cs' | 'en' | 'de'

const copy = {
  en: {
    inviteSubject: (site: string) => `You're invited to ${site}`,
    inviteIntro: (inviter: string, site: string, role: string) => `${inviter} invited you to manage the content of ${site} as ${role}.`,
    inviteAction: 'Accept the invitation',
    inviteExpiry: (days: number) => `The link works for ${days} days. If you weren't expecting this, you can ignore it.`,
    resetSubject: (site: string) => `Reset your password for ${site}`,
    resetIntro: 'Someone asked to reset the password for this email address. Choose a new password with the link below.',
    resetAction: 'Choose a new password',
    resetExpiry: 'The link works for 1 hour. If you didn’t ask for this, ignore this email — your password stays the same.',
    fallback: 'If the button does not work, copy this address into your browser:',
    emailConfirmSubject: (site: string) => `Confirm your new email address for ${site}`,
    emailConfirmIntro: (site: string) => `You asked to sign in to ${site} with this email address. Confirm it with the link below.`,
    emailConfirmAction: 'Confirm the new address',
    emailConfirmExpiry: (hours: number) => `The link works for ${hours} hours. Until you confirm, you keep signing in with your current address. If you didn’t ask for this, ignore this email.`,
    emailRequestedSubject: (site: string) => `Your sign-in email for ${site} is about to change`,
    emailRequestedIntro: (site: string, to: string) => `Someone signed in to your account at ${site} asked to change its sign-in email to ${to}. Nothing changes until the new address is confirmed.`,
    emailRequestedAction: 'Choose a new password',
    emailRequestedFooter: 'If it was you, there is nothing to do. If not, choose a new password right away: that cancels the change and signs everyone else out.',
    emailChangedSubject: (site: string) => `Your sign-in email for ${site} was changed`,
    emailChangedIntro: (site: string, to: string) => `The sign-in email of your account at ${site} was changed to ${to}. From now on, sign in with the new address.`,
    emailChangedByAdminIntro: (site: string, to: string) => `An administrator changed the sign-in email of your account at ${site} to ${to}. From now on, sign in with the new address.`,
    emailChangedFooter: 'If you didn’t expect this, contact the administrator of the site.',
    emailSetSubject: (site: string) => `Your sign-in email for ${site}`,
    emailSetIntro: (site: string) => `An administrator set this address as the sign-in email of your account at ${site}. Sign in with it and your usual password.`,
    emailSetAction: 'Sign in',
    emailSetFooter: 'If you didn’t expect this, contact the administrator of the site.',
    emailInUseSubject: (site: string) => `Your email address at ${site}`,
    emailInUseIntro: (site: string) => `Someone asked to use this address for another account at ${site}, but it already belongs to an account there. Nothing was changed.`,
    emailInUseFooter: 'If it was you, sign in with this address instead. Otherwise, ignore this email.',
  },
  cs: {
    inviteSubject: (site: string) => `Pozvánka: ${site}`,
    inviteIntro: (inviter: string, site: string, role: string) => `${inviter} vás zve ke správě obsahu webu ${site} jako ${role}.`,
    inviteAction: 'Přijmout pozvánku',
    inviteExpiry: (days: number) => `Odkaz platí ${days} dní. Pokud jste pozvánku nečekali, můžete ji ignorovat.`,
    resetSubject: (site: string) => `Obnovení hesla: ${site}`,
    resetIntro: 'Někdo požádal o obnovení hesla k této e-mailové adrese. Nové heslo nastavíte přes odkaz níže.',
    resetAction: 'Nastavit nové heslo',
    resetExpiry: 'Odkaz platí 1 hodinu. Pokud jste o obnovení nežádali, e-mail ignorujte — vaše heslo zůstává stejné.',
    fallback: 'Pokud tlačítko nefunguje, zkopírujte tuto adresu do prohlížeče:',
    emailConfirmSubject: (site: string) => `Potvrďte novou e-mailovou adresu: ${site}`,
    emailConfirmIntro: (site: string) => `Požádali jste o přihlašování do webu ${site} touto e-mailovou adresou. Potvrďte ji přes odkaz níže.`,
    emailConfirmAction: 'Potvrdit novou adresu',
    emailConfirmExpiry: (hours: number) => `Odkaz platí ${hours} hodin. Dokud adresu nepotvrdíte, přihlašujete se dál tou současnou. Pokud jste o změnu nežádali, e-mail ignorujte.`,
    emailRequestedSubject: (site: string) => `Žádost o změnu přihlašovacího e-mailu: ${site}`,
    emailRequestedIntro: (site: string, to: string) => `Někdo přihlášený k vašemu účtu na webu ${site} požádal o změnu přihlašovacího e-mailu na ${to}. Dokud nová adresa není potvrzená, nic se nemění.`,
    emailRequestedAction: 'Nastavit nové heslo',
    emailRequestedFooter: 'Pokud jste to byli vy, nemusíte nic dělat. Pokud ne, hned si nastavte nové heslo: tím se změna zruší a všichni ostatní se odhlásí.',
    emailChangedSubject: (site: string) => `Přihlašovací e-mail byl změněn: ${site}`,
    emailChangedIntro: (site: string, to: string) => `Přihlašovací e-mail vašeho účtu na webu ${site} byl změněn na ${to}. Odteď se přihlašujte novou adresou.`,
    emailChangedByAdminIntro: (site: string, to: string) => `Administrátor změnil přihlašovací e-mail vašeho účtu na webu ${site} na ${to}. Odteď se přihlašujte novou adresou.`,
    emailChangedFooter: 'Pokud jste změnu nečekali, obraťte se na administrátora webu.',
    emailSetSubject: (site: string) => `Váš přihlašovací e-mail: ${site}`,
    emailSetIntro: (site: string) => `Administrátor nastavil tuto adresu jako přihlašovací e-mail vašeho účtu na webu ${site}. Přihlaste se jí a svým obvyklým heslem.`,
    emailSetAction: 'Přihlásit se',
    emailSetFooter: 'Pokud jste změnu nečekali, obraťte se na administrátora webu.',
    emailInUseSubject: (site: string) => `Vaše e-mailová adresa: ${site}`,
    emailInUseIntro: (site: string) => `Někdo chtěl tuto adresu použít pro jiný účet na webu ${site}, ale už k ní jeden účet patří. Nic se nezměnilo.`,
    emailInUseFooter: 'Pokud jste to byli vy, přihlaste se touto adresou. Jinak e-mail ignorujte.',
  },
  de: {
    inviteSubject: (site: string) => `Einladung zu ${site}`,
    inviteIntro: (inviter: string, site: string, role: string) => `${inviter} lädt Sie ein, die Inhalte von ${site} als ${role} zu verwalten.`,
    inviteAction: 'Einladung annehmen',
    inviteExpiry: (days: number) => `Der Link ist ${days} Tage gültig. Wenn Sie keine Einladung erwartet haben, können Sie diese E-Mail ignorieren.`,
    resetSubject: (site: string) => `Passwort für ${site} zurücksetzen`,
    resetIntro: 'Für diese E-Mail-Adresse wurde ein neues Passwort angefordert. Über den Link unten können Sie ein neues Passwort festlegen.',
    resetAction: 'Neues Passwort festlegen',
    resetExpiry: 'Der Link ist 1 Stunde gültig. Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail. Ihr Passwort bleibt unverändert.',
    fallback: 'Falls die Schaltfläche nicht funktioniert, kopieren Sie diese Adresse in Ihren Browser:',
    emailConfirmSubject: (site: string) => `Neue E-Mail-Adresse für ${site} bestätigen`,
    emailConfirmIntro: (site: string) => `Sie möchten sich bei ${site} mit dieser E-Mail-Adresse anmelden. Bestätigen Sie sie über den Link unten.`,
    emailConfirmAction: 'Neue Adresse bestätigen',
    emailConfirmExpiry: (hours: number) => `Der Link ist ${hours} Stunden gültig. Bis zur Bestätigung melden Sie sich weiter mit Ihrer bisherigen Adresse an. Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail.`,
    emailRequestedSubject: (site: string) => `Ihre Anmelde-E-Mail für ${site} soll geändert werden`,
    emailRequestedIntro: (site: string, to: string) => `Jemand, der in Ihrem Konto bei ${site} angemeldet ist, möchte die Anmelde-E-Mail in ${to} ändern. Bis die neue Adresse bestätigt ist, ändert sich nichts.`,
    emailRequestedAction: 'Neues Passwort festlegen',
    emailRequestedFooter: 'Wenn Sie das waren, ist nichts zu tun. Wenn nicht, legen Sie sofort ein neues Passwort fest: Das bricht die Änderung ab und meldet alle anderen ab.',
    emailChangedSubject: (site: string) => `Ihre Anmelde-E-Mail für ${site} wurde geändert`,
    emailChangedIntro: (site: string, to: string) => `Die Anmelde-E-Mail Ihres Kontos bei ${site} wurde in ${to} geändert. Melden Sie sich ab jetzt mit der neuen Adresse an.`,
    emailChangedByAdminIntro: (site: string, to: string) => `Ein Administrator hat die Anmelde-E-Mail Ihres Kontos bei ${site} in ${to} geändert. Melden Sie sich ab jetzt mit der neuen Adresse an.`,
    emailChangedFooter: 'Wenn Sie das nicht erwartet haben, wenden Sie sich an den Administrator der Website.',
    emailSetSubject: (site: string) => `Ihre Anmelde-E-Mail für ${site}`,
    emailSetIntro: (site: string) => `Ein Administrator hat diese Adresse als Anmelde-E-Mail Ihres Kontos bei ${site} festgelegt. Melden Sie sich damit und mit Ihrem gewohnten Passwort an.`,
    emailSetAction: 'Anmelden',
    emailSetFooter: 'Wenn Sie das nicht erwartet haben, wenden Sie sich an den Administrator der Website.',
    emailInUseSubject: (site: string) => `Ihre E-Mail-Adresse bei ${site}`,
    emailInUseIntro: (site: string) => `Jemand wollte diese Adresse für ein anderes Konto bei ${site} verwenden, sie gehört dort aber schon zu einem Konto. Es wurde nichts geändert.`,
    emailInUseFooter: 'Wenn Sie das waren, melden Sie sich mit dieser Adresse an. Andernfalls ignorieren Sie diese E-Mail.',
  },
} satisfies Record<Locale, Record<string, unknown>>

/** The role as the invitation names it, in the sentence's language (the admin's own names: Administrátor, Editor, Autor). */
const roleNames: Record<Locale, Record<string, string>> = {
  en: { admin: 'an administrator', editor: 'an editor', author: 'an author' },
  cs: { admin: 'administrátor', editor: 'editor', author: 'autor' },
  de: { admin: 'Administrator', editor: 'Redakteur', author: 'Autor' },
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!))

const SUPPORTED: Locale[] = ['cs', 'en', 'de']

/**
 * The language of the person whose request this is: the language they chose in the admin
 * (the `cms_admin_locale` cookie), else the first of their browser's languages we write
 * in (Accept-Language, by weight). Null when neither says. Used when the recipient has no
 * saved language: a reset link goes to whoever asked, in their language, and an
 * invitation in the inviting administrator's.
 */
export function requestLocale(event: any): Locale | null {
  const pick = (code: string): Locale | null => {
    const base = code.trim().toLowerCase().split('-')[0] as Locale
    return SUPPORTED.includes(base) ? base : null
  }
  const chosen = pick(String(getCookie(event, 'cms_admin_locale') ?? ''))
  if (chosen) return chosen
  const header = String(getRequestHeader(event, 'accept-language') ?? '')
  const ranked = header.split(',').map((part, i) => {
    const [code, ...params] = part.split(';')
    const q = Number(/q=([\d.]+)/.exec(params.join(';'))?.[1] ?? 1)
    return { code: (code ?? '').trim(), q: Number.isFinite(q) ? q : 0, i }
  }).filter((x) => x.code && x.q > 0).sort((a, b) => b.q - a.q || a.i - b.i)
  for (const { code } of ranked) {
    const found = pick(code)
    if (found) return found
  }
  return null
}

/** The admin's settings that emails need: product name and default language. */
export function emailContext(locale?: string | null): { locale: Locale; site: string } {
  const admin = ((useAppConfig() as any)?.cms?.admin ?? {}) as Record<string, any>
  const wanted = (locale || admin.defaultLocale || 'en') as string
  const base = wanted.toLowerCase().split('-')[0]
  const lang: Locale = base === 'cs' || base === 'de' ? base : 'en'
  return { locale: lang, site: resolveText(admin.name, lang, ['en']) || 'CMS' }
}

function layout(opts: { intro: string; action?: string; url?: string; footer: string; fallback: string }) {
  const url = opts.url ? escapeHtml(opts.url) : ''
  const button = opts.action && opts.url
    ? `<p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;font-weight:600">${escapeHtml(opts.action)}</a></p>
`
    : ''
  const fallback = opts.action && opts.url
    ? `<p style="margin:0;font-size:12px;line-height:1.5;color:#a3a3a3">${escapeHtml(opts.fallback)}<br><span style="word-break:break-all">${url}</span></p>
`
    : ''
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717">
<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:28px">
<p style="margin:0 0 20px;font-size:15px;line-height:1.55">${escapeHtml(opts.intro)}</p>
${button}<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#737373">${escapeHtml(opts.footer)}</p>
${fallback}</div></body></html>`
  const text = opts.action && opts.url
    ? `${opts.intro}\n\n${opts.action}: ${opts.url}\n\n${opts.footer}\n`
    : `${opts.intro}\n\n${opts.footer}\n`
  return { html, text }
}

export function inviteEmail(opts: { to: string; inviter: string; url: string; role?: string; locale?: string | null }) {
  const { locale, site } = emailContext(opts.locale)
  const c = copy[locale]
  const days = Math.round(INVITE_TTL_MS / 86_400_000)
  return {
    to: opts.to,
    subject: c.inviteSubject(site),
    ...layout({ intro: c.inviteIntro(opts.inviter, site, roleNames[locale][opts.role ?? ''] ?? roleNames[locale].editor!), action: c.inviteAction, url: opts.url, footer: c.inviteExpiry(days), fallback: c.fallback }),
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

// ── a change of email address ──────────────────────────────────────────────────

/** To the new address: the link that makes the change. */
export function emailConfirmEmail(opts: { to: string; url: string; locale?: string | null }) {
  const { locale, site } = emailContext(opts.locale)
  const c = copy[locale]
  const hours = Math.round(EMAIL_CHANGE_TTL_MS / 3_600_000)
  return { to: opts.to, subject: c.emailConfirmSubject(site), ...layout({ intro: c.emailConfirmIntro(site), action: c.emailConfirmAction, url: opts.url, footer: c.emailConfirmExpiry(hours), fallback: c.fallback }) }
}

/** To the old address when a change is asked for: who to call if it was not them (a new password cancels it). */
export function emailRequestedNotice(opts: { to: string; newEmail: string; url: string; locale?: string | null }) {
  const { locale, site } = emailContext(opts.locale)
  const c = copy[locale]
  return { to: opts.to, subject: c.emailRequestedSubject(site), ...layout({ intro: c.emailRequestedIntro(site, maskEmail(opts.newEmail)), action: c.emailRequestedAction, url: opts.url, footer: c.emailRequestedFooter, fallback: c.fallback }) }
}

/** To the old address once the change is made (by the person, or by an administrator). */
export function emailChangedNotice(opts: { to: string; newEmail: string; byAdmin?: boolean; locale?: string | null }) {
  const { locale, site } = emailContext(opts.locale)
  const c = copy[locale]
  const intro = opts.byAdmin ? c.emailChangedByAdminIntro(site, maskEmail(opts.newEmail)) : c.emailChangedIntro(site, maskEmail(opts.newEmail))
  return { to: opts.to, subject: c.emailChangedSubject(site), ...layout({ intro, footer: c.emailChangedFooter, fallback: c.fallback }) }
}

/** To the new address when an administrator set it: from now on this is how they sign in. */
export function emailSetNotice(opts: { to: string; url: string; locale?: string | null }) {
  const { locale, site } = emailContext(opts.locale)
  const c = copy[locale]
  return { to: opts.to, subject: c.emailSetSubject(site), ...layout({ intro: c.emailSetIntro(site), action: c.emailSetAction, url: opts.url, footer: c.emailSetFooter, fallback: c.fallback }) }
}

/**
 * To an address someone asked to move to that already has an account: the person asking
 * is not told (it would tell them who has an account), the owner of the address is.
 */
export function emailInUseNotice(opts: { to: string; locale?: string | null }) {
  const { locale, site } = emailContext(opts.locale)
  const c = copy[locale]
  return { to: opts.to, subject: c.emailInUseSubject(site), ...layout({ intro: c.emailInUseIntro(site), footer: c.emailInUseFooter, fallback: c.fallback }) }
}

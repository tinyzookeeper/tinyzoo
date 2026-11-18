import { resolveText } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'
import { listedRecipients } from './formSettings'

// Website forms (defineForm): what the website needs to draw one, who hears about a
// submission, and the email they get.

/** The form collection by name, or 404 (never another collection). */
export function formEntity(reg: CmsRegistry, name: string | undefined): CmsEntity {
  const e = reg.entities.find((x) => x.name === name && (x as any).preset === 'form')
  if (!e) throw createError({ statusCode: 404, statusMessage: 'No such form' })
  return e
}

// The button and thank-you texts when the form does not set its own.
const FORM_DEFAULTS: Record<string, { submit: string; success: string }> = {
  cs: { submit: 'Odeslat', success: 'Děkujeme, zprávu jsme dostali.' },
  en: { submit: 'Send', success: 'Thank you, we got your message.' },
  de: { submit: 'Senden', success: 'Vielen Dank, Ihre Nachricht ist angekommen.' },
}

/** The language a form is answered in: the one the website says (`locale`), else the site's default. */
export function formLocale(reg: CmsRegistry, wanted: unknown): string {
  return typeof wanted === 'string' && reg.locales?.locales.includes(wanted) ? wanted : (reg.locales?.default ?? 'en')
}

/** The visitor-facing description of a form, in one language: what to draw. */
export function formSchema(e: CmsEntity, locale: string): Record<string, any> {
  const form = (e as any).form as { fields: string[]; submitLabel: any; successMessage: any }
  const text = (v: any, fallback = '') => resolveText(v, locale) || fallback
  const defaults = FORM_DEFAULTS[locale.split('-')[0]!] ?? FORM_DEFAULTS.en!
  return {
    name: e.name,
    locale,
    label: text(e.label, e.name),
    submitLabel: text(form.submitLabel, defaults.submit),
    successMessage: text(form.successMessage, defaults.success),
    turnstileSiteKey: String((useRuntimeConfig().public as any)?.cmsTurnstileSiteKey || '') || null,
    fields: form.fields.map((key) => {
      const fld = e.fields[key] as any
      const meta = fld.meta ?? {}
      return {
        key,
        type: fld.type,
        label: text(meta.label, key),
        help: text(meta.help) || null,
        // A choice with no default that is not .optional() must be made, a consent must be ticked: say so.
        required: !!fld.isRequired || !!meta.mustBeTrue || (fld.type === 'select' && !fld.isOptional && fld.default === undefined),
        // What a choice starts on (its default), so the form opens with it selected.
        default: fld.type === 'select' && typeof fld.default === 'string' ? fld.default : null,
        format: meta.format ?? null,
        multiline: !!meta.multiline,
        max: meta.max ?? null,
        options: fld.type === 'select'
          ? (meta.options as string[]).map((value) => ({ value, label: text(meta.labels?.[value], value) }))
          : null,
      }
    }),
  }
}

/** Who gets an email about a new submission: the admin's Forms settings, else code, else env. */
export async function formRecipients(db: any, reg: CmsRegistry, e: CmsEntity): Promise<string[]> {
  const settings = reg.entities.find((x) => (x as any).preset === 'formSettings')
  if (settings) {
    const [row]: any[] = await db.select().from(settings.table).limit(1)
    const listed = listedRecipients(settings, row)
    if (listed.length) return listed
  }
  const coded = ((e as any).form?.notify?.to ?? []) as string[]
  if (coded.length) return coded
  // The module writes a comma-separated string (so NUXT_CMS_FORMS_NOTIFY_TO binds), but a list set straight in `runtimeConfig` works too.
  const env = (useRuntimeConfig().cms as any)?.forms?.notifyTo
  return (Array.isArray(env) ? env.map(String) : String(env || '').split(',')).map((s) => s.trim()).filter(Boolean)
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!))

/** The email about a new submission: every field, and a link to it in the admin. */
export function submissionEmail(opts: { to: string; e: CmsEntity; row: Record<string, any>; adminUrl: string | null }) {
  const { locale, site } = emailContext()
  const schema = formSchema(opts.e, locale)
  const lines = schema.fields.map((f: any) => {
    const v = opts.row[f.key]
    const shown = v === null || v === undefined || v === '' ? '—'
      : f.type === 'boolean' ? (v ? (locale === 'cs' ? 'Ano' : locale === 'de' ? 'Ja' : 'Yes') : (locale === 'cs' ? 'Ne' : locale === 'de' ? 'Nein' : 'No'))
      : f.type === 'select' ? (f.options.find((o: any) => o.value === v)?.label ?? String(v))
      : v instanceof Date ? v.toISOString() : String(v)
    return { label: f.label, value: shown }
  })
  // Reply straight to the visitor; the subject says who wrote.
  const emailField = schema.fields.find((f: any) => f.format === 'email' && typeof opts.row[f.key] === 'string' && opts.row[f.key])
  const replyTo = emailField ? String(opts.row[emailField.key]) : undefined
  const nameField = schema.fields.find((f: any) => f.type === 'text' && f.format !== 'email' && !f.multiline && typeof opts.row[f.key] === 'string' && opts.row[f.key])
  const who = nameField ? String(opts.row[nameField.key]).slice(0, 80) : (replyTo ?? '')
  const subject = locale === 'cs'
    ? (who ? `Nová zpráva od ${who}: ${schema.label}` : `Nová zpráva: ${schema.label} (${site})`)
    : locale === 'de'
      ? (who ? `Neue Nachricht von ${who}: ${schema.label}` : `Neue Nachricht: ${schema.label} (${site})`)
      : (who ? `New message from ${who}: ${schema.label}` : `New message: ${schema.label} (${site})`)
  const open = locale === 'cs' ? 'Otevřít v administraci' : locale === 'de' ? 'In der Verwaltung öffnen' : 'Open in the admin'
  const text = [...lines.map((l: any) => `${l.label}:\n${l.value}\n`), opts.adminUrl ? `${open}: ${opts.adminUrl}` : ''].join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1f2023">`
    + lines.map((l: any) => {
      // Computed first: a regex inside a template placeholder stops Nitro auto-imports.
      const value = escapeHtml(l.value).split('\n').join('<br>')
      const label = escapeHtml(l.label)
      return `<p style="margin:0 0 12px"><strong>${label}</strong><br>${value}</p>`
    }).join('')
    + (opts.adminUrl ? `<p style="margin:20px 0 0"><a href="${escapeHtml(opts.adminUrl)}">${escapeHtml(open)}</a></p>` : '')
    + `</div>`
  return { to: opts.to, subject, text, html, replyTo }
}

/** Cloudflare Turnstile: true when not configured, or the token passes. */
export async function turnstileOk(token: unknown, ip: string): Promise<boolean> {
  const secret = String((useRuntimeConfig().cms as any)?.forms?.turnstileSecret || '')
  if (!secret) return true
  if (typeof token !== 'string' || !token) return false
  try {
    const res: any = await $fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    })
    return res?.success === true
  }
  catch {
    return false
  }
}

/**
 * Website forms, as a plugin (`tinyzoo/forms`): visitors fill in a form, every submission
 * lands in the admin as an entry, and editors are told by email.
 *
 *   // cms.config.ts
 *   import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
 *
 *   export const plugins = [formsPlugin()]
 *   export const ContactForm = defineForm('contactForm', { label: 'Contact form', fields: { … } })
 *   export const FormSettings = defineFormSettings()
 *   // on a page: <CmsForm name="contactForm" />
 *
 * What the plugin brings: the endpoints `GET/POST /api/content/_form/:name` (spam checks,
 * rate limits, Turnstile, notifications), the `<CmsForm>` component, the retention of
 * submissions (`retentionDays`) and the admin's form bits (no "New" button, the retention
 * note under the list). The forms and the settings stay the site's own entities: the
 * tables and their names are exactly what `defineForm` has always made.
 *
 * `defineForm` and `defineFormSettings` are also exported from `tinyzoo`, deprecated:
 * they still work, register this plugin by themselves and say so once.
 */
import { defineEntity, defineSingleton, type EntityDef } from '../src/entity'
import { f } from '../src/fields'
import type { LocalizedText } from '../src/i18n'
import { defineCmsPlugin, pluginFile, type CmsPlugin, type CmsPluginRequirement } from '../src/plugin'
import pkg from '../package.json'
import { retainForms } from './retention'

/**
 * Who may read a form's messages (list, open, export, search) and the recipients in the
 * Forms settings, unless the site says otherwise with `defineForm({ access })`: administrators
 * and editors. Messages are personal data of people who are not users of the site — an
 * author, who writes posts, has no business reading them. (A custom role of an external
 * sign-in gets no access either, until the form's `access.read` names it.)
 */
export const formsReadAccess: NonNullable<EntityDef<any>['access']>['read'] = ({ user }) => user?.role === 'admin' || user?.role === 'editor'

/** Field types a visitor can fill in on a website form. */
export const FORM_FIELD_TYPES = new Set(['text', 'number', 'boolean', 'select', 'datetime'])

export interface FormOptions<F extends Record<string, any>> {
  /** The form's name in the admin ("Contact form", { cs: 'Kontaktní formulář' }). */
  label: LocalizedText
  /** One submission ("Message"); the list of submissions is labelled with `label`. */
  labelSingular?: LocalizedText
  description?: LocalizedText
  /** What visitors fill in: text (also `format: 'email'`, `multiline`), number, yes/no, a choice, a date. */
  fields: F
  /** The field that names a submission in the list (default: the first text field). */
  titleField?: keyof F & string
  /** The button under the form on the website. */
  submitLabel?: LocalizedText
  /** Shown after sending. */
  successMessage?: LocalizedText
  /**
   * Who is told about a new submission, by email. Addresses set by editors in the
   * Forms settings (defineFormSettings) come first; these are the fallback.
   */
  notify?: { to?: string[] }
  /**
   * Delete a submission this many days after it arrived (a scheduled task does it, daily;
   * the admin says so under the list). Default: keep them until someone deletes them.
   * Set it to what the site's privacy policy promises.
   */
  retentionDays?: number
  /**
   * Who may read, change and delete the messages. By default only administrators and
   * editors read them (authors do not, whatever else they may do): write a rule to widen
   * or narrow that, the same rules entities have everywhere:
   *
   *   access: { read: ({ user }) => user.role !== 'author' || user.id === '…' }
   *
   * A rule given here for `read` replaces the default; `update` and `delete` narrow what the
   * roles allow, as always. It decides the list, a message, the CSV export, search and the
   * form's place in the admin menu.
   */
  access?: EntityDef<F>['access']
}

/** What an entity made by this plugin's helpers says about the plugin it needs. */
export const FORMS_REQUIREMENT: CmsPluginRequirement = {
  plugin: 'forms',
  hint: 'add `export const plugins = [formsPlugin()]` to cms.config.ts (`import { formsPlugin } from \'tinyzoo/forms\'`).',
}

/**
 * A form on the website (contact, sign-up, order): visitors fill it in, every
 * submission lands in the admin as an entry of this collection, and editors are told
 * by email. Spam is kept out by a hidden field, a minimum time to fill it in, a rate
 * limit per visitor and, when configured, Cloudflare Turnstile.
 *
 *   export const ContactForm = defineForm('contactForm', {
 *     label: { en: 'Contact form', cs: 'Kontaktní formulář' },
 *     fields: {
 *       name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
 *       email: f.text({ required: true, format: 'email' }).label({ en: 'Email', cs: 'E-mail' }),
 *       message: f.text({ required: true, multiline: true, max: 5000 }).label({ en: 'Message', cs: 'Zpráva' }),
 *     },
 *   })
 *   // on the website: <CmsForm name="contactForm" />
 *   // or POST /api/content/_form/contactForm { name, email, message }
 *
 * Needs `formsPlugin()` in the site's `plugins`.
 */
export function defineForm<F extends Record<string, any>>(name: string, opts: FormOptions<F>) {
  if (opts.retentionDays !== undefined && (!Number.isInteger(opts.retentionDays) || opts.retentionDays < 1)) {
    throw new Error(`Form "${name}": retentionDays must be a whole number of days, at least 1 (leave it out to keep submissions).`)
  }
  for (const [key, fld] of Object.entries(opts.fields) as [string, any][]) {
    if (key === 'status' || key === 'id') throw new Error(`Form field "${key}" is reserved.`)
    if (!FORM_FIELD_TYPES.has(fld.type) || fld.relation) {
      throw new Error(`Form field "${key}" has type "${fld.type}", which website forms do not support (allowed: ${[...FORM_FIELD_TYPES].join(', ')}).`)
    }
  }
  const keys = Object.keys(opts.fields)
  const titleField = opts.titleField ?? keys.find((k) => (opts.fields as any)[k].type === 'text') ?? keys[0]!
  const e = defineEntity(name, {
    label: opts.label,
    labelSingular: opts.labelSingular ?? { en: 'Submission', cs: 'Odpověď', de: 'Nachricht' },
    description: opts.description,
    icon: 'i-lucide-inbox',
    titleField,
    fields: {
      ...opts.fields,
      status: f.select({
        options: ['new', 'read', 'done'] as const, default: 'new',
        labels: { new: { en: 'New', cs: 'Nové', de: 'Neu' }, read: { en: 'Read', cs: 'Přečtené', de: 'Gelesen' }, done: { en: 'Done', cs: 'Vyřízené', de: 'Erledigt' } },
        icons: { new: 'i-lucide-mail', read: 'i-lucide-mail-open', done: 'i-lucide-check' },
      }).position('sidebar').label({ en: 'State', cs: 'Stav', de: 'Status' }),
    },
    admin: { list: { columns: [...keys.slice(0, 3), 'status'] as any, searchable: keys.filter((k) => (opts.fields as any)[k].type === 'text') as any } },
    access: { read: formsReadAccess, ...opts.access },
  } as any)
  ;(e as any).preset = 'form'
  ;(e as any).requiresPlugin = FORMS_REQUIREMENT
  ;(e as any).form = {
    fields: keys,
    submitLabel: opts.submitLabel ?? null,
    successMessage: opts.successMessage ?? null,
    notify: { to: opts.notify?.to ?? [] },
    retentionDays: opts.retentionDays ?? null,
  }
  return e
}

/**
 * Settings for every website form: who gets an email about new submissions. Optional;
 * without it, each form's `notify.to` (code) or `cms.forms.notifyTo` (env) is used.
 */
export function defineFormSettings(opts: { name?: string; access?: EntityDef<any>['access'] } = {}) {
  const e = defineSingleton(opts.name ?? 'formSettings', {
    label: { en: 'Forms', cs: 'Formuláře', de: 'Formulare' },
    description: { en: 'Who is told about new messages from the website.', cs: 'Komu přijde e-mail o nových zprávách z webu.', de: 'Wer über neue Nachrichten von der Website informiert wird.' },
    icon: 'i-lucide-inbox',
    titleField: 'notifyTo',
    fields: {
      notifyTo: f.list({
        fields: { email: f.text({ required: true, format: 'email' }).label({ en: 'Email', cs: 'E-mail', de: 'E-Mail' }) },
        max: 20, itemLabel: { en: 'Recipient', cs: 'Příjemce', de: 'Empfänger' },
      }).label({ en: 'Send new messages to', cs: 'Nové zprávy posílat na', de: 'Neue Nachrichten senden an' })
        .help({ en: 'Everyone here gets an email when someone sends a form on the website.', cs: 'Všem zde přijde e-mail, když někdo odešle formulář na webu.', de: 'Alle hier erhalten eine E-Mail, wenn jemand ein Formular auf der Website absendet.' }),
    },
    // The recipients are people's addresses, and the settings of messages authors do not read.
    access: { read: formsReadAccess, ...opts.access },
  } as any)
  ;(e as any).preset = 'formSettings'
  ;(e as any).requiresPlugin = FORMS_REQUIREMENT
  return e
}

/** The plugin: endpoints, `<CmsForm>`, retention, and the admin's form bits. */
export function formsPlugin(): CmsPlugin {
  return defineCmsPlugin({
    name: 'forms',
    version: pkg.version,
    // <CmsForm> for the website's pages.
    components: pluginFile(import.meta.url, './components'),
    // The public form endpoints keep the address they have always had.
    serverHandlers: [
      { method: 'get', contentPath: '_form/:name', handler: pluginFile(import.meta.url, './server/form.get.ts') },
      { method: 'post', contentPath: '_form/:name', handler: pluginFile(import.meta.url, './server/form.post.ts') },
    ],
    hooks: { retention: retainForms },
    // A form's submissions arrive from the website, so the admin offers no "New" button,
    // and says when they are deleted.
    graph: (e) => {
      if ((e as any).preset !== 'form') return
      const days = (e as any).form?.retentionDays as number | null | undefined
      return {
        create: false,
        notices: days ? [{ icon: 'i-lucide-clock', key: 'plugins.forms.retention', params: { count: days } }] : [],
      }
    },
    i18n: {
      en: { retention: { one: 'Messages are deleted automatically {count} day after they arrive.', other: 'Messages are deleted automatically {count} days after they arrive.' } },
      cs: { retention: { one: 'Zprávy se automaticky mažou {count} den po přijetí.', few: 'Zprávy se automaticky mažou {count} dny po přijetí.', other: 'Zprávy se automaticky mažou {count} dní po přijetí.' } },
      de: { retention: { one: 'Nachrichten werden {count} Tag nach Eingang automatisch gelöscht.', other: 'Nachrichten werden {count} Tage nach Eingang automatisch gelöscht.' } },
    },
  })
}

/** The registration the deprecated `defineForm` / `defineFormSettings` of `tinyzoo` leave to the plugin. */
export const IMPLICIT_FORMS_REQUIREMENT: CmsPluginRequirement = { ...FORMS_REQUIREMENT, create: formsPlugin }

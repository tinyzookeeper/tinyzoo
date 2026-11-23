import { localizeFormIssues } from '../messages'
import { formEntity, formLocale, formRecipients, submissionEmail, turnstileOk } from './forms'

// POST /api/content/_form/:name — a visitor sends a website form (defineForm).
// The submission is validated against the form's fields and stored as a new entry
// (state "new"); the people in the Forms settings get an email. Spam stays out:
//  - `_hp`: a hidden field people never fill in (filled → answered 201, not stored),
//  - `_t`: milliseconds the form was open (under 1.5 s → answered 201, not stored). It is
//    optional ON PURPOSE: a plain HTML form without JavaScript, or a script, cannot send it,
//    and dropping their messages in silence would lose real ones. <CmsForm> always sends it;
//    what keeps robots that leave it out away is the hidden field, the rate limits and
//    Turnstile (cms.forms.turnstileSecret) — switch that on for a form that robots find,
//  - a rate limit per visitor, and Cloudflare Turnstile when configured,
//  - only from this site's own pages (Origin), when the browser says where from.
// Open to everyone by design: no content token (browsers send it).
const WINDOW = 10 * 60_000

/** What a robot gets for a post that is thrown away: the answer of a stored one. */
function acceptedUnseen(event: any) {
  setResponseStatus(event, 201)
  return { ok: true }
}

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const e = formEntity(reg, getRouterParam(event, 'name'))
  const form = (e as any).form as { fields: string[] }

  const origin = getRequestHeader(event, 'origin')
  if (origin) {
    let ours: boolean
    if (cmsIsMultiTenant()) {
      // Many sites share the server: the site's own hosts and its address count, not the request's.
      try { ours = useCmsSite().hosts.includes(cmsNormalHost(new URL(origin).host)) || new URL(String(cmsSettings().publicUrl || '')).origin === origin }
      catch { ours = false }
    }
    else {
      const own = new Set([getRequestURL(event).origin])
      const configured = String(cmsSettings().publicUrl || '').replace(/\/+$/, '')
      if (configured) own.add(new URL(configured).origin)
      ours = own.has(origin)
    }
    if (!ours) throw createError({ statusCode: 403, statusMessage: 'Forms accept submissions from this site only' })
  }

  // Attempts are limited loosely (correcting a typo is fine); accepted messages tightly, below.
  const ip = clientIp(event)
  if (!(await rateLimit(`form-try:${e.name}:${ip}`, 30, WINDOW))) {
    throw tooManyRequests(event, 'Too many messages; try again in a few minutes', WINDOW)
  }

  // A form is a few fields: refuse anything large before reading it.
  const length = Number(getRequestHeader(event, 'content-length') || 0)
  if (length > 64 * 1024 || getRequestHeader(event, 'transfer-encoding')) throw createError({ statusCode: 413, statusMessage: 'Too large for a form' })
  const body = (await readBody(event).catch(() => null)) as Record<string, any> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw createError({ statusCode: 400, statusMessage: 'Send the form as JSON or form data' })

  // Robots that fill the hidden field: answered like a success, nothing stored.
  // The same 201 as a stored one: a robot must not be able to tell which of its posts were thrown away.
  if (typeof body._hp === 'string' && body._hp.trim()) return acceptedUnseen(event)

  if (!(await turnstileOk(body['cf-turnstile-response'], ip))) {
    throw createError({ statusCode: 400, statusMessage: 'The spam check failed; reload the page and try again' })
  }

  // Only the form's own fields (never its state, ids or anything else).
  const input: Record<string, any> = {}
  for (const key of form.fields) {
    let v = body[key]
    const fld = e.fields[key] as any
    // Form data sends text: turn it into what the field expects.
    if (typeof v === 'string') {
      v = v.trim()
      if (v === '') v = fld.isOptional ? null : undefined
      else if (fld.type === 'number') v = Number(v)
      else if (fld.type === 'boolean') v = v === 'true' || v === 'on' || v === '1'
    }
    // An unchosen choice (null) is "not given": its default applies, or it is asked for.
    if (v === null && !fld.isOptional) v = undefined
    if (v === undefined && fld.type === 'boolean') v = false
    if (v !== undefined) input[key] = v
  }
  // Refused fields come back with a message in the visitor's language (`_locale`, what the website says).
  const parsed = e.insertSchema.safeParse(input)
  if (!parsed.success) {
    const wanted = typeof body._locale === 'string' && /^[a-z]{2,3}([-_][A-Za-z0-9]+)?$/.test(body._locale) ? body._locale : formLocale(reg, undefined)
    const issues = localizeFormIssues(parsed.error.issues as any[], e.fields as any, wanted)
    throw createError({ statusCode: 422, statusMessage: 'Validation failed', data: issues })
  }
  const values = parsed.data as Record<string, any>
  values.status = 'new'
  // Sent faster than a person fills a form in (<CmsForm> never sends that early): a
  // robot posting directly. Checked after validation, so a real empty form still gets
  // its errors; answered like a success, nothing stored.
  if (body._t !== undefined && Number(body._t) < 1500) return acceptedUnseen(event)
  if (!(await rateLimit(`form:${e.name}:${ip}`, 8, WINDOW))) {
    throw tooManyRequests(event, 'Too many messages; try again in a few minutes', WINDOW)
  }

  const [row]: any[] = await (db as any).insert(e.table).values(values).returning()
    .catch((err: unknown) => rethrowDbError(err, e, 'write'))
  await audit(event, 'form.submit', { entity: e.name, recordId: row.id }).catch(() => {})
  await reportChange(event, { type: 'entry.created', entity: e, id: row.id, after: row })

  // Tell people; a mail problem never loses the submission.
  const to = await formRecipients(db, reg, e)
  if (to.length) {
    const base = String(cmsSettings().publicUrl || '').replace(/\/+$/, '') || getRequestURL(event).origin
    const adminUrl = base + '/admin/' + e.name + '/' + row.id
    for (const addr of to) {
      await submissionEmail(event, { to: addr, e, row, adminUrl }).then(sendCmsMail).catch((err: any) => {
        console.error('[cms] form notification failed:', redactEmails(safeErrorMessage(err)))
      })
    }
  }
  setResponseStatus(event, 201)
  return { ok: true }
})

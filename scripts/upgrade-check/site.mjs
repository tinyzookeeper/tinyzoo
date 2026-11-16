// What the upgrade check does to a running site over HTTP: first-run setup, seeding,
// recording what the content API and the admin API return, comparing two recordings
// field by field, and saving every entry back through the admin.
//
// Nothing here knows the site's content model beyond the names the starter has always
// had (`page`, `news`, `siteSettings`, `navigation`, `contactForm`); the snapshot and
// the round trip walk the admin graph (`/api/cms/_graph`) instead of a fixed list, so
// entries a later seeding step adds are covered without a change here.
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'

export const ACCOUNT = { name: 'Upgrade Check', email: 'upgrade@check.test', password: 'a long enough password for the upgrade check' }

// ── HTTP ─────────────────────────────────────────────────────────────────────────

/** A tiny HTTP client that keeps one session cookie: one instance is one browser. */
export class Client {
  cookie = ''
  constructor(baseURL) { this.baseURL = baseURL }

  async request(method, path, { json, body, headers = {} } = {}) {
    const h = { accept: 'application/json', ...headers }
    if (this.cookie) h.cookie = this.cookie
    if (json !== undefined) {
      h['content-type'] = 'application/json'
      body = JSON.stringify(json)
    }
    const res = await fetch(this.baseURL + path, { method, headers: h, body, redirect: 'manual' })
    const set = res.headers.getSetCookie()
    if (set.length) this.cookie = set.map((c) => c.split(';')[0]).join('; ')
    const buf = Buffer.from(await res.arrayBuffer())
    const text = buf.toString('utf8')
    let parsed = text
    try { parsed = text ? JSON.parse(text) : null }
    catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, body: parsed, bytes: buf }
  }

  get(path) { return this.request('GET', path) }
  post(path, json) { return this.request('POST', path, { json }) }
  put(path, json) { return this.request('PUT', path, { json }) }
  patch(path, json) { return this.request('PATCH', path, { json }) }
  upload(path, file) {
    const form = new FormData()
    form.append('file', new Blob([file.data], { type: file.type }), file.name)
    return this.request('POST', path, { body: form })
  }
}

/** Throws with the response when it is not one of the expected statuses. */
export function expectStatus(res, what, ...ok) {
  const wanted = ok.length ? ok : [200]
  if (!wanted.includes(res.status)) {
    throw new Error(`${what}: HTTP ${res.status} ${typeof res.body === 'string' ? res.body.slice(0, 300) : JSON.stringify(res.body).slice(0, 600)}`)
  }
  return res
}

export async function signIn(baseURL, account = ACCOUNT) {
  const client = new Client(baseURL)
  expectStatus(await client.post('/api/cms/_auth/login', { email: account.email, password: account.password }), `sign in as ${account.email}`)
  return client
}

// ── fixtures ─────────────────────────────────────────────────────────────────────

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** A small, valid PNG of one colour (so the check does not carry binary files). */
export function png(size, [r, g, b]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8 bits, RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [r, g, b]).flat())])
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]))
}

const doc = (text, image) => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text }] },
    ...(image ? [{ type: 'image', attrs: { src: image.url, mediaId: image.id, alt: '' } }] : []),
  ],
})

// ── seeding ──────────────────────────────────────────────────────────────────────
//
// Seeding is a pluggable step. This one goes through the HTTP API with a few fixed
// entries. When `tinyzoo seed` exists at the baseline, a seeder that runs it plugs into
// `SEEDERS` in upgrade-check.mjs (or a baseline's hook file returns its own `seed`);
// everything after it works from what the site returns, not from what was seeded.

/** First-run setup, then pages, news, settings, navigation, media and a form message. */
export async function seedViaApi(baseURL, { setupToken, log = () => {} }) {
  const admin = new Client(baseURL)
  // The code goes in `token`: NUXT_CMS_AUTH_SETUP_TOKEN is set, which every version accepts.
  expectStatus(await admin.post('/api/cms/_auth/setup', { ...ACCOUNT, token: setupToken }), 'first-run setup', 201)
  log('first-run setup done')

  const graph = expectStatus(await admin.get('/api/cms/_graph'), 'admin graph').body
  const has = (name) => graph.some((e) => e.name === name)
  const upload = async (name, data) => expectStatus(await admin.upload('/api/cms/_media', { name, type: 'image/png', data }), `upload ${name}`, 201).body
  const hero = await upload('hero.png', png(8, [200, 60, 60]))
  const cover = await upload('cover.png', png(6, [40, 120, 200]))
  const inline = await upload('inline.png', png(4, [60, 160, 80]))
  const logo = await upload('logo.png', png(5, [20, 20, 20]))

  const created = {}
  if (has('page')) {
    const home = expectStatus(await admin.post('/api/cms/page', {
      title: 'Úvod', slug: 'uvod', status: 'published', metaTitle: 'Úvod — upgrade check',
      sections: [
        { id: 'home-hero', type: 'hero', heading: 'Vítejte', text: 'První odstavec.', image: hero.id, buttonLabel: 'Kontakt', buttonUrl: '/kontakt' },
        { id: 'home-text', type: 'text', body: doc('Text stránky s diakritikou: příliš žluťoučký kůň.') },
        { id: 'home-image', type: 'image', image: cover.id, caption: 'Popisek' },
        { id: 'home-cta', type: 'cta', heading: 'Napište nám', buttonLabel: 'Napsat', buttonUrl: '/kontakt' },
        { id: 'home-contact', type: 'contact', heading: 'Kontaktní formulář' },
      ],
    }), 'create the home page', 201).body.row
    expectStatus(await admin.patch(`/api/cms/page/${home.id}?locale=en`, {
      title: 'Home', slug: 'home', metaTitle: 'Home — upgrade check',
      sections: [
        { id: 'home-hero', type: 'hero', heading: 'Welcome', text: 'First paragraph.', image: hero.id, buttonLabel: 'Contact', buttonUrl: '/contact' },
        { id: 'home-text', type: 'text', body: doc('Page text.') },
        { id: 'home-image', type: 'image', image: cover.id, caption: 'Caption' },
        { id: 'home-cta', type: 'cta', heading: 'Write to us', buttonLabel: 'Write', buttonUrl: '/contact' },
        { id: 'home-contact', type: 'contact', heading: 'Contact form' },
      ],
    }), 'translate the home page')
    const contact = expectStatus(await admin.post('/api/cms/page', {
      title: 'Kontakt', slug: 'kontakt', status: 'published',
      sections: [{ id: 'contact-form', type: 'contact', heading: 'Napište' }],
    }), 'create the contact page', 201).body.row
    const draft = expectStatus(await admin.post('/api/cms/page', {
      title: 'Koncept', slug: 'koncept', status: 'draft', sections: [{ id: 'draft-text', type: 'text', body: doc('Ještě nehotové.') }],
    }), 'create a draft page', 201).body.row
    created.pages = [home.id, contact.id, draft.id]
  }

  if (has('news')) {
    const item = expectStatus(await admin.post('/api/cms/news', {
      title: 'První aktualita', slug: 'prvni-aktualita', status: 'published', cover: cover.id,
      perex: 'Krátké shrnutí.', body: doc('Text aktuality s obrázkem.', inline),
    }), 'create a news item', 201).body.row
    expectStatus(await admin.patch(`/api/cms/news/${item.id}?locale=en`, {
      title: 'First news item', slug: 'first-news-item', perex: 'Short summary.', body: doc('News text with a picture.', inline),
    }), 'translate the news item')
    const draft = expectStatus(await admin.post('/api/cms/news', {
      title: 'Rozepsaná aktualita', slug: 'rozepsana', status: 'draft', body: doc('Koncept.'),
    }), 'create a draft news item', 201).body.row
    created.news = [item.id, draft.id]
  }

  if (has('siteSettings')) {
    expectStatus(await admin.put('/api/cms/_singleton/siteSettings', {
      siteName: 'Upgrade check', email: 'info@upgrade-check.test', phone: '+420 123 456 789', address: 'Ulice 1\nMěsto', logo: logo.id,
      tagline: 'Slogan', openingHours: [{ id: 'oh1', type: 'item', days: 'Po–Pá', hours: '8–16' }, { id: 'oh2', type: 'item', days: 'So', hours: 'zavřeno' }],
    }), 'save the site settings')
    expectStatus(await admin.put('/api/cms/_singleton/siteSettings?locale=en', { tagline: 'Tagline' }), 'translate the site settings')
  }

  if (has('navigation')) {
    const link = (label, url) => ({ id: `link-${url.replace(/\W+/g, '-')}`, type: 'link', label, url, newTab: false, sub: false })
    expectStatus(await admin.put('/api/cms/_singleton/navigation', { main: [link('Úvod', '/'), link('Kontakt', '/kontakt')], footer: [link('Aktuality', '/aktuality')] }), 'save the navigation')
    expectStatus(await admin.put('/api/cms/_singleton/navigation?locale=en', { main: [link('Home', '/en'), link('Contact', '/en/contact')], footer: [] }), 'translate the navigation')
  }

  if (has('contactForm')) {
    expectStatus(await new Client(baseURL).post('/api/content/_form/contactForm', { name: 'Jana Nováková', email: 'jana@example.test', message: 'Dobrý den, mám dotaz.' }), 'send a form message', 200, 201)
  }
  log(`seeded ${Object.entries(created).map(([k, v]) => `${v.length} ${k}`).join(', ')}, 4 files, settings, navigation and a form message`)
  return created
}

// ── recording ────────────────────────────────────────────────────────────────────

const isMediaObject = (v) => v && typeof v === 'object' && !Array.isArray(v) && typeof v.id === 'string' && typeof v.url === 'string' && typeof v.mime === 'string'

/** Every `{ id, url, mime, … }` object anywhere inside `value`, by id. */
function mediaIn(value, found = {}) {
  if (isMediaObject(value)) found[value.id] = value.url
  if (value && typeof value === 'object') for (const v of Object.values(value)) mediaIn(v, found)
  return found
}

/** All pages of a list endpoint (`{ items | rows, total }`). */
async function listAll(client, path, key, what) {
  const out = []
  for (let page = 1; page < 50; page++) {
    const res = expectStatus(await client.get(`${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=100`), what)
    out.push(...(res.body[key] ?? []))
    if (out.length >= (res.body.total ?? 0) || !(res.body[key] ?? []).length) break
  }
  return out
}

/**
 * Everything the check compares across the upgrade, as plain data:
 *   content[entity][locale][id]  the public content API (entries) / content[entity][locale] (globals)
 *   admin[entity][id][locale]    the admin's own view of every entry and setting
 *   sitemap                      the content API's sitemap entries, sorted
 *   media[id]                    the files the content points at: their URL and a hash of the served bytes
 * `admin` is a signed-in client; the content API is read anonymously, like a website does.
 */
export async function snapshot(baseURL, admin) {
  const anon = new Client(baseURL)
  const graph = expectStatus(await admin.get('/api/cms/_graph'), 'admin graph').body
  const snap = { entities: graph.map((e) => e.name).sort(), content: {}, admin: {}, sitemap: null, media: {} }

  for (const e of graph) {
    const locales = e.locales?.all ?? [null]
    // The public side. A 404 means the entity is not on the content API (forms, redirects, settings).
    for (const locale of locales) {
      const q = locale ? `locale=${locale}` : ''
      if (e.singleton) {
        const res = await anon.get(`/api/content/_global/${e.name}${q ? `?${q}` : ''}`)
        if (res.status === 404) continue
        expectStatus(res, `content API, ${e.name}${locale ? ` (${locale})` : ''}`)
        ;(snap.content[e.name] ??= {})[locale ?? 'default'] = res.body.item
      }
      else {
        const res = await anon.get(`/api/content/${e.name}?limit=1${q ? `&${q}` : ''}`)
        if (res.status === 404) continue
        expectStatus(res, `content API, ${e.name}${locale ? ` (${locale})` : ''}`)
        const items = await listAll(anon, `/api/content/${e.name}${q ? `?${q}` : ''}`, 'items', `content API, ${e.name}${locale ? ` (${locale})` : ''}`)
        ;(snap.content[e.name] ??= {})[locale ?? 'default'] = Object.fromEntries(items.map((i) => [i.id, i]))
      }
    }
    // The admin side: every entry, in its default language and in each translation it has.
    if (e.singleton) {
      const res = expectStatus(await admin.get(`/api/cms/_singleton/${e.name}`), `admin, ${e.name}`)
      const row = res.body.row
      if (row) {
        const byLocale = { default: row }
        for (const l of (row.__locales ?? []).filter((l) => l !== e.locales?.default)) byLocale[l] = expectStatus(await admin.get(`/api/cms/_singleton/${e.name}?locale=${l}`), `admin, ${e.name} (${l})`).body.row
        ;(snap.admin[e.name] ??= {})[row.id] = byLocale
      }
    }
    else {
      for (const row of await listAll(admin, `/api/cms/${e.name}`, 'rows', `admin list, ${e.name}`)) {
        const full = expectStatus(await admin.get(`/api/cms/${e.name}/${row.id}`), `admin, ${e.name} ${row.id}`).body.row
        const byLocale = { default: full }
        for (const l of (full.__locales ?? []).filter((l) => l !== e.locales?.default)) byLocale[l] = expectStatus(await admin.get(`/api/cms/${e.name}/${row.id}?locale=${l}`), `admin, ${e.name} ${row.id} (${l})`).body.row
        ;(snap.admin[e.name] ??= {})[row.id] = byLocale
      }
    }
  }

  const sitemap = await anon.get('/api/content/_sitemap')
  // Ordered by last change by the server; sorted here so a save does not look like a rearrangement.
  if (sitemap.status === 200) snap.sitemap = [...sitemap.body.entries].sort((a, b) => `${a.locale}:${a.loc}`.localeCompare(`${b.locale}:${b.loc}`))

  const urls = mediaIn(snap.content)
  for (const [id, url] of Object.entries(urls)) snap.media[id] = { url, ...(await fetchMedia(anon, url)) }
  return snap
}

async function fetchMedia(client, url) {
  const res = await client.get(url)
  return { status: res.status, sha256: res.status === 200 ? createHash('sha256').update(res.bytes).digest('hex') : null }
}

/** How many entries and what languages a snapshot holds, for the summary. */
export function describe(snap) {
  const entries = Object.values(snap.admin).reduce((n, byId) => n + Object.keys(byId).length, 0)
  const locales = new Set(Object.values(snap.content).flatMap((byLocale) => Object.keys(byLocale)))
  return `${Object.keys(snap.content).length} content collections, ${entries} entries in the admin, ${locales.size} language${locales.size === 1 ? '' : 's'}, ${Object.keys(snap.media).length} files`
}

// ── comparing ────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `content.page.cs.sections[].image.url`: ids dropped, array positions as `[]`. */
const pathOf = (segments) => segments.reduce((p, s) => (typeof s === 'number' ? `${p}[]` : UUID.test(s) ? p : p ? `${p}.${s}` : s), '')

function globToRegExp(glob) {
  const body = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^.]+').replace(/\0/g, '.*')
  return new RegExp(`^${body}$`)
}

/**
 * The differences between two snapshots: `{ path, where, kind: 'added' | 'removed' | 'changed', before, after }`.
 * `ignoreKeys` are keys (anywhere) left out, for comparing a snapshot with one taken after saves.
 */
export function diff(before, after, { ignoreKeys = [] } = {}) {
  const ignore = new Set(ignoreKeys)
  const out = []
  const walk = (a, b, segments) => {
    if (a === b) return
    const aObj = a && typeof a === 'object'
    const bObj = b && typeof b === 'object'
    if (aObj && bObj && Array.isArray(a) === Array.isArray(b)) {
      if (Array.isArray(a)) {
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
          if (i >= a.length) out.push(change('added', [...segments, i], undefined, b[i]))
          else if (i >= b.length) out.push(change('removed', [...segments, i], a[i], undefined))
          else walk(a[i], b[i], [...segments, i])
        }
      }
      else {
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
          if (ignore.has(k)) continue
          if (!(k in a)) out.push(change('added', [...segments, k], undefined, b[k]))
          else if (!(k in b)) out.push(change('removed', [...segments, k], a[k], undefined))
          else walk(a[k], b[k], [...segments, k])
        }
      }
      return
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(change('changed', segments, a, b))
  }
  const change = (kind, segments, a, b) => ({ kind, path: pathOf(segments), where: segments.join('.'), before: a, after: b })
  walk(before, after, [])
  return out
}

/**
 * Splits differences into the ones a documented rule covers and the rest. A rule is
 * `{ path, kind?, why }`: `path` is a generic path (`*` = one segment, `**` = anything).
 * Returns `{ allowed: [{ ...difference, why }], unexpected }`.
 */
export function applyRules(differences, rules) {
  const compiled = rules.map((r) => {
    if (!r.why) throw new Error(`Documented difference ${JSON.stringify(r.path)} has no \`why\`: say which change makes it expected.`)
    return { ...r, re: globToRegExp(r.path) }
  })
  const allowed = []
  const unexpected = []
  for (const d of differences) {
    const rule = compiled.find((r) => r.re.test(d.path) && (!r.kind || r.kind === d.kind))
    if (rule) allowed.push({ ...d, why: rule.why })
    else unexpected.push(d)
  }
  return { allowed, unexpected }
}

const short = (v) => {
  const s = v === undefined ? '(missing)' : JSON.stringify(v)
  return s.length > 90 ? `${s.slice(0, 87)}…` : s
}
export const formatDifference = (d) => `${d.kind.padEnd(7)} ${d.where}${d.kind === 'changed' ? `: ${short(d.before)} → ${short(d.after)}` : d.kind === 'added' ? ` = ${short(d.after)}` : ` (was ${short(d.before)})`}`

// ── saving through the admin ─────────────────────────────────────────────────────

/** The body the admin's form would send for `row`: the entity's own fields, media as ids. */
function formBody(entity, row, { translation }) {
  const body = {}
  for (const field of entity.fields) {
    if (translation && !field.localized) continue
    const value = field.type === 'media' && `${field.key}Id` in row ? row[`${field.key}Id`] : row[field.key]
    if (value !== undefined) body[field.key] = value
  }
  return body
}

/**
 * Opens every entry the snapshot recorded and saves it back unchanged (PATCH, or PUT for a
 * setting), in each language it has. Returns what it saved and the failures.
 */
export async function saveEverything(admin, snap) {
  const graph = expectStatus(await admin.get('/api/cms/_graph'), 'admin graph').body
  const saved = []
  const failures = []
  for (const e of graph) {
    for (const [id, byLocale] of Object.entries(snap.admin[e.name] ?? {})) {
      for (const [locale, recorded] of Object.entries(byLocale)) {
        const translation = locale !== 'default'
        const q = translation ? `?locale=${locale}` : ''
        const label = `${e.name}${e.singleton ? '' : ` ${id}`}${translation ? ` (${locale})` : ''}`
        // Open it again (as the editor does), then save what the form holds.
        const open = await admin.get(e.singleton ? `/api/cms/_singleton/${e.name}${q}` : `/api/cms/${e.name}/${id}${q}`)
        if (open.status !== 200) { failures.push(`${label}: could not open it (HTTP ${open.status})`); continue }
        const body = formBody(e, open.body.row ?? recorded, { translation })
        const res = e.singleton ? await admin.put(`/api/cms/_singleton/${e.name}${q}`, body) : await admin.patch(`/api/cms/${e.name}/${id}${q}`, body)
        if (res.status !== 200) failures.push(`${label}: saving it unchanged gave HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 400)}`)
        else saved.push(label)
      }
    }
  }
  return { saved, failures }
}

/** Media of `after` that must still be served, checked against what `before` recorded. */
export async function checkMedia(baseURL, before, after) {
  const anon = new Client(baseURL)
  const problems = []
  for (const [id, old] of Object.entries(before.media)) {
    if (old.status !== 200) continue // was not served before either
    const now = after.media[id]
    if (!now) { problems.push(`file ${id} (${old.url}) is no longer in the content`); continue }
    if (now.status !== 200 || now.sha256 !== old.sha256) problems.push(`file ${id}: ${now.url} answers ${now.status}${now.sha256 && now.sha256 !== old.sha256 ? ' with different bytes' : ''}`)
    // The old address stays in rich text and in links people kept: it has to keep working.
    if (old.url !== now.url) {
      const res = await fetchMedia(anon, old.url)
      if (res.status !== 200 || res.sha256 !== old.sha256) problems.push(`file ${id}: the old address ${old.url} now answers ${res.status}`)
    }
  }
  return problems
}

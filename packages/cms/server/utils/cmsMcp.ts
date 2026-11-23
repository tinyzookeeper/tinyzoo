import { McpServer, createMcpHandler } from '@modelcontextprotocol/server'
import type { CallToolResult, McpHttpHandler } from '@modelcontextprotocol/server'
import { propOf } from 'tinyzoo'
import type { CmsEntity } from 'tinyzoo'
import { z } from 'zod'

/**
 * The MCP server at `/api/mcp` (server/api/mcp.ts): the site's content for a program that speaks
 * MCP, with a personal access token (cmsAccessTokens.ts).
 *
 * Every tool goes through the admin's own routes, called inside this process as the token's user
 * (`x-tinyzoo-mcp`): the same validation, roles, field access, publishing rules, revisions, search
 * index, webhooks and audit log as a person in the admin. A tool only shapes what goes in and out:
 * names instead of ids where it helps, Markdown for rich text, compact JSON.
 */

const VERSION = '1'

const INSTRUCTIONS = `This is the content of a website made with tinyzoo: collections of entries (pages, posts…) and globals (site-wide settings), possibly in several languages, plus a media library.

Start with describe_site: it lists every collection and global you can reach with their fields, what this token may do, and the languages. Before writing to a collection, describe_collection gives the exact shape of its data.

- Entries are drafts until published (collections with publishing). create_entry and update_entry write drafts; publish_entry and unpublish_entry change what visitors see, if this token may publish.
- Globals, and collections without publishing, are live the moment they are saved: changing them needs the right to publish. describe_site's "can" tells you what you may do where.
- Rich-text fields may be given as Markdown strings; reads give them as Markdown when you ask (richText: "markdown").
- With several languages, the default language is the entry itself; pass locale to read or write a translation.
- update_entry changes only the fields you send. update_global does the same for a global.
- Everything you do is recorded under the token's person, as if they did it in the admin.
Results are compact JSON; fields without a value are left out.`

// ── calling the admin's routes ──────────────────────────────────────────────────

class RouteError extends Error {
  constructor(public status: number, message: string, public issues?: { path?: (string | number)[]; message?: string }[]) {
    super(message)
  }
}

async function call<T = any>(user: CmsUser, method: string, path: string, opts: { query?: Record<string, unknown>; body?: unknown } = {}): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  const url = path + (qs.size ? `?${qs}` : '')
  const res = await useNitroApp().localFetch(url, {
    method,
    headers: {
      [MCP_INTERNAL_HEADER]: mcpInternalValue(user.token!.id),
      'accept': 'application/json',
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null }
  catch { /* not JSON */ }
  if (!res.ok) {
    const issues = Array.isArray(data?.data) ? data.data : Array.isArray(data?.data?.issues) ? data.data.issues : undefined
    throw new RouteError(res.status, String(data?.statusMessage || data?.message || `HTTP ${res.status}`), issues)
  }
  return data as T
}

// ── results ─────────────────────────────────────────────────────────────────────

/** Leaves out null and undefined, recursively. */
function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compact)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) if (v !== null && v !== undefined) out[k] = compact(v)
    return out
  }
  return value
}

const ok = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(compact(data)) }] })
const fail = (message: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text: message }] })

async function run(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn()
  }
  catch (err: any) {
    if (err instanceof RouteError) {
      const issues = (err.issues ?? []).slice(0, 20).map((i) => `${(i.path ?? []).join('.') || 'data'}: ${i.message ?? 'invalid'}`)
      return fail(issues.length ? `${err.message}\n${issues.join('\n')}` : err.message)
    }
    return fail(String(err?.statusMessage || err?.message || 'Something went wrong'))
  }
}

// ── the site's shape ────────────────────────────────────────────────────────────

/** A label as text: the given string, or the English one, or the first. */
const text = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') {
    const o = v as Record<string, string>
    return o.en ?? Object.values(o)[0]
  }
  return undefined
}

function entity(name: string): CmsEntity {
  const e = useCms().reg.byName.get(name)
  if (!e) throw createError({ statusCode: 404, statusMessage: `No collection or global "${name}". describe_site lists them.` })
  return e
}

function collectionOf(name: string): CmsEntity {
  const e = entity(name)
  if (e.singleton) throw createError({ statusCode: 422, statusMessage: `"${name}" is a global: use get_global and update_global.` })
  return e
}

function globalOf(name: string): CmsEntity {
  const e = entity(name)
  if (!e.singleton) throw createError({ statusCode: 422, statusMessage: `"${name}" is a collection: use the entry tools.` })
  return e
}

/** One field in a few words for describe_site. */
function fieldSummary(e: CmsEntity, key: string, user: CmsUser, uneditable: Set<string>) {
  const f: any = e.fields[key]
  const rel = f.relation
  return {
    type: f.type,
    required: f.isRequired || undefined,
    localized: e.localized.includes(key) || undefined,
    options: Array.isArray(f.meta?.options) ? f.meta.options : undefined,
    to: rel ? rel.to().name : undefined,
    many: rel && rel.kind !== 'many-to-one' ? true : undefined,
    blocks: f.blocks ? Object.keys(f.blocks) : undefined,
    label: text(f.meta?.label),
    help: text(f.meta?.help),
    readOnly: uneditable.has(key) || undefined,
  }
}

function publishInfo(e: CmsEntity) {
  const p = e.publish
  if (!p) return undefined
  return { field: propOf(p.field, e.fields[p.field]!), published: p.publishedValue, draft: p.draftValue, perLanguage: p.perLocale || undefined, scheduledBy: p.dateField }
}

const statusProp = (e: CmsEntity) => (e.publish ? propOf(e.publish.field, e.fields[e.publish.field]!) : null)

// ── values in and out ───────────────────────────────────────────────────────────

/** Rich-text fields given as Markdown, as documents. */
function prepareData(e: CmsEntity, data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data }
  for (const [key, value] of Object.entries(out)) {
    if ((e.fields[key] as any)?.type === 'richtext' && typeof value === 'string') out[key] = markdownToDoc(value)
  }
  return out
}

/** A row from the admin's routes, without the form's helpers; rich text as Markdown when asked. */
function cleanRow(e: CmsEntity, row: Record<string, any> | null, richText: 'json' | 'markdown' = 'json') {
  if (!row) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === '__locales') out.languages = v
    else if (k === '__states') out.languageStates = v
    else if (k.startsWith('__') || k.endsWith('__label') || k.endsWith('__media')) continue
    else if (richText === 'markdown' && (e.fields[k] as any)?.type === 'richtext') out[k] = docToMarkdown(v)
    else out[k] = v
  }
  return out
}

/** The few columns a list shows of an entry. */
function entryLine(e: CmsEntity, row: Record<string, any>) {
  const status = statusProp(e)
  return {
    id: row.id,
    title: row[e.titleField],
    status: status ? row[status] : undefined,
    updatedAt: row.updatedAt,
    languages: row.__locales,
  }
}

// ── inputs ──────────────────────────────────────────────────────────────────────

const collection = z.string().min(1).max(100).describe('The collection\'s name, as describe_site lists it.')
const globalName = z.string().min(1).max(100).describe('The global\'s name, as describe_site lists it.')
const id = z.string().uuid().describe('The entry\'s id.')
const locale = z.string().min(2).max(20).optional().describe('A translation language (not the default one). Leave out for the default language.')
const richText = z.enum(['json', 'markdown']).optional().describe('Rich-text fields as the editor\'s JSON (default) or as Markdown.')
const data = z.record(z.string(), z.unknown()).describe('Field values by key, as describe_collection shows. Rich-text fields may be Markdown strings.')

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', pdf: 'application/pdf',
}

const READ = { readOnlyHint: true, openWorldHint: false } as const
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const

// ── the server ──────────────────────────────────────────────────────────────────

export function createCmsMcpServer(user: CmsUser): McpServer {
  const server = new McpServer({ name: 'tinyzoo', title: 'tinyzoo', version: VERSION }, { instructions: INSTRUCTIONS })
  const { reg } = useCms()
  const rights = user.token!.rights

  server.registerTool('describe_site', {
    title: 'Describe the site',
    description: 'The site\'s collections and globals that this token reaches, each with its fields (type, required, per language, options, related collection, read-only for you), how it publishes, and what you may do with it; the languages; and what this token may do. Start here.',
    inputSchema: z.object({}),
    annotations: READ,
  }, () => run(async () => {
    const role = roleOf(user)!
    const areas = []
    for (const g of reg.graph) {
      const e = reg.byName.get(g.name)
      if (!e || !accessWhere(e, 'read', user).allowed) continue
      const can = (['create', 'update', 'delete'] as const).filter((op) => !(e.singleton && op !== 'update') && accessWhere(e, op, user).allowed)
      const uneditable = uneditableFields(e, user)
      const hidden = unreadableFields(e, user)
      areas.push({
        name: e.name,
        kind: e.singleton ? 'global' : 'collection',
        label: text(e.label),
        description: text(e.description),
        titleField: e.singleton ? undefined : e.titleField,
        publish: publishInfo(e),
        pageTree: e.tree ? true : undefined,
        can: ['read', ...can],
        fields: Object.fromEntries(Object.keys(e.fields).filter((k) => !hidden.has(k)).map((k) => [k, fieldSummary(e, k, user, uneditable)])),
      })
    }
    return ok({
      site: cmsSettings().publicUrl || undefined,
      languages: reg.locales ? { default: reg.locales.default, all: reg.locales.locales } : undefined,
      you: { name: user.name, role: role.name, publish: role.publish, media: rights.media ? role.media : 'read' },
      token: { write: rights.write, publish: role.publish, delete: rights.delete, media: rights.media, only: rights.entities ?? undefined },
      areas,
    })
  }))

  server.registerTool('describe_collection', {
    title: 'Describe a collection',
    description: 'The exact shape of the data create_entry, update_entry or update_global take for one collection or global, as JSON Schema (update takes the same fields, all optional), with each field\'s label and help text.',
    inputSchema: z.object({ name: z.string().min(1).max(100).describe('A collection or global, as describe_site lists it.') }),
    annotations: READ,
  }, ({ name }) => run(async () => {
    const e = entity(name)
    if (!accessWhere(e, 'read', user).allowed) return fail(`This token cannot open "${name}".`)
    const hidden = unreadableFields(e, user)
    const uneditable = uneditableFields(e, user)
    const schema = z.toJSONSchema(writeSchema(e, 'create', null, uneditable) as any, { io: 'input', unrepresentable: 'any' }) as Record<string, any>
    delete schema.$schema
    return ok({
      name: e.name,
      kind: e.singleton ? 'global' : 'collection',
      publish: publishInfo(e),
      localized: e.localized.filter((k) => !hidden.has(k)),
      readOnly: [...uneditable].filter((k) => !hidden.has(k)),
      richText: Object.keys(e.fields).filter((k) => (e.fields[k] as any).type === 'richtext' && !hidden.has(k)),
      fields: Object.fromEntries(Object.keys(e.fields).filter((k) => !hidden.has(k)).map((k) => [k, { label: text((e.fields[k] as any).meta?.label), help: text((e.fields[k] as any).meta?.help) }])),
      schema,
    })
  }))

  server.registerTool('list_entries', {
    title: 'List entries',
    description: 'Entries of a collection, newest first: id, title, publishing status, last change and languages. Search by words (accents and small typos do not matter), filter by status or by a language that is missing a translation. fields: "all" gives every field.',
    inputSchema: z.object({
      collection,
      q: z.string().max(200).optional().describe('Words to search for in the title and searchable fields.'),
      status: z.enum(['published', 'scheduled', 'draft']).optional().describe('Only entries in this state (collections with publishing).'),
      missingTranslation: z.string().max(20).optional().describe('Only entries not yet translated into this language.'),
      sort: z.string().max(100).optional().describe('A field to sort by (default: createdAt).'),
      dir: z.enum(['asc', 'desc']).optional(),
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional().describe('Per page (default 20).'),
      fields: z.enum(['summary', 'all']).optional().describe('summary (default) or all fields.'),
    }),
    annotations: READ,
  }, (a) => run(async () => {
    const e = collectionOf(a.collection)
    const res = await call(user, 'GET', `/api/cms/${e.name}`, {
      query: { q: a.q, status: a.status, sort: a.sort, dir: a.dir, page: a.page, limit: a.limit, ...(a.missingTranslation ? { [`filter.lang:${a.missingTranslation}`]: 'missing' } : {}) },
    })
    return ok({
      total: res.total, page: res.page, limit: res.limit,
      entries: res.rows.map((r: any) => (a.fields === 'all' ? cleanRow(e, r) : entryLine(e, r))),
    })
  }))

  server.registerTool('get_entry', {
    title: 'Get an entry',
    description: 'One entry with all its fields you may read, its languages, and whether you may change it now (and if not, why: role, someone else\'s entry, or already live).',
    inputSchema: z.object({ collection, id, locale, richText }),
    annotations: READ,
  }, (a) => run(async () => {
    const e = collectionOf(a.collection)
    const res = await call(user, 'GET', `/api/cms/${e.name}/${a.id}`, { query: { locale: a.locale } })
    return ok({ entry: cleanRow(e, res.row, a.richText), can: res.can })
  }))

  server.registerTool('get_global', {
    title: 'Get a global',
    description: 'A global (site-wide settings, such as the footer or contact details) with all its fields you may read.',
    inputSchema: z.object({ name: globalName, locale, richText }),
    annotations: READ,
  }, (a) => run(async () => {
    const e = globalOf(a.name)
    const res = await call(user, 'GET', `/api/cms/_singleton/${e.name}`, { query: { locale: a.locale } })
    return ok({ global: cleanRow(e, res.row, a.richText), can: res.can })
  }))

  server.registerTool('search', {
    title: 'Search',
    description: 'Search every collection you may read, drafts included, in every language: the best few matches per collection with an excerpt.',
    inputSchema: z.object({
      q: z.string().min(1).max(200).describe('What to look for.'),
      limit: z.number().int().min(1).max(20).optional().describe('Matches per collection (default 5).'),
    }),
    annotations: READ,
  }, (a) => run(async () => {
    const res = await call(user, 'GET', '/api/cms/_search', { query: { q: a.q, limit: a.limit } })
    return ok({ results: res.items.map((i: any) => ({ collection: i.entity, id: i.id, title: i.title, status: i.status, excerpt: i.excerpt, updatedAt: i.updatedAt })) })
  }))

  server.registerTool('list_media', {
    title: 'List files',
    description: 'Files in the media library, newest first: id, name, type, size, dimensions, description (alt) and address. A media field takes the file\'s id.',
    inputSchema: z.object({
      q: z.string().max(100).optional().describe('Words in the name or description.'),
      accept: z.string().max(100).optional().describe('Only these types, e.g. image/*.'),
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(60).optional().describe('Per page (default 24).'),
    }),
    annotations: READ,
  }, (a) => run(async () => {
    const res = await call(user, 'GET', '/api/cms/_media', { query: a })
    return ok({
      total: res.total, page: res.page,
      files: res.items.map((m: any) => ({ id: m.id, name: m.name, mime: m.mime, size: m.size, width: m.width, height: m.height, alt: m.alt, folder: m.folder, url: m.url, createdAt: m.createdAt })),
    })
  }))

  // ── writes: the token's rights and the person's role decide, in the routes ──

  const readOnly = () => (rights.write ? null : fail('This access token only reads. Make one that may edit on your account page in the admin.'))

  server.registerTool('create_entry', {
    title: 'Create an entry',
    description: 'Add an entry to a collection, as a draft (for collections with publishing). Only the default language; add translations with update_entry and locale. publish: true publishes it straight away, if this token may publish.',
    inputSchema: z.object({ collection, data, publish: z.boolean().optional().describe('Publish it at once (needs the right to publish).') }),
    annotations: WRITE,
  }, (a) => run(async () => {
    const denied = readOnly()
    if (denied) return denied
    const e = collectionOf(a.collection)
    const body = prepareData(e, a.data)
    const status = statusProp(e)
    if (status && e.publish) body[status] = a.publish ? e.publish.publishedValue : (body[status] ?? e.publish.draftValue)
    const res = await call(user, 'POST', `/api/cms/${e.name}`, { body })
    return ok({ created: entryLine(e, res.row) })
  }))

  server.registerTool('update_entry', {
    title: 'Change an entry',
    description: 'Change some fields of an entry; the others stay. With locale, write that translation. An entry that is live can be changed only with the right to publish (the change goes straight to the website).',
    inputSchema: z.object({ collection, id, data, locale }),
    annotations: { ...WRITE, idempotentHint: true },
  }, (a) => run(async () => {
    const denied = readOnly()
    if (denied) return denied
    const e = collectionOf(a.collection)
    const res = await call(user, 'PATCH', `/api/cms/${e.name}/${a.id}`, { query: { locale: a.locale }, body: prepareData(e, a.data) })
    return ok({ updated: entryLine(e, res.row ?? { id: a.id }) })
  }))

  const setStatus = (published: boolean) => (a: { collection: string; id: string; locale?: string }) => run(async () => {
    const denied = readOnly()
    if (denied) return denied
    const e = collectionOf(a.collection)
    const status = statusProp(e)
    if (!status || !e.publish) return fail(`"${e.name}" has no publishing: its entries are live as they are saved.`)
    const res = await call(user, 'PATCH', `/api/cms/${e.name}/${a.id}`, { query: { locale: a.locale }, body: { [status]: published ? e.publish.publishedValue : e.publish.draftValue } })
    return ok({ [published ? 'published' : 'unpublished']: entryLine(e, res.row ?? { id: a.id }), locale: a.locale })
  })

  server.registerTool('publish_entry', {
    title: 'Publish an entry',
    description: 'Put an entry on the website (or, with locale, that translation, for collections that publish per language). Needs the right to publish.',
    inputSchema: z.object({ collection, id, locale }),
    annotations: { ...WRITE, idempotentHint: true, openWorldHint: true },
  }, setStatus(true))

  server.registerTool('unpublish_entry', {
    title: 'Unpublish an entry',
    description: 'Take an entry off the website; it stays as a draft. With locale, only that translation. Needs the right to publish.',
    inputSchema: z.object({ collection, id, locale }),
    annotations: { ...WRITE, idempotentHint: true, openWorldHint: true },
  }, setStatus(false))

  server.registerTool('delete_entry', {
    title: 'Delete an entry',
    description: 'Delete an entry for good (its earlier versions go with it). Refused while other content still uses it. With locale, remove only that translation. Needs the right to delete.',
    inputSchema: z.object({ collection, id, locale }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, (a) => run(async () => {
    const denied = readOnly()
    if (denied) return denied
    const e = collectionOf(a.collection)
    await call(user, 'DELETE', `/api/cms/${e.name}/${a.id}`, { query: { locale: a.locale } })
    return ok({ deleted: { collection: e.name, id: a.id, locale: a.locale } })
  }))

  server.registerTool('update_global', {
    title: 'Change a global',
    description: 'Change some fields of a global; the others stay. With locale, write that translation.',
    inputSchema: z.object({ name: globalName, data, locale }),
    annotations: { ...WRITE, idempotentHint: true },
  }, (a) => run(async () => {
    const denied = readOnly()
    if (denied) return denied
    const e = globalOf(a.name)
    let body = prepareData(e, a.data)
    // A save replaces the whole global (the admin sends the whole form): keep what is not sent.
    if (!a.locale) {
      const current = await call(user, 'GET', `/api/cms/_singleton/${e.name}`)
      if (current.row) {
        const keys = Object.keys(((writeSchema(e, 'create') as any).shape ?? {}) as object)
        const keep = uneditableFields(e, user)
        const now: Record<string, unknown> = {}
        for (const k of keys) if (!keep.has(k) && k in current.row) now[k] = current.row[k]
        body = { ...now, ...body }
      }
    }
    const res = await call(user, 'PUT', `/api/cms/_singleton/${e.name}`, { query: { locale: a.locale }, body })
    return ok({ updated: e.name, global: cleanRow(e, res.row) })
  }))

  server.registerTool('upload_media', {
    title: 'Upload a file',
    description: 'Add a file to the media library (images, PDF, video, audio), given as base64. Answers with its id for a media field. Needs the right to change files.',
    inputSchema: z.object({
      filename: z.string().min(1).max(200).describe('The file\'s name, e.g. team-photo.jpg.'),
      mime: z.string().max(100).optional().describe('Its type (image/jpeg…); by default from the name.'),
      base64: z.string().min(1).describe('The file\'s content, base64.'),
      alt: z.string().max(1000).optional().describe('What the picture shows, for people who cannot see it.'),
      folder: z.string().max(100).optional().describe('A library folder to put it in.'),
    }),
    annotations: WRITE,
  }, (a) => run(async () => {
    const denied = readOnly()
    if (denied) return denied
    assertTokenMedia(user)
    const bytes = Buffer.from(a.base64, 'base64')
    if (!bytes.length) return fail('The file is empty, or not base64.')
    const ext = /\.([a-z0-9]+)$/i.exec(a.filename)?.[1]?.toLowerCase() ?? ''
    const type = a.mime ?? MIME_BY_EXTENSION[ext]
    if (!type) return fail(`Cannot tell the type of "${a.filename}": give mime, or a name ending in ${Object.keys(MIME_BY_EXTENSION).join(', ')}.`)
    const form = new FormData()
    form.append('file', new Blob([bytes], { type }), a.filename)
    // A file put there on purpose: it stays in the library even while no entry uses it.
    form.append('library', '1')
    if (a.folder) form.append('folder', a.folder)
    // The request inside this process takes bytes: the multipart body, encoded here.
    const encoded = new Response(form)
    const res = await useNitroApp().localFetch('/api/cms/_media', {
      method: 'POST',
      headers: { [MCP_INTERNAL_HEADER]: mcpInternalValue(user.token!.id), 'accept': 'application/json', 'content-type': encoded.headers.get('content-type')! },
      body: Buffer.from(await encoded.arrayBuffer()),
    })
    const out: any = await res.json().catch(() => null)
    if (!res.ok) throw new RouteError(res.status, String(out?.statusMessage || `HTTP ${res.status}`), out?.data)
    let m = out
    // The description is set after the upload, as in the admin.
    if (a.alt) m = { ...m, ...(await call(user, 'PATCH', `/api/cms/_media/${m.id}`, { body: { alt: a.alt } })) }
    return ok({ uploaded: { id: m.id, name: m.name, mime: m.mime, size: m.size, width: m.width, height: m.height, alt: m.alt, url: m.url } })
  }))

  server.registerTool('update_media', {
    title: 'Change a file\'s details',
    description: 'Change a file\'s description (alt, and per language altLocales) or its folder. Needs the right to change files.',
    inputSchema: z.object({
      id: z.string().uuid().describe('The file\'s id.'),
      alt: z.string().max(1000).optional(),
      altLocales: z.record(z.string(), z.string().max(1000)).optional().describe('The description in other languages: { en: "…" }.'),
      folder: z.string().max(100).nullable().optional(),
    }),
    annotations: { ...WRITE, idempotentHint: true },
  }, ({ id: fileId, ...rest }) => run(async () => {
    const denied = readOnly()
    if (denied) return denied
    const res = await call(user, 'PATCH', `/api/cms/_media/${fileId}`, { body: rest })
    return ok({ updated: { id: fileId, alt: res?.alt, folder: res?.folder } })
  }))

  server.registerTool('delete_media', {
    title: 'Delete a file',
    description: 'Delete a file from the media library for good. Refused while content still uses it. Needs the rights to change files and to delete.',
    inputSchema: z.object({ id: z.string().uuid().describe('The file\'s id.') }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, ({ id: fileId }) => run(async () => {
    const denied = readOnly()
    if (denied) return denied
    await call(user, 'DELETE', `/api/cms/_media/${fileId}`)
    return ok({ deleted: { id: fileId } })
  }))

  return server
}

// ── serving ─────────────────────────────────────────────────────────────────────

// Per site: it is made with the site's upload limit (maxRequestBodySize); a fresh server is built for every request.
const handler = siteScoped<McpHttpHandler | undefined>(() => undefined)

/** The one handler for every request: a fresh server per request, for the token's user (passed as authInfo). */
export function cmsMcpHandler(): McpHttpHandler {
  if (!handler()) handler.set(createMcpHandler(({ authInfo }) => createCmsMcpServer((authInfo?.extra as any)?.user as CmsUser), {
    responseMode: 'json',
    // Room for a file sent as base64 to upload_media.
    maxRequestBodySize: Math.ceil(maxUploadBytes() * 1.4) + 256 * 1024,
    onerror: (err) => console.error('[cms] mcp', scrubError(err)),
  }))
  return handler()!
}

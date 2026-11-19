// An OpenAPI 3.1 document (the one buildOpenApiDocument writes from a config) → one page of
// Markdown: every collection's operations, parameters, fields and an example response.
// build.ts renders it like any other page of docs/, so the worked example of the content API
// on the website is made from the generator's own output and cannot drift from it.
//
// Pure: a document in, a string out (test/unit/docs-openapi.spec.ts).

type Schema = Record<string, any>
export interface OpenApiDocument {
  openapi: string
  info?: { title?: string; version?: string }
  paths: Record<string, Record<string, Operation>>
  components?: { schemas?: Record<string, Schema> }
}
interface Operation {
  operationId: string
  tags?: string[]
  summary?: string
  description?: string
  parameters?: Parameter[]
  responses: Record<string, { description?: string; content?: Record<string, { schema: Schema }> }>
}
interface Parameter { name: string; in: 'query' | 'path'; required?: boolean; description?: string; schema: Schema }

export interface OpenApiPageOptions {
  /** Where the document lives in the repository, for the page's closing note (a path from the repository root). */
  sourceFile: string
  /** Names of the example collections' Markdown links (relative to the page); the page is docs/generated/api-example.md. */
  guide: { content: string; reference: string }
}

// ── schemas ────────────────────────────────────────────────────────────────────────────

const refName = (s: Schema): string | null => (typeof s.$ref === 'string' ? s.$ref.replace('#/components/schemas/', '') : null)

/** `null` in a type, or a `null` branch of an anyOf: the value may be JSON null. */
function split(schema: Schema): { schema: Schema; nullable: boolean } {
  if (Array.isArray(schema.anyOf)) {
    const rest = schema.anyOf.filter((s: Schema) => s.type !== 'null')
    if (rest.length === 1 && rest.length !== schema.anyOf.length) return { schema: rest[0], nullable: true }
  }
  if (Array.isArray(schema.type) && schema.type.includes('null')) {
    const type = schema.type.filter((t: string) => t !== 'null')
    const { enum: values, ...others } = schema
    return { schema: { ...others, type: type.length === 1 ? type[0] : type, ...(values ? { enum: values.filter((v: unknown) => v !== null) } : {}) }, nullable: true }
  }
  return { schema, nullable: false }
}

/** A schema in a few words, as it reads in a table: `string`, `"draft" | "published"`, `Author[]`, `date-time string`. */
export function typeText(input: Schema, doc?: OpenApiDocument): string {
  const { schema } = split(input)
  const ref = refName(schema)
  if (ref) return ref.endsWith('Embedded') ? `${ref.slice(0, -'Embedded'.length)} (nested)` : ref.endsWith('Ref') ? `${ref.slice(0, -'Ref'.length)} ({ id, title })` : ref
  if (schema.const !== undefined) return JSON.stringify(schema.const)
  if (Array.isArray(schema.enum)) return schema.enum.map((v: unknown) => JSON.stringify(v)).join(' | ')
  if (Array.isArray(schema.oneOf)) return schema.oneOf.map((s: Schema) => typeText(s, doc)).join(' | ')
  if (Array.isArray(schema.anyOf)) return schema.anyOf.map((s: Schema) => typeText(s, doc)).join(' | ')
  if (schema.type === 'array') return `${wrap(typeText(schema.items ?? {}, doc))}[]`
  if (schema.type === 'object') {
    const inline = schema.properties ? `{ ${Object.entries<Schema>(schema.properties).map(([k, v]) => `${k}: ${typeText(v, doc)}`).join(', ')} }` : ''
    return inline && inline.length <= 56 ? inline : 'object'
  }
  if (schema.type === 'string' && schema.format) return `${schema.format} string`
  if (schema.type === 'integer' || schema.type === 'number' || schema.type === 'boolean' || schema.type === 'string') return schema.type
  return 'any'
}
const wrap = (t: string) => (t.includes(' | ') ? `(${t})` : t)

function constraints(input: Schema): string {
  const { schema } = split(input)
  const out: string[] = []
  if (typeof schema.minimum === 'number') out.push(`min ${schema.minimum}`)
  if (typeof schema.maximum === 'number') out.push(`max ${schema.maximum}`)
  if (typeof schema.maxLength === 'number') out.push(`max ${schema.maxLength} characters`)
  if (schema.pattern) out.push(`pattern \`${schema.pattern}\``)
  if (schema.default !== undefined) out.push(`default \`${JSON.stringify(schema.default)}\``)
  return out.join(', ')
}

// ── an example value for a schema ──────────────────────────────────────────────────────

const UUIDS = [
  '8f2a6c1e-4b7d-4e19-9a53-0c6d2f81b7a4', '3d9e5b70-1c2a-48f6-b0e7-5a4c9d13e862', 'c41b8e92-7f05-4d3a-a6c8-12e9b05f7d3c',
  '5e0a7d34-9b18-4c6f-8d21-f3a6b94c0e57', 'a7c3f185-2e64-4b90-93d7-6b1e08a4c2f9',
]
const WORDS: Record<string, string> = {
  title: 'Hello, world', slug: 'hello-world', bio: 'Writes about analytical engines.', email: 'ada@example.com',
  url: 'https://example.com', alt: 'A bunch of tulips on a table', caption: 'Spring at the market', city: 'Brno', street: 'Joštova 10',
  label: 'Contact', status: 'published', excerpt: 'The first post.', metaTitle: 'Hello, world — Example', metaDescription: 'A short description for search engines.',
}
const DAY = '2026-03-14T09:30:00.000Z'
/** Sample texts that suit one schema (a page's title is not a post's). */
const OWNER_WORDS: Record<string, Record<string, string>> = {
  Page: { title: 'About us', slug: 'about-us', metaTitle: 'About us — Example' },
  Tag: { name: 'Tutorials', slug: 'tutorials' },
}
const INTEGERS: Record<string, number> = { width: 1600, height: 1066, x: 50, y: 40, limit: 20, page: 1, total: 1, position: 1 }

export interface ExampleContext {
  schemas: Record<string, Schema>
  /** The key being filled (names a sample text), and a counter for ids. */
  key?: string
  /** The schema being filled (names a sample text). */
  owner?: string
  uuid: { n: number }
  depth?: number
}

export function example(input: Schema, ctx: ExampleContext): unknown {
  const { schema } = split(input)
  const depth = ctx.depth ?? 0
  const ref = refName(schema)
  if (ref) {
    if (ref === 'RichTextDoc') {
      return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The text, one paragraph.' }] }] }
    }
    if (ref === 'RichTextNode') return { type: 'paragraph' }
    if (ref === 'CmsMedia') return media(ctx, false)
    if (ref === 'CmsGalleryItem') return media(ctx, true)
    if (ref === 'CmsTreeNode') return { id: uuid(ctx), title: 'About us', path: '/o-nas', children: depth > 0 ? [] : [{ id: uuid(ctx), title: 'The team', path: '/o-nas/tym', children: [] }] }
    const target = ctx.schemas[ref]
    return target ? example(target, { ...ctx, owner: ref.replace(/(Embedded|Ref)$/, ''), depth: depth + 1 }) : null
  }
  if (schema.const !== undefined) return schema.const
  if (Array.isArray(schema.enum)) return ctx.key === 'entity' && schema.enum.includes('post') ? 'post' : schema.enum.includes('published') ? 'published' : (schema.enum.find((v: unknown) => v !== null) ?? null)
  if (Array.isArray(schema.oneOf)) return example(schema.oneOf[0], ctx)
  if (Array.isArray(schema.anyOf)) return example(schema.anyOf.find((s: Schema) => s.type !== 'null') ?? {}, ctx)
  switch (schema.type) {
    case 'object': {
      const props: Schema = schema.properties ?? {}
      // `paths`: the item's address in each language.
      if (ctx.key === 'paths' && !schema.properties) return { cs: '/blog/ahoj-svete', en: '/en/blog/hello-world' }
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(props)) out[k] = example(v as Schema, { ...ctx, key: k, depth })
      return out
    }
    case 'array': {
      const k = ctx.key ?? ''
      // `locales`: the languages the item exists in.
      if (k === 'locales' && Array.isArray(schema.items?.enum)) return schema.items.enum.slice(0, 2)
      // A [start, end) range, as in the search's highlights.
      if (schema.items?.type === 'array' && schema.items.items?.type === 'integer') return [[0, 5]]
      if (schema.type === 'array' && schema.items?.type === 'integer' && schema.minItems === 2) return [0, 5]
      return [example(schema.items ?? {}, { ...ctx, depth })]
    }
    case 'integer': return INTEGERS[ctx.key ?? ''] ?? (typeof schema.minimum === 'number' && schema.minimum > 1 ? schema.minimum : 1)
    case 'number': return 1
    case 'boolean': return true
    case 'string': {
      if (schema.format === 'uuid') return uuid(ctx)
      if (schema.format === 'date-time') return DAY
      if (schema.format === 'uri') return 'https://cms.example.com/media/tulips.jpg'
      const k = ctx.key ?? ''
      if (k === 'locale') return 'en'
      if (k === 'path') return '/blog/hello-world'
      if (k === 'mime') return 'image/jpeg'
      if (k === 'query') return 'hello'
      if (k === 'entity') return 'post'
      if (k === 'parent') return null
      const own = OWNER_WORDS[ctx.owner ?? '']?.[k]
      if (own) return own
      if (k === 'id') return 'b7e4a1'
      if (k === 'name') return ctx.owner === 'Author' ? 'Ada Lovelace' : `Example ${(ctx.owner ?? 'name').replace(/([A-Z])/g, ' $1').trim().toLowerCase()}`
      if (k === 'slug' && ctx.owner && ctx.owner !== 'Post') return `example-${ctx.owner.toLowerCase()}`
      return WORDS[k] ?? (k ? `Example ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}` : 'text')
    }
  }
  return null
}
const uuid = (ctx: ExampleContext) => UUIDS[ctx.uuid.n++ % UUIDS.length]!
function media(ctx: ExampleContext, caption: boolean) {
  return {
    id: uuid(ctx), url: 'https://cms.example.com/media/tulips.jpg', width: 1600, height: 1066, alt: WORDS.alt, mime: 'image/jpeg',
    focal: { x: 50, y: 40 }, ...(caption ? { caption: WORDS.caption } : {}),
  }
}

// ── Markdown ───────────────────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const code = (s: string) => `\`${s.replace(/`/g, '').replace(/\|/g, '\\|')}\``
const json = (value: unknown) => `\`\`\`json\n${compact(value)}\n\`\`\`\n`

/** JSON, indented, with small objects and lists kept on one line: an example reads, it does not scroll. */
function inline(value: unknown): string {
  if (Array.isArray(value)) return value.length ? `[${value.map(inline).join(', ')}]` : '[]'
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    return entries.length ? `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(', ')} }` : '{}'
  }
  return JSON.stringify(value) ?? 'null'
}
function compact(value: unknown, indent = ''): string {
  const one = inline(value)
  if (one.length + indent.length <= 78 || typeof value !== 'object' || value === null) return one
  const inner = `${indent}  `
  if (Array.isArray(value)) return `[\n${value.map((v) => inner + compact(v, inner)).join(',\n')}\n${indent}]`
  return `{\n${Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${compact(v, inner)}`).join(',\n')}\n${indent}}`
}
const table = (head: string[], rows: string[][]) => `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`
/** Descriptions in the document are Markdown-ish already (backticks); keep them, minus line breaks and pipes. */
const prose = (s: string | undefined) => esc((s ?? '').trim())

function paramRow(p: Parameter, doc: OpenApiDocument): string[] {
  const { schema } = split(p.schema)
  const notes = [p.required ? 'Required' : '', constraints(p.schema)].filter(Boolean)
  const what = Array.isArray(schema.enum) && schema.enum.length > 5
    ? `${schema.enum.length} values: ${schema.enum.slice(0, 5).map((v: string) => code(v)).join(', ')}, …`
    : ''
  const type = what ? 'string' : typeText(p.schema, doc)
  return [code(p.name), p.in, code(type) ?? '', esc([prose(p.description), what, notes.join('. ') && `${notes.join('. ').replace(/^./, (c) => c.toUpperCase())}.`].filter(Boolean).join(' ') || '—')]
}

/** Query filters (a field's own name or `<field>.from`/`.to`) are many; they are listed once, not row by row. */
const BASE_QUERY = new Set(['page', 'limit', 'sort', 'dir', 'q', 'locale'])

function paramsTable(op: Operation, doc: OpenApiDocument): string {
  const params = op.parameters ?? []
  if (!params.length) return ''
  const isList = op.operationId.startsWith('list')
  const main = params.filter((p) => !isList || p.in === 'path' || BASE_QUERY.has(p.name))
  const filters = isList ? params.filter((p) => p.in === 'query' && !BASE_QUERY.has(p.name)) : []
  let out = table(['Parameter', 'In', 'Type', 'What it does'], main.map((p) => paramRow(p, doc)))
  if (filters.length) {
    const exact = filters.filter((p) => !/\.(from|to)$/.test(p.name))
    const ranges = filters.filter((p) => /\.(from|to)$/.test(p.name))
    out += `\nFilters, each one a query parameter named after the field. Exact match: ${exact.map((p) => code(p.name)).join(', ') || 'none'}.`
    if (ranges.length) out += ` Date ranges: ${ranges.map((p) => code(p.name)).join(', ')}.`
    out += '\n'
  }
  return out
}

function responsesTable(op: Operation): string {
  const rows = Object.entries(op.responses).map(([status, r]) => [code(status), esc(r.description ?? '')])
  return table(['Status', 'Meaning'], rows)
}

function fieldsTable(name: string, schema: Schema, doc: OpenApiDocument): string {
  const required = new Set<string>(schema.required ?? [])
  const rows = Object.entries<Schema>(schema.properties ?? {}).map(([key, s]) => {
    const { schema: inner, nullable } = split(s)
    const notes = [nullable ? 'may be `null`' : '', constraints(s), inner.description ? prose(inner.description) : '', required.has(key) ? '' : 'optional'].filter(Boolean)
    const type = typeText(s, doc)
    return [code(key), code(type.length > 60 ? `${type.slice(0, 57)}…` : type), notes.join('. ') || '—']
  })
  return `${table(['Field', 'Type', 'Notes'], rows)}`
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const pascal = (s: string) => s.replace(/(^|[_-])([a-z0-9])/gi, (_, __, c: string) => c.toUpperCase())

export function openApiPage(doc: OpenApiDocument, opts: OpenApiPageOptions): string {
  const schemas = doc.components?.schemas ?? {}
  const ex = (s: Schema) => example(s, { schemas, uuid: { n: 0 } })
  const ops = (path: string) => doc.paths[path]?.get
  const collections = Object.keys(doc.paths).filter((p) => /^\/api\/content\/[^/_][^/]*$/.test(p)).map((p) => p.split('/').pop()!)
  const trees = Object.keys(doc.paths).filter((p) => p.startsWith('/api/content/_tree/')).map((p) => p.split('/').pop()!)
  const globals = Object.keys(doc.paths).filter((p) => p.startsWith('/api/content/_global/')).map((p) => p.split('/').pop()!)
  const search = ops('/api/content/_search')
  const out: string[] = []

  out.push('# Example: the API of one site\n')
  out.push(
    `A worked example of the content API: every route, parameter and response of a site with ${collections.length} public collections `
    + `(${collections.join(', ')}), ${globals.length} globals (${globals.join(', ')}) and a website search. `
    + `This page is generated from an OpenAPI document when the website is built, so it is exactly what \`tinyzoo openapi\` writes for that site. `
    + `What every site shares (routes, preview, caching, errors) is in [the content API reference](${opts.guide.reference}).\n`,
  )

  out.push('## A site gets its own\n')
  out.push('The collections, fields and filters below belong to this example site. Yours come from your `cms.config.ts`, and you get the same reference for them in four ways:\n')
  out.push([
    '- **`/api/openapi.json`** on your site: the OpenAPI 3.1 document, always on (behind the content token when you set one).',
    '- **`/api/openapi`**: the same document as an interactive reference (Scalar), in development, or in production with `cms.content.docs: true`.',
    '- **`tinyzoo openapi`**: writes the document to a file (`openapi.json`), for a code generator or a CI step. Without a running site.',
    '- **The typed client**: `tinyzoo client` writes `cms-content.ts` with the types of every collection below, and `@tinyzoo/client` fetches them ([the typed client](' + opts.guide.content + '#typed-clients--openapi)).',
    '',
  ].join('\n'))

  // At a glance
  const glance: string[][] = []
  for (const [path, item] of Object.entries(doc.paths)) {
    const op = item.get
    if (op) glance.push(['`GET`', code(path), esc(op.summary ?? '')])
  }
  out.push('## Every route\n')
  out.push(table(['Method', 'Path', 'What it returns'], glance))

  out.push('## Shapes every collection shares\n')
  out.push('Every item has an `id`, `createdAt` and `updatedAt`; a collection that is translated adds `locale`, `locales` and, when its items have addresses, `paths`. Files and rich text look the same everywhere:\n')
  if (schemas.CmsMedia) out.push(`### A file\n\n${table(['Field', 'Type', 'Notes'], rowsOf(schemas.CmsMedia, doc))}\n${json(ex({ $ref: '#/components/schemas/CmsMedia' }))}`)
  if (schemas.CmsGalleryItem) out.push('A gallery is a list of files, each with a `caption` (`string`, or `null`). A relation to another public collection arrives as the nested item (written `Author (nested)` below) with its plain fields only: no relations, files, galleries, groups, lists or blocks of its own. One to a collection that is not public arrives as `{ id, title }`.\n')
  if (schemas.RichTextDoc) out.push(`### Rich text\n\nStored as a ProseMirror document: render it with \`<CmsContent :doc="item.body" />\` and never as HTML. A node has a \`type\`, and optionally \`text\`, \`content\`, \`marks\` and \`attrs\`.\n\n${json(ex({ $ref: '#/components/schemas/RichTextDoc' }))}`)
  const listOne = collections[0]
  if (listOne) {
    const List = schemas[`${pascal(listOne)}List`]
    if (List) out.push(`### A list\n\nEvery list answers with its items, the total number of matches, and the page asked for:\n\n${json({ ...(ex(List) as Record<string, unknown>), items: ['…'] })}`)
  }

  for (const name of collections) {
    const Name = pascal(name)
    const list = ops(`/api/content/${name}`)
    const one = ops(`/api/content/${name}/{slug}`)
    const item = schemas[Name]
    out.push(`## ${cap(name)}\n`)
    if (item) out.push(`\`${name}\` is a public collection; \`${Name}\` is the shape of one item.\n`)
    if (list) {
      out.push(`### List ${name} items\n`)
      out.push(`${code(`GET /api/content/${name}`)}${list.description ? `. ${list.description}` : ''}\n`)
      out.push(paramsTable(list, doc))
      out.push(`\n${responsesTable(list)}`)
      const listSchema = schemas[`${Name}List`]
      if (listSchema) out.push(`\nExample response, \`/api/content/${name}?limit=1${list.parameters?.some((p) => p.name === 'locale') ? '&locale=en' : ''}\`:\n\n${json(ex(listSchema) && limited(ex(listSchema) as Record<string, unknown>))}`)
    }
    if (one) {
      out.push(`### Get one ${name}\n`)
      out.push(`${code(`GET /api/content/${name}/{slug}`)}. ${one.summary ? cap(one.summary) : ''}.${one.description ? ` ${one.description}` : ''}\n`)
      out.push(paramsTable(one, doc))
      out.push(`\n${responsesTable(one)}`)
      if (item) out.push(`\nThe answer is \`{ "item": { … } }\`, the item shaped exactly as in the list above.\n`)
    }
    if (item) out.push(`### The ${name} fields\n\n${fieldsTable(Name, item, doc)}`)
    for (const tree of trees.filter((t) => t === name)) {
      const op = ops(`/api/content/_tree/${tree}`)!
      out.push(`### The ${name} tree\n`)
      out.push(`${code(`GET /api/content/_tree/${tree}`)}. ${op.description ?? ''}\n`)
      out.push(paramsTable(op, doc))
      const node = schemas.CmsTreeNode
      if (node) out.push(`\n${json({ items: [ex({ $ref: '#/components/schemas/CmsTreeNode' })] })}`)
    }
  }

  if (globals.length) {
    out.push('## Globals\n')
    out.push('A global is one object a site has once (its settings, its navigation). `item` is `null` until someone first saves it.\n')
    for (const name of globals) {
      const op = ops(`/api/content/_global/${name}`)!
      const Name = pascal(name)
      out.push(`### The ${name} global\n`)
      out.push(`${code(`GET /api/content/_global/${name}`)}\n`)
      out.push(paramsTable(op, doc))
      if (schemas[Name]) out.push(`\n${fieldsTable(Name, schemas[Name]!, doc)}\nExample response:\n\n${json({ item: ex(schemas[Name]!) })}`)
    }
  }

  if (search) {
    out.push('## Search\n')
    out.push(`${code('GET /api/content/_search')}. ${search.description ?? ''}\n`)
    out.push(paramsTable(search, doc))
    out.push(`\n${responsesTable(search)}`)
    const item = schemas.CmsSearchItem
    if (item) {
      out.push(`\n${fieldsTable('CmsSearchItem', item, doc)}`)
      out.push(`\nExample response, \`/api/content/_search?q=hello\`:\n\n${json({ query: 'hello', items: [ex(item)], total: 1 })}`)
    }
  }

  out.push('## Where this comes from\n')
  out.push(`The document is [\`${opts.sourceFile}\`](../../${opts.sourceFile}), which the tests keep equal to what \`buildOpenApiDocument\` writes for the playground's \`cms.config.ts\`. The website's build turns it into this page.\n`)
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

/** One item is enough in an example list; the totals stay as they are. */
function limited(list: Record<string, unknown>) {
  return { ...list, items: Array.isArray(list.items) ? list.items.slice(0, 1) : list.items, total: 1, page: 1, limit: 1 }
}

function rowsOf(schema: Schema, doc: OpenApiDocument): string[][] {
  const required = new Set<string>(schema.required ?? [])
  return Object.entries<Schema>(schema.properties ?? {}).map(([key, s]) => {
    const { nullable } = split(s)
    return [code(key), code(typeText(s, doc)), [nullable ? 'may be `null`' : '', constraints(s), required.has(key) ? '' : 'optional'].filter(Boolean).join('. ') || '—']
  })
}

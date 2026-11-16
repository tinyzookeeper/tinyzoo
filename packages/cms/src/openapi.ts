import { buildContentModel, type ContentField, type ContentFieldType, type ContentShape } from './content-shape'

// Emit an OpenAPI 3.1 document describing the PUBLIC content API, generated from
// cms.config.ts. Every public collection gets concrete `/api/content/<name>` and
// `/<name>/{slug}` paths (concrete, not templated — far better codegen DX), and the
// response schemas mirror the actual projected shapes (see content-shape.ts).

export interface OpenApiOptions {
  title?: string
  version?: string
  description?: string
  servers?: { url: string; description?: string }[]
  /** When true, declare + require the content API token security scheme. */
  tokenAuth?: boolean
}

type JsonSchema = Record<string, any>

const REF = (name: string): JsonSchema => ({ $ref: `#/components/schemas/${name}` })

const MEDIA_PROPERTIES: JsonSchema = {
  id: { type: 'string', format: 'uuid' },
  url: { type: 'string', format: 'uri' },
  width: { type: ['integer', 'null'] },
  height: { type: ['integer', 'null'] },
  alt: { type: ['string', 'null'] },
  mime: { type: 'string' },
  focal: {
    type: ['object', 'null'],
    additionalProperties: false,
    properties: { x: { type: 'integer', minimum: 0, maximum: 100 }, y: { type: 'integer', minimum: 0, maximum: 100 } },
    required: ['x', 'y'],
  },
}
const MEDIA_REQUIRED = ['id', 'url', 'width', 'height', 'alt', 'mime', 'focal']

/** Wrap a schema so the value may also be JSON `null` (OpenAPI 3.1 style). */
function nullable(schema: JsonSchema, isNullable: boolean): JsonSchema {
  if (!isNullable) return schema
  if (schema.$ref) return { anyOf: [schema, { type: 'null' }] }
  const t = schema.type
  if (typeof t === 'string') {
    const out: JsonSchema = { ...schema, type: [t, 'null'] }
    // A nullable enum must list null, else strict 2020-12 validators reject null.
    if (Array.isArray(out.enum) && !out.enum.includes(null)) out.enum = [...out.enum, null]
    return out
  }
  return { anyOf: [schema, { type: 'null' }] }
}

function scalarSchema(t: Extract<ContentFieldType, { kind: 'scalar' }>): JsonSchema {
  switch (t.scalar) {
    case 'integer': return { type: 'integer' }
    case 'number': return { type: 'number' }
    case 'boolean': return { type: 'boolean' }
    case 'datetime': return { type: 'string', format: 'date-time' }
    case 'string': {
      const s: JsonSchema = { type: 'string' }
      if (t.enumValues) s.enum = [...t.enumValues]
      if (t.pattern) s.pattern = t.pattern
      return s
    }
  }
}

/** Map a projected field's value-type to a JSON Schema (relations → $refs). */
function fieldSchema(t: ContentFieldType): JsonSchema {
  switch (t.kind) {
    case 'scalar': return scalarSchema(t)
    case 'richtext': return REF('RichTextDoc')
    case 'media': return REF('CmsMedia')
    case 'gallery': return { type: 'array', items: REF('CmsGalleryItem') }
    case 'relation-one': return REF(t.public ? `${pascalRef(t.target)}Embedded` : `${pascalRef(t.target)}Ref`)
    case 'relation-many': return { type: 'array', items: REF(t.public ? `${pascalRef(t.target)}Embedded` : `${pascalRef(t.target)}Ref`) }
    case 'blocks': {
      const variants = t.blocks.map((b) => {
        const properties: JsonSchema = { id: { type: 'string' }, type: { type: 'string', const: b.type } }
        for (const f of b.fields) properties[f.key] = nullable(fieldSchema(f.type), f.nullable)
        return { type: 'object', properties, required: ['id', 'type', ...b.fields.map((f) => f.key)], additionalProperties: false }
      })
      return { type: 'array', items: variants.length === 1 ? variants[0] : { oneOf: variants, discriminator: { propertyName: 'type' } } }
    }
    case 'group': {
      const properties: JsonSchema = {}
      for (const f of t.fields) properties[f.key] = nullable(fieldSchema(f.type), f.nullable)
      return { type: 'object', properties, required: t.fields.map((f) => f.key), additionalProperties: false }
    }
  }
}

// content-shape already pascal-cases; we only have the entity name on relation
// targets, so re-derive here with the same rule (snake/kebab → Pascal).
function pascalRef(name: string): string {
  return name.replace(/(^|[_-])([a-z0-9])/g, (_, __, c) => c.toUpperCase())
}

/** An object schema for a list of projected fields, with id + optional timestamps. */
function objectSchema(fields: ContentField[], opts: { timestamps: boolean; locales?: string[] | null; paths?: boolean; tree?: boolean }): JsonSchema {
  const properties: JsonSchema = { id: { type: 'string', format: 'uuid' } }
  const required = ['id']
  for (const f of fields) {
    properties[f.key] = nullable(fieldSchema(f.type), f.nullable)
    required.push(f.key)
  }
  if (opts.timestamps) {
    properties.createdAt = { type: 'string', format: 'date-time' }
    properties.updatedAt = { type: 'string', format: 'date-time' }
    required.push('createdAt', 'updatedAt')
  }
  if (opts.locales) {
    properties.locale = { type: 'string', enum: [...opts.locales], description: 'The language this item is served in.' }
    properties.locales = { type: 'array', items: { type: 'string', enum: [...opts.locales] }, description: 'Languages this item exists in.' }
    required.push('locale', 'locales')
    if (opts.paths) {
      properties.paths = { type: 'object', additionalProperties: { type: 'string' }, description: "The item's address in each language it exists in." }
      required.push('paths')
    }
  }
  if (opts.tree) {
    properties.path = { type: ['string', 'null'], description: "The page's address in the language served: its ancestors' address parts and its own (/o-nas/tym), language prefix included." }
    properties.breadcrumbs = {
      type: 'array',
      description: 'From the top of the tree down to this page (the page itself last): title and address of each, in the language served. Only live pages.',
      items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, path: { type: 'string' } }, required: ['title', 'path'] },
    }
    required.push('path', 'breadcrumbs')
  }
  return { type: 'object', additionalProperties: false, properties, required }
}

function localeParam(shape: ContentShape): JsonSchema[] {
  if (!shape.locales) return []
  return [{
    name: 'locale', in: 'query',
    description: 'Language to serve. Untranslated fields fall back to the default language.',
    schema: { type: 'string', enum: [...shape.locales], default: shape.locales[0] },
  }]
}

function listParams(shape: ContentShape): JsonSchema[] {
  const params: JsonSchema[] = [
    { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
    { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
    { name: 'sort', in: 'query', schema: { type: 'string', enum: shape.sortKeys, default: 'createdAt' } },
    { name: 'dir', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
    { name: 'q', in: 'query', description: `Substring match against \`${shape.titleField}\`.`, schema: { type: 'string' } },
    ...localeParam(shape),
  ]
  for (const filter of shape.filters) {
    if (filter.value === 'datetime') {
      const from = filter.key.endsWith('.from')
      params.push({
        name: filter.key,
        in: 'query',
        description: from ? 'Only items on or after this date or time (ISO 8601).' : 'Only items on or before this date or time (ISO 8601; a bare date includes the whole day).',
        schema: { type: 'string' },
      })
      continue
    }
    params.push({
      name: filter.key,
      in: 'query',
      description: 'Exact-match filter.',
      schema: filter.value === 'boolean' ? { type: 'boolean' } : filter.enumValues ? { type: 'string', enum: [...filter.enumValues] } : { type: 'string' },
    })
  }
  return params
}

export function buildOpenApiDocument(config: Record<string, any>, opts: OpenApiOptions = {}): JsonSchema {
  const model = buildContentModel(config)
  const tokenAuth = !!opts.tokenAuth

  const schemas: JsonSchema = {
    RichTextNode: {
      type: 'object',
      description: 'A ProseMirror/TipTap node. Render with a structured renderer — never raw HTML.',
      properties: {
        type: { type: 'string' },
        text: { type: 'string' },
        content: { type: 'array', items: REF('RichTextNode') },
        marks: { type: 'array', items: { type: 'object', additionalProperties: true } },
        attrs: { type: 'object', additionalProperties: true },
      },
      required: ['type'],
      additionalProperties: true,
    },
    RichTextDoc: {
      type: 'object',
      properties: { type: { type: 'string', const: 'doc' }, content: { type: 'array', items: REF('RichTextNode') } },
      required: ['type'],
      additionalProperties: true,
    },
    CmsMedia: { type: 'object', additionalProperties: false, properties: MEDIA_PROPERTIES, required: MEDIA_REQUIRED },
    // Spelled out (not allOf CmsMedia): CmsMedia forbids extra properties, so an allOf
    // with it would reject every item for carrying `caption`.
    CmsGalleryItem: {
      type: 'object',
      additionalProperties: false,
      properties: { ...MEDIA_PROPERTIES, caption: { type: ['string', 'null'] } },
      required: [...MEDIA_REQUIRED, 'caption'],
    },
  }

  // Embedded (nested public) + ref (nested non-public) target schemas.
  for (const emb of model.embedded) schemas[`${emb.pascal}Embedded`] = objectSchema(emb.fields, { timestamps: false })
  for (const ref of model.refs) {
    schemas[`${ref.pascal}Ref`] = {
      type: 'object',
      additionalProperties: false,
      // The title key is ALWAYS present (publicProjection sets it); only its value
      // may be null — so it stays `required`, the schema just allows null.
      properties: { id: { type: 'string', format: 'uuid' }, [ref.titleField]: nullable(fieldSchema(ref.titleType), ref.titleNullable) },
      required: ['id', ref.titleField],
    }
  }

  // Top-level item + list-wrapper schemas, plus paths.
  const paths: JsonSchema = {}
  const tag = (name: string) => name
  for (const shape of model.entities) {
    schemas[shape.pascal] = objectSchema(shape.fields, { timestamps: true, locales: shape.locales, paths: shape.paths, tree: shape.tree })
    schemas[`${shape.pascal}List`] = {
      type: 'object',
      additionalProperties: false,
      properties: {
        items: { type: 'array', items: REF(shape.pascal) },
        total: { type: 'integer' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
      },
      required: ['items', 'total', 'page', 'limit'],
    }

    const lookupBy = shape.slugField ? `\`${shape.slugField}\` (falling back to id)` : 'id'
    paths[`/api/content/${shape.name}`] = {
      get: {
        operationId: `list${shape.pascal}`,
        tags: [tag(shape.name)],
        summary: `List ${shape.name} items`,
        description: shape.gated ? 'Returns only published items.' : undefined,
        parameters: listParams(shape),
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: REF(`${shape.pascal}List`) } } },
          ...(tokenAuth ? { 401: { description: 'Missing or invalid API token' } } : {}),
        },
      },
    }
    paths[`/api/content/${shape.name}/{slug}`] = {
      get: {
        operationId: `get${shape.pascal}`,
        tags: [tag(shape.name)],
        summary: `Get one ${shape.name} by ${shape.tree ? 'its address (the chain of address parts, o-nas/tym) or id' : lookupBy}`,
        description: shape.tree ? 'The key is the chain of address parts from the top of the tree down, as one path segment with the slashes escaped (`o-nas%2Ftym`), looked up in the language asked for and then in the default one. A page under an unpublished page is not found.' : undefined,
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }, ...localeParam(shape)],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', additionalProperties: false, properties: { item: REF(shape.pascal) }, required: ['item'] } } } },
          404: { description: 'Not found or not published' },
          ...(tokenAuth ? { 401: { description: 'Missing or invalid API token' } } : {}),
        },
      },
    }
  }

  const treeNodes = model.entities.filter((s) => s.tree)
  if (treeNodes.length) {
    schemas.CmsTreeNode = {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        path: { type: ['string', 'null'] },
        children: { type: 'array', items: REF('CmsTreeNode') },
      },
      required: ['id', 'title', 'path', 'children'],
    }
  }
  for (const shape of treeNodes) {
    paths[`/api/content/_tree/${shape.name}`] = {
      get: {
        operationId: `tree${shape.pascal}`,
        tags: [shape.name],
        summary: `The ${shape.name} tree, for navigation`,
        description: 'Live pages only, top level first, each level in the order editors arranged it. A page under an unpublished page is left out with everything below it.',
        parameters: localeParam(shape),
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', additionalProperties: false, properties: { items: { type: 'array', items: REF('CmsTreeNode') } }, required: ['items'] } } } },
          ...(tokenAuth ? { 401: { description: 'Missing or invalid API token' } } : {}),
        },
      },
    }
  }

  for (const g of model.globals) {
    schemas[g.pascal] = objectSchema(g.fields, { timestamps: true, locales: g.locales })
    paths[`/api/content/_global/${g.name}`] = {
      get: {
        operationId: `getGlobal${g.pascal}`,
        tags: ['globals'],
        summary: `Get the ${g.name} global`,
        parameters: localeParam(g),
        responses: {
          200: { description: 'OK (item is null until it is first saved)', content: { 'application/json': { schema: { type: 'object', additionalProperties: false, properties: { item: { anyOf: [REF(g.pascal), { type: 'null' }] } }, required: ['item'] } } } },
          ...(tokenAuth ? { 401: { description: 'Missing or invalid API token' } } : {}),
        },
      },
    }
  }

  // The website search, when some collection lives at an address.
  if (model.search.collections.length) {
    const ranges = { type: 'array', items: { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 2 }, description: '[start, end) character ranges of the words found' }
    schemas.CmsSearchItem = {
      type: 'object',
      additionalProperties: false,
      properties: {
        entity: { type: 'string', enum: model.search.collections },
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        titleHighlights: ranges,
        excerpt: { type: 'string', description: 'Text around the first word found; empty when only the title matched' },
        highlights: ranges,
        path: { type: ['string', 'null'], description: 'The entry\'s address on the website, in the searched language' },
        locale: { type: ['string', 'null'] },
        updatedAt: { type: 'string', format: 'date-time' },
      },
      required: ['entity', 'id', 'title', 'titleHighlights', 'excerpt', 'highlights', 'path', 'locale', 'updatedAt'],
    }
    paths['/api/content/_search'] = {
      get: {
        operationId: 'search',
        tags: ['search'],
        summary: 'Search the website',
        description: `Published entries of ${model.search.collections.join(', ')}, best matches first. Every word must appear (in any order, accents and case ignored); fewer than two letters return nothing.`,
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', maxLength: 100 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
          { name: 'entity', in: 'query', description: 'Only these collections (comma-separated)', schema: { type: 'string' } },
          ...(model.search.locales ? [{ name: 'locale', in: 'query', description: 'Language to search in: only entries translated into it.', schema: { type: 'string', enum: model.search.locales } }] : []),
        ],
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'object', additionalProperties: false, properties: { query: { type: 'string' }, items: { type: 'array', items: REF('CmsSearchItem') }, total: { type: 'integer' } }, required: ['query', 'items', 'total'] } } },
          },
          429: { description: 'Too many searches from this visitor' },
          ...(tokenAuth ? { 401: { description: 'Missing or invalid API token' } } : {}),
        },
      },
    }
  }

  const doc: JsonSchema = {
    openapi: '3.1.0',
    info: {
      title: opts.title ?? 'Content API',
      version: opts.version ?? '1.0.0',
      description: opts.description ?? 'Public, read-only content delivery API generated from cms.config.ts.',
    },
    servers: opts.servers ?? [{ url: '/' }],
    paths,
    components: {
      schemas,
      ...(tokenAuth
        ? {
            securitySchemes: {
              ApiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
              BearerToken: { type: 'http', scheme: 'bearer' },
            },
          }
        : {}),
    },
    ...(tokenAuth ? { security: [{ ApiKey: [] }, { BearerToken: [] }] } : {}),
  }
  return doc
}

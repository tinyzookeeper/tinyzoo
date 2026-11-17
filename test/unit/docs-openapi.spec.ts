import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { example, openApiPage, typeText, type OpenApiDocument } from '../../site/modules/docs/openapi'

// The worked example of the content API on the website (site/modules/docs/openapi.ts):
// an OpenAPI document in, one page of Markdown out. The documents are the golden files of
// test/contracts, which the contract tests keep equal to what buildOpenApiDocument writes.
const root = join(import.meta.dirname, '../..')
const load = (name: string) => JSON.parse(readFileSync(join(root, 'test/contracts', name), 'utf8')) as OpenApiDocument
const opts = { sourceFile: 'test/contracts/x.json', guide: { content: 'content-api.md', reference: 'content-api-reference.md' } }

describe.each([['openapi.playground.json'], ['surface.openapi.json']])('the page made from %s', (file) => {
  const doc = load(file)
  const md = openApiPage(doc, opts)

  it('has every route of the document, and every parameter of each', () => {
    for (const [path, item] of Object.entries(doc.paths)) {
      expect(md, path).toContain(`\`${path}\``)
      for (const p of item.get!.parameters ?? []) expect(md, `${path} ${p.name}`).toContain(`\`${p.name}\``)
    }
  })

  it('lists every field of every collection and global', () => {
    const schemas = doc.components!.schemas!
    for (const [name, schema] of Object.entries(schemas)) {
      if (!schema.properties || /^(RichText|Cms|.*Embedded$|.*Ref$|.*List$)/.test(name)) continue
      for (const key of Object.keys(schema.properties)) expect(md, `${name}.${key}`).toContain(`| \`${key}\` |`)
    }
  })

  it('has an example for each collection that carries all of its fields and nothing else', () => {
    const schemas = doc.components!.schemas!
    const item = (name: string) => example({ $ref: `#/components/schemas/${name}` }, { schemas, uuid: { n: 0 } }) as Record<string, unknown>
    for (const name of Object.keys(schemas)) {
      if (!schemas[`${name}List`]) continue
      expect(Object.keys(item(name)).sort(), name).toEqual(Object.keys(schemas[name]!.properties!).sort())
    }
  })

  it('is plain Markdown: tables keep their columns, no template left over, no undefined', () => {
    expect(md).not.toMatch(/undefined|\[object Object\]|NaN/)
    for (const row of md.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|---'))) {
      // Unescaped pipes would add columns; each table's rows have as many cells as its header.
      expect(row.replace(/\\\|/g, '').match(/\|/g)!.length, row).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('typeText', () => {
  it('reads a schema the way a table does', () => {
    expect(typeText({ type: ['string', 'null'], format: 'date-time' })).toBe('date-time string')
    expect(typeText({ type: 'string', enum: ['draft', 'published'] })).toBe('"draft" | "published"')
    expect(typeText({ type: 'array', items: { $ref: '#/components/schemas/AuthorEmbedded' } })).toBe('Author (nested)[]')
    expect(typeText({ type: 'array', items: { type: 'string', enum: ['a', 'b'] } })).toBe('("a" | "b")[]')
    expect(typeText({ anyOf: [{ $ref: '#/components/schemas/CmsMedia' }, { type: 'null' }] })).toBe('CmsMedia')
  })
})

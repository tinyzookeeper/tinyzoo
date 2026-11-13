import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildOpenApiDocument, emitContentTypes, emitSchema } from '@my-cms/core'
import * as config from '../../playground/cms.config'

const playground = join(import.meta.dirname, '../../playground')
const read = (p: string) => readFileSync(join(playground, p), 'utf8')

// The generated artifacts are committed. If one of these fails, either the
// generator changed (regenerate: `pnpm db:generate`, `pnpm --filter playground
// cms:client`) or it drifted from what the config says.
describe('generated artifacts are in sync with cms.config.ts', () => {
  it('db schema (server/db/schema.ts)', () => {
    expect(emitSchema(config)).toBe(read('server/db/schema.ts'))
  })

  it('typed content client (app/lib/cms-content.ts)', () => {
    expect(emitContentTypes(config)).toBe(read('app/lib/cms-content.ts'))
  })
})

describe('OpenAPI document', () => {
  const doc: any = buildOpenApiDocument(config, { title: 'Content API' })

  it('is OpenAPI 3.1 with a path per public collection, and globals on their own route', () => {
    expect(doc.openapi).toMatch(/^3\.1\./)
    const paths = Object.keys(doc.paths)
    expect(paths).toEqual(expect.arrayContaining([
      '/api/content/post', '/api/content/post/{slug}',
      '/api/content/author', '/api/content/tag',
      '/api/content/_global/siteSettings',
    ]))
    expect(paths).not.toContain('/api/content/siteSettings')
    expect(doc.components.schemas.SiteSettings.properties).toHaveProperty('siteName')
  })

  it('documents a gallery item as a whole object (an allOf with a closed schema would reject it)', () => {
    const item = doc.components.schemas.CmsGalleryItem
    expect(item.allOf).toBeUndefined()
    expect(item.additionalProperties).toBe(false)
    expect(item.required).toEqual(expect.arrayContaining(['id', 'url', 'alt', 'focal', 'caption']))
  })

  it('never documents a hidden field', () => {
    expect(JSON.stringify(doc.components.schemas.Author)).not.toContain('email')
  })

  it('does not reflect anything request-specific into servers', () => {
    expect(doc.servers).toEqual([{ url: '/' }])
  })
})

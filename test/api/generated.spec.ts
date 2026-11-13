import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { anonymous } from '../helpers/api'

describe('generated endpoints', () => {
  it('serves the OpenAPI document', async () => {
    const res = await anonymous().get('/api/openapi.json')
    expect(res.status).toBe(200)
    expect(Object.keys(res.body.paths)).toContain('/api/content/post')
  })

  // What a frontend curls must be what is committed (and what `cms client` emits).
  it('serves typed bindings identical to the committed ones', async () => {
    const res = await anonymous().get('/api/content-types.ts')
    expect(res.status).toBe(200)
    expect(res.body).toBe(readFileSync(join(import.meta.dirname, '../../playground/app/lib/cms-content.ts'), 'utf8'))
  })

  it('serves the API reference page', async () => {
    const res = await fetch(`${(anonymous()).baseURL}/api/openapi`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })
})

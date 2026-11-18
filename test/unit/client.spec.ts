import { describe, expect, it, vi } from 'vitest'
import { CmsError, createCmsClient } from '@tinyzoo/client'
import { defineEntity, f } from 'tinyzoo'

function client(response: { status?: number; body?: unknown } = {}) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(response.body ?? { items: [], total: 0, page: 1, limit: 20 }), { status: response.status ?? 200, headers: { 'content-type': 'application/json' } }))
  const cms = createCmsClient<{ post: { item: any; sort: 'title'; filters: { status?: string } } }>({ baseUrl: 'https://cms.example.com', token: 'tok', fetch: fetch as any })
  return { cms, fetch }
}

describe('@tinyzoo/client', () => {
  it('adds root members only with a "$" in front after 1.0, so no collection is ever hidden', () => {
    // A collection is `client.<name>`. Entity names start with a letter, so a "$" member can never
    // take a collection's place. These four are 1.0's; a collection named like one is reached
    // with `client.collection('<name>')`.
    const V1 = ['collection', 'global', 'openapi', 'search']
    const members = Object.keys(client().cms)
    expect(members).toEqual(expect.arrayContaining(V1))
    expect(members.filter((m) => !V1.includes(m) && !m.startsWith('$'))).toEqual([])
    expect(() => defineEntity('$x', { label: 'X', titleField: 'title', fields: { title: f.text() } })).toThrow(/Invalid entity name/)
  })

  it('builds list URLs with paging, sort and flattened filters, and sends the token', async () => {
    const { cms, fetch } = client()
    await cms.post.list({ page: 2, limit: 5, sort: 'title', dir: 'asc', q: 'hi', filter: { status: 'published' } })
    const [url, init] = fetch.mock.calls[0]!
    const u = new URL(url)
    expect(u.pathname).toBe('/api/content/post')
    expect(Object.fromEntries(u.searchParams)).toEqual({ page: '2', limit: '5', sort: 'title', dir: 'asc', q: 'hi', status: 'published' })
    expect(new Headers(init?.headers).get('x-api-key')).toBe('tok')
  })

  it('encodes the slug and unwraps the item', async () => {
    const { cms, fetch } = client({ body: { item: { id: '1' } } })
    expect(await cms.post.get('a/b c')).toEqual({ id: '1' })
    expect(fetch.mock.calls[0]![0]).toBe('https://cms.example.com/api/content/post/a%2Fb%20c')
  })

  it('fetches a global in a language, and sends dates in filters as ISO', async () => {
    const { cms, fetch } = client({ body: { item: { id: 'g' } } })
    expect(await cms.global('siteSettings', { locale: 'en' })).toEqual({ id: 'g' })
    expect(fetch.mock.calls[0]![0]).toBe('https://cms.example.com/api/content/_global/siteSettings?locale=en')
    await cms.post.list({ filter: { 'publishedAt.from': new Date('2026-01-01T00:00:00Z') } as any })
    expect(new URL(fetch.mock.calls[1]![0]).searchParams.get('publishedAt.from')).toBe('2026-01-01T00:00:00.000Z')
  })

  it('throws CmsError with the status on a non-2xx', async () => {
    const { cms } = client({ status: 404, body: { statusMessage: 'Not found' } })
    await expect(cms.post.get('missing')).rejects.toBeInstanceOf(CmsError)
    await expect(cms.post.get('missing')).rejects.toMatchObject({ status: 404 })
  })

  // Regression: the access proxy used `prop in target`, so prototype keys
  // (toString, constructor) and `then` (await-ability) resolved to collections.
  it('does not turn prototype keys or `then` into collections', () => {
    const { cms } = client()
    expect((cms as any).then).toBeUndefined()
    expect(typeof (cms as any).toString).toBe('function')
    expect((cms as any).constructor).toBe(Object)
  })
})

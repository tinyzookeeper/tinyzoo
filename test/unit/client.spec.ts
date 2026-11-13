import { describe, expect, it, vi } from 'vitest'
import { CmsError, createCmsClient } from '@my-cms/client'

function client(response: { status?: number; body?: unknown } = {}) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(response.body ?? { items: [], total: 0, page: 1, limit: 20 }), { status: response.status ?? 200, headers: { 'content-type': 'application/json' } }))
  const cms = createCmsClient<{ post: { item: any; sort: 'title'; filters: { status?: string } } }>({ baseUrl: 'https://cms.example.com', token: 'tok', fetch: fetch as any })
  return { cms, fetch }
}

describe('@my-cms/client', () => {
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

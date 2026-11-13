// @my-cms/client — a tiny, dependency-free, strictly-typed client for the public
// content API. It carries ZERO knowledge of any specific CMS: all types come from
// a generated `ContentSchema` (see `cms client`), so the runtime is stable across
// schema changes and the same build serves every CMS instance.
//
//   import { createClient } from './cms-content'   // generated
//   const cms = createClient({ baseUrl: 'https://cms.example.com' })
//   const { items } = await cms.post.list({ filter: { status: 'published' }, sort: 'publishedAt' })
//   const post = await cms.post.get('hello-world')

export interface ClientOptions {
  /** Origin of the CMS, e.g. 'https://cms.example.com'. May be '' for same-origin (browser only). */
  baseUrl: string
  /** Content API token (sent as `x-api-key`) when the API is gated. */
  token?: string
  /** Extra headers merged into every request. */
  headers?: Record<string, string>
  /** Fetch implementation override (defaults to global `fetch`). */
  fetch?: typeof globalThis.fetch
}

export interface ListResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface ListParams<Sort extends string = string, Filters = Record<string, never>> {
  page?: number
  limit?: number
  sort?: Sort
  dir?: 'asc' | 'desc'
  /** Substring search against the collection's title field. */
  q?: string
  /** Exact-match filters (collection-specific). */
  filter?: Filters
  /** Language to serve (collections with translations). Untranslated fields fall back to the default. */
  locale?: string
}

export interface GetOptions {
  /** Language to serve (collections with translations). */
  locale?: string
}

export interface CollectionSpec {
  item: unknown
  sort?: string
  // `object` (not Record<string, unknown>) so a generated `interface XFilters`
  // still satisfies it — interfaces don't satisfy index-signature constraints.
  filters?: object
}
export type AnyContentSchema = Record<string, CollectionSpec>

export interface Collection<C extends CollectionSpec> {
  /** List published items, paginated, filtered and sorted. */
  list: (params?: ListParams<Extract<C['sort'], string>, C['filters']>) => Promise<ListResponse<C['item']>>
  /** Fetch a single published item by slug (falling back to id). Throws CmsError on 404. */
  get: (slugOrId: string, options?: GetOptions) => Promise<C['item']>
}

export type CmsClient<S extends AnyContentSchema> =
  & { readonly [K in keyof S]: Collection<S[K]> }
  & {
    /** Same as `client[name]`, but accepts a runtime collection name. */
    collection: <K extends keyof S & string>(name: K) => Collection<S[K]>
    /** Fetch the OpenAPI 3.1 document for this CMS. */
    openapi: () => Promise<unknown>
  }

/** Thrown for any non-2xx content API response. */
export class CmsError extends Error {
  readonly status: number
  readonly statusText: string
  readonly url: string
  readonly body: unknown
  constructor(message: string, status: number, statusText: string, url: string, body: unknown) {
    super(message)
    this.name = 'CmsError'
    this.status = status
    this.statusText = statusText
    this.url = url
    this.body = body
  }
}

function buildQuery(query?: Record<string, unknown>): string {
  if (!query) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export function createCmsClient<S extends AnyContentSchema>(options: ClientOptions): CmsClient<S> {
  const base = options.baseUrl.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  if (typeof doFetch !== 'function') {
    throw new Error('@my-cms/client: no fetch available — pass options.fetch')
  }

  async function request<T>(path: string, query?: Record<string, unknown>): Promise<T> {
    const target = base + path + buildQuery(query)
    const headers: Record<string, string> = { accept: 'application/json', ...(options.headers ?? {}) }
    if (options.token) headers['x-api-key'] = options.token

    const res = await doFetch(target, { headers })
    if (!res.ok) {
      let body: unknown
      try { body = await res.clone().json() }
      catch { try { body = await res.text() } catch { /* ignore */ } }
      throw new CmsError(`Content API ${res.status} ${res.statusText} for ${path}`, res.status, res.statusText, target, body)
    }
    return res.json() as Promise<T>
  }

  function collection(name: string): Collection<CollectionSpec> {
    const seg = encodeURIComponent(name)
    const list = (params: ListParams = {}) => {
      const { filter, ...rest } = params
      // reserved params (rest) spread LAST so a filter key can never clobber page/limit/sort/dir/q
      return request(`/api/content/${seg}`, { ...((filter as Record<string, unknown>) ?? {}), ...rest })
    }
    const get = async (slugOrId: string, opts: GetOptions = {}) => {
      const res = await request<{ item: unknown }>(`/api/content/${seg}/${encodeURIComponent(slugOrId)}`, { locale: opts.locale })
      return res.item
    }
    return { list, get } as unknown as Collection<CollectionSpec>
  }

  const root = {
    collection,
    openapi: () => request('/api/openapi.json'),
  }

  // Access-only proxy: the runtime is schema-agnostic, so collections are resolved
  // lazily on property access and are NOT enumerable (`Object.keys`/`in` won't list
  // them). `then` is trapped so the client is never mistaken for a thenable, and
  // Object.prototype members keep their normal meaning (so a collection named e.g.
  // `toString` is reachable only via `client.collection('toString')`).
  return new Proxy(root, {
    get(target, prop, receiver) {
      if (typeof prop !== 'string' || prop === 'then' || prop in Object.prototype || Object.hasOwn(target, prop)) {
        return Reflect.get(target, prop, receiver)
      }
      return collection(prop)
    },
  }) as unknown as CmsClient<S>
}

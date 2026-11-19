import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Where a redirect sends a visitor: the target, with the query of the address they asked for
// carried over. A target with a #anchor got the query after the anchor (`/merch#shop?utm=x`), so
// the browser saw it as part of the anchor and the page never got the query.

// Loaded by path: the file belongs to the server (Nitro auto-imports its neighbours).
const { redirectDestination } = await import(/* @vite-ignore */ join(import.meta.dirname, '../../packages/cms/server/utils/cmsRedirects.ts'))

describe('redirectDestination(target, requested)', () => {
  it('puts the query before the target\'s #anchor', () => {
    expect(redirectDestination('/merch#shop', '/old?utm_source=x&b=2')).toBe('/merch?utm_source=x&b=2#shop')
    expect(redirectDestination('https://shop.example.com/#top', '/old?a=1')).toBe('https://shop.example.com/?a=1#top')
  })

  it('carries the query over to a target without one', () => {
    expect(redirectDestination('/merch', '/old?a=1')).toBe('/merch?a=1')
    expect(redirectDestination('/merch', '/old')).toBe('/merch')
    expect(redirectDestination('/merch#shop', '/old')).toBe('/merch#shop')
  })

  it('keeps a target that has a query of its own as it is', () => {
    expect(redirectDestination('/merch?tab=2#shop', '/old?a=1')).toBe('/merch?tab=2#shop')
    expect(redirectDestination('/merch?tab=2', '/old?a=1')).toBe('/merch?tab=2')
  })

  it('ignores an empty query and a fragment in the request', () => {
    expect(redirectDestination('/merch#shop', '/old?')).toBe('/merch#shop')
    expect(redirectDestination('/merch', '/old?a=1#x')).toBe('/merch?a=1')
  })
})

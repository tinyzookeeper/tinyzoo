import { describe, expect, it } from 'vitest'
import {
  oauthClientName, oauthPublicCorsPath, oauthRedirectRefusal, oauthRedirectRegistered, oauthRequestedScope, oauthResourceMatches,
} from '../../packages/cms/server/utils/cmsOAuthRules'

// The refusals of the MCP server's OAuth sign-in (cmsOAuthRules.ts): each one easy to write
// approximately and dangerous to get approximately right.
describe('oauth rules', () => {
  it('sends codes only to https, loopback http, or an app scheme, never with a fragment', () => {
    expect(oauthRedirectRefusal('https://claude.ai/api/mcp/auth_callback')).toBeNull()
    expect(oauthRedirectRefusal('http://127.0.0.1:6274/callback')).toBeNull()
    expect(oauthRedirectRefusal('http://[::1]:8080/cb')).toBeNull()
    expect(oauthRedirectRefusal('cursor://anysphere/cb')).toBeNull()
    expect(oauthRedirectRefusal('http://example.com/cb')).toBe('insecure-http')
    expect(oauthRedirectRefusal('https://example.com/cb#frag')).toBe('has-fragment')
    expect(oauthRedirectRefusal('javascript:alert(1)')).toBe('forbidden-scheme')
    expect(oauthRedirectRefusal('not a url')).toBe('malformed')
  })

  it('matches a redirect exactly (a trailing slash aside), never by origin or prefix', () => {
    const registered = ['https://claude.ai/api/mcp/auth_callback']
    expect(oauthRedirectRegistered(registered, 'https://claude.ai/api/mcp/auth_callback/')).toBe(true)
    expect(oauthRedirectRegistered(registered, 'https://claude.ai/anything')).toBe(false)
    expect(oauthRedirectRegistered(registered, 'https://claude.ai.evil.example/api/mcp/auth_callback')).toBe(false)
  })

  it('reads the scope as a ceiling: nothing asked is everything, unknown scopes are ignored', () => {
    expect(oauthRequestedScope(undefined)).toBe('write')
    expect(oauthRequestedScope('openid mcp:read')).toBe('read')
    expect(oauthRequestedScope('mcp:read mcp:write')).toBe('write')
  })

  it('binds a token to this resource only; absent is fine', () => {
    const own = 'https://example.com/api/mcp'
    expect(oauthResourceMatches(undefined, own)).toBe(true)
    expect(oauthResourceMatches('https://example.com/api/mcp/', own)).toBe(true)
    expect(oauthResourceMatches('https://example.com/api/other', own)).toBe(false)
    expect(oauthResourceMatches('https://evil.example/api/mcp', own)).toBe(false)
  })

  it('names an unnamed client honestly, and opens CORS only where no cookie is read', () => {
    expect(oauthClientName('  ')).toBe('An MCP client')
    expect(oauthClientName('Claude')).toBe('Claude')
    expect(oauthPublicCorsPath('/api/mcp')).toBe(true)
    expect(oauthPublicCorsPath('/.well-known/oauth-authorization-server')).toBe(true)
    expect(oauthPublicCorsPath('/api/cms/_auth/oauth/x')).toBe(false)
  })
})

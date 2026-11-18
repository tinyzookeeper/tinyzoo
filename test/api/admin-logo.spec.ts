import { describe, expect, it } from 'vitest'
import { anonymous } from '../helpers/api'

// The admin's theme with the default logo settings (the playground sets a name, no logos):
// what GET /api/cms/_theme hands the admin, and what the sign-in page draws from it.

describe('GET /api/cms/_theme (no logos)', () => {
  it('answers anyone, with no logos, the signature on and no developer notes', async () => {
    const res = await anonymous().get('/api/cms/_theme')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expect(res.body).toMatchObject({
      version: 1,
      name: { en: 'Demo Blog', cs: 'Demo blog', de: 'Demo-Blog' },
      logo: { full: null, mark: null, fullDark: null, markDark: null, fullDarkPlate: false, markDarkPlate: false },
      signature: true,
      notes: [],
    })
  })
})

describe('the sign-in page without logos', () => {
  it("keeps tinyzoo's tab icon, adds no manifest, and shows the initials, the name and the signature", async () => {
    const res = await fetch(anonymous().baseURL + '/admin/login', { headers: { 'accept-language': 'en' } })
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).toMatch(/<link[^>]+rel="icon"[^>]+type="image\/svg\+xml"|<link[^>]+type="image\/svg\+xml"[^>]+rel="icon"/)
    expect(html).not.toContain('/api/cms/_brand/')
    expect(html).not.toContain('apple-touch-icon')
    expect(html).toContain('>DB<') // the initials tile of "Demo Blog"
    expect(html).toContain('Demo Blog')
    expect(html).toMatch(/<span class="sr-only">tinyzoo<\/span>/) // the signature in the footer
  })
})

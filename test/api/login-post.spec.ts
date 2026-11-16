import { describe, expect, inject, it } from 'vitest'

// The sign-in form before the page has hydrated: a native submit. It must be a POST, and a
// POST to the page must never turn the password into an address or echo it back.
const PASSWORD = 'pa55w0rd-in-a-pre-hydration-submit'

describe('the sign-in form without JavaScript', () => {
  it('is served as a POST form', async () => {
    for (const path of ['/admin/login', '/admin/forgot']) {
      const html = await (await fetch(inject('baseURL') + path)).text()
      const form = /<form\b[^>]*>/.exec(html)?.[0]
      expect(form, path).toMatch(/method="post"/)
    }
  })

  it('a native submit sends the password in the body, and the answer neither redirects with it nor shows it', async () => {
    const res = await fetch(inject('baseURL') + '/admin/login', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'ada@example.com', password: PASSWORD }),
    })
    const text = await res.text()
    expect(res.headers.get('location') ?? '').not.toContain(PASSWORD)
    expect(text).not.toContain(PASSWORD)
    expect(res.status).toBeLessThan(500)
    expect(res.headers.getSetCookie()).toEqual([])
  })
})

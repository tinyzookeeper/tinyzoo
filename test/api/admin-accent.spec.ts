import { describe, expect, it } from 'vitest'
import { anonymous } from '../helpers/api'

// The admin's accent as the built server hands it out. The playground is unbranded (mono), so
// this checks the default end to end: the theme at GET /api/cms/_theme (no developer notes in a
// production build) and the admin page drawn by the stylesheet alone (no brand <style>).
// The colour maths itself: test/unit/admin-accent.spec.ts.

describe('the admin accent', () => {
  it('GET /api/cms/_theme: mono, with the hexes the stylesheet draws and the accent as text', async () => {
    const res = await anonymous().get('/api/cms/_theme')
    expect(res.status).toBe(200)
    expect(res.body.accent).toMatchObject({
      kind: 'preset', preset: 'mono',
      light: { primary: '#2E3035', onPrimary: '#FFFFFF', text: '#2E3035' },
      dark: { primary: '#F9F5EF', onPrimary: '#131313', text: '#F9F5EF' },
    })
    expect(Object.keys(res.body.accent.light.ramp)).toHaveLength(11)
    expect(res.body.notes).toEqual([])
  })

  it('the admin page names the accent on <html> and writes no brand colour', async () => {
    const html = await (await fetch(`${anonymous().baseURL}/admin/login`)).text()
    expect(html).toMatch(/<html[^>]*data-cms-accent="mono"/)
    expect(html).not.toContain(`data-cms-accent='brand'`)
  })

  it('unbranded: the animals are on (theme.animals), cream moments and the colourful hedgehog as an image', async () => {
    const theme = (await anonymous().get('/api/cms/_theme')).body
    expect(theme.animals).toBe(true)
    expect(theme.accent.moments).toBeUndefined()
    const html = await (await fetch(`${anonymous().baseURL}/admin/login`)).text()
    // The sign-in's animal: the drawn file, not the inline drawing a brand colour gets.
    expect(html).toMatch(/<img[^>]*data-character="hedgehog"/)
    expect(html).not.toContain('cms-animal__body')
    expect(html).not.toMatch(/--cms-moment-bg:#/)
  })
})

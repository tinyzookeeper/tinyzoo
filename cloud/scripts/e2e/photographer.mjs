// Photographer's own part of the end-to-end check, a few checks only (scripts/e2e-templates.mjs
// runs it after the checks every hosted template goes through). The full run (scripts/e2e.mjs,
// section 6b) goes through the wizard, the lightbox and the look change in the admin as well.
export default {
  // The name the site is made with.
  name: 'Ateliér Světlo',
  // Every look writes the name in its header.
  named: async (page) => (await page.locator('header').first().innerText()).toLowerCase().includes('ateliér světlo'),
  async extra({ page, origin, check }) {
    // The gallery and an album answer with one main heading; the album holds photographs.
    const gallery = await page.goto(`${origin}/galerie`, { waitUntil: 'networkidle' })
    check('photographer: the gallery answers with one heading', gallery.status() === 200 && await page.locator('h1').count() === 1, String(gallery.status()))
    const album = await page.goto(`${origin}/album/anna-a-vojta`, { waitUntil: 'networkidle' })
    const photos = await page.locator('[data-photo]').count()
    check('photographer: an album answers with one heading and its photographs', album.status() === 200 && await page.locator('h1').count() === 1 && photos >= 2, JSON.stringify([album.status(), photos]))

    // The enquiry form sends, and the message arrives in the admin (the page is signed in to it).
    await page.goto(`${origin}/kontakt`, { waitUntil: 'networkidle' })
    await page.locator('form [name=name]').fill('Tereza Malá')
    await page.locator('form [name=email]').fill('tereza@example.com')
    await page.locator('form [name=message]').fill('Dobrý den, máte volno 12. 6. 2027?')
    await page.locator('form button[type=submit]').click()
    await page.locator('[role=status]').waitFor({ timeout: 15_000 })
    const sent = (await page.locator('[role=status]').innerText()).includes('Děkuji')
    const messages = await page.evaluate(async () => { const r = await (await fetch('/api/cms/enquiry', { headers: { accept: 'application/json' } })).json(); return r.items ?? r.rows ?? [] })
    check('photographer: the enquiry form sends, and the message arrives in the admin', sent && messages.length === 1, JSON.stringify({ sent, messages: messages.length }))
  },
}

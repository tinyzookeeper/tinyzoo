import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { anonymous, type Client, hooksMark, signIn, testDb, truncateAll, waitForHooks } from '../helpers/api'

// Pages under pages (definePages({ tree: true }) in the playground, cs + en, the English
// address template '/pages/:slug'): nested addresses, lookup by address, breadcrumbs, the
// tree, moving a subtree with redirects, refusals, the sitemap.
const db = testDb()
let admin: Client
let author: Client
beforeAll(async () => {
  admin = await signIn('admin')
  author = await signIn('author')
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const visitor = anonymous()

/** A page (published unless said otherwise), with its English address part when given. */
async function page(title: string, slug: string, parent: string | null = null, en?: { title: string; slug: string } | null, over: Record<string, unknown> = {}) {
  const res = await admin.post('/api/cms/page', { title, slug, parent, status: 'published', sections: [], ...over })
  if (res.status !== 201) throw new Error(`page ${slug}: ${res.status} ${JSON.stringify(res.body)}`)
  const row = res.body.row
  if (en) {
    const t = await admin.request('PATCH', `/api/cms/page/${row.id}?locale=en`, { json: en })
    if (t.status !== 200) throw new Error(`translate ${slug}: ${t.status} ${JSON.stringify(t.body)}`)
  }
  return row as { id: string; slug: string }
}

/** o-nas (about) ─ tym (team) ─ vedeni (leadership); historie under o-nas; kontakt at the top. */
async function site() {
  const about = await page('O nás', 'o-nas', null, { title: 'About us', slug: 'about' })
  const team = await page('Tým', 'tym', about.id, { title: 'Team', slug: 'team' })
  const lead = await page('Vedení', 'vedeni', team.id)
  const history = await page('Historie', 'historie', about.id)
  const contact = await page('Kontakt', 'kontakt', null, { title: 'Contact', slug: 'contact' })
  return { about, team, lead, history, contact }
}

// A page by its whole address: the parts as one path segment, slashes escaped (what the client sends).
const item = async (path: string, locale = '') => (await visitor.get(`/api/content/page/${encodeURIComponent(path)}${locale ? `?locale=${locale}` : ''}`))
const redirects = async () => (await db.query('select "from", "to", permanent from redirect order by "from"')).rows.map((r) => [r.from, r.to, r.permanent])

describe('nested addresses', () => {
  it('finds a page by its whole address, in each language its own', async () => {
    const t = await site()
    const cs = await item('o-nas/tym')
    expect(cs.status).toBe(200)
    expect(cs.body.item).toMatchObject({ id: t.team.id, path: '/o-nas/tym', title: 'Tým', parent: t.about.id })
    expect(cs.body.item.breadcrumbs).toEqual([{ title: 'O nás', path: '/o-nas' }, { title: 'Tým', path: '/o-nas/tym' }])

    const en = await item('about/team', 'en')
    expect(en.status).toBe(200)
    expect(en.body.item).toMatchObject({ id: t.team.id, path: '/en/pages/about/team', title: 'Team', locale: 'en' })
    expect(en.body.item.breadcrumbs).toEqual([{ title: 'About us', path: '/en/pages/about' }, { title: 'Team', path: '/en/pages/about/team' }])
    expect(en.body.item.paths).toEqual({ cs: '/o-nas/tym', en: '/en/pages/about/team' })
  })

  it('takes the address as one escaped segment (a leading or trailing slash does not matter), and an id', async () => {
    const t = await site()
    expect((await item('/o-nas/tym')).body.item.id).toBe(t.team.id)
    expect((await item('o-nas/tym/vedeni/')).body.item.path).toBe('/o-nas/tym/vedeni')
    // sent by hand, the slashes are escaped (a raw one would be another route)
    expect((await visitor.get('/api/content/page/o-nas%2Ftym%2Fvedeni')).body.item.id).toBe(t.lead.id)
    expect((await visitor.get('/api/content/page/o-nas%2ftym')).body.item.id).toBe(t.team.id)
    expect((await item(t.lead.id)).body.item.path).toBe('/o-nas/tym/vedeni')
  })

  it('does not find a page by its own part alone, nor by a wrong chain', async () => {
    await site()
    expect((await item('tym')).status).toBe(404)
    expect((await item('kontakt/tym')).status).toBe(404)
    expect((await item('o-nas/vedeni')).status).toBe(404)
  })

  it('falls back to the default language where a page is not translated', async () => {
    const t = await site()
    // "Vedení" has no English translation: its Czech part stands in, under the translated parents.
    const res = await item('about/team/vedeni', 'en')
    expect(res.status).toBe(200)
    expect(res.body.item).toMatchObject({ id: t.lead.id, path: '/en/pages/about/team/vedeni', locale: 'en' })
    expect(res.body.item.breadcrumbs.map((b: any) => b.title)).toEqual(['About us', 'Team', 'Vedení'])
    // the Czech address still works in English (served in English, untranslated text falling back)
    expect((await item('o-nas/tym/vedeni', 'en')).body.item.id).toBe(t.lead.id)
  })

  it('lists pages with their path, parent and breadcrumbs', async () => {
    const t = await site()
    const list = (await visitor.get('/api/content/page?limit=50')).body
    const lead = list.items.find((i: any) => i.id === t.lead.id)
    expect(lead).toMatchObject({ path: '/o-nas/tym/vedeni', parent: t.team.id })
    expect(lead.breadcrumbs.map((b: any) => b.path)).toEqual(['/o-nas', '/o-nas/tym', '/o-nas/tym/vedeni'])
    const children = (await visitor.get(`/api/content/page?parent=${t.about.id}`)).body.items.map((i: any) => i.slug).sort()
    expect(children).toEqual(['historie', 'tym'])
  })

  it('allows the same address part under different parents (and at the top)', async () => {
    const t = await site()
    const other = await admin.post('/api/cms/page', { title: 'Tým jinde', slug: 'tym', parent: t.contact.id, status: 'published', sections: [] })
    expect(other.status).toBe(201)
    expect((await item('kontakt/tym')).body.item.path).toBe('/kontakt/tym')
    expect((await item('o-nas/tym')).body.item.id).toBe(t.team.id)
    expect((await admin.post('/api/cms/page', { title: 'Tým nahoře', slug: 'tym', status: 'published', sections: [] })).status).toBe(201)
  })
})

describe('the published tree', () => {
  it('returns the live pages nested, in the order editors gave them, per language', async () => {
    const t = await site()
    const cs = (await visitor.get('/api/content/_tree/page')).body.items
    expect(cs.map((n: any) => n.title)).toEqual(['O nás', 'Kontakt'])
    expect(cs[0]).toMatchObject({ id: t.about.id, path: '/o-nas' })
    expect(cs[0].children.map((n: any) => [n.title, n.path])).toEqual([['Tým', '/o-nas/tym'], ['Historie', '/o-nas/historie']])
    expect(cs[0].children[0].children).toEqual([{ id: t.lead.id, title: 'Vedení', path: '/o-nas/tym/vedeni', children: [] }])

    const en = (await visitor.get('/api/content/_tree/page?locale=en')).body.items
    expect(en.map((n: any) => [n.title, n.path])).toEqual([['About us', '/en/pages/about'], ['Contact', '/en/pages/contact']])
    expect(en[0].children[0]).toMatchObject({ title: 'Team', path: '/en/pages/about/team' })
    // not translated: the default language's title, under the translated address
    expect(en[0].children[0].children[0]).toMatchObject({ title: 'Vedení', path: '/en/pages/about/team/vedeni' })
  })

  it('follows a manual order', async () => {
    const t = await site()
    expect((await admin.post('/api/cms/page/_move', { id: t.history.id, parent: t.about.id, index: 0 })).status).toBe(200)
    const kids = (await visitor.get('/api/content/_tree/page')).body.items[0].children.map((n: any) => n.title)
    expect(kids).toEqual(['Historie', 'Tým'])
  })

  it('is 404 for a collection that is not a tree', async () => {
    expect((await visitor.get('/api/content/_tree/post')).status).toBe(404)
  })
})

describe('a page under a draft', () => {
  it('is not reachable, listed, in the tree or in the sitemap; the draft preview still shows it', async () => {
    const t = await site()
    expect((await admin.patch(`/api/cms/page/${t.about.id}`, { status: 'draft' })).status).toBe(200)
    expect((await item('o-nas')).status).toBe(404)
    expect((await item('o-nas/tym')).status).toBe(404)
    expect((await item(t.lead.id)).status).toBe(404)
    expect((await visitor.get('/api/content/page?limit=50')).body.items.map((i: any) => i.slug)).toEqual(['kontakt'])
    expect((await visitor.get('/api/content/_tree/page')).body.items.map((n: any) => n.title)).toEqual(['Kontakt'])
    const sitemap = (await visitor.get('/api/content/_sitemap')).body.entries.map((e: any) => e.loc)
    expect(sitemap).toContain('/kontakt')
    expect(sitemap.filter((l: string) => l.startsWith('/o-nas'))).toEqual([])
    // an editor's preview reads it, with the real trail (the draft in it)
    const preview = await admin.get('/api/content/page/o-nas%2Ftym?preview')
    expect(preview.status).toBe(200)
    expect(preview.body.item.breadcrumbs.map((b: any) => b.title)).toEqual(['O nás', 'Tým'])
    // the admin's list says why it is hidden
    const rows = (await admin.get('/api/cms/page/_tree')).body.rows
    expect(rows.find((r: any) => r.id === t.team.id)).toMatchObject({ status: 'published', onSite: false })
    expect(rows.find((r: any) => r.id === t.about.id)).toMatchObject({ status: 'draft', onSite: false })
    // published again, the branch comes back
    await admin.patch(`/api/cms/page/${t.about.id}`, { status: 'published' })
    expect((await item('o-nas/tym')).status).toBe(200)
  })

  it('is not reachable when only the middle page is a draft', async () => {
    const t = await site()
    await admin.patch(`/api/cms/page/${t.team.id}`, { status: 'draft' })
    expect((await item('o-nas')).status).toBe(200)
    expect((await item('o-nas/tym/vedeni')).status).toBe(404)
    expect((await item('o-nas/historie')).status).toBe(200)
  })

  it('is a draft of its own: an unpublished child under a live parent stays hidden', async () => {
    const t = await site()
    await admin.patch(`/api/cms/page/${t.history.id}`, { status: 'draft' })
    expect((await item('o-nas/historie')).status).toBe(404)
    expect((await item('o-nas/tym')).status).toBe(200)
  })
})

describe('refusals', () => {
  it('refuses an address that is already taken, naming the page', async () => {
    const t = await site()
    const res = await admin.post('/api/cms/page', { title: 'Druhý tým', slug: 'tym', parent: t.about.id, sections: [] })
    expect(res.status).toBe(409)
    expect(res.body.data[0]).toMatchObject({ path: ['slug'], code: 'unique', address: '/o-nas/tym', otherId: t.team.id, otherTitle: 'Tým' })
    // renaming into a taken address
    const rename = await admin.patch(`/api/cms/page/${t.history.id}`, { slug: 'tym' })
    expect(rename.status).toBe(409)
    // moving into a taken address
    const lone = await page('Tým nahoře', 'tym')
    const move = await admin.post('/api/cms/page/_move', { id: lone.id, parent: t.about.id })
    expect(move.status).toBe(409)
    expect(move.body.data[0]).toMatchObject({ code: 'unique', address: '/o-nas/tym' })
  })

  it('refuses a taken address in English too', async () => {
    const t = await site()
    const other = await page('Jiný', 'jiny', t.about.id)
    const res = await admin.request('PATCH', `/api/cms/page/${other.id}?locale=en`, { json: { title: 'Another', slug: 'team' } })
    expect(res.status).toBe(409)
    expect(res.body.data[0]).toMatchObject({ code: 'unique', locale: 'en', address: '/en/pages/about/team' })
  })

  it('refuses a loop and names it', async () => {
    const t = await site()
    const own = await admin.patch(`/api/cms/page/${t.about.id}`, { parent: t.about.id })
    expect(own.status).toBe(422)
    const loop = await admin.patch(`/api/cms/page/${t.about.id}`, { parent: t.lead.id })
    expect(loop.status).toBe(422)
    expect(loop.body.data[0]).toMatchObject({ path: ['parent'], code: 'tree_cycle', loop: ['O nás', 'Tým', 'Vedení', 'O nás'] })
    const move = await admin.post('/api/cms/page/_move', { id: t.team.id, parent: t.lead.id })
    expect(move.status).toBe(422)
    expect(move.body.data[0].code).toBe('tree_cycle')
    // nothing changed
    expect((await item('o-nas/tym/vedeni')).status).toBe(200)
  })

  it('refuses a tree deeper than four levels (and a page that carries one deeper)', async () => {
    const t = await site()
    const level4 = await page('Čtvrtá', 'ctvrta', t.lead.id)
    expect((await item('o-nas/tym/vedeni/ctvrta')).body.item.breadcrumbs).toHaveLength(4)
    const tooDeep = await admin.post('/api/cms/page', { title: 'Pátá', slug: 'pata', parent: level4.id, sections: [] })
    expect(tooDeep.status).toBe(422)
    expect(tooDeep.body.data[0]).toMatchObject({ path: ['parent'], code: 'tree_depth', depth: 5, maxDepth: 4 })
    // the whole branch moved under a page at level 3 would be 3 + 1 + 3 levels
    const move = await admin.post('/api/cms/page/_move', { id: t.team.id, parent: t.history.id })
    expect(move.status).toBe(422)
    expect(move.body.data[0].code).toBe('tree_depth')
  })

  it('refuses a parent that does not exist', async () => {
    const res = await admin.post('/api/cms/page', { title: 'Sirotek', slug: 'sirotek', parent: '00000000-0000-4000-8000-000000000000', sections: [] })
    expect(res.status).toBe(422)
  })

  it('refuses to delete a page that has subpages, listing them; nothing is deleted', async () => {
    const t = await site()
    const res = await admin.delete(`/api/cms/page/${t.about.id}`)
    expect(res.status).toBe(409)
    expect(res.body.data).toMatchObject({ code: 'has_children', count: 2 })
    expect(res.body.data.children.map((c: any) => c.title).sort()).toEqual(['Historie', 'Tým'])
    expect((await item('o-nas/tym/vedeni')).status).toBe(200)
    // below first, then it goes
    expect((await admin.delete(`/api/cms/page/${t.lead.id}`)).status).toBe(200)
    expect((await admin.delete(`/api/cms/page/${t.team.id}`)).status).toBe(200)
    expect((await admin.delete(`/api/cms/page/${t.history.id}`)).status).toBe(200)
    expect((await admin.delete(`/api/cms/page/${t.about.id}`)).status).toBe(200)
  })

  it('needs a signed-in editor to move, and an author may not move a live page', async () => {
    const t = await site()
    expect((await visitor.post('/api/cms/page/_move', { id: t.history.id, parent: null })).status).toBe(401)
    // someone else's page is not theirs to move
    expect((await author.post('/api/cms/page/_move', { id: t.history.id, parent: null })).status).toBe(404)
    // their own draft is: last under a live page it stays a draft; but putting it first among live pages
    // would renumber those, which an author may not do
    const draft = (await author.post('/api/cms/page', { title: 'Návrh', slug: 'navrh', sections: [] })).body.row
    expect((await author.post('/api/cms/page/_move', { id: draft.id, parent: t.contact.id })).status).toBe(200)
    expect((await author.post('/api/cms/page/_move', { id: draft.id, parent: null, index: 0 })).status).toBe(403)
    expect((await visitor.get('/api/cms/page/_tree')).status).toBe(401)
  })
})

describe('moving a subtree', () => {
  it('gives the page and every page below it new addresses, in every language, and leaves redirects', async () => {
    const t = await site()
    const res = await admin.post('/api/cms/page/_move', { id: t.team.id, parent: t.contact.id })
    expect(res.status).toBe(200)
    // "Vedení" has no English translation but is reachable in English at its fallback address: that moves too
    expect(res.body.moved.map((m: any) => [m.locale, m.from, m.to]).sort()).toEqual([
      ['cs', '/o-nas/tym', '/kontakt/tym'],
      ['cs', '/o-nas/tym/vedeni', '/kontakt/tym/vedeni'],
      ['en', '/en/pages/about/team', '/en/pages/contact/team'],
      ['en', '/en/pages/about/team/vedeni', '/en/pages/contact/team/vedeni'],
    ])
    expect(res.body.redirects).toBe(4)

    expect((await item('kontakt/tym/vedeni')).body.item.breadcrumbs.map((b: any) => b.path)).toEqual(['/kontakt', '/kontakt/tym', '/kontakt/tym/vedeni'])
    expect((await item('o-nas/tym')).status).toBe(404)
    expect((await item('contact/team', 'en')).body.item.path).toBe('/en/pages/contact/team')
    expect(await redirects()).toEqual([
      ['/en/pages/about/team', '/en/pages/contact/team', true],
      ['/en/pages/about/team/vedeni', '/en/pages/contact/team/vedeni', true],
      ['/o-nas/tym', '/kontakt/tym', true],
      ['/o-nas/tym/vedeni', '/kontakt/tym/vedeni', true],
    ])
    // and the website's server sends visitors of the old address on
    const old = await fetch(`${visitor.baseURL}/o-nas/tym/vedeni`, { redirect: 'manual' })
    expect(old.status).toBe(301)
    expect(old.headers.get('location')).toBe('/kontakt/tym/vedeni')
  })

  it('collapses chains and removes a redirect from an address a page is back at', async () => {
    const t = await site()
    await admin.post('/api/cms/page/_move', { id: t.team.id, parent: t.contact.id })
    await admin.post('/api/cms/page/_move', { id: t.team.id, parent: t.history.id })
    // /o-nas/tym → /kontakt/tym used to be a hop; now it leads where the page is
    expect((await redirects()).filter((r) => r[0] === '/o-nas/tym' || r[0] === '/kontakt/tym')).toEqual([
      ['/kontakt/tym', '/o-nas/historie/tym', true],
      ['/o-nas/tym', '/o-nas/historie/tym', true],
    ])
    await admin.post('/api/cms/page/_move', { id: t.team.id, parent: t.about.id })
    // the page lives at /o-nas/tym again: nothing may send visitors away from it
    expect((await redirects()).map((r) => r[0])).not.toContain('/o-nas/tym')
    expect((await redirects()).find((r) => r[0] === '/kontakt/tym')).toEqual(['/kontakt/tym', '/o-nas/tym', true])
    expect((await item('o-nas/tym')).status).toBe(200)
  })

  it('changes every descendant when a parent’s address part changes', async () => {
    const t = await site()
    const res = await admin.patch(`/api/cms/page/${t.about.id}`, { slug: 'firma' })
    expect(res.status).toBe(200)
    expect((await item('firma/tym/vedeni')).body.item.path).toBe('/firma/tym/vedeni')
    expect((await item('o-nas/tym')).status).toBe(404)
    expect((await redirects()).filter((r) => r[0].startsWith('/o-nas'))).toEqual([
      ['/o-nas', '/firma', true],
      ['/o-nas/historie', '/firma/historie', true],
      ['/o-nas/tym', '/firma/tym', true],
      ['/o-nas/tym/vedeni', '/firma/tym/vedeni', true],
    ])
    // English keeps its own parts (about/team): nothing moved there
    expect((await redirects()).filter((r) => r[0].startsWith('/en'))).toEqual([])
    expect((await item('about/team', 'en')).body.item.path).toBe('/en/pages/about/team')
  })

  it('does the same for a translated address part, in that language only', async () => {
    const t = await site()
    const res = await admin.request('PATCH', `/api/cms/page/${t.about.id}?locale=en`, { json: { slug: 'about-us' } })
    expect(res.status).toBe(200)
    // "Historie" and "Vedení" are not translated: their address in English follows the parent
    expect(await redirects()).toEqual([
      ['/en/pages/about', '/en/pages/about-us', true],
      ['/en/pages/about/historie', '/en/pages/about-us/historie', true],
      ['/en/pages/about/team', '/en/pages/about-us/team', true],
      ['/en/pages/about/team/vedeni', '/en/pages/about-us/team/vedeni', true],
    ])
    expect((await item('about-us/team', 'en')).body.item.path).toBe('/en/pages/about-us/team')
    expect((await item('o-nas/tym')).status).toBe(200) // Czech untouched
  })

  it('falls back to the default part when a translation is removed, moving what is below', async () => {
    const t = await site()
    const res = await admin.delete(`/api/cms/page/${t.team.id}?locale=en`)
    expect(res.status).toBe(200)
    expect(await redirects()).toEqual([
      ['/en/pages/about/team', '/en/pages/about/tym', true],
      ['/en/pages/about/team/vedeni', '/en/pages/about/tym/vedeni', true],
    ])
    expect((await item('about/tym/vedeni', 'en')).body.item.path).toBe('/en/pages/about/tym/vedeni')
  })

  it('makes no redirects for pages that were not on the website', async () => {
    const t = await site()
    await admin.patch(`/api/cms/page/${t.history.id}`, { status: 'draft' })
    await admin.patch(`/api/cms/page/${t.history.id}`, { slug: 'minulost' })
    expect(await redirects()).toEqual([])
    // and a draft branch: moving it leaves nothing either
    await admin.patch(`/api/cms/page/${t.team.id}`, { status: 'draft' })
    await admin.post('/api/cms/page/_move', { id: t.team.id, parent: t.contact.id })
    expect(await redirects()).toEqual([])
  })

  it('reports every changed address in the webhook payload', async () => {
    const t = await site()
    const mark = hooksMark()
    await admin.post('/api/cms/page/_move', { id: t.team.id, parent: t.contact.id })
    const ok = (h: any[]) => h.find((x) => x.path === '/ok' && x.json.type === 'entry.updated' && x.json.id === t.team.id)
    const hooks = await waitForHooks(mark, (h) => !!ok(h))
    const body = ok(hooks).json
    expect(body.public).toBe(true)
    expect(body.moved.map((m: any) => [m.locale, m.from, m.to]).sort()).toEqual([
      ['cs', '/o-nas/tym', '/kontakt/tym'],
      ['cs', '/o-nas/tym/vedeni', '/kontakt/tym/vedeni'],
      ['en', '/en/pages/about/team', '/en/pages/contact/team'],
      ['en', '/en/pages/about/team/vedeni', '/en/pages/contact/team/vedeni'],
    ])
    // every old and new address of the subtree is among the paths to purge
    expect(body.paths).toEqual(expect.arrayContaining(['/o-nas/tym', '/o-nas/tym/vedeni', '/kontakt/tym', '/kontakt/tym/vedeni', '/en/pages/about/team', '/en/pages/contact/team']))
  })

  it('puts a page under a new parent last, or where asked; reordering moves no address', async () => {
    const t = await site()
    const extra = await page('Extra', 'extra', t.about.id)
    expect((await admin.post('/api/cms/page/_move', { id: extra.id, parent: t.about.id, index: 0 })).body).toMatchObject({ ok: true, moved: [], redirects: 0 })
    const order = async () => (await visitor.get('/api/content/_tree/page')).body.items[0].children.map((n: any) => n.title)
    expect(await order()).toEqual(['Extra', 'Tým', 'Historie'])
    await admin.post('/api/cms/page/_move', { id: extra.id, parent: t.about.id, index: 99 })
    expect(await order()).toEqual(['Tým', 'Historie', 'Extra'])
    expect(await redirects()).toEqual([])
    // a changed parent through the form puts it last among its new siblings
    await admin.patch(`/api/cms/page/${t.contact.id}`, { parent: t.about.id })
    expect(await order()).toEqual(['Tým', 'Historie', 'Extra', 'Kontakt'])
  })
})

describe('sitemap', () => {
  it('lists nested addresses in both languages, fixed paths and what a hook adds', async () => {
    await site()
    const { entries } = (await visitor.get('/api/content/_sitemap')).body
    const locs = entries.map((e: any) => e.loc)
    expect(locs).toEqual(expect.arrayContaining(['/o-nas', '/o-nas/tym', '/o-nas/tym/vedeni', '/en/pages/about/team', '/en/pages/contact']))
    // the fixed pages (cms.sitemap.paths): one address, and one in each language
    expect(locs).toEqual(expect.arrayContaining(['/kontakt', '/aktuality', '/en/news']))
    // the page "Kontakt" (tree) and the fixed /kontakt are one address, listed once
    expect(locs.filter((l: string) => l === '/kontakt')).toHaveLength(1)
    // a hook pushed one
    expect(locs).toContain('/z-hooku')
    const team = entries.find((e: any) => e.loc === '/o-nas/tym')
    expect(team.alternates).toEqual([{ locale: 'cs', loc: '/o-nas/tym' }, { locale: 'en', loc: '/en/pages/about/team' }])
    const news = entries.find((e: any) => e.loc === '/en/news')
    expect(news).toMatchObject({ locale: 'en', lastmod: null })
    expect(news.alternates).toEqual([{ locale: 'cs', loc: '/aktuality' }, { locale: 'en', loc: '/en/news' }])
  })

  it('serves it as XML with hreflang alternates and no lastmod for fixed pages', async () => {
    await site()
    const xml = (await visitor.get('/sitemap.xml')).body as string
    expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/o-nas\/tym<\/loc>/)
    expect(xml).toMatch(/hreflang="en" href="https?:\/\/[^"]+\/en\/pages\/about\/team"/)
    // a fixed page has no date to give: <loc> is followed by the alternates straight away
    expect(xml).toMatch(/\/aktuality<\/loc>\n    <xhtml/)
  })

  it('follows a move at once', async () => {
    const t = await site()
    await visitor.get('/api/content/_sitemap')
    await admin.post('/api/cms/page/_move', { id: t.team.id, parent: t.contact.id })
    const locs = (await visitor.get('/api/content/_sitemap')).body.entries.map((e: any) => e.loc)
    expect(locs).toContain('/kontakt/tym')
    expect(locs).not.toContain('/o-nas/tym')
  })
})

describe('the admin', () => {
  it('lists the tree with addresses, status and what is on the website', async () => {
    const t = await site()
    const { rows, maxDepth } = (await admin.get('/api/cms/page/_tree')).body
    expect(maxDepth).toBe(4)
    const lead = rows.find((r: any) => r.id === t.lead.id)
    expect(lead).toMatchObject({ parentId: t.team.id, title: 'Vedení', slug: 'vedeni', status: 'published', onSite: true })
    expect(lead.paths).toEqual({ cs: '/o-nas/tym/vedeni' })
    expect(rows.find((r: any) => r.id === t.team.id).paths).toEqual({ cs: '/o-nas/tym', en: '/en/pages/about/team' })
    expect(rows.find((r: any) => r.id === t.team.id).locales).toEqual(['cs', 'en'])
  })

  it('leaves the page and everything below it out of the parent picker', async () => {
    const t = await site()
    const picker = async (exclude?: string) => (await admin.get(`/api/cms/page/options${exclude ? `?exclude=${exclude}` : ''}`)).body.map((o: any) => o.label).sort()
    expect(await picker()).toEqual(['Historie'.replace('Historie', 'O nás / Historie'), 'Kontakt', 'O nás', 'O nás / Tým', 'O nás / Tým / Vedení'].sort())
    expect(await picker(t.about.id)).toEqual(['Kontakt'])
    expect(await picker(t.team.id)).toEqual(['Kontakt', 'O nás', 'O nás / Historie'])
  })

  it('finds a nested page in the website search, at its nested address', async () => {
    const t = await site()
    await admin.patch(`/api/cms/page/${t.lead.id}`, { title: 'Vedení firmy' })
    const res = await visitor.get('/api/content/_search?q=vedeni&locale=cs')
    expect(res.status).toBe(200)
    expect(res.body.items.find((i: any) => i.id === t.lead.id)).toMatchObject({ entity: 'page', path: '/o-nas/tym/vedeni' })
    // a move changes the address the search gives, without the page being saved
    await admin.post('/api/cms/page/_move', { id: t.team.id, parent: t.contact.id })
    const after = (await visitor.get('/api/content/_search?q=vedeni&locale=cs')).body.items.find((i: any) => i.id === t.lead.id)
    expect(after.path).toBe('/kontakt/tym/vedeni')
  })

  it('gives the link picker the nested address', async () => {
    await site()
    const res = (await admin.get('/api/cms/_links?q=Tým&locale=cs')).body
    expect(res.items.find((i: any) => i.title === 'Tým')).toMatchObject({ entity: 'page', path: '/o-nas/tym', published: true })
    // the search is on the default language's title; the item comes back in the language asked for
    const en = (await admin.get('/api/cms/_links?q=T%C3%BDm&locale=en')).body
    expect(en.items.find((i: any) => i.title === 'Team')).toMatchObject({ path: '/en/pages/about/team' })
  })
})

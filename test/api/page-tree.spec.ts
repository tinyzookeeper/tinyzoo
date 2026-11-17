import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { accounts, anonymous, type Client, hooksMark, signIn, testDb, truncateAll, waitForHooks } from '../helpers/api'

// Pages under pages (definePages({ tree: true }) in the playground, cs + en, the English
// address template '/pages/:slug'): nested addresses, lookup by address, breadcrumbs, the
// tree, moving a subtree with redirects, refusals, the sitemap.
const db = testDb()
let admin: Client
let editor: Client
let author: Client
beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
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
/** Every page's position, version and last editor, straight from the database. */
const pageRows = async () => Object.fromEntries((await db.query('select id, position, updated_at, updated_by from page')).rows.map((r) => [r.id, r]))
const revisionCount = async (id: string) => (await db.query('select count(*)::int as n from cms_revisions where record_id = $1', [id])).rows[0].n
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
    // their own draft is: under a live page it stays a draft; first among live pages it is the draft that
    // gets a place, the live pages keep theirs (nothing of theirs is written)
    const draft = (await author.post('/api/cms/page', { title: 'Návrh', slug: 'navrh', sections: [] })).body.row
    expect((await author.post('/api/cms/page/_move', { id: draft.id, parent: t.contact.id })).status).toBe(200)
    const live = await pageRows()
    expect((await author.post('/api/cms/page/_move', { id: draft.id, parent: null, index: 0 })).status).toBe(200)
    const after = await pageRows()
    for (const page of [t.about, t.contact]) expect(after[page.id]).toEqual(live[page.id])
    // …but a live page is not theirs to move
    const liveMove = await author.post('/api/cms/page/_move', { id: t.contact.id, parent: null, index: 0 })
    expect(liveMove.status).toBe(404)
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
    expect(xml).toMatch(/\/aktuality<\/loc>\s*<xhtml/)
    // the language versions name the default language's as x-default
    expect(xml).toMatch(/hreflang="x-default" href="https?:\/\/[^"]+\/o-nas\/tym"/)
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

  it('leaves out pages with no room left under them (the move would be refused on save)', async () => {
    const a = await page('A', 'a')
    const b = await page('B', 'b', a.id)
    const c = await page('C', 'c', b.id)
    const d = await page('D', 'd', c.id) // four levels deep: the most there is
    const solo = await page('Solo', 'solo')
    const labels = async (query: string) => (await admin.get(`/api/cms/page/options?${query}`)).body.map((o: any) => o.label).sort()
    // A new page: anything but the deepest.
    expect(await labels('placing=1')).toEqual(['A', 'A / B', 'A / B / C', 'Solo'].sort())
    // An existing page without pages below it: the same (its own place is left out too).
    expect(await labels(`exclude=${solo.id}`)).toEqual(['A', 'A / B', 'A / B / C'].sort())
    // A page that carries one level of pages: only parents with two free levels.
    const withKid = await page('Rodič', 'rodic')
    await page('Dítě', 'dite', withKid.id)
    expect(await labels(`exclude=${withKid.id}`)).toEqual(['A', 'A / B', 'Solo'].sort())
    // The refusal a save would give is the same one.
    expect((await admin.patch(`/api/cms/page/${solo.id}`, { parent: d.id })).status).toBe(422)
  })

  it('tells the editor how many redirects a changed address left behind', async () => {
    const t = await site()
    const renamed = await admin.patch(`/api/cms/page/${t.about.id}`, { slug: 'o-firme' })
    expect(renamed.status).toBe(200)
    const made = (await redirects()).length
    expect(made).toBeGreaterThan(1) // the page and the pages below it
    expect(renamed.body.redirects).toBe(made)
    // A save that changes no address says nothing about redirects.
    expect((await admin.patch(`/api/cms/page/${t.contact.id}`, { title: 'Kontakty' })).body.redirects).toBeUndefined()
    // A translated address part counts too.
    const en = await admin.request('PATCH', `/api/cms/page/${t.team.id}?locale=en`, { json: { title: 'Team', slug: 'crew' } })
    expect(en.body.row.__redirects).toBeGreaterThan(0)
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

describe('links to pages in the tree', () => {
  // A picked page is stored as a reference (cms:page/<id>) and resolved to its address.
  const saveMenu = (main: unknown[]) => admin.put('/api/cms/_singleton/navigation', { main, footer: [] })
  const menuUrls = async (locale = '') => ((await visitor.get(`/api/content/_global/navigation${locale ? `?locale=${locale}` : ''}`)).body.item.main as any[]).map((l) => l.url)
  const link = (id: string) => ({ id: `n-${id}`, type: 'link', label: 'x', url: `cms:page/${id}`, newTab: false, sub: false })

  it('resolve to the nested address in each language, and follow a move', async () => {
    const t = await site()
    expect((await saveMenu([link(t.team.id)])).status).toBe(200)
    expect(await menuUrls()).toEqual(['/o-nas/tym'])
    expect(await menuUrls('en')).toEqual(['/en/pages/about/team'])
    const moved = await admin.request('PATCH', `/api/cms/page/${t.team.id}`, { json: { parent: t.contact.id } })
    expect(moved.status).toBe(200)
    expect(await menuUrls()).toEqual(['/kontakt/tym'])
  })

  it('go nowhere for visitors while a page above is unpublished', async () => {
    const t = await site()
    await saveMenu([link(t.lead.id)])
    expect(await menuUrls()).toEqual(['/o-nas/tym/vedeni'])
    await admin.request('PATCH', `/api/cms/page/${t.about.id}`, { json: { status: 'draft' } })
    expect(await menuUrls()).toEqual([null])
  })
})

describe('putting a page in its place', () => {
  // An editor's draft page with two draft pages under it, and an author's draft that goes in among them.
  async function arrange() {
    const draftBy = async (who: Client, title: string, slug: string, parent: string | null = null) =>
      (await who.post('/api/cms/page', { title, slug, parent, sections: [] })).body.row as { id: string }
    const top = await draftBy(editor, 'Redaktorova', 'redaktorova')
    const one = await draftBy(editor, 'První', 'prvni', top.id)
    const two = await draftBy(editor, 'Druhá', 'druha', top.id)
    const mine = await draftBy(author, 'Autorova', 'autorova')
    return { top, one, two, mine }
  }

  it('writes only the moved page: an author moving their draft in among an editor\'s leaves those untouched', async () => {
    const t = await arrange()
    const before = await pageRows()
    const move = await author.post('/api/cms/page/_move', { id: t.mine.id, parent: t.top.id, index: 0 })
    expect(move.status).toBe(200)
    const after = await pageRows()
    // the editor's pages: same number, same version, still last edited by the editor
    for (const page of [t.top, t.one, t.two]) expect(after[page.id]).toEqual(before[page.id])
    expect(after[t.one.id].updated_by).toBe(accounts().editor.id)
    // …and the moved page is first among them
    expect(after[t.mine.id].position).toBeLessThan(after[t.one.id].position)
    const kids = (await admin.get('/api/cms/page/_tree')).body.rows.filter((r: any) => r.parentId === t.top.id).sort((a: any, b: any) => a.position - b.position)
    expect(kids.map((r: any) => r.id)).toEqual([t.mine.id, t.one.id, t.two.id])
  })

  it('renumbers the siblings only when no number fits between two, and then without stamping them', async () => {
    const t = await arrange()
    // numbers with no room between them (older data)
    await db.query('update page set position = 0 where id = $1', [t.one.id])
    await db.query('update page set position = 1 where id = $1', [t.two.id])
    const before = await pageRows()
    const revisions = await revisionCount(t.two.id)
    const move = await author.post('/api/cms/page/_move', { id: t.mine.id, parent: t.top.id, index: 1 })
    expect(move.status).toBe(200)
    const after = await pageRows()
    // the order is right, with room again
    const order = Object.values(after).filter((r: any) => [t.one.id, t.mine.id, t.two.id].includes(r.id)).sort((a: any, b: any) => a.position - b.position).map((r: any) => r.id)
    expect(order).toEqual([t.one.id, t.mine.id, t.two.id])
    expect(after[t.two.id].position).not.toBe(before[t.two.id].position)
    // but a renumbered page keeps its version, its last editor and its history
    for (const page of [t.top, t.one, t.two]) {
      expect(after[page.id].updated_at).toEqual(before[page.id].updated_at)
      expect(after[page.id].updated_by).toBe(before[page.id].updated_by)
    }
    expect(await revisionCount(t.two.id)).toBe(revisions)
    // so an editor who has it open can still save it
    const stale = await editor.request('PATCH', `/api/cms/page/${t.two.id}`, { json: { title: 'Druhá, upravená' }, headers: { 'x-cms-version': new Date(before[t.two.id].updated_at).toISOString() } })
    expect(stale.status).toBe(200)
  })

  it('keeps pages in the order they were put in through many moves', async () => {
    const t = await arrange()
    const order = async () => (await admin.get('/api/cms/page/_tree')).body.rows.filter((r: any) => r.parentId === t.top.id).sort((a: any, b: any) => a.position - b.position).map((r: any) => r.title)
    for (let i = 0; i < 12; i++) await admin.post('/api/cms/page/_move', { id: t.mine.id, parent: t.top.id, index: 1 })
    expect(await order()).toEqual(['První', 'Autorova', 'Druhá'])
    // always to the front: the numbers keep going down, the order stays right
    for (const id of [t.two.id, t.one.id, t.mine.id]) await admin.post('/api/cms/page/_move', { id, parent: t.top.id, index: 0 })
    expect(await order()).toEqual(['Autorova', 'První', 'Druhá'])
  })
})

describe('a write that reads the tree before it takes the lock', () => {
  const treeLock = `select pg_advisory_xact_lock(72011050, hashtext('page'))`
  /**
   * Holds a lock in a transaction of the test (by default the tree's own), starts `request` (which reads what it needs,
   * then waits for the lock), changes the database under it, and lets go.
   */
  async function whileLocked<T>(request: () => Promise<T>, change: string, params: unknown[], lock = treeLock): Promise<T> {
    const c = await db.connect()
    try {
      await c.query('begin')
      await c.query(lock)
      const pending = request()
      for (let i = 0; ; i++) {
        const { rows } = await c.query(`select count(*)::int as n from pg_locks where not granted`)
        if (rows[0].n > 0) break
        if (i > 200) throw new Error('the request never waited for the lock')
        await new Promise((r) => setTimeout(r, 25))
      }
      await c.query(change, params)
      await c.query('commit')
      return await pending
    }
    catch (err) {
      await c.query('rollback').catch(() => {})
      throw err
    }
    finally { c.release() }
  }

  async function pair() {
    const parent = await page('Rodič', 'rodic')
    await page('Dvojka', 'dvojka', parent.id)
    const lone = await page('Jedna', 'jedna')
    return { parent, lone }
  }

  it('a move uses the address part the page has under the lock, not the one it had when the request came', async () => {
    const t = await pair()
    // the page is renamed (a concurrent edit) to the part its new neighbour has, after the move read it
    const res = await whileLocked(() => admin.post('/api/cms/page/_move', { id: t.lone.id, parent: t.parent.id }), 'update page set slug = $1 where id = $2', ['dvojka', t.lone.id])
    expect(res.status).toBe(409)
    expect(res.body.data[0]).toMatchObject({ code: 'unique', address: '/rodic/dvojka' })
    expect((await db.query('select parent_id from page where id = $1', [t.lone.id])).rows[0].parent_id).toBeNull()
  })

  it('a new parent through the form uses the address part the page has under the lock', async () => {
    const t = await pair()
    const res = await whileLocked(() => admin.patch(`/api/cms/page/${t.lone.id}`, { parent: t.parent.id }), 'update page set slug = $1 where id = $2', ['dvojka', t.lone.id])
    expect(res.status).toBe(409)
    expect(res.body.data[0]).toMatchObject({ code: 'unique', address: '/rodic/dvojka' })
  })

  it('a rename through the form uses the parent the page has under the lock', async () => {
    const t = await pair()
    // the page is moved under the parent (a concurrent move) after the rename read it
    const res = await whileLocked(() => admin.patch(`/api/cms/page/${t.lone.id}`, { slug: 'dvojka' }), 'update page set parent_id = $1 where id = $2', [t.parent.id, t.lone.id])
    expect(res.status).toBe(409)
    expect(res.body.data[0]).toMatchObject({ code: 'unique', address: '/rodic/dvojka' })
  })

  it('a translation uses the parent the page has under the lock', async () => {
    const parent = await page('Rodič', 'rodic', null, { title: 'Parent', slug: 'parent' })
    await page('Tým', 'tym', parent.id, { title: 'Team', slug: 'team' })
    const lone = await page('Jedna', 'jedna')
    // the page itself is what is held here: the translation reads it, then waits to write to it
    const res = await whileLocked(
      () => admin.request('PATCH', `/api/cms/page/${lone.id}?locale=en`, { json: { title: 'One', slug: 'team' } }),
      'update page set parent_id = $1 where id = $2', [parent.id, lone.id],
      `select 1 from page where id = '${lone.id}' for update`,
    )
    expect(res.status).toBe(409)
    expect(res.body.data[0]).toMatchObject({ code: 'unique', locale: 'en', address: '/en/pages/parent/team' })
  })

  it('a translation takes the tree lock before it locks the page row (the order moves use: no deadlock)', async () => {
    const t = await pair()
    const c = await db.connect()
    try {
      await c.query('begin')
      await c.query(treeLock)
      const pending = admin.request('PATCH', `/api/cms/page/${t.lone.id}?locale=en`, { json: { title: 'One', slug: 'one' } })
      for (let i = 0; ; i++) {
        const { rows } = await c.query(`select count(*)::int as n from pg_locks where not granted`)
        if (rows[0].n > 0) break
        if (i > 200) throw new Error('the request never waited for the lock')
        await new Promise((r) => setTimeout(r, 25))
      }
      // The request waits on the tree lock and holds no row lock yet: the page row is free.
      const free = await db.query('select id from page where id = $1 for update nowait', [t.lone.id]).then(() => true, () => false)
      expect(free).toBe(true)
      await c.query('commit')
      expect((await pending).status).toBe(200)
    }
    finally { c.release() }
  })
})

describe('a page below a draft that sits deeper than the limit allows today', () => {
  // The limit was lowered after the page was made: it hangs at level 5 (the API refuses that now).
  async function deep() {
    const t = await site()
    const fourth = await page('Čtvrtá', 'ctvrta', t.lead.id)
    const fifth = await page('Pátá', 'pata', t.contact.id)
    await db.query('update page set parent_id = $1 where id = $2', [fourth.id, fifth.id])
    return { ...t, fourth, fifth }
  }
  const address = 'o-nas/tym/vedeni/ctvrta/pata'

  it('is served while every page above is live', async () => {
    const t = await deep()
    const res = await item(address)
    expect(res.status).toBe(200)
    expect(res.body.item.id).toBe(t.fifth.id)
    expect(res.body.item.breadcrumbs.map((b: any) => b.title)).toEqual(['O nás', 'Tým', 'Vedení', 'Čtvrtá', 'Pátá'])
  })

  it('is not served, listed, in the tree or in the sitemap once the top page is a draft, and its trail never names the draft', async () => {
    const t = await deep()
    expect((await admin.patch(`/api/cms/page/${t.about.id}`, { status: 'draft' })).status).toBe(200)
    expect((await item(address)).status).toBe(404)
    expect((await item(t.fifth.id)).status).toBe(404)
    expect((await visitor.get('/api/content/page?limit=50')).body.items.map((i: any) => i.slug)).toEqual(['kontakt'])
    expect((await visitor.get('/api/content/_tree/page')).body.items.map((n: any) => n.title)).toEqual(['Kontakt'])
    const sitemap = (await visitor.get('/api/content/_sitemap')).body.entries.map((e: any) => e.loc)
    expect(sitemap.filter((l: string) => l.startsWith('/o-nas'))).toEqual([])
    // the editor's preview still reads it, with the real trail
    const preview = await admin.get(`/api/content/page/${encodeURIComponent(address)}?preview`)
    expect(preview.status).toBe(200)
    expect(preview.body.item.breadcrumbs.map((b: any) => b.title)).toEqual(['O nás', 'Tým', 'Vedení', 'Čtvrtá', 'Pátá'])
    // published again, it is back
    await admin.patch(`/api/cms/page/${t.about.id}`, { status: 'published' })
    expect((await item(address)).status).toBe(200)
  })

  it('is not served when a page in the middle is a draft', async () => {
    const t = await deep()
    await admin.patch(`/api/cms/page/${t.team.id}`, { status: 'draft' })
    expect((await item(address)).status).toBe(404)
    expect((await item('o-nas/historie')).status).toBe(200)
  })
})

describe('pages a person may not read', () => {
  // The playground hides pages whose address starts with "interni" from authors (a row-level read rule).
  async function secret() {
    const mine = (await author.post('/api/cms/page', { title: 'Moje', slug: 'moje', sections: [] })).body.row
    const hidden = await page('Interní plán', 'interni', mine.id, null, { status: 'draft' })
    const open = await page('Veřejná', 'verejna', hidden.id)
    const top = await page('Otevřená', 'otevrena')
    return { mine, hidden, open, top }
  }

  it('control: the author really cannot read the internal page', async () => {
    const t = await secret()
    expect((await author.get(`/api/cms/page/${t.hidden.id}`)).status).toBe(404)
    expect((await author.get(`/api/cms/page/${t.open.id}`)).status).toBe(200)
  })

  it('keeps their titles out of the parent picker\'s trail', async () => {
    const t = await secret()
    const labels = async (who: Client) => (await who.get('/api/cms/page/options?q=' + encodeURIComponent('Veřejná'))).body.map((o: any) => o.label)
    expect(await labels(admin)).toEqual(['Moje / Interní plán / Veřejná'])
    expect(await labels(author)).toEqual(['Moje / … / Veřejná'])
    expect(t.open.id).toBeTruthy()
  })

  it('keeps their address parts out of the admin tree', async () => {
    const t = await secret()
    const rows = async (who: Client) => (await who.get('/api/cms/page/_tree')).body.rows as any[]
    expect((await rows(admin)).find((r) => r.id === t.open.id).paths).toEqual({ cs: '/moje/interni/verejna' })
    const seen = await rows(author)
    expect(seen.find((r) => r.id === t.open.id).paths).toEqual({})
    expect(seen.find((r) => r.id === t.top.id).paths).toEqual({ cs: '/otevrena' })
    expect(JSON.stringify(seen)).not.toContain('interni')
  })

  it('keeps their titles out of the refusal for a taken address', async () => {
    const t = await secret()
    // the hidden page sits under the author's "Moje"; a new page there with the same part takes its address
    const clash = { title: 'Můj plán', slug: 'interni', parent: t.mine.id, sections: [] }
    const asAdmin = await admin.post('/api/cms/page', clash)
    expect(asAdmin.status).toBe(409)
    expect(asAdmin.body.data[0].otherTitle).toBe('Interní plán')
    const asAuthor = await author.post('/api/cms/page', clash)
    expect(asAuthor.status).toBe(409)
    expect(asAuthor.body.data[0]).toMatchObject({ code: 'unique', address: '/moje/interni', otherTitle: '…' })
    expect(JSON.stringify(asAuthor.body)).not.toContain('Interní plán')
  })

  it('keeps their titles out of the refusal for a loop', async () => {
    const t = await secret()
    // moje → interní plán → veřejná → moje
    const asAdmin = await admin.post('/api/cms/page/_move', { id: t.mine.id, parent: t.open.id })
    expect(asAdmin.status).toBe(422)
    expect(asAdmin.body.data[0].loop).toEqual(['Moje', 'Interní plán', 'Veřejná', 'Moje'])
    const asAuthor = await author.post('/api/cms/page/_move', { id: t.mine.id, parent: t.open.id })
    expect(asAuthor.status).toBe(422)
    expect(asAuthor.body.data[0]).toMatchObject({ code: 'tree_cycle', loop: ['Moje', '…', 'Veřejná', 'Moje'] })
    expect(JSON.stringify(asAuthor.body)).not.toContain('Interní plán')
  })

  it('cannot be a new parent, as far as they can tell the page does not exist', async () => {
    const t = await secret()
    const draft = (await author.post('/api/cms/page', { title: 'Návrh', slug: 'navrh', sections: [] })).body.row
    expect((await author.post('/api/cms/page/_move', { id: draft.id, parent: t.hidden.id })).status).toBe(422)
    expect((await author.patch(`/api/cms/page/${draft.id}`, { parent: t.hidden.id })).status).toBe(422)
    expect((await author.post('/api/cms/page', { title: 'Nový', slug: 'novy', parent: t.hidden.id, sections: [] })).status).toBe(422)
    expect((await db.query('select parent_id from page where id = $1', [draft.id])).rows[0].parent_id).toBeNull()
    // a page they can read is fine
    expect((await author.post('/api/cms/page/_move', { id: draft.id, parent: t.top.id })).status).toBe(200)
    expect((await author.patch(`/api/cms/page/${draft.id}`, { parent: t.open.id })).status).toBe(200)
    // an editor reads everything
    expect((await editor.post('/api/cms/page/_move', { id: draft.id, parent: t.hidden.id })).status).toBe(200)
  })

  it('may stay where they are: a page under a parent they cannot read can still be edited', async () => {
    const t = await secret()
    const child = (await author.post('/api/cms/page', { title: 'Dítě', slug: 'dite', sections: [] })).body.row
    // put under the internal page by someone who may read it
    expect((await admin.post('/api/cms/page/_move', { id: child.id, parent: t.hidden.id })).status).toBe(200)
    // saving it again with the parent it has is not a new parent
    expect((await author.patch(`/api/cms/page/${child.id}`, { title: 'Dítě, upravené', parent: t.hidden.id })).status).toBe(200)
    expect((await author.patch(`/api/cms/page/${child.id}`, { title: 'Dítě, podruhé' })).status).toBe(200)
  })
})

describe('an address that a draft translates', () => {
  it('does not hide the live page that falls back to that address from visitors', async () => {
    // "Zde" is live and not translated: in English it is at /en/pages/about (its Czech part falls back).
    const live = await page('Zde', 'about')
    // a draft with the same English part
    const draft = await page('Jiná', 'jina', null, { title: 'Other', slug: 'about' }, { status: 'draft' })
    const res = await item('about', 'en')
    expect(res.status).toBe(200)
    expect(res.body.item).toMatchObject({ id: live.id, path: '/en/pages/about' })
    // an editor previewing meets the draft first (its own translated address)
    const preview = await admin.get('/api/content/page/about?locale=en&preview')
    expect(preview.status).toBe(200)
    expect(preview.body.item.id).toBe(draft.id)
  })
})

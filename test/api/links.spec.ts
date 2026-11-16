import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { buildRegistry, linkRef } from 'tinyzoo'
import * as config from '../../playground/cms.config'
import { convertLinks, formatConvertReport } from '../../packages/cms/cli/links-convert'
import { anonymous, type Client, hooksMark, signIn, testDb, truncateAll, waitForHooks } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'
import { envWithout, siteFolderWithEnvFile } from '../helpers/siteFolder'

// Links that follow their target: a page picked in the link picker is stored as
// `cms:<entity>/<id>`; visitors get its current address in their language (or nothing
// when it is gone, not published or not public), and a page cannot be deleted while
// something still links to it.
const db = testDb()
const reg = buildRegistry(config)
let admin: Client
beforeAll(async () => { admin = await signIn('admin') })
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

const link = (label: string, url: string, over: Record<string, unknown> = {}) => ({ id: label.toLowerCase().replace(/\W+/g, '-'), type: 'link', label, url, newTab: false, sub: false, ...over })
const para = (text: string, href?: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Viz ' }, { type: 'text', text, ...(href ? { marks: [{ type: 'link', attrs: { href } }] } : {}) }] }] })
const MISSING = 'cms:page/00000000-0000-4000-8000-00000000dead'

async function page(title: string, slug: string, over: Record<string, unknown> = {}) {
  const res = await admin.post('/api/cms/page', { title, slug, status: 'published', sections: [], ...over })
  if (res.status !== 201) throw new Error(`page: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body.row
}
const translatePage = (id: string, body: Record<string, unknown>) => admin.request('PATCH', `/api/cms/page/${id}?locale=en`, { json: body })
const saveMenu = (main: unknown[], locale?: string) => locale
  ? admin.request('PUT', `/api/cms/_singleton/navigation?locale=${locale}`, { json: { main } })
  : admin.put('/api/cms/_singleton/navigation', { main, footer: [] })
const menu = async (query = '', client: Client = anonymous()) => (await client.get(`/api/content/_global/navigation${query}`)).body.item
const urls = (item: any) => item.main.map((l: any) => l.url)

describe('a menu link to a page', () => {
  it('follows the page when it is renamed, in every language', async () => {
    const about = await page('O nás', 'o-nas')
    await translatePage(about.id, { title: 'About', slug: 'about' })
    const untranslated = await page('Kontakt', 'kontakt')
    const ref = linkRef('page', about.id)
    await saveMenu([link('O nás', ref), link('Kontakt', linkRef('page', untranslated.id)), link('Ven', 'https://example.com'), link('Mail', 'mailto:a@b.cz'), link('Zpět', '/stary-odkaz')])
    // The English menu is written separately, with its own links.
    await saveMenu([link('About', ref)], 'en')

    expect(urls(await menu())).toEqual(['/o-nas', '/kontakt', 'https://example.com', 'mailto:a@b.cz', '/stary-odkaz'])
    expect(urls(await menu('?locale=en'))).toEqual(['/en/pages/about'])

    // Renamed: the same links, the new addresses. (No menu was saved.)
    expect((await admin.patch(`/api/cms/page/${about.id}`, { slug: 'nas-tym' })).status).toBe(200)
    expect((await translatePage(about.id, { slug: 'our-team' })).status).toBe(200)
    expect(urls(await menu())).toEqual(['/nas-tym', '/kontakt', 'https://example.com', 'mailto:a@b.cz', '/stary-odkaz'])
    expect(urls(await menu('?locale=en'))).toEqual(['/en/pages/our-team'])
  })

  it('falls back like the website does: an untranslated page keeps its default address under the language prefix', async () => {
    const kontakt = await page('Kontakt', 'kontakt')
    await saveMenu([link('Kontakt', linkRef('page', kontakt.id))])
    // The menu has no English version: the Czech one is served, its link in English.
    expect(urls(await menu('?locale=en'))).toEqual(['/en/pages/kontakt'])
    // The same address the content API itself gives the page in that language.
    expect((await anonymous().get(`/api/content/page/kontakt?locale=en`)).body.item.paths).toEqual({ cs: '/kontakt' })
  })

  it('gives the other fields of a block and a list the same: buttons in blocks, links in lists', async () => {
    const target = await page('Rezervace', 'rezervace')
    const ref = linkRef('page', target.id)
    const home = await page('Domů', 'domu', { sections: [
      { id: 'h', type: 'hero', heading: 'Vítejte', buttonLabel: 'Rezervovat', buttonUrl: ref },
      { id: 'c', type: 'cta', text: 'Pojďte k nám', buttonLabel: 'Ano', buttonUrl: '/ven' },
    ] })
    const item = (await anonymous().get(`/api/content/page/${home.slug}`)).body.item
    expect(item.sections.map((s: any) => s.buttonUrl)).toEqual(['/rezervace', '/ven'])
    expect(JSON.stringify(item)).not.toContain('cms:')
    // The list endpoint resolves them too.
    const list = (await anonymous().get('/api/content/page')).body.items
    expect(JSON.stringify(list)).not.toContain('cms:')
  })

  it('keeps the stored reference for the admin, and refuses what is not a well-formed one', async () => {
    const about = await page('O nás', 'o-nas')
    const ref = linkRef('page', about.id)
    await saveMenu([link('O nás', ref)])
    expect((await admin.get('/api/cms/_singleton/navigation')).body.row.main[0].url).toBe(ref)
    expect((await saveMenu([link('X', 'cms:page/not-an-id')])).status).toBe(422)
    expect((await saveMenu([link('X', 'cms:')])).status).toBe(422)
    expect((await saveMenu([link('X', 'javascript:alert(1)')])).status).toBe(422)
    // An address field is not a link field.
    expect((await admin.post('/api/cms/redirect', { from: ref, to: '/x' })).status).toBe(422)
  })

  it('changes the answer, so a browser that cached the old one gets the new one (ETag)', async () => {
    const about = await page('O nás', 'o-nas')
    await saveMenu([link('O nás', linkRef('page', about.id))])
    const first = await anonymous().get('/api/content/_global/navigation')
    const etag = first.headers.get('etag')!
    expect(etag).toBeTruthy()
    expect((await anonymous().get('/api/content/_global/navigation', { 'if-none-match': etag })).status).toBe(304)
    await admin.patch(`/api/cms/page/${about.id}`, { slug: 'nas-tym' })
    const second = await anonymous().get('/api/content/_global/navigation', { 'if-none-match': etag })
    expect(second.status).toBe(200)
    expect(second.body.item.main[0].url).toBe('/nas-tym')
    expect(second.headers.get('etag')).not.toBe(etag)
  })
})

describe('a link whose target cannot be reached', () => {
  it('is null for visitors while the page is not published, and visible in the admin', async () => {
    const draft = await page('Chystáme', 'chystame', { status: 'draft' })
    const ref = linkRef('page', draft.id)
    await saveMenu([link('Chystáme', ref), link('Kontakt', '/kontakt')])
    expect(urls(await menu())).toEqual([null, '/kontakt'])
    expect(urls(await menu('', admin))).toEqual([null, '/kontakt']) // a signed-in editor is still a visitor of the public API…
    // …unless it is a preview
    expect(urls(await menu('?preview', admin))).toEqual(['/chystame', '/kontakt'])
    expect(urls(await menu('?preview'))).toEqual([null, '/kontakt']) // never for an anonymous visitor
    // The admin sees the stored link, and what it points to.
    expect((await admin.get('/api/cms/_singleton/navigation')).body.row.main[0].url).toBe(ref)
    const info = (await admin.post('/api/cms/_links/resolve', { refs: [ref], locale: null })).body.items[ref]
    expect(info).toEqual({ entity: 'page', id: draft.id, title: 'Chystáme', path: '/chystame', state: 'draft' })
    // Published, it follows at once.
    await admin.patch(`/api/cms/page/${draft.id}`, { status: 'published' })
    expect(urls(await menu())).toEqual(['/chystame', '/kontakt'])
    expect((await admin.post('/api/cms/_links/resolve', { refs: [ref] })).body.items[ref].state).toBe('live')
  })

  it('is null when the page is scheduled for later, or the entry is not of a collection with addresses', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    const author = await createAuthor(admin)
    const soon = await createPost(admin, { author: author.id, status: 'published', publishedAt: future })
    await saveMenu([link('Později', linkRef('post', soon.id)), link('Autor', linkRef('author', author.id)), link('Nic', 'cms:nothing/00000000-0000-4000-8000-00000000dead'), link('Pryč', MISSING)])
    expect(urls(await menu())).toEqual([null, null, null, null])
    const refs = [linkRef('post', soon.id), linkRef('author', author.id), MISSING]
    const info = (await admin.post('/api/cms/_links/resolve', { refs, locale: null })).body.items
    expect(info[linkRef('post', soon.id)].state).toBe('draft') // not live yet
    expect(info[linkRef('author', author.id)]).toMatchObject({ state: 'missing', path: null }) // authors have no address
    expect(info[MISSING]).toMatchObject({ state: 'missing', title: '', path: null })
  })

  it('takes the link off rich text and keeps the words', async () => {
    const draft = await page('Chystáme', 'chystame', { status: 'draft' })
    const live = await page('Kontakt', 'kontakt')
    const author = await createAuthor(admin)
    const body = { type: 'doc', content: [
      ...para('Chystáme', linkRef('page', draft.id)).content,
      ...para('Kontakt', linkRef('page', live.id)).content,
      ...para('Pryč', MISSING).content,
      ...para('Venku', 'https://example.com').content,
    ] }
    const post = await createPost(admin, { author: author.id, status: 'published', body })
    const item = (await anonymous().get(`/api/content/post/${post.slug}`)).body.item
    const marks = (item.body.content as any[]).map((p) => p.content[1].marks?.map((m: any) => m.attrs.href) ?? null)
    expect(marks).toEqual([null, ['/kontakt'], null, ['https://example.com']])
    expect((item.body.content as any[]).map((p) => p.content[1].text)).toEqual(['Chystáme', 'Kontakt', 'Pryč', 'Venku'])
    expect(JSON.stringify(item)).not.toContain('cms:')
    // The admin keeps what the editor picked.
    expect(JSON.stringify((await admin.get(`/api/cms/post/${post.id}`)).body.row.body)).toContain(linkRef('page', draft.id))
  })

  it('never lets a cms: through, however it got into the database', async () => {
    const live = await page('Kontakt', 'kontakt')
    await saveMenu([link('A', linkRef('page', live.id))])
    // A value no validation would take (written around the API) is dropped, not served.
    await db.query(`update navigation set main = replace(main::text, $1, 'cms:garbage')::jsonb`, [linkRef('page', live.id)])
    expect(urls(await menu())).toEqual([null])
  })
})

describe('rich text and links elsewhere on a page', () => {
  it('resolves links in rich text inside blocks and in targets populated into an entry', async () => {
    const live = await page('Kontakt', 'kontakt')
    const ref = linkRef('page', live.id)
    const about = await page('O nás', 'o-nas', { sections: [{ id: 't', type: 'text', heading: 'Text', body: para('napište nám', ref) }] })
    const item = (await anonymous().get(`/api/content/page/${about.slug}`)).body.item
    expect(item.sections[0].body.content[0].content[1].marks[0].attrs.href).toBe('/kontakt')

    // An author's bio comes embedded in a post: its links are resolved there too.
    const author = await createAuthor(admin, { bio: para('kontakt', ref) })
    const post = await createPost(admin, { author: author.id, status: 'published' })
    const embedded = (await anonymous().get(`/api/content/post/${post.slug}`)).body.item.author
    expect(embedded.bio.content[0].content[1].marks[0].attrs.href).toBe('/kontakt')
  })

  it('shows links by their text in the search index, never as references', async () => {
    const live = await page('Kontakt', 'kontakt')
    const author = await createAuthor(admin)
    const post = await createPost(admin, { author: author.id, status: 'published', body: para('rezervační formulář', linkRef('page', live.id)) })
    const found = (await anonymous().get('/api/content/_search?q=rezerva%C4%8Dn%C3%AD')).body.items
    expect(found.map((i: any) => i.id)).toEqual([post.id])
    expect(JSON.stringify(found)).not.toContain('cms:')
    expect((await anonymous().get('/api/content/_search?q=cms')).body.total).toBe(0)
  })
})

describe('a redirect to a page', () => {
  const raw = (path: string) => fetch(anonymous().baseURL + path, { redirect: 'manual' })
  it('follows the page, and sends nobody anywhere once the page is not published', async () => {
    const target = await page('Nová', 'nova')
    expect((await admin.post('/api/cms/redirect', { from: '/stara', to: linkRef('page', target.id) })).status).toBe(201)
    expect((await raw('/stara')).headers.get('location')).toBe('/nova')
    await admin.patch(`/api/cms/page/${target.id}`, { slug: 'novejsi' })
    expect((await raw('/stara')).headers.get('location')).toBe('/novejsi') // (refreshed on a change on this instance)
    await admin.patch(`/api/cms/page/${target.id}`, { status: 'draft' })
    expect((await raw('/stara')).status).not.toBe(301)
  })

  it('is refused when it would lead back to its own address', async () => {
    const target = await page('Nová', 'nova')
    const res = await admin.post('/api/cms/redirect', { from: '/nova', to: linkRef('page', target.id) })
    expect(res.status).toBe(422)
    expect(res.body.data[0].code).toBe('redirect_loop')
  })

  const redirectRows = async () => (await db.query('select "from", "to" from redirect order by "from"')).rows.map((r) => [r.from, r.to])

  it('does not loop when the page takes over the redirect’s own address: the redirect goes, and a leftover one is skipped', async () => {
    // A live page renamed to the old address (a move leaves redirects of its own: the one from there goes).
    const kontakt = await page('Kontakt', 'kontakt')
    expect((await admin.post('/api/cms/redirect', { from: '/stara-adresa', to: linkRef('page', kontakt.id) })).status).toBe(201)
    expect((await raw('/stara-adresa')).headers.get('location')).toBe('/kontakt')
    expect((await admin.patch(`/api/cms/page/${kontakt.id}`, { slug: 'stara-adresa' })).status).toBe(200)
    expect((await redirectRows()).filter(([from]) => from === '/stara-adresa')).toEqual([])
    expect((await raw('/stara-adresa')).headers.get('location')).toBeNull()

    // A draft renamed to the old address, then published: nothing moved while it was live, so only the cleanup on publish removes it.
    const cenik = await page('Ceník', 'cenik', { status: 'draft' })
    expect((await admin.post('/api/cms/redirect', { from: '/stary-cenik', to: linkRef('page', cenik.id) })).status).toBe(201)
    expect((await admin.patch(`/api/cms/page/${cenik.id}`, { slug: 'stary-cenik' })).status).toBe(200)
    expect((await admin.patch(`/api/cms/page/${cenik.id}`, { status: 'published' })).status).toBe(200)
    expect((await redirectRows()).filter(([from]) => from === '/stary-cenik')).toEqual([])
    expect((await raw('/stary-cenik')).headers.get('location')).toBeNull()

    // A redirect that is still there (written behind the API's back) must not send visitors round and round either.
    await db.query(`insert into redirect ("from", "to", permanent) values ('/stary-cenik', $1, true)`, [linkRef('page', cenik.id)])
    expect((await admin.post('/api/cms/redirect', { from: '/jina', to: '/nekam' })).status).toBe(201) // (a change: the cache is read again)
    const again = await raw('/stary-cenik')
    expect(again.status).not.toBe(301)
    expect(again.headers.get('location')).toBeNull()
  })

  it('goes when any entry goes live at its address: a post published, a page translated', async () => {
    const author = await createAuthor(admin)
    await admin.post('/api/cms/redirect', { from: '/blog/novinka', to: '/blog/jina' })
    await admin.post('/api/cms/redirect', { from: '/blog/nic', to: '/blog/jina' })
    const post = await createPost(admin, { author: author.id, status: 'draft', slug: 'novinka' })
    expect(await redirectRows()).toEqual([['/blog/nic', '/blog/jina'], ['/blog/novinka', '/blog/jina']]) // a draft hides nothing
    expect((await admin.patch(`/api/cms/post/${post.id}`, { status: 'published' })).status).toBe(200)
    expect(await redirectRows()).toEqual([['/blog/nic', '/blog/jina']])
    expect((await raw('/blog/novinka')).status).not.toBe(301)

    const about = await page('O nás', 'o-nas')
    await admin.post('/api/cms/redirect', { from: '/en/pages/about', to: '/ven' })
    expect((await translatePage(about.id, { title: 'About', slug: 'about' })).status).toBe(200)
    expect(await redirectRows()).toEqual([['/blog/nic', '/blog/jina']])
  })

  it('leads to the page in the language of the old address', async () => {
    const about = await page('O nás', 'o-nas')
    await translatePage(about.id, { title: 'About', slug: 'about' })
    const ref = linkRef('page', about.id)
    await admin.post('/api/cms/redirect', { from: '/stary', to: ref })
    await admin.post('/api/cms/redirect', { from: '/en/old', to: ref })
    expect((await raw('/stary')).headers.get('location')).toBe('/o-nas')
    expect((await raw('/en/old')).headers.get('location')).toBe('/en/pages/about')
  })

  it('is judged for loops in the language of its old address too', async () => {
    const about = await page('O nás', 'o-nas')
    await translatePage(about.id, { title: 'About', slug: 'about' })
    // The English page is at /en/pages/about: an English old address of the same name would lead back to itself.
    const res = await admin.post('/api/cms/redirect', { from: '/en/pages/about', to: linkRef('page', about.id) })
    expect(res.status).toBe(422)
    expect(res.body.data[0].code).toBe('redirect_loop')
    // …while the Czech address of the same page is no loop for it.
    expect((await admin.post('/api/cms/redirect', { from: '/en/pages/stary', to: linkRef('page', about.id) })).status).toBe(201)
  })
})

describe('deleting something that is linked to', () => {
  it('is refused, naming what links to it, until the links are gone', async () => {
    const about = await page('O nás', 'o-nas')
    const ref = linkRef('page', about.id)
    await saveMenu([link('O nás', ref)])
    const refused = await admin.delete(`/api/cms/page/${about.id}`)
    expect(refused.status).toBe(409)
    expect(refused.body.data).toMatchObject({ code: 'in_use', usedBy: [{ entity: 'navigation', singleton: true, via: 'link', locale: null }] })
    expect((await admin.get(`/api/cms/page/${about.id}`)).status).toBe(200)

    await saveMenu([link('O nás', '/o-nas')]) // an address again: nothing follows
    expect((await admin.delete(`/api/cms/page/${about.id}`)).status).toBe(200)
  })

  it('counts links in entries, in blocks, in rich text and in translations, and says which entry', async () => {
    const target = await page('Cíl', 'cil')
    const ref = linkRef('page', target.id)
    const author = await createAuthor(admin)
    const post = await createPost(admin, { author: author.id, title: 'Článek s odkazem', body: para('cíl', ref) })
    const refused = async () => (await admin.delete(`/api/cms/page/${target.id}`)).body.data.usedBy
    expect(await refused()).toEqual([expect.objectContaining({ entity: 'post', id: post.id, title: 'Článek s odkazem', via: 'link' })])

    await admin.patch(`/api/cms/post/${post.id}`, { body: para('cíl') }) // the link is gone from the post…
    const home = await page('Domů', 'domu', { sections: [{ id: 'h', type: 'hero', heading: 'Hej', buttonUrl: ref }] }) // …now a block button holds one
    expect(await refused()).toEqual([expect.objectContaining({ entity: 'page', id: home.id })])

    await admin.patch(`/api/cms/page/${home.id}`, { sections: [] })
    await saveMenu([link('Cíl', '/cil')])
    await saveMenu([link('Target', ref)], 'en') // only the English menu holds it
    expect(await refused()).toEqual([expect.objectContaining({ entity: 'navigation', singleton: true, locale: 'en' })])

    await saveMenu([link('Target', '/en/pages/cil')], 'en')
    expect((await admin.delete(`/api/cms/page/${target.id}`)).status).toBe(200)
  })

  it('is not stopped by an entry linking to itself, and links to other entries do not count', async () => {
    const me = await page('Já', 'ja')
    await admin.patch(`/api/cms/page/${me.id}`, { sections: [{ id: 'h', type: 'hero', heading: 'Hej', buttonUrl: linkRef('page', me.id) }] })
    const other = await page('Druhá', 'druha', { sections: [{ id: 'h', type: 'hero', heading: 'Hej', buttonUrl: linkRef('page', me.id) }] })
    expect((await admin.delete(`/api/cms/page/${me.id}`)).status).toBe(409) // the other page links to it
    expect((await admin.delete(`/api/cms/page/${other.id}`)).status).toBe(200)
    expect((await admin.delete(`/api/cms/page/${me.id}`)).status).toBe(200) // only itself is left
  })

  it('does not count a translation being deleted (the entry stays, the links keep working)', async () => {
    const about = await page('O nás', 'o-nas')
    await translatePage(about.id, { title: 'About', slug: 'about' })
    await saveMenu([link('O nás', linkRef('page', about.id))])
    expect((await admin.request('DELETE', `/api/cms/page/${about.id}?locale=en`)).status).toBe(200)
    expect(urls(await menu('?locale=en'))).toEqual(['/en/pages/o-nas']) // back to the default language's address
  })
})

describe('what a reader may not see', () => {
  const draftPost = async (title: string) => createPost(admin, { author: (await createAuthor(admin)).id, status: 'draft', title, slug: title.toLowerCase().replace(/\W+/g, '-') })

  it('does not tell a draft the person may not read from one that does not exist', async () => {
    const secret = await draftPost('Interní koncept') // authors may not read posts titled "Interní…" (playground rule)
    const author = await signIn('author')
    const ask = async (client: Client, id: string) => (await client.post('/api/cms/_links/resolve', { refs: [linkRef('post', id)] })).body.items[linkRef('post', id)]
    const unreadable = await ask(author, secret.id)
    const absent = await ask(author, '00000000-0000-4000-8000-00000000dead')
    expect(unreadable).toEqual({ entity: 'post', id: secret.id, title: '', path: null, state: 'missing' })
    expect(absent).toEqual({ entity: 'post', id: '00000000-0000-4000-8000-00000000dead', title: '', path: null, state: 'missing' })
    // Whoever may read it sees it.
    expect(await ask(admin, secret.id)).toMatchObject({ title: 'Interní koncept', state: 'draft' })
  })

  it('names, when a delete is refused, only the entries the person may read, and counts the rest', async () => {
    const author = await signIn('author')
    const mine = (await author.post('/api/cms/page', { title: 'Moje stránka', slug: 'moje', status: 'draft', sections: [] })).body.row
    const secret = await draftPost('Interní koncept')
    await admin.patch(`/api/cms/post/${secret.id}`, { body: para('moje', linkRef('page', mine.id)) })
    await saveMenu([link('Moje', linkRef('page', mine.id))]) // a menu: the author may read it

    const refused = await author.delete(`/api/cms/page/${mine.id}`)
    expect(refused.status).toBe(409)
    expect(refused.body.data.code).toBe('in_use')
    expect(refused.body.data.usedBy).toEqual([expect.objectContaining({ entity: 'navigation', singleton: true })])
    expect(refused.body.data.hidden).toBe(1)
    expect(JSON.stringify(refused.body)).not.toContain('Interní koncept')
    // Someone who may read everything is told everything.
    const adminRefused = await admin.delete(`/api/cms/page/${mine.id}`)
    expect(adminRefused.body.data.usedBy).toEqual(expect.arrayContaining([expect.objectContaining({ entity: 'post', title: 'Interní koncept' })]))
    expect(adminRefused.body.data.hidden).toBeUndefined()
  })
})

describe('a preview and the previewer’s access', () => {
  it('resolves a link to a draft only for someone who may read it', async () => {
    const author = await signIn('author')
    const writer = (await createAuthor(admin)).id
    const secret = await createPost(admin, { author: writer, status: 'draft', title: 'Interní plán', slug: 'interni-plan' }) // authors may not read it
    const open = await createPost(admin, { author: writer, status: 'draft', title: 'Koncept', slug: 'koncept' })
    const live = await createPost(admin, { author: writer, status: 'published', title: 'Zveřejněné', slug: 'zverejnene' })
    const home = await page('Domů', 'domu', { sections: [
      { id: 'a', type: 'hero', heading: 'Interní', buttonUrl: linkRef('post', secret.id) },
      { id: 'b', type: 'hero', heading: 'Koncept', buttonUrl: linkRef('post', open.id) },
      { id: 'c', type: 'hero', heading: 'Živé', buttonUrl: linkRef('post', live.id) },
    ] })
    const buttons = async (client: Client, query = '') => (await client.get(`/api/content/page/${home.slug}${query}`)).body.item.sections.map((s: any) => s.buttonUrl)

    expect(await buttons(admin, '?preview')).toEqual(['/blog/interni-plan', '/blog/koncept', '/blog/zverejnene']) // may read every draft
    expect(await buttons(author, '?preview')).toEqual([null, '/blog/koncept', '/blog/zverejnene']) // not the internal one
    expect(await buttons(anonymous())).toEqual([null, null, '/blog/zverejnene']) // visitors: only what is live
  })
})

describe('the link picker', () => {
  it('offers pages with the reference to store, and resolves what is stored in the language being edited', async () => {
    const about = await page('O nás', 'o-nas')
    await translatePage(about.id, { title: 'About', slug: 'about' })
    const found = (await admin.get('/api/cms/_links?q=nas')).body.items
    expect(found).toEqual([{ entity: 'page', id: about.id, ref: linkRef('page', about.id), title: 'O nás', path: '/o-nas', published: true }])
    const ref = linkRef('page', about.id)
    expect((await admin.post('/api/cms/_links/resolve', { refs: [ref], locale: 'en' })).body.items[ref]).toEqual({ entity: 'page', id: about.id, title: 'About', path: '/en/pages/about', state: 'live' })
    expect((await admin.post('/api/cms/_links/resolve', { refs: [ref], locale: 'cs' })).body.items[ref]).toMatchObject({ title: 'O nás', path: '/o-nas' })
    // Only signed-in people; only well-formed references are looked up.
    expect((await anonymous().post('/api/cms/_links/resolve', { refs: [ref] })).status).toBe(401)
    expect((await admin.post('/api/cms/_links/resolve', { refs: ['cms:x', '/o-nas', 3, null] })).body.items).toEqual({})
  })

  it('answers authors too: they may read every entry', async () => {
    const about = await page('O nás', 'o-nas')
    const ref = linkRef('page', about.id)
    const author = await signIn('author')
    // Authors may read everything: they see the page.
    expect((await author.post('/api/cms/_links/resolve', { refs: [ref] })).body.items[ref]).toMatchObject({ state: 'live', title: 'O nás' })
  })
})

describe('what a site should purge', () => {
  it('names the pages that link to a page whose address changed, and the menus', async () => {
    const target = await page('Cíl', 'cil')
    const ref = linkRef('page', target.id)
    const linking = await page('Odkazuje', 'odkazuje', { sections: [{ id: 'h', type: 'hero', heading: 'Hej', buttonUrl: ref }] })
    await page('Nic', 'nic')
    await saveMenu([link('Cíl', ref)])
    const mark = hooksMark()
    expect((await admin.patch(`/api/cms/page/${target.id}`, { slug: 'novy-cil' })).status).toBe(200)
    const hooks = await waitForHooks(mark, (h) => h.some((x) => x.json.entity === 'page' && x.json.id === target.id))
    const change = hooks.find((x) => x.json.id === target.id)!.json
    expect(change.paths.sort()).toEqual(['/cil', '/novy-cil', '/odkazuje'].sort())
    expect(change.globals).toEqual(['navigation'])
    expect(linking.id).toBeTruthy()
  })

  it('names what links to the pages below a page that was renamed, moved or unpublished', async () => {
    const about = await page('O nás', 'o-nas')
    const team = await page('Tým', 'tym', { parent: about.id })
    const linking = await page('Odkazuje', 'odkazuje', { sections: [{ id: 'h', type: 'hero', heading: 'Hej', buttonUrl: linkRef('page', team.id) }] })
    await saveMenu([link('Tým', linkRef('page', team.id))]) // only the subpage is linked: nothing links to "about" itself
    const changeOf = async (id: string, act: () => Promise<unknown>) => {
      const mark = hooksMark()
      await act()
      return (await waitForHooks(mark, (h) => h.some((x) => x.json.id === id))).find((x) => x.json.id === id)!.json
    }

    const renamed = await changeOf(about.id, () => admin.patch(`/api/cms/page/${about.id}`, { slug: 'nas' }))
    expect(renamed.globals).toEqual(['navigation'])
    expect(renamed.paths).toEqual(expect.arrayContaining(['/o-nas/tym', '/nas/tym', '/odkazuje']))

    const unpublished = await changeOf(about.id, () => admin.patch(`/api/cms/page/${about.id}`, { status: 'draft' }))
    expect(unpublished.globals).toEqual(['navigation'])
    expect(unpublished.paths).toEqual(expect.arrayContaining(['/nas/tym', '/odkazuje']))
    expect(linking.id).toBeTruthy()
  })

  it('adds nothing when the address did not change', async () => {
    const target = await page('Cíl', 'cil')
    await saveMenu([link('Cíl', linkRef('page', target.id))])
    const mark = hooksMark()
    await admin.patch(`/api/cms/page/${target.id}`, { title: 'Nový nadpis' })
    const hooks = await waitForHooks(mark, (h) => h.some((x) => x.json.id === target.id))
    const change = hooks.find((x) => x.json.id === target.id)!.json
    expect(change.paths).toEqual(['/cil'])
    expect(change.globals).toBeUndefined()
  })
})

describe('tinyzoo links:convert', () => {
  const orm = () => drizzle(db as any, { schema: reg.schema })
  const navRow = async () => (await db.query('select main from navigation')).rows[0].main as any[]

  async function arrange() {
    const about = await page('O nás', 'o-nas', { sections: [{ id: 'h', type: 'hero', heading: 'Hej', buttonUrl: '/kontakt' }] })
    await translatePage(about.id, { title: 'About', slug: 'about' })
    const kontakt = await page('Kontakt', 'kontakt')
    const author = await createAuthor(admin)
    const post = await createPost(admin, { author: author.id, status: 'published', slug: 'novinka', body: para('o nás', '/o-nas') })
    await saveMenu([link('O nás', '/o-nas'), link('Kontakt', '/kontakt/'), link('Novinka', '/blog/novinka'), link('Ven', 'https://example.com'), link('Chybí', '/neni'), link('Kotva', '/o-nas#tym'), link('Mail', 'mailto:a@b.cz')])
    await saveMenu([link('About', '/en/pages/about'), link('Home', '/')], 'en')
    return { about, kontakt, post }
  }

  it('turns an address that matches exactly one entry into a reference, and reports the rest', async () => {
    const { about, kontakt, post } = await arrange()
    const before = (await db.query('select updated_at from page where id = $1', [about.id])).rows[0].updated_at

    const dry = await convertLinks(orm(), reg, { dryRun: true })
    expect(dry.linksConverted).toBe(6) // 3 menu links, the page's button, the post's text link, 1 English menu link
    expect((await navRow())[0].url).toBe('/o-nas') // nothing written
    expect(formatConvertReport(dry).join('\n')).toMatch(/dry run: nothing was written/)

    const report = await convertLinks(orm(), reg, { batchSize: 1 })
    expect(report.linksConverted).toBe(dry.linksConverted)
    expect(report.unmatched.map((u) => [u.value, u.reason])).toEqual([['/neni', 'no-page'], ['/', 'no-page'], ['/o-nas#tym', 'anchor-or-query']].sort((a, b) => (a[1]! as string).localeCompare(b[1]! as string) || (a[0]! as string).localeCompare(b[0]! as string)))
    const main = await navRow()
    expect(main.map((l) => l.url)).toEqual([linkRef('page', about.id), linkRef('page', kontakt.id), linkRef('post', post.id), 'https://example.com', '/neni', '/o-nas#tym', 'mailto:a@b.cz'])
    const en = (await db.query('select main from navigation_locales')).rows[0].main as any[]
    expect(en.map((l) => l.url)).toEqual([linkRef('page', about.id), '/'])
    // The page's block button and the post's rich text link too.
    expect((await db.query('select sections from page where id = $1', [about.id])).rows[0].sections[0].buttonUrl).toBe(linkRef('page', kontakt.id))
    const postBody = (await db.query('select body from post where id = $1', [post.id])).rows[0].body
    expect(postBody.content[0].content[1].marks[0].attrs.href).toBe(linkRef('page', about.id))
    // Not an edit: nothing about the entries' versions moved.
    expect((await db.query('select updated_at from page where id = $1', [about.id])).rows[0].updated_at).toEqual(before)

    // Visitors get the same addresses as before.
    expect(urls(await menu())).toEqual(['/o-nas', '/kontakt', '/blog/novinka', 'https://example.com', '/neni', '/o-nas#tym', 'mailto:a@b.cz'])
    expect(urls(await menu('?locale=en'))).toEqual(['/en/pages/about', '/'])
    // And a second run has nothing left to do.
    const again = await convertLinks(orm(), reg)
    expect(again.linksConverted).toBe(0)
    expect(formatConvertReport(again).join('\n')).toContain('nothing to convert')
  })

  it('converts only what is served in the same language, and only for published entries; reports the rest', async () => {
    const uvod = await page('Úvod', 'uvod')
    await translatePage(uvod.id, { title: 'Home', slug: 'home' })
    const draft = await page('Rozpracovaná', 'rozpracovana', { status: 'draft' })
    await saveMenu([link('English', '/en/pages/home'), link('Úvod', '/uvod'), link('Koncept', '/rozpracovana')])
    await saveMenu([link('Home', '/en/pages/home'), link('Úvod', '/uvod')], 'en')
    const served = { cs: urls(await menu()), en: urls(await menu('?locale=en')) }
    expect(served).toEqual({ cs: ['/en/pages/home', '/uvod', '/rozpracovana'], en: ['/en/pages/home', '/uvod'] })

    const report = await convertLinks(orm(), reg)
    // Only the Czech menu's /uvod and the English menu's /en/pages/home are the address of a published entry in their own language.
    expect(report.linksConverted).toBe(2)
    expect((await navRow()).map((l) => l.url)).toEqual(['/en/pages/home', linkRef('page', uvod.id), '/rozpracovana'])
    expect(((await db.query('select main from navigation_locales')).rows[0].main as any[]).map((l) => l.url)).toEqual([linkRef('page', uvod.id), '/uvod'])
    expect(report.unmatched.map((u) => [u.value, u.reason]).sort()).toEqual([['/en/pages/home', 'other-language'], ['/rozpracovana', 'draft'], ['/uvod', 'other-language']])
    expect(report.unmatched.find((u) => u.reason === 'draft')!.candidates).toEqual([linkRef('page', draft.id)])
    const text = formatConvertReport(report).join('\n')
    expect(text).toMatch(/\/rozpracovana — the entry is not published/)
    expect(text).toMatch(/\/uvod — this is an entry’s address in another language/)

    // What visitors get did not change, in either language (the draft's typed address is still served as typed).
    expect({ cs: urls(await menu()), en: urls(await menu('?locale=en')) }).toEqual(served)
  })

  it('leaves an address two entries share', async () => {
    // `a` has no English version, so it is served at /en/pages/a (its own address, in English);
    // `b` is translated to the slug "a": the same address.
    await page('Stejná', 'a')
    const b = await page('Druhá', 'b')
    await translatePage(b.id, { slug: 'a', title: 'A' })
    await saveMenu([])
    await saveMenu([link('Shared', '/en/pages/a')], 'en') // an English menu: served in the language both addresses are in
    const report = await convertLinks(orm(), reg)
    const shared = report.unmatched.find((u) => u.value === '/en/pages/a')
    expect(shared).toMatchObject({ reason: 'several-pages', count: 1 })
    expect(shared!.candidates).toHaveLength(2)
    expect(((await db.query('select main from navigation_locales')).rows[0].main as any[])[0].url).toBe('/en/pages/a') // left as it was
    expect(formatConvertReport(report).join('\n')).toMatch(/more than one entry has this address/)
  })

  it('runs as a command (dry run) against DATABASE_URL, from the site’s folder', async () => {
    await arrange()
    const out = execFileSync('pnpm', ['exec', 'tsx', join(import.meta.dirname, '../../packages/cms/cli/index.ts'), 'links:convert', '--dry-run'], {
      cwd: join(import.meta.dirname, '../../playground'),
      env: { ...process.env, DATABASE_URL: inject('databaseUrl') },
      encoding: 'utf8',
    })
    expect(out).toMatch(/navigation\.main\s+entries\s+3 links would be converted/)
    expect(out).toMatch(/\/neni — no entry has this address/)
    expect(out).toMatch(/dry run: nothing was written/)
    expect((await navRow())[0].url).toBe('/o-nas')
  })

  it('finds DATABASE_URL in the site\'s .env, as `tinyzoo up` does', async () => {
    await arrange()
    const site = siteFolderWithEnvFile(inject('databaseUrl'))
    try {
      const out = execFileSync(join(import.meta.dirname, '../../playground/node_modules/.bin/tsx'), [join(import.meta.dirname, '../../packages/cms/cli/index.ts'), 'links:convert', '--dry-run'], {
        cwd: site.dir, env: envWithout(), encoding: 'utf8',
      })
      expect(out).toMatch(/navigation\.main\s+entries\s+3 links would be converted/)
    }
    finally { site.remove() }
  })
})

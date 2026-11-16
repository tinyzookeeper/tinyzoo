import { describe, expect, it } from 'vitest'
import { cmsMenuTree } from '@tinyzoo/client'
import {
  buildContentModel, defineBlock, definePages, f, holdsLinks, isLinkRef, isSafeLink, linkRef, linkRefsOf, looksLikeLinkRef, mapDocLinks, mapRowLinks,
  parseLinkRef, richTextSchema, sanitizeRichText, entryTexts, type LinkFieldLike,
} from 'tinyzoo'
import { richTextExtensions } from '../../packages/cms/shared/richtext-editor'
import { normalizeAddress } from '../../packages/cms/cli/links-convert'
import { cmsDeleteFailure } from '../../packages/cms/app/utils/cmsIssues'
import en from '../../packages/cms/app/i18n/en'
import cs from '../../packages/cms/app/i18n/cs'
import * as config from '../../playground/cms.config'

const ID = '2f6c9f7e-1111-4222-8333-444455556666'
const ID2 = '9a8b7c6d-1111-4222-8333-444455556666'
const REF = `cms:page/${ID}`
const REF2 = `cms:post/${ID2}`

describe('link references', () => {
  it('are cms:<entity>/<id>, parsed and built', () => {
    expect(parseLinkRef(REF)).toEqual({ entity: 'page', id: ID })
    expect(parseLinkRef(`cms:blog_post/${ID.toUpperCase()}`)).toEqual({ entity: 'blog_post', id: ID }) // the id in lower case
    expect(linkRef('page', ID.toUpperCase())).toBe(REF)
    expect(isLinkRef(REF)).toBe(true)
  })

  it('are strict: nothing else passes for one', () => {
    for (const bad of ['cms:page', 'cms:page/', 'cms:page/not-a-uuid', `cms:/${ID}`, `cms:1page/${ID}`, `cms:page/${ID}/x`, `cms:page/${ID}#a`, ` cms:page/${ID}`, `cms:page/${ID} `, `CMS:page/${ID}x`, 'cms:', '', null, undefined, 3]) {
      expect(isLinkRef(bad), String(bad)).toBe(false)
    }
    expect(looksLikeLinkRef('cms:whatever')).toBe(true)
    expect(looksLikeLinkRef('CMS:page/x')).toBe(true)
    expect(looksLikeLinkRef('/cms:page')).toBe(false)
  })

  it('are accepted by isSafeLink and link fields — and only well-formed ones', () => {
    expect(isSafeLink(REF)).toBe(true)
    for (const ok of ['/kontakt', 'https://example.com', 'mailto:a@b.cz', 'tel:+420123456789', '#top']) expect(isSafeLink(ok), ok).toBe(true)
    for (const bad of ['cms:page', 'cms:page/not-a-uuid', 'cms:page/x y', 'javascript:alert(1)', 'data:text/html,x', 'cms://page/x', '']) expect(isSafeLink(bad), bad).toBe(false)
    const link = f.text({ format: 'link' }).zod('create')
    expect(link.safeParse(REF).success).toBe(true)
    expect(link.safeParse('cms:page/nope').success).toBe(false)
    // an address field is not a link: a reference is not an address
    expect(f.text({ format: 'path' }).zod('create').safeParse(REF).success).toBe(false)
    expect(f.text({ format: 'url' }).zod('create').safeParse(REF).success).toBe(false)
  })

  it('stay in rich text links when well-formed, and are dropped (text kept) when not', () => {
    const para = (...marks: any[]) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Kontakt', marks }] }] })
    const kept = richTextSchema.parse(para({ type: 'link', attrs: { href: REF } }))
    expect((kept as any).content[0].content[0].marks).toEqual([{ type: 'link', attrs: { href: REF } }])
    for (const href of ['cms:page/nope', 'cms:', 'javascript:alert(1)']) {
      const out = sanitizeRichText(para({ type: 'link', attrs: { href } }) as any)
      expect((out as any).content[0].content[0].marks, href).toEqual([])
      expect((out as any).content[0].content[0].text).toBe('Kontakt')
    }
  })

  it('are an allowed scheme in the editor (the link extension would refuse the href otherwise)', () => {
    const link = richTextExtensions().find((x) => x.name === 'link')!
    expect((link.options as any).protocols).toContainEqual({ scheme: 'cms', optionalSlashes: true })
  })
})

// A model with a link at every depth: a field, a list, a block, a group, rich text.
const hours = f.list({ fields: { label: f.text(), url: f.text({ format: 'link' }) } })
const card = defineBlock({
  label: 'Card',
  fields: { title: f.text(), url: f.text({ format: 'link' }).optional(), body: f.richtext().optional(), more: hours },
})
const fields: Record<string, LinkFieldLike> = {
  title: f.text() as any,
  home: f.text({ format: 'link' }) as any,
  address: f.text({ format: 'path' }) as any,
  site: f.text({ format: 'url' }) as any,
  body: f.richtext() as any,
  menu: hours as any,
  sections: f.blocks({ card }) as any,
  contact: f.group({ fields: { web: f.text({ format: 'link' }), note: f.richtext(), nested: f.group({ fields: { to: f.text({ format: 'link' }) } }) } }) as any,
}
const rich = (href: string, text = 'více') => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Viz ' }, { type: 'text', text, marks: [{ type: 'bold' }, { type: 'link', attrs: { href } }] }] }] })

describe('walking the links of a row', () => {
  const row = () => ({
    title: REF, // not a link field
    home: REF,
    address: '/adresa',
    site: 'https://example.com',
    body: rich(REF2),
    menu: [{ id: 'a', type: 'item', label: 'A', url: REF }, { id: 'b', type: 'item', label: 'B', url: '/b' }],
    sections: [
      { id: 's1', type: 'card', title: 'x', url: REF2, body: rich(REF), more: [{ id: 'm', type: 'item', label: 'M', url: REF }] },
      { id: 's2', type: 'gone', url: REF },
    ],
    contact: { web: REF, note: rich(REF2), nested: { to: REF } },
  })

  it('knows which fields can hold a link', () => {
    expect(['title', 'address', 'site'].map((k) => holdsLinks(fields[k]!))).toEqual([false, false, false])
    expect(['home', 'body', 'menu', 'sections', 'contact'].map((k) => holdsLinks(fields[k]!))).toEqual([true, true, true, true, true])
    expect(holdsLinks(f.group({ fields: { a: f.text(), b: f.number() } }) as any)).toBe(false)
    expect(holdsLinks(f.list({ fields: { a: f.text() } }) as any)).toBe(false)
  })

  it('finds every reference, at every depth, and only in link fields and rich-text links', () => {
    expect([...linkRefsOf(fields, row())].sort()).toEqual([REF, REF2].sort())
    expect(linkRefsOf(fields, { title: REF, address: REF, site: REF }).size).toBe(0)
    // an unknown block type is not read (the content API skips it too)
    expect(linkRefsOf(fields, { sections: [{ id: 's', type: 'gone', url: REF }] }).size).toBe(0)
  })

  it('rewrites them without touching the row, keeping what did not change', () => {
    const r = row()
    const before = structuredClone(r)
    const to = (v: string) => (v === REF ? '/o-nas' : v === REF2 ? null : undefined)
    const out = mapRowLinks(fields, r, { field: to, mark: to })
    expect(r).toEqual(before) // nothing modified
    expect(Object.keys(out).sort()).toEqual(['body', 'contact', 'home', 'menu', 'sections'])
    expect(out.home).toBe('/o-nas')
    expect(out.menu[0].url).toBe('/o-nas')
    expect(out.menu[1]).toBe(r.menu[1]) // the unchanged item is the same object
    expect(out.sections[0].url).toBeNull()
    expect(out.sections[0].more[0].url).toBe('/o-nas')
    expect(out.sections[1]).toBe(r.sections[1]) // unknown type passes through
    expect(out.contact.web).toBe('/o-nas')
    expect(out.contact.nested.to).toBe('/o-nas')
    // rich text: the link becomes text (the null), the other mark stays; or the href changes
    expect(out.body.content[0].content[1]).toEqual({ type: 'text', text: 'více', marks: [{ type: 'bold' }] })
    // a text with no other mark is left with none
    expect(mapDocLinks({ type: 'doc', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: REF } }] }] }, { mark: () => null })).toEqual({ type: 'doc', content: [{ type: 'text', text: 'x' }] })
    expect(out.sections[0].body.content[0].content[1].marks).toContainEqual({ type: 'link', attrs: { href: '/o-nas' } })
    expect(out.contact.note.content[0].content[1].marks).toEqual([{ type: 'bold' }])
  })

  it('returns nothing when nothing changes', () => {
    expect(mapRowLinks(fields, row(), { field: () => undefined, mark: () => undefined })).toEqual({})
    const doc = rich('/x')
    expect(mapDocLinks(doc, { mark: () => undefined })).toBe(doc)
  })

  it('leaves blocks stored at an older version alone when asked (their fields may not be where the definition says)', () => {
    const v2 = defineBlock({ label: 'V2', version: 2, upgrade: (d) => d, fields: { url: f.text({ format: 'link' }) } })
    const defs = { fields: { blocks: f.blocks({ v2 }) as any } }
    const stale: string[] = []
    const value = { blocks: [{ id: 'a', type: 'v2', url: REF }, { id: 'b', type: 'v2', v: 2, url: REF }] }
    const out = mapRowLinks(defs.fields, value, { field: () => '/x', skipStale: true, onStale: (t) => stale.push(t) })
    expect(out.blocks.map((b: any) => b.url)).toEqual([REF, '/x'])
    expect(stale).toEqual(['v2'])
  })
})

describe('what the content model says about link fields', () => {
  const model = buildContentModel(config as any)
  it('may be null whatever `required` says (the target can be gone)', () => {
    const nav = model.globals.find((g) => g.name === 'navigation')!
    const main = nav.fields.find((x) => x.key === 'main')!.type as any
    expect(main.blocks[0].fields.find((x: any) => x.key === 'url')).toMatchObject({ nullable: true })
    expect(main.blocks[0].fields.find((x: any) => x.key === 'label')).toMatchObject({ nullable: false })
  })
  it('does not change for fields that are not links', () => {
    const page = definePages({ blocks: {} })
    expect(page.fields.title.type).toBe('text')
  })
})

describe('search', () => {
  it('reads the text of a link, never where it points', () => {
    const texts = entryTexts({ body: f.richtext(), home: f.text({ format: 'link' }) } as any, { body: rich(REF, 'Kontakt'), home: REF })
    expect(texts).toEqual(['Viz Kontakt'])
    expect(texts.join(' ')).not.toContain('cms:')
  })
})

describe('menus without an address', () => {
  const link = (id: string, url: string | null, sub = false) => ({ id, label: id, url, sub })
  it('drop links that lead nowhere, and keep a heading whose dropdown still works', () => {
    expect(cmsMenuTree([link('a', '/a'), link('b', null), link('c', '/c')]).map((x) => x.id)).toEqual(['a', 'c'])
    const tree = cmsMenuTree([link('a', null), link('a1', '/a1', true), link('a2', null, true), link('b', '/b')])
    expect(tree.map((x) => [x.id, x.url, x.children.map((c) => c.id)])).toEqual([['a', null, ['a1']], ['b', '/b', []]])
    expect(cmsMenuTree([link('a', null), link('a1', null, true)])).toEqual([])
  })
})

describe('addresses compared by links:convert', () => {
  it('ignore a trailing slash and percent-encoding', () => {
    expect(normalizeAddress('/o-nas/')).toBe('/o-nas')
    expect(normalizeAddress('/')).toBe('/')
    expect(normalizeAddress('/o%20n%C3%A1s')).toBe('/o nás')
    expect(normalizeAddress('/100%')).toBe('/100%') // a stray % is compared as stored
  })
})

describe('the admin’s words for a page that is linked to', () => {
  const translator = (catalog: any) => (key: string, params: Record<string, string | number> = {}) => {
    const text = key.split('.').reduce((node: any, part) => node?.[part], catalog) as string
    return text.replace(/\{(\w+)\}/g, (_m, name) => String(params[name]))
  }
  const refused = (usedBy: unknown[]) => ({ data: { data: { code: 'in_use', usedBy } } })
  const name = (label: any) => label.en

  it('names what links to it: an entry by its title, a menu by its collection, and says "linked from"', () => {
    const t = translator(en)
    const out = cmsDeleteFailure(refused([
      { entity: 'post', id: '1', title: 'Článek s odkazem', singleton: false, via: 'link' },
      { entity: 'navigation', id: '2', title: '', singleton: true, label: { en: 'Navigation' }, via: 'link' },
    ]), t as any, name)
    expect(out.description).toBe('Linked from “Článek s odkazem”, Navigation. Remove those links first, then delete it.')
  })

  it('keeps the old wording for a relation, or a mix', () => {
    const t = translator(en)
    expect(cmsDeleteFailure(refused([{ entity: 'post', id: '1', title: 'Hotovo' }]), t as any, name).description).toBe('Used in “Hotovo”. Change those first, then delete it.')
    expect(cmsDeleteFailure(refused([{ entity: 'post', id: '1', title: 'A' }, { entity: 'page', id: '2', title: 'B', via: 'link' }]), t as any, name).description).toMatch(/^Used in /)
    expect(cmsDeleteFailure(refused([{ entity: 'navigation', singleton: true, label: { cs: 'Navigace' }, via: 'link' }]), translator(cs) as any, (l: any) => l.cs).description).toBe('Odkazuje na něj Navigace. Nejdřív ty odkazy odeberte, pak ho smažte.')
  })
})

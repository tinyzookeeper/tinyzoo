import { describe, expect, it } from 'vitest'
import {
  applyChange, buildRegistry, chainOf, checkTreeChange, defineBlock, defineLocales, definePages, depthOf, descendantsOf, f, fillPathTemplate, heightOf,
  indexTree, listLayout, movedPaths, sitePath, slugChain, treeAddress, type TreeNode,
} from 'tinyzoo'

const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })
const template = { cs: '/:slug', en: '/pages/:slug' }
const opts = { maxDepth: 4, locales, template, key: 'slug' }

// o-nas (about) ─ tym (team) ─ vedeni (leadership)
//             └ historie
// kontakt
const node = (id: string, parentId: string | null, slug: string, extra: Partial<TreeNode> = {}): TreeNode => ({ id, parentId, slug, title: slug, position: 0, ...extra })
const nodes: TreeNode[] = [
  node('about', null, 'o-nas', { slugs: { en: 'about' }, locales: ['en'] }),
  node('team', 'about', 'tym', { slugs: { en: 'team' }, locales: ['en'] }),
  node('lead', 'team', 'vedeni'),
  node('history', 'about', 'historie', { position: 1 }),
  node('contact', null, 'kontakt', { slugs: { en: 'contact' }, locales: ['en'], position: 1 }),
]

describe('addresses in a page tree', () => {
  it('fills a template from a list of address parts, each escaped', () => {
    expect(fillPathTemplate('/:slug', { slug: ['o-nas', 'tym'] })).toBe('/o-nas/tym')
    expect(fillPathTemplate('/pages/:slug', { slug: ['a b', 'c/d'] })).toBe('/pages/a%20b/c%2Fd')
    expect(fillPathTemplate('/:slug', { slug: [] })).toBeNull()
    expect(fillPathTemplate('/:slug', { slug: ['a', ''] })).toBeNull()
    expect(sitePath(locales, template, 'en', { slug: ['about', 'team'] })).toBe('/en/pages/about/team')
  })

  it('is the chain of ancestors then the page itself, in each language its own parts', () => {
    const index = indexTree(nodes)
    expect(treeAddress(locales, template, 'slug', index, 'lead', 'cs')).toBe('/o-nas/tym/vedeni')
    expect(treeAddress(locales, template, 'slug', index, 'team', 'en')).toBe('/en/pages/about/team')
    expect(treeAddress(locales, template, 'slug', index, 'about', 'cs')).toBe('/o-nas')
  })

  it('falls back to the default language part where a page is not translated', () => {
    const index = indexTree(nodes)
    // "lead" has no English part: the Czech one stands in, under the translated ancestors.
    expect(slugChain(index, 'lead', 'en', 'cs')).toEqual(['about', 'team', 'vedeni'])
    expect(treeAddress(locales, template, 'slug', index, 'lead', 'en')).toBe('/en/pages/about/team/vedeni')
    // an empty translation falls back too
    const blank = indexTree([node('p', null, 'x', { slugs: { en: '' } })])
    expect(slugChain(blank, 'p', 'en', 'cs')).toEqual(['x'])
  })

  it('walks the tree: chain, depth, height, descendants in order', () => {
    const index = indexTree(nodes)
    expect(chainOf(index, 'lead').map((n) => n.id)).toEqual(['about', 'team', 'lead'])
    expect(depthOf(index, 'lead')).toBe(3)
    expect(heightOf(index, 'about')).toBe(2)
    expect(heightOf(index, 'contact')).toBe(0)
    expect(descendantsOf(index, 'about').map((n) => n.id)).toEqual(['team', 'lead', 'history'])
  })
})

describe('checking a change', () => {
  it('lets an ordinary move through', () => {
    expect(checkTreeChange(nodes, { id: 'history', parentId: 'contact', slug: 'historie' }, opts)).toBeNull()
  })

  it('refuses a page under itself and names the loop', () => {
    const own = checkTreeChange(nodes, { id: 'about', parentId: 'about', slug: 'o-nas' }, opts)
    expect(own).toMatchObject({ code: 'tree_cycle' })
    const deeper = checkTreeChange(nodes, { id: 'about', parentId: 'lead', slug: 'o-nas' }, opts)
    expect(deeper).toMatchObject({ code: 'tree_cycle', loop: ['o-nas', 'tym', 'vedeni', 'o-nas'] })
    expect((deeper as any).message).toContain('o-nas → tym → vedeni → o-nas')
  })

  it('refuses a tree deeper than the limit, counting what the page carries along', () => {
    // contact (depth 1) moved under lead (depth 3) → 4 levels: allowed at 4
    expect(checkTreeChange(nodes, { id: 'contact', parentId: 'lead', slug: 'kontakt' }, opts)).toBeNull()
    const deep = [...nodes, node('x', 'contact', 'x'), node('y', 'x', 'y')]
    // about (height 2) under y (depth 3): 3 + 3 = 6 > 4
    expect(checkTreeChange(deep, { id: 'about', parentId: 'y', slug: 'o-nas' }, opts)).toMatchObject({ code: 'tree_depth', depth: 6, maxDepth: 4 })
    // the same move is fine when the tree may be 6 deep
    expect(checkTreeChange(deep, { id: 'about', parentId: 'y', slug: 'o-nas' }, { ...opts, maxDepth: 6 })).toBeNull()
    // a new page one level too deep
    expect(checkTreeChange(nodes, { id: 'new', parentId: 'lead', slug: 'dalsi' }, { ...opts, maxDepth: 3 })).toMatchObject({ code: 'tree_depth', depth: 4 })
  })

  it('refuses a parent that does not exist', () => {
    expect(checkTreeChange(nodes, { id: 'history', parentId: 'ghost', slug: 'historie' }, opts)).toMatchObject({ code: 'tree_parent_missing' })
  })

  it('keeps the full address unique per language, among everyone else', () => {
    // same slug under another parent is fine …
    expect(checkTreeChange(nodes, { id: 'new', parentId: 'contact', slug: 'tym' }, opts)).toBeNull()
    // … under the same parent it is not
    expect(checkTreeChange(nodes, { id: 'new', parentId: 'about', slug: 'tym' }, opts)).toMatchObject({ code: 'tree_address_taken', path: '/o-nas/tym', locale: 'cs', otherId: 'team' })
    // a move that makes a page's address the same as another's
    expect(checkTreeChange(nodes, { id: 'history', parentId: 'about', slug: 'tym' }, opts)).toMatchObject({ code: 'tree_address_taken' })
  })

  it('compares translated addresses in their own language', () => {
    // English: /en/pages/about/team is taken by team, whatever the Czech slug of the new page is
    const clash = checkTreeChange(nodes, { id: 'new', parentId: 'about', slug: 'novy', slugs: { en: 'team' } }, opts)
    expect(clash).toMatchObject({ code: 'tree_address_taken', locale: 'en', path: '/en/pages/about/team', otherId: 'team' })
  })

  it('checks everything below a renamed page, not just the page', () => {
    // "about" renamed to "kontakt" collides with the top-level contact page
    expect(checkTreeChange(nodes, { id: 'about', parentId: null, slug: 'kontakt' }, opts)).toMatchObject({ code: 'tree_address_taken', path: '/kontakt', otherId: 'contact' })
    // the same in English: renaming the English part to "contact" takes the translated contact page's address
    expect(checkTreeChange(nodes, { id: 'about', parentId: null, slug: 'o-nas', slugs: { en: 'contact' } }, opts))
      .toMatchObject({ code: 'tree_address_taken', locale: 'en', path: '/en/pages/contact', otherId: 'contact' })
  })

  it('does not let old duplicates block an edit that does not touch them', () => {
    const legacy = [node('a', null, 'same'), node('b', null, 'same'), node('c', null, 'other')]
    expect(checkTreeChange(legacy, { id: 'c', parentId: null, slug: 'other', title: 'c' }, opts)).toBeNull()
  })

  it('only compares languages a page exists in', () => {
    // "history" has no English translation: its fallback address is not an English page, so a
    // translated page may take that address.
    const t: TreeNode[] = [node('h', null, 'about'), node('p', null, 'x', { slugs: { en: 'about' }, locales: ['en'] })]
    expect(checkTreeChange(t, { id: 'p', parentId: null, slug: 'x', slugs: { en: 'about' } }, opts)).toBeNull()
  })

  it('applies a change to a copy of the tree', () => {
    const next = applyChange(nodes, { id: 'history', parentId: 'contact', slug: 'archiv' })
    expect(next.find((n) => n.id === 'history')).toMatchObject({ parentId: 'contact', slug: 'archiv', title: 'historie' })
    expect(nodes.find((n) => n.id === 'history')).toMatchObject({ parentId: 'about', slug: 'historie' })
  })
})

describe('what moved', () => {
  it('lists the page and every descendant, in every language they have', () => {
    const next = applyChange(nodes, { id: 'about', parentId: 'contact', slug: 'o-nas', slugs: { en: 'about' } })
    const moved = movedPaths(nodes, next, ['about', 'team', 'lead', 'history'], opts)
    expect(moved.filter((m) => m.id === 'team').map((m) => [m.locale, m.from, m.to])).toEqual([
      ['cs', '/o-nas/tym', '/kontakt/o-nas/tym'],
      ['en', '/en/pages/about/team', '/en/pages/contact/about/team'],
    ])
    // 'lead' has no English translation, but is reachable in English at its fallback address: that moves too
    expect(moved.filter((m) => m.id === 'lead').map((m) => [m.locale, m.to])).toEqual([['cs', '/kontakt/o-nas/tym/vedeni'], ['en', '/en/pages/contact/about/team/vedeni']])
  })

  it('lists a changed translated part only for that language', () => {
    const next = applyChange(nodes, { id: 'about', parentId: null, slug: 'o-nas', slugs: { en: 'about-us' } })
    const moved = movedPaths(nodes, next, ['about', 'team'], opts)
    expect(moved.map((m) => [m.id, m.locale, m.to])).toEqual([
      ['about', 'en', '/en/pages/about-us'],
      ['team', 'en', '/en/pages/about-us/team'],
    ])
    // an untranslated page below follows its parent's new part
    expect(movedPaths(nodes, next, ['lead'], opts).map((m) => [m.locale, m.to])).toEqual([['en', '/en/pages/about-us/team/vedeni']])
  })

  it('lists nothing for a new page or an unchanged one', () => {
    const next = applyChange(nodes, { id: 'fresh', parentId: null, slug: 'fresh' })
    expect(movedPaths(nodes, next, ['fresh', 'about'], opts)).toEqual([])
  })

  it('moves a page to the fallback address when its translation is removed', () => {
    const next = applyChange(nodes, { id: 'team', parentId: 'about', slug: 'tym', slugs: { en: null }, locales: [] })
    const moved = movedPaths(nodes, next, ['team', 'lead'], opts)
    expect(moved.find((m) => m.id === 'team' && m.locale === 'en')).toMatchObject({ from: '/en/pages/about/team', to: '/en/pages/about/tym' })
  })
})

describe('definePages({ tree })', () => {
  const blocks = { text: defineBlock({ label: 'Text', fields: { body: f.text() } }) }

  it('is flat unless asked: no parent, a unique slug', () => {
    const flat = definePages({ blocks, name: 'flatPage' })
    expect(Object.keys(flat.fields)).not.toContain('parent')
    expect(flat.fields.slug.isUnique).toBe(true)
    expect((flat as any).tree).toBeUndefined()
    expect(listLayout(flat as any)).toBe('table')
  })

  it('adds a parent, a position, a plain slug and the tree list', () => {
    const tree = definePages({ blocks, name: 'treePage', tree: true })
    expect(Object.keys(tree.fields)).toEqual(expect.arrayContaining(['parent', 'position']))
    expect(tree.fields.slug.isUnique).toBe(false)
    expect(tree.tree).toEqual({ parent: 'parent', order: 'position', maxDepth: 4 })
    expect(listLayout(tree as any)).toBe('tree')
    expect(Object.keys(tree.table)).toEqual(expect.arrayContaining(['parentId', 'position']))
    expect(buildRegistry({ tree }).byName.get('treePage')!.tree?.maxDepth).toBe(4)
  })

  it('takes a depth limit, from 2 to 10', () => {
    expect(definePages({ blocks, name: 'deepPage', tree: { maxDepth: 6 } }).tree?.maxDepth).toBe(6)
    expect(() => definePages({ blocks, name: 'tooDeep', tree: { maxDepth: 11 } })).toThrow(/2 to 10/)
    expect(() => definePages({ blocks, name: 'tooShallow', tree: { maxDepth: 1 } })).toThrow(/2 to 10/)
  })

  it('needs the address to hold the slug', () => {
    expect(() => definePages({ blocks, name: 'noSlugPath', path: '/pages', tree: true })).toThrow(/content.path must contain :slug/)
  })
})

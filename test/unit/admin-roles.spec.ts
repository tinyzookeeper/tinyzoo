import { describe, expect, it } from 'vitest'
import en from '../../packages/cms/app/i18n/en'
import cs from '../../packages/cms/app/i18n/cs'
import { cmsLockedSentence, cmsNameList, cmsRoleReach, cmsRoleSentence, type CmsRoleChoice } from '../../packages/cms/app/utils/cmsRoles'

// The Team page describes a role the developer wrote no description for, from its definition.
type Catalog = Record<string, any>
const tFor = (catalog: Catalog, locale: string) => (key: string, params: Record<string, any> = {}) => {
  let msg: any = key.split('.').reduce((o: any, k) => o?.[k], catalog)
  if (msg && typeof msg === 'object') msg = msg[new Intl.PluralRules(locale).select(Number(params.count ?? 0))] ?? msg.other
  return String(msg ?? key).replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? ''))
}
const t = tFor(en, 'en')
// Czech lists keep "a" with the next word (a no-break space): compared as plain spaces.
const plain = (s: string) => s.replace(/\u00a0/g, ' ')
const LABELS: Record<string, string> = { post: 'Posts', page: 'Pages', author: 'Authors', tag: 'Tags', siteSettings: 'Site settings', event: 'Events' }
const AREAS = Object.keys(LABELS)
const label = (a: string) => LABELS[a]!
const reach = (map: Record<string, ('read' | 'create' | 'update' | 'delete')[]>, own = false) =>
  Object.fromEntries(Object.entries(map).map(([k, ops]) => [k, { ops, own: own && ops.includes('update') }]))
const role = (over: Partial<CmsRoleChoice>): CmsRoleChoice => ({ name: 'x', custom: true, from: 'editor', label: null, description: null, publish: true, media: 'all', manage: false, reach: {}, ...over })

describe('a role in words', () => {
  const translator = role({
    publish: false, media: 'own',
    reach: reach({ post: ['read', 'update'], page: ['read', 'update'], author: ['read'], tag: ['read'], siteSettings: ['read'], event: ['read', 'create', 'update', 'delete'] }),
  })

  it('groups what it changes and what it only reads, in the admin’s order', () => {
    expect(cmsRoleReach(translator, AREAS)).toEqual({ edits: ['post', 'page', 'event'], reads: ['author', 'tag', 'siteSettings'], editsAll: false, readsAll: false, own: false })
  })

  it('says it in one sentence: changes, reads, publishing, files', () => {
    expect(cmsRoleSentence(translator, AREAS, { t, locale: 'en', label })).toBe(
      'Edits Posts, Pages, and Events. Only reads Authors, Tags, and Site settings. Cannot publish: drafts only. Changes only the files they uploaded.',
    )
  })

  it('names first what the definition lists', () => {
    const proofreader = role({ publish: false, listed: ['event'], reach: reach({ post: ['read', 'update'], page: ['read', 'update'], event: ['read', 'update'] }) })
    expect(cmsRoleReach(proofreader, AREAS).edits).toEqual(['event', 'post', 'page'])
  })

  it('cuts a long list ("and 2 more")', () => {
    expect(cmsRoleSentence(translator, AREAS, { t, locale: 'en', label, max: 2 })).toContain('Edits Posts and 2 more.')
    expect(cmsNameList(['A', 'B', 'C', 'D', 'E'], 'en', t, 4)).toBe('A, B, C, and 2 more')
    expect(cmsNameList(['A', 'B'], 'en', t, 4)).toBe('A and B')
  })

  it('everything, nothing, only reading, own entries, no media library', () => {
    const all = reach(Object.fromEntries(AREAS.map((a) => [a, ['read', 'update']])))
    expect(cmsRoleSentence(role({ reach: all, manage: true }), AREAS, { t, locale: 'en', label })).toBe('Edits all content. Publishes. Every file in the media library. Manages people and privacy.')
    expect(cmsRoleSentence(role({ reach: {}, media: 'none' }), AREAS, { t, locale: 'en', label })).toBe('Sees no content. No media library.')
    const readsAll = reach(Object.fromEntries(AREAS.map((a) => [a, ['read']])))
    // Publishing says nothing for a role that changes nothing.
    expect(cmsRoleSentence(role({ reach: readsAll, publish: false }), AREAS, { t, locale: 'en', label })).toBe('Only reads the content. Every file in the media library.')
    const authorLike = role({ from: 'author', publish: false, media: 'own', reach: reach({ post: ['read', 'create', 'update', 'delete'], author: ['read'] }, true) })
    expect(cmsRoleSentence(authorLike, ['post', 'author'], { t, locale: 'en', label })).toBe('Edits Posts. Only reads Authors. Only the entries they created. Cannot publish: drafts only. Changes only the files they uploaded.')
  })

  it('in Czech, without declining the names', () => {
    const tc = tFor(cs, 'cs')
    const csLabels: Record<string, string> = { post: 'Články', page: 'Stránky', author: 'Autoři', tag: 'Štítky', siteSettings: 'Nastavení webu', event: 'Akce' }
    expect(plain(cmsRoleSentence(translator, AREAS, { t: tc, locale: 'cs', label: (a) => csLabels[a]! }))).toBe(
      'Upravuje: Články, Stránky a Akce. Jen čte: Autoři, Štítky a Nastavení webu. Nezveřejňuje, píše jen koncepty. Mění jen vlastní soubory.',
    )
    expect(plain(cmsNameList(['A', 'B', 'C', 'D', 'E', 'F', 'G'], 'cs', tc, 3))).toBe('A, B a 5 dalších oblastí')
  })
})

describe('who can change a locked field', () => {
  it('names the roles, in the admin’s language', () => {
    expect(cmsLockedSentence(['Editor', 'Administrator'], 'en', t)).toBe('Only Editor and Administrator can change this.')
    expect(cmsLockedSentence(['Administrator'], 'en', t)).toBe('Only Administrator can change this.')
    expect(plain(cmsLockedSentence(['Editor', 'Korektor', 'Administrátor'], 'cs', tFor(cs, 'cs')))).toBe('Upravit to mohou jen Editor, Korektor a Administrátor.')
    expect(cmsLockedSentence(['Administrátor'], 'cs', tFor(cs, 'cs'))).toBe('Upravit to může jen Administrátor.')
  })
})

import { describe, expect, it } from 'vitest'
import { buildRegistry, defineAdminMenu, defineEntity, defineRedirects, defineSingleton, f, menuSources, resolveMenu } from 'tinyzoo'
import { defineForm, formsPlugin } from 'tinyzoo/forms'

// The admin's menu: where rows go by themselves, what the site says (defineAdminMenu), and what
// an administrator arranged on top.
const News = defineEntity('news', { label: 'News', titleField: 'title', fields: { title: f.text() } })
const Album = defineEntity('album', { label: 'Albums', titleField: 'title', fields: { title: f.text() } })
const Page = defineEntity('page', { label: 'Pages', titleField: 'title', fields: { title: f.text() } })
const Settings = defineSingleton('siteSettings', { label: 'Site settings', titleField: 'name', fields: { name: f.text() } })
const Redirect = defineRedirects()
const Contact = defineForm('contact', { label: 'Contact', fields: { message: f.text() } })
const Enrol = defineForm('enrol', { label: 'Enrolment', fields: { message: f.text() } })

const graphOf = (config: Record<string, unknown>) => buildRegistry(config).graph
const site = (config: Record<string, unknown>, pages: { to: string; group: 'content' | 'settings' }[] = []) => menuSources(graphOf(config), pages)
const plugins = [formsPlugin()]
const config = { News, Album, Page, Settings, Redirect, Contact, Enrol, plugins }
const visits = [{ to: '/admin/p/analytics', group: 'content' as const }]

describe('the menu by itself', () => {
  it('puts messages and plugin pages beside Home, collections under Content, pages and globals under Website, the rest behind Settings', () => {
    expect(resolveMenu(site(config, visits))).toEqual({
      home: ['@forms', '/admin/p/analytics'],
      groups: [
        { id: 'content', label: null, items: ['album', 'news'] },
        { id: 'website', label: null, items: ['page', 'siteSettings', '@media'] },
      ],
      settings: ['redirect', '@team', '@privacy', '@about'],
      forms: ['contact', 'enrol'],
    })
  })

  it('has no messages row on a site without forms', () => {
    expect(resolveMenu(site({ News, Page })).home).toEqual([])
  })
})

describe('defineAdminMenu', () => {
  it('orders what it names and leaves the rest in its usual place', () => {
    const menu = defineAdminMenu({ groups: { content: [News], website: [Settings, '@media'] }, settings: ['@about'], forms: [Enrol] })
    expect(resolveMenu(site(config, visits), menu)).toEqual({
      home: ['@forms', '/admin/p/analytics'],
      groups: [
        { id: 'content', label: null, items: ['news', 'album'] },
        { id: 'website', label: null, items: ['siteSettings', '@media', 'page'] },
      ],
      settings: ['@about', 'redirect', '@team', '@privacy'],
      forms: ['enrol', 'contact'],
    })
  })

  it('takes groups of the site’s own, and moves rows between places', () => {
    const menu = defineAdminMenu({ home: [News], groups: { club: { label: { en: 'Club' }, items: [Album, Redirect] } } })
    const layout = resolveMenu(site(config), menu)
    expect(layout.home).toEqual(['news', '@forms'])
    expect(layout.groups).toEqual([
      { id: 'club', label: { en: 'Club' }, items: ['album', 'redirect'] },
      { id: 'website', label: null, items: ['page', 'siteSettings', '@media'] },
    ])
    expect(layout.settings).toEqual(['@team', '@privacy', '@about'])
  })

  it('says what is wrong with it', () => {
    expect(() => defineAdminMenu({ groups: { content: [News, News] } })).toThrow(/"news" is listed twice/)
    expect(() => defineAdminMenu({ groups: { content: [News] }, settings: [News] })).toThrow(/listed twice \(groups\.content and settings\)/)
    expect(() => defineAdminMenu({ groups: { club: [News] } })).toThrow(/the group "club" needs a label/)
    expect(() => buildRegistry({ ...config, menu: defineAdminMenu({ groups: { content: ['nothing'] } }) })).toThrow(/names "nothing", which the site does not have/)
    expect(() => buildRegistry({ ...config, menu: defineAdminMenu({ groups: { content: [Contact] } }) })).toThrow(/The forms share one row, '@forms'/)
    expect(() => buildRegistry({ ...config, menu: defineAdminMenu({ forms: [News] }) })).toThrow(/is not a form/)
    expect(() => buildRegistry({ ...config, menu: defineAdminMenu({ settings: ['@nope'] }) })).toThrow(/not a built-in row/)
    expect(() => buildRegistry({ ...config, a: defineAdminMenu({}), b: defineAdminMenu({}) })).toThrow(/more than one `defineAdminMenu/)
  })

  it('is kept by the registry', () => {
    const menu = defineAdminMenu({ groups: { content: [News] } })
    expect(buildRegistry({ ...config, menu }).menu).toBe(menu)
    expect(buildRegistry(config).menu).toBeNull()
  })
})

describe('an administrator’s arrangement', () => {
  const menu = defineAdminMenu({ groups: { content: [News, Album], website: [Page, Settings, '@media'] } })

  it('goes on top of the site’s layout', () => {
    const saved = { home: ['news', '@forms'], groups: { content: ['@media'], website: ['siteSettings', 'page'] }, settings: ['album', '@about', '@team', '@privacy', 'redirect'] }
    expect(resolveMenu(site(config), menu, saved)).toEqual({
      home: ['news', '@forms'],
      groups: [
        { id: 'content', label: null, items: ['@media'] },
        { id: 'website', label: null, items: ['siteSettings', 'page'] },
      ],
      settings: ['album', '@about', '@team', '@privacy', 'redirect'],
      forms: ['contact', 'enrol'],
    })
  })

  it('keeps a row added later where the site has it, and forgets rows and groups that are gone', () => {
    const saved = { home: ['@forms', 'gone'], groups: { content: ['album'], old: ['news'] }, settings: ['@about'] }
    const layout = resolveMenu(site(config), menu, saved)
    expect(layout.home).toEqual(['@forms'])
    // "news" sat in a group the site no longer has: it is back in the site's place for it
    expect(layout.groups).toEqual([
      { id: 'content', label: null, items: ['album', 'news'] },
      { id: 'website', label: null, items: ['page', 'siteSettings', '@media'] },
    ])
    expect(layout.settings).toEqual(['@about', 'redirect', '@team', '@privacy'])
  })

  it('never shows a row twice', () => {
    const saved = { home: ['news', 'news'], groups: { content: ['news', 'album'] }, settings: ['album'] }
    const layout = resolveMenu(site(config), menu, saved)
    const all = [...layout.home, ...layout.groups.flatMap((g) => g.items), ...layout.settings]
    expect(all.filter((k) => k === 'news')).toHaveLength(1)
    expect(all.filter((k) => k === 'album')).toHaveLength(1)
    expect(new Set(all).size).toBe(all.length)
  })
})

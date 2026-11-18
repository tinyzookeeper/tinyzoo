import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defineBlock, defineEntity, defineSingleton, editorLayout, f, listLayout, type CmsEntity } from 'tinyzoo'
import { CMS_SIDEBAR_LAYOUT_COOKIE, cmsSidebarFolded } from '../../packages/cms/app/utils/cmsSidebar'

// The admin picks how an editor and a list look from what the content is; the
// developer can say otherwise with admin.editor / admin.list.layout.
const e = (x: unknown) => x as CmsEntity
const publish = { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/news/:slug' } as const
const status = () => f.select({ options: ['draft', 'published'] as const })

describe('editorLayout', () => {
  it('writes when there is a rich-text body with a page on the website', () => {
    const News = defineEntity('news', { label: 'News', titleField: 'title', fields: { title: f.text(), slug: f.slug({ from: 'title' }), status: status(), body: f.richtext() }, publish })
    expect(editorLayout(e(News))).toBe('write')
  })

  it('previews pages built from blocks, and globals with a page', () => {
    const text = defineBlock({ label: 'Text', fields: { body: f.richtext() } })
    const Page = defineEntity('page', { label: 'Pages', titleField: 'title', fields: { title: f.text(), slug: f.slug({ from: 'title' }), status: status(), body: f.blocks({ text }) }, publish })
    expect(editorLayout(e(Page))).toBe('preview')
    const Home = defineSingleton('home', { label: 'Home', titleField: 'headline', fields: { headline: f.text() }, admin: { preview: '/' } })
    expect(editorLayout(e(Home))).toBe('preview')
  })

  it('uses a form for facts, rich text without a page, and globals without a page', () => {
    const Event = defineEntity('event', { label: 'Events', titleField: 'title', fields: { title: f.text(), startsAt: f.datetime(), place: f.text() } })
    expect(editorLayout(e(Event))).toBe('form')
    const Note = defineEntity('note', { label: 'Notes', titleField: 'title', fields: { title: f.text(), body: f.richtext() } })
    expect(editorLayout(e(Note))).toBe('form')
    const Club = defineSingleton('club', { label: 'Club', titleField: 'name', fields: { name: f.text() } })
    expect(editorLayout(e(Club))).toBe('form')
  })

  it('lets the developer choose', () => {
    const News = defineEntity('news', { label: 'News', titleField: 'title', fields: { title: f.text(), slug: f.slug({ from: 'title' }), status: status(), body: f.richtext() }, publish, admin: { editor: 'form' } })
    expect(editorLayout(e(News))).toBe('form')
  })
})

describe('listLayout', () => {
  it('shows picture cards when the first column is a picture', () => {
    const Partner = defineEntity('partner', { label: 'Partners', titleField: 'name', fields: { name: f.text(), logo: f.media() }, admin: { list: { columns: ['logo', 'name'] } } })
    expect(listLayout(e(Partner))).toBe('grid')
  })

  it('shows Upcoming / Past for dated content without drafts', () => {
    const Event = defineEntity('event', { label: 'Events', titleField: 'title', fields: { title: f.text(), startsAt: f.datetime() }, admin: { list: { columns: ['title', 'startsAt'] } } })
    expect(listLayout(e(Event))).toBe('dated')
  })

  it('keeps a table for written content led by a photo (the text is the content)', () => {
    const News = defineEntity('news', { label: 'News', titleField: 'title', fields: { title: f.text(), hero: f.media(), body: f.richtext() }, admin: { list: { columns: ['hero', 'title'] } } })
    expect(listLayout(e(News))).toBe('table')
  })

  it('uses a table otherwise, and when content with drafts has a date', () => {
    const News = defineEntity('news', { label: 'News', titleField: 'title', fields: { title: f.text(), slug: f.slug({ from: 'title' }), status: status(), publishedAt: f.datetime().optional() }, publish, admin: { list: { columns: ['title', 'publishedAt'] } } })
    expect(listLayout(e(News))).toBe('table')
  })

  it('lets the developer choose', () => {
    const Event = defineEntity('event', { label: 'Events', titleField: 'title', fields: { title: f.text(), startsAt: f.datetime() }, admin: { list: { columns: ['title', 'startsAt'], layout: 'table' } } })
    expect(listLayout(e(Event))).toBe('table')
  })
})

describe('cmsSidebarFolded: the folded sidebar after a reload', () => {
  it('reads the cookie as useCookie hands it over: the number 1, the string "1" or true', () => {
    // useCookie parses a value that looks like JSON: the `1` the admin stores comes back as a number.
    expect(cmsSidebarFolded(1)).toBe(true)
    expect(cmsSidebarFolded('1')).toBe(true)
    expect(cmsSidebarFolded(true)).toBe(true)
  })

  it('keeps the sidebar open otherwise', () => {
    for (const v of [0, '0', false, null, undefined, '', 'yes', 2]) expect(cmsSidebarFolded(v), String(v)).toBe(false)
  })

  it('is what the admin layout reads, on the server and in the browser', () => {
    const vue = readFileSync(join(import.meta.dirname, '../../packages/cms/app/layouts/admin.vue'), 'utf8')
    expect(vue).not.toMatch(/pref\.value === '1'/)
    expect(vue.match(/cmsSidebarFolded\(pref\.value\)/g)).toHaveLength(2)
  })

  it("starts Nuxt UI's own sidebar cookie from the same fold, so the first frame does not jump", () => {
    const vue = readFileSync(join(import.meta.dirname, '../../packages/cms/app/layouts/admin.vue'), 'utf8')
    // Nuxt UI names its cookie `${storageKey}-sidebar-${id}`.
    const key = /<UDashboardGroup[^>]*storage-key="([^"]+)"/.exec(vue)?.[1]
    const id = /<UDashboardSidebar\s[^>]*\bid="([^"]+)"/.exec(vue)?.[1]
    expect(`${key}-sidebar-${id}`).toBe(CMS_SIDEBAR_LAYOUT_COOKIE)
    expect(vue).toMatch(/useCookie<[^>]+>\(CMS_SIDEBAR_LAYOUT_COOKIE\)/)
  })
})

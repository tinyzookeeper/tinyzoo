import { describe, expect, it } from 'vitest'
import { defineBlock, defineEntity, defineSingleton, editorLayout, f, listLayout, type CmsEntity } from 'tinyzoo'

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

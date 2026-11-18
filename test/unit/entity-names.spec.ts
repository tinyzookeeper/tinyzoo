import { describe, expect, it } from 'vitest'
import { defineEntity, defineSingleton, f } from '../../packages/cms/src/index'

// The name of an entity is a database table, an address and an identifier in the generated
// schema.ts. A space or a dash only failed when esbuild compiled that file; now the name is refused where it is written.
const fields = { title: f.text({ required: true }) }

describe('entity names', () => {
  it.each(['post', 'blogPost', 'blog_post', 'News2', 'contactForm'])('accepts %s', (name) => {
    expect(() => defineEntity(name, { label: 'X', titleField: 'title', fields })).not.toThrow()
  })

  it.each(['blog post', 'blog-post', 'blog.post', '2posts', 'Článek', '', 'a/b', "x'y"])('refuses %j, saying what is allowed', (name) => {
    expect(() => defineEntity(name, { label: 'X', titleField: 'title', fields })).toThrow(/Invalid entity name .*letters, digits and underscores/)
  })

  it('applies to globals too', () => {
    expect(() => defineSingleton('site settings', { label: 'X', titleField: 'title', fields })).toThrow(/Invalid entity name/)
  })
})

// Names that belong to tinyzoo (1.0): what it adds later must not collide with a site's names.
describe('names tinyzoo keeps for itself', () => {
  const make = (name: string, extra: Record<string, unknown> = {}) =>
    () => defineEntity(name, { label: 'X', titleField: 'title', fields: { title: f.text(), ...extra } } as any)

  it.each(['email', 'privacy', 'media', 'team', 'p', '_x'])('refuses the entity name %s (an admin page or route)', (name) => {
    expect(make(name)).toThrow(/reserved by the CMS/)
  })

  it.each(['cms', 'cmsPage', 'cms_page', 'CmsPage', 'CMSPAGE', 'cmspage'])('refuses %s: names starting with "cms" are tinyzoo\'s tables and schema names', (name) => {
    expect(make(name)).toThrow(/starting with "_" or "cms"/)
    expect(() => defineSingleton(name, { label: 'X', titleField: 'title', fields: { title: f.text() } })).toThrow(/reserved by the CMS/)
  })

  it.each(['emails', 'myCms', 'acms', 'privacyPolicy'])('still accepts %s', (name) => {
    expect(make(name)).not.toThrow()
  })

  it.each(['path', 'paths', 'breadcrumbs', 'preview', 'locale', 'locales'])('refuses the field name %s in every entity, with a pointer to "Renaming a field"', (key) => {
    expect(make('post', { [key]: f.text() })).toThrow(/reserved by the CMS.*renaming-a-field/s)
    expect(() => defineSingleton('settings', { label: 'X', titleField: 'title', fields: { title: f.text(), [key]: f.text() } as any })).toThrow(/reserved by the CMS/)
  })

  it.each(['_key', '_type', '_draft', '_'])('refuses the field name %s: names starting with "_" are tinyzoo\'s', (key) => {
    expect(make('post', { [key]: f.text() })).toThrow(/starting with "_" are reserved by the CMS/)
  })

  it.each(['cover image', 'cover-image', '2cover', 'obálka', 'a.b', ''])('refuses the field name %j, saying what is allowed', (key) => {
    expect(make('post', { [key]: f.text() })).toThrow(/Invalid field name .*letters, digits and underscores/)
  })

  it.each(['coverImage', 'cover_image', 'image2', 'X', 'pathname', 'previewText'])('accepts the field name %s', (key) => {
    expect(make('post', { [key]: f.text() })).not.toThrow()
  })
})

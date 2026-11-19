import { describe, expect, it } from 'vitest'
import { buildRegistry, defineEntity, defineLocales, defineSingleton, f } from '../../packages/cms/src/index'

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

// Every entity, translation table, junction and choice field becomes a name in schema.ts and in
// the database. Two equal ones made drizzle-kit fail ("Multiple exports with the same name") long
// after the config was written: an entity `courseSignup` and the field `signup` of `course`.
describe('names that would be the same in the generated schema', () => {
  const choice = () => f.select({ options: ['online', 'phone'] as const })

  it('refuses an entity whose table has the name of another entity\'s choice field, naming both', () => {
    const Course = defineEntity('course', { label: 'Courses', titleField: 'title', fields: { title: f.text(), signup: choice() } })
    const CourseSignup = defineEntity('courseSignup', { label: 'Sign-ups', titleField: 'name', fields: { name: f.text() } })
    expect(() => buildRegistry({ Course, CourseSignup })).toThrow(/"courseSignup".*the table of "courseSignup".*the choices of the field "signup" of "course".*[Rr]ename/s)
  })

  it('refuses the same SQL name too (a table and a type share them in Postgres)', () => {
    const A = defineEntity('a_b', { label: 'A', titleField: 'title', fields: { title: f.text(), c: choice() } })
    const B = defineEntity('a', { label: 'B', titleField: 'title', fields: { title: f.text(), bC: choice() } })
    expect(() => buildRegistry({ A, B })).toThrow(/a_b_c/)
  })

  it('refuses an entity named like another one\'s translations or a junction', () => {
    const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })
    const Post = defineEntity('post', { label: 'Posts', titleField: 'title', fields: { title: f.text().localized() } })
    const PostLocales = defineEntity('postLocales', { label: 'X', titleField: 'title', fields: { title: f.text() } })
    expect(() => buildRegistry({ locales, Post, PostLocales })).toThrow(/"postLocales".*the table of "postLocales".*the translations of "post"/s)
    const Tag = defineEntity('tag', { label: 'Tags', titleField: 'name', fields: { name: f.text() } })
    const Article = defineEntity('article', { label: 'Articles', titleField: 'title', fields: { title: f.text(), tags: f.relation({ to: () => Tag, kind: 'many-to-many', through: 'tag' }) } })
    expect(() => buildRegistry({ Tag, Article })).toThrow(/"tag".*the relation "tags" of "article"/s)
  })

  it('accepts names that only look alike', () => {
    const Course = defineEntity('course', { label: 'Courses', titleField: 'title', fields: { title: f.text(), signup: choice() } })
    const Signup = defineEntity('signup', { label: 'Sign-ups', titleField: 'name', fields: { name: f.text(), course: choice() } })
    expect(() => buildRegistry({ Course, Signup })).not.toThrow()
  })
})

import { describe, expect, it } from 'vitest'
import { defineEntity, defineSingleton, emitSchema, f } from 'tinyzoo'

// `content.populate` names top-level fields: the types refuse anything else ('sister.logo' is
// TS2322), but `tinyzoo generate` accepted it without a word, and the content API ignores it. Now
// generate refuses it too (the server still ignores it, so a site running with one keeps working).
// A picture inside a group, a list or blocks is always delivered as a picture, and a relation is
// populated one level deep, so a dotted key has nothing to add.

const fields = {
  name: f.text(),
  logo: f.media().optional(),
  sister: f.group({ fields: { name: f.text(), logo: f.media().optional() } }),
}

describe('content.populate and content.hidden keys', () => {
  it('are type-checked against the fields', () => {
    defineSingleton('studio', {
      label: 'Studio', titleField: 'name', fields,
      // @ts-expect-error a nested key is not a field of the entity
      content: { public: true, populate: ['sister.logo'] },
    })
    defineSingleton('studio', { label: 'Studio', titleField: 'name', fields, content: { public: true, populate: ['logo'] } })
  })

  it('a nested key stops `generate`, saying that pictures in a group are delivered anyway', () => {
    const Studio = defineSingleton('studio', { label: 'Studio', titleField: 'name', fields, content: { public: true, populate: ['logo', 'sister.logo'] } } as any)
    expect(() => emitSchema({ Studio })).toThrow(/"studio".*content\.populate.*"sister\.logo".*not a field.*inside a group.*always/s)
  })

  it('so does a key that is no field at all, in populate or hidden', () => {
    const Post = defineEntity('post', { label: 'Posts', titleField: 'name', fields, content: { public: true, populate: ['logoo'] } } as any)
    expect(() => emitSchema({ Post })).toThrow(/"post".*content\.populate.*"logoo".*not a field.*name, logo, sister/s)
    const Author = defineEntity('author', { label: 'Authors', titleField: 'name', fields: { name: f.text(), email: f.text() }, content: { public: true, hidden: ['mail'] } } as any)
    expect(() => emitSchema({ Author })).toThrow(/"author".*content\.hidden.*"mail".*not a field/s)
  })

  it('accepts the fields themselves', () => {
    const Post = defineEntity('post', { label: 'Posts', titleField: 'name', fields, content: { public: true, populate: ['logo'], hidden: ['sister'] } })
    expect(() => emitSchema({ Post })).not.toThrow()
  })
})

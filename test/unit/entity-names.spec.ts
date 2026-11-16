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

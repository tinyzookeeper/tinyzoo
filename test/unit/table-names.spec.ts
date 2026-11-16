import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { buildRegistry, defineEntity, defineLocales, emitSchema, f } from 'tinyzoo'

// SQL identifiers are snake_case; entity names (API paths, the graph, TS export names)
// stay as written. The emitted schema.ts and the runtime tables must agree exactly, or
// migrations would be generated for names the server never queries.
const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })
const BlogPost: any = defineEntity('blogPost', {
  label: 'Blog posts',
  titleField: 'title',
  fields: {
    title: f.text().localized(),
    slug: f.slug({ from: 'title', unique: true }).localized(),
    postState: f.select({ options: ['draft', 'live'] as const }),
    tags: f.relation({ to: () => PostTag, kind: 'many-to-many' }),
    related: f.relation({ to: () => PostTag, kind: 'many-to-many', through: 'myJunction' }),
  },
})
const PostTag: any = defineEntity('postTag', { label: 'Tags', titleField: 'name', fields: { name: f.text() } })
const config = { locales, BlogPost, PostTag }

const quoted = (src: string, call: string) => [...src.matchAll(new RegExp(`${call}\\('([^']+)'`, 'g'))].map((m) => m[1]!)

describe('snake_case table names', () => {
  const reg = buildRegistry(config)
  const src = emitSchema(config)

  it('names the runtime tables, translations, indexes, enums and junctions in snake_case', () => {
    expect(getTableConfig(BlogPost.table).name).toBe('blog_post')
    expect(getTableConfig(BlogPost.localesTable).name).toBe('blog_post_locales')
    expect(getTableConfig(BlogPost.localesTable).indexes.map((i: any) => i.config.name).sort()).toEqual([
      'blog_post_locales_parent_locale_unique',
      'blog_post_locales_slug_unique',
    ])
    expect(BlogPost.enums.map((e: any) => e.enumName)).toEqual(['blog_post_post_state'])
    // a generated junction is built from the snake names; a given `through` stays as written
    expect(reg.junctions.map((j) => j.tableName).sort()).toEqual(['blog_post_to_post_tag', 'myJunction'])
    expect(getTableConfig(reg.junctions[0]!.table).name).toBe(reg.junctions[0]!.tableName)
  })

  it('keeps entity names and TS export names camelCase', () => {
    expect(BlogPost.name).toBe('blogPost')
    expect(reg.byName.has('blogPost')).toBe(true)
    expect(src).toContain("export const blogPost = pgTable('blog_post'")
    expect(src).toContain("export const blogPostLocales = pgTable('blog_post_locales'")
    expect(src).toContain("export const blogPostPostState = pgEnum('blog_post_post_state'")
    expect(Object.keys(reg.schema)).toEqual(expect.arrayContaining(['blogPost', 'blogPost_locales', 'blogPost_to_postTag', 'myJunction']))
  })

  it('emits exactly the names the runtime tables have', () => {
    const entityTables = reg.entities.flatMap((e) => [e.table, e.localesTable].filter(Boolean))
    const runtime = [...entityTables.map((t: any) => getTableConfig(t).name), ...reg.junctions.map((j) => j.tableName)].sort()
    const emitted = quoted(src, 'pgTable').filter((n) => !n.startsWith('cms_')).sort()
    expect(emitted).toEqual(runtime)

    const runtimeIndexes = entityTables.flatMap((t: any) => getTableConfig(t).indexes.map((i: any) => i.config.name as string)).sort()
    expect(quoted(src, 'uniqueIndex').filter((n) => !n.startsWith('cms_')).sort()).toEqual(runtimeIndexes)

    const runtimeEnums = reg.entities.flatMap((e) => e.enums.map((en: any) => en.enumName as string)).sort()
    expect(quoted(src, 'pgEnum').sort()).toEqual(runtimeEnums)
  })

  it('never emits an uppercase table, index or enum name', () => {
    for (const call of ['pgTable', 'pgEnum', 'uniqueIndex']) {
      for (const n of quoted(src, call)) if (n !== 'myJunction') expect(n).toMatch(/^[a-z0-9_]+$/)
    }
  })
})

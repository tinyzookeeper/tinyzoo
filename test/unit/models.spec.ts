import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import {
  buildRegistry, defineCmsPlugin, defineEntity, defineModels, f, DEFAULT_MODEL, isCmsModels, modelMigrationsAsset, modelPluginsProblem, modelsOf,
} from 'tinyzoo'
import { consentPlugin } from 'tinyzoo/consent'
import { formsPlugin } from 'tinyzoo/forms'

// Content models of one build (src/models.ts): declared with defineModels, told apart by name.

/** A model with posts and tags, so each has a relation table `post_to_tag`. */
function blog() {
  const Tag = defineEntity('tag', { label: 'Tags', titleField: 'name', fields: { name: f.text({ required: true }) } })
  const Post = defineEntity('post', { label: 'Posts', titleField: 'title', fields: { title: f.text({ required: true }), tags: f.relation({ to: () => Tag, kind: 'many-to-many' }) } })
  return { Tag, Post }
}
const page = () => defineEntity('page', { label: 'Pages', titleField: 'title', fields: { title: f.text({ required: true }) } })
const shop = { config: { Page: page() }, migrations: 'models/shop/migrations' }

describe('defineModels', () => {
  it('returns the models, and only their names are enumerable', () => {
    const models = defineModels({ shop, blog: { config: blog(), migrations: 'models/blog/migrations' } })
    expect(Object.keys(models)).toEqual(['shop', 'blog'])
    expect(Object.entries(models).map(([name]) => name)).toEqual(['shop', 'blog'])
    expect(isCmsModels(models)).toBe(true)
    expect(isCmsModels({ shop })).toBe(false)
    expect(models.shop.migrations).toBe('models/shop/migrations')
  })

  it.each(['Shop', '1shop', 'shop_one', 'a'.repeat(41), '', 'shop one'])('refuses the name %j', (name) => {
    expect(() => defineModels({ [name]: shop })).toThrow(/model name/)
  })
  it('refuses "default": that is the app\'s own config', () => {
    expect(() => defineModels({ default: shop })).toThrow(/"default" is the model of the app's own/)
  })
  it('refuses a model without a config object, or with no migrations folder', () => {
    expect(() => defineModels({ shop: { config: null as any, migrations: 'x' } })).toThrow(/needs a `config`/)
    expect(() => defineModels({ shop: { config: { A: page() }, migrations: '' } })).toThrow(/needs `migrations`/)
    expect(() => defineModels({ shop: { config: { A: page() }, migrations: 3 as any } })).toThrow(/needs `migrations`/)
  })
  it('refuses a model whose config declares models itself', () => {
    const inner = defineModels({ shop })
    expect(() => defineModels({ outer: { config: { models: inner }, migrations: 'x' } })).toThrow(/models do not nest/)
  })
})

describe('modelsOf', () => {
  it('without defineModels: one model, "default", whose config is the object itself', () => {
    const config = { Page: page(), anything: 1 }
    const { models, hasDefault } = modelsOf(config)
    expect(hasDefault).toBe(true)
    expect([...models.keys()]).toEqual([DEFAULT_MODEL])
    expect(models.get(DEFAULT_MODEL)!.config).toBe(config)
    expect(models.get(DEFAULT_MODEL)!.migrations).toBeNull()
    // Not even an entity is needed: that is today's behaviour.
    expect(modelsOf({}).hasDefault).toBe(true)
  })

  it('with models and entities of its own: "default" first, then the named ones', () => {
    const Own = page()
    const models = defineModels({ shop, blog: { config: blog(), migrations: 'b' } })
    const out = modelsOf({ Own, other: 'x', models })
    expect(out.hasDefault).toBe(true)
    expect([...out.models.keys()]).toEqual(['default', 'shop', 'blog'])
    expect(out.models.get('default')!.config).toEqual({ Own, other: 'x' })
    expect(out.models.get('shop')!.config).toBe(shop.config)
    expect(out.models.get('shop')!.migrations).toBe('models/shop/migrations')
  })

  it('with models only: no "default"', () => {
    const out = modelsOf({ models: defineModels({ shop }), note: 'not an entity' })
    expect(out.hasDefault).toBe(false)
    expect([...out.models.keys()]).toEqual(['shop'])
  })

  it('two defineModels exports are an error', () => {
    expect(() => modelsOf({ a: defineModels({ shop }), b: defineModels({ shop }) })).toThrow(/more than once/)
  })

  it('gives each model its own registry', () => {
    const out = modelsOf({ models: defineModels({ shop, blog: { config: blog(), migrations: 'b' } }) })
    const [a, b] = [...out.models.values()].map((m) => buildRegistry(m.config))
    expect([...a!.byName.keys()]).toEqual(['page'])
    expect([...b!.byName.keys()].sort()).toEqual(['post', 'tag'])
  })
})

describe('modelMigrationsAsset', () => {
  it('keeps today\'s name for "default", and names the others', () => {
    expect(modelMigrationsAsset('default')).toBe('cms-migrations')
    expect(modelMigrationsAsset('shop')).toBe('cms-migrations-shop')
  })
})

describe('modelPluginsProblem', () => {
  const named = (name: string, ...plugins: unknown[]) => ({ name, config: { Page: page(), plugins } })
  const optioned = (text: string) => defineCmsPlugin({ name: 'texty', version: '1.0.0', i18n: { en: { hello: text } } })

  it('is null for one model, or for none', () => {
    expect(modelPluginsProblem([named('a', formsPlugin())])).toBeNull()
    expect(modelPluginsProblem([])).toBeNull()
  })
  it('is null for the same plugins as different instances with the same options', () => {
    expect(modelPluginsProblem([named('a', formsPlugin(), consentPlugin()), named('b', formsPlugin(), consentPlugin())])).toBeNull()
    // Another order is another plan: the build registers them in order.
    expect(modelPluginsProblem([named('a', formsPlugin(), consentPlugin()), named('b', consentPlugin(), formsPlugin())])).toMatch(/different order/)
  })
  it('names both models and their plugins when the sets differ', () => {
    const message = modelPluginsProblem([named('shop', formsPlugin()), named('blog', formsPlugin(), consentPlugin())])!
    expect(message).toContain('"shop"')
    expect(message).toContain('"blog"')
    expect(message).toMatch(/shop: forms@[\w.-]+;/)
    expect(message).toMatch(/blog: forms@[\w.-]+, consent@[\w.-]+\)/)
    expect(message).not.toContain('registered with options')
  })
  it('says it is the options when the names and versions are equal', () => {
    const message = modelPluginsProblem([named('shop', optioned('one')), named('blog', optioned('two'))])!
    expect(message).toContain('"shop"')
    expect(message).toContain('"blog"')
    expect(message).toMatch(/registered with options that change what the build registers/)
  })
  it('names the model whose plugins cannot be collected', () => {
    expect(() => modelPluginsProblem([{ name: 'shop', config: { plugins: [formsPlugin(), formsPlugin()].map((p) => ({ ...p })) } }])).toThrow(/content model "shop"/)
  })
})

describe('relation tables of different models', () => {
  const junction = (config: Record<string, any>, name = 'post_to_tag') => buildRegistry(config).junctions.find((j) => j.tableName === name)!
  const targets = (table: any) => getTableConfig(table).foreignKeys.map((fk) => fk.reference().foreignTable)

  it('two models with the same relation table name each reference their own entities', () => {
    const a = blog()
    const b = blog()
    const ja = junction({ Post: a.Post, Tag: a.Tag })
    const jb = junction({ Post: b.Post, Tag: b.Tag })
    expect(ja.table).not.toBe(jb.table)
    expect(targets(ja.table)).toEqual(expect.arrayContaining([a.Post.table, a.Tag.table]))
    expect(targets(ja.table)).not.toContain(b.Post.table)
    expect(targets(jb.table)).toEqual(expect.arrayContaining([b.Post.table, b.Tag.table]))
    expect(targets(jb.table)).not.toContain(a.Post.table)
  })

  it('the same entities in two config objects share the table', () => {
    const a = blog()
    expect(junction({ Post: a.Post, Tag: a.Tag }).table).toBe(junction({ Tag: a.Tag, Post: a.Post, extra: 1 }).table)
  })

  it('both sides of one relation share one table', () => {
    const Tag = defineEntity('tag', { label: 'Tags', titleField: 'name', fields: { name: f.text({ required: true }), posts: f.relation({ to: () => Post, kind: 'many-to-many' }) } })
    const Post: any = defineEntity('post', { label: 'Posts', titleField: 'title', fields: { title: f.text({ required: true }), tags: f.relation({ to: () => Tag, kind: 'many-to-many' }) } })
    const reg = buildRegistry({ Post, Tag })
    const tables = reg.junctions.filter((j) => j.tableName === 'post_to_tag')
    expect(tables).toHaveLength(2)
    expect(tables[0]!.table).toBe(tables[1]!.table)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { assertAllowedStatement, buildRegistry, defineEntity, defineLocales, defineRedirects, defineSingleton, f } from '../../packages/cms/src/index'
import { applyModelOps, DEFAULT_MODEL_LIMITS, emptyModelDoc, type ModelContext, type ModelOp } from '../../packages/cms/src/model-doc'
import { modelEntities } from '../../packages/cms/src/model-map'
import {
  customTypesEnabled, customTypesLimits, describeDesignTypes, designTypesForModel, modelCountQueries, modelDdlAllow, modelPlanningBuild,
  ModelStatementRefused, planModelChange, runModelStatements,
} from '../../packages/cms/server/utils/cmsModelPlan'

// The pure parts of the server side of a site's own content types (cmsModelPlan.ts). What needs a
// running server (the transaction, the guard, the routes) is in test/api/tenants-custom.spec.ts.

const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })
const Category = defineEntity('category', { label: 'Categories', titleField: 'name', fields: { name: f.text({ required: true }) }, content: { public: true } })
const design = { locales, Category }

describe('the limits of a site\'s own types', () => {
  it('gives the defaults when the site has no setting or an odd one', () => {
    for (const raw of [undefined, null, 'x', 5, true, [], {}]) expect(customTypesLimits(raw)).toEqual(DEFAULT_MODEL_LIMITS)
    expect(DEFAULT_MODEL_LIMITS).toEqual({ types: 12, fields: 30, options: 30 })
  })

  it('takes each limit when it is a whole number from 0 to 200', () => {
    expect(customTypesLimits({ types: 3, fields: 7, options: 9 })).toEqual({ types: 3, fields: 7, options: 9 })
    expect(customTypesLimits({ types: 0, fields: 200, options: 1 })).toEqual({ types: 0, fields: 200, options: 1 })
    expect(customTypesLimits({ fields: 50 })).toEqual({ types: 12, fields: 50, options: 30 })
  })

  it('ignores a value that is not allowed, and keeps the others', () => {
    for (const bad of [201, -1, 1.5, '5', null, undefined, NaN, Infinity, true, [5]]) {
      expect(customTypesLimits({ types: bad, fields: 4, options: 6 }), String(bad)).toEqual({ types: 12, fields: 4, options: 6 })
      expect(customTypesLimits({ types: 2, fields: bad, options: 6 }), String(bad)).toEqual({ types: 2, fields: 30, options: 6 })
      expect(customTypesLimits({ types: 2, fields: 4, options: bad }), String(bad)).toEqual({ types: 2, fields: 4, options: 30 })
    }
  })

  it('switches the feature off only with enabled: false', () => {
    expect(customTypesEnabled(undefined)).toBe(true)
    expect(customTypesEnabled(null)).toBe(true)
    expect(customTypesEnabled({})).toBe(true)
    expect(customTypesEnabled({ enabled: true })).toBe(true)
    expect(customTypesEnabled({ enabled: false })).toBe(false)
    for (const odd of ['false', 0, undefined, null, '']) expect(customTypesEnabled({ enabled: odd }), String(odd)).toBe(true)
  })
})

describe('designTypesForModel', () => {
  const reg = buildRegistry({
    locales,
    Post: defineEntity('post', { label: 'Posts', titleField: 'title', fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title', unique: true }) }, content: { public: true, slug: 'slug', path: '/blog/:slug' } }),
    News: defineEntity('news', {
      label: 'News', titleField: 'title',
      fields: { title: f.text({ required: true }).localized(), slug: f.slug({ from: 'title', unique: true }).localized() },
      content: { public: true, slug: 'slug', path: { cs: '/aktuality/:slug', en: '/news/:slug' } },
    }),
    Page: defineEntity('page', { label: 'Pages', titleField: 'title', fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title', unique: true }) }, content: { public: true, slug: 'slug', path: '/:slug' } }),
    Settings: defineSingleton('settings', { label: 'Settings', titleField: 'name', fields: { name: f.text() } }),
    Note: defineEntity('note', { label: 'Notes', titleField: 'title', fields: { title: f.text({ required: true }) } }),
  } as any)
  const types = designTypesForModel(reg)
  const of = (name: string) => types.filter((t) => t.name === name)

  it('takes the first part of an address as the prefix', () => {
    expect(of('post')).toEqual([{ name: 'post', singleton: false, pathPrefix: 'blog' }])
  })

  it('gives one entry per language when the address differs by language', () => {
    expect(of('news').map((t) => t.pathPrefix).sort()).toEqual(['aktuality', 'news'])
    expect(of('news').every((t) => t.singleton === false)).toBe(true)
  })

  it('gives no prefix when the address starts with a parameter', () => {
    expect(of('page')).toEqual([{ name: 'page', singleton: false, pathPrefix: null }])
  })

  it('marks a single page, with no prefix', () => {
    expect(of('settings')).toEqual([{ name: 'settings', singleton: true, pathPrefix: null }])
  })

  it('gives no prefix to a type with no public content', () => {
    expect(of('note')).toEqual([{ name: 'note', singleton: false, pathPrefix: null }])
  })
})

describe('the chain from a document to the statements', () => {
  const now = new Date('2026-11-24T10:00:00.000Z')
  const later = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  const ctx = (extra: Partial<ModelContext> = {}): ModelContext => ({
    design: [{ name: 'category', singleton: false, pathPrefix: null }],
    limits: DEFAULT_MODEL_LIMITS,
    now,
    ...extra,
  })
  const apply = (doc: ReturnType<typeof emptyModelDoc>, ops: ModelOp[], extra: Partial<ModelContext> = {}) => applyModelOps(doc, ops, ctx(extra))
  const entitiesOf = (doc: ReturnType<typeof emptyModelDoc>) => modelEntities(doc, design, { withHidden: true }).entities as Record<string, any>
  const planningReg = (doc: ReturnType<typeof emptyModelDoc>) => modelPlanningBuild(doc, design)

  const { doc: doc1 } = apply(emptyModelDoc(), [
    { op: 'type.add', name: 'custom_course', label: { cs: 'Kurzy' } },
    { op: 'field.add', type: 'custom_course', field: { key: 'teacher', type: 'text', label: { cs: 'Lektor' } } },
    { op: 'field.add', type: 'custom_course', field: { key: 'level', type: 'select', label: { cs: 'Úroveň' }, options: [{ label: { cs: 'Začátečníci' } }, { label: { cs: 'Pokročilí' } }] } },
    { op: 'field.add', type: 'custom_course', field: { key: 'cover', type: 'media', label: { cs: 'Obrázek' } } },
    { op: 'field.add', type: 'custom_course', field: { key: 'author', type: 'relation', to: 'category', label: { cs: 'Autor' } } },
  ], { counts: { entries: { custom_course: 0 } } })
  const entities1 = entitiesOf(doc1)

  describe('modelCountQueries', () => {
    it('counts the entries of the type, and the values and gaps of a field the operation names', () => {
      const out = modelCountQueries(entities1, [{ op: 'field.update', type: 'custom_course', key: 'teacher', required: true }])
      expect(out).toEqual([
        { kind: 'entries', key: 'custom_course', text: 'select count(*)::int as n from "custom_course"' },
        { kind: 'values', key: 'custom_course.teacher', text: 'select count(*)::int as n from "custom_course" where "teacher" is not null' },
        { kind: 'missing', key: 'custom_course.teacher', text: 'select count(*)::int as n from "custom_course" where "teacher" is null' },
      ])
    })

    it('uses the column of a picture, which ends in _id', () => {
      const out = modelCountQueries(entities1, [{ op: 'field.update', type: 'custom_course', key: 'cover', label: { cs: 'Titulka' } }])
      expect(out.find((q) => q.kind === 'values')!.text).toContain('"cover_id" is not null')
      expect(out.find((q) => q.kind === 'missing')!.text).toContain('"cover_id" is null')
    })

    it('makes no query for a type or a field that does not exist', () => {
      expect(modelCountQueries(entities1, [{ op: 'field.update', type: 'custom_nothing', key: 'teacher', required: true }])).toEqual([])
      const out = modelCountQueries(entities1, [{ op: 'field.update', type: 'custom_course', key: 'nothing', required: true }])
      expect(out.map((q) => q.kind)).toEqual(['entries'])
    })

    it('never lets the text of a request reach the SQL', () => {
      const evil = [
        { op: 'field.update', type: 'custom_course', key: 'teacher"; drop table "cms_users"; --', required: true },
        { op: 'field.update', type: 'custom_course" where 1=1; --', key: 'teacher', required: true },
      ] as unknown as ModelOp[]
      const out = modelCountQueries(entities1, evil)
      expect(out.map((q) => q.kind)).toEqual(['entries'])
      for (const q of out) expect(q.text).not.toMatch(/drop|cms_users|1=1/i)
    })

    it('does not take a name of Object.prototype for a type or a field', () => {
      for (const type of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
        expect(modelCountQueries(entities1, [{ op: 'field.update', type, key: 'teacher', required: true } as unknown as ModelOp]), type).toEqual([])
      }
      for (const key of ['__proto__', 'constructor', 'toString']) {
        expect(modelCountQueries(entities1, [{ op: 'field.update', type: 'custom_course', key, required: true } as unknown as ModelOp]).map((q) => q.kind), key).toEqual(['entries'])
      }
    })

    it('makes none for a new type or a purge', () => {
      expect(modelCountQueries(entities1, [{ op: 'type.add', name: 'custom_other', label: { cs: 'Jiné' } }])).toEqual([])
      expect(modelCountQueries({}, [{ op: 'purge', types: ['custom_course'] }, { op: 'purge', fields: [{ type: 'custom_course', key: 'teacher' }] }])).toEqual([])
    })
  })

  describe('modelDdlAllow', () => {
    it('allows SET NOT NULL for a field made required', () => {
      const { doc: after } = apply(doc1, [{ op: 'field.update', type: 'custom_course', key: 'teacher', required: true }], { counts: { missing: { 'custom_course.teacher': 0 } } })
      const allow = modelDdlAllow(doc1, after, [{ op: 'field.update', type: 'custom_course', key: 'teacher', required: true }], entities1, planningReg(doc1).reg)
      expect(allow.setNotNull).toEqual(['custom_course.teacher'])
    })

    it('allows SET NOT NULL for a restored field that stays required', () => {
      const { doc: required } = apply(doc1, [{ op: 'field.update', type: 'custom_course', key: 'teacher', required: true }], { counts: { missing: { 'custom_course.teacher': 0 } } })
      const { doc: hidden } = apply(required, [{ op: 'field.remove', type: 'custom_course', key: 'teacher' }])
      const restore: ModelOp[] = [{ op: 'field.restore', type: 'custom_course', key: 'teacher' }]
      const back = apply(hidden, restore, { counts: { missing: { 'custom_course.teacher': 0 } } })
      expect(back.notes).toEqual([])
      expect(modelDdlAllow(hidden, back.doc, restore, entitiesOf(hidden), planningReg(hidden).reg).setNotNull).toEqual(['custom_course.teacher'])
    })

    it('allows nothing for a field restored as optional', () => {
      const { doc: required } = apply(doc1, [{ op: 'field.update', type: 'custom_course', key: 'teacher', required: true }], { counts: { missing: { 'custom_course.teacher': 0 } } })
      const { doc: hidden } = apply(required, [{ op: 'field.remove', type: 'custom_course', key: 'teacher' }])
      const restore: ModelOp[] = [{ op: 'field.restore', type: 'custom_course', key: 'teacher' }]
      const back = apply(hidden, restore, { counts: { missing: { 'custom_course.teacher': 4 } } })
      expect(back.notes.map((n) => n.code)).toEqual(['restored-optional'])
      expect(modelDdlAllow(hidden, back.doc, restore, entitiesOf(hidden), planningReg(hidden).reg).setNotNull).toEqual([])
    })

    it('allows the drops of a purged type: its tables and its choice types', () => {
      const { doc: hidden } = apply(doc1, [{ op: 'type.remove', type: 'custom_course' }])
      const purge: ModelOp[] = [{ op: 'purge', types: ['custom_course'] }]
      const { doc: purged } = apply(hidden, purge, { now: later(31), internal: true })
      const b = planningReg(hidden)
      const allow = modelDdlAllow(hidden, purged, purge, b.entities, b.reg)
      expect(allow.drop?.tables).toContain('custom_course')
      expect(allow.drop?.types).toContain('custom_course_level')
      expect(allow.setNotNull).toEqual([])
    })

    it('allows the drop of a purged select field: its column and its choice type', () => {
      const { doc: hidden } = apply(doc1, [{ op: 'field.remove', type: 'custom_course', key: 'level' }])
      const purge: ModelOp[] = [{ op: 'purge', fields: [{ type: 'custom_course', key: 'level' }] }]
      const { doc: purged } = apply(hidden, purge, { now: later(31), internal: true })
      const b = planningReg(hidden)
      const allow = modelDdlAllow(hidden, purged, purge, b.entities, b.reg)
      expect(allow.drop?.columns).toEqual(['custom_course.level'])
      expect(allow.drop?.types).toEqual(['custom_course_level'])
      expect(allow.drop?.tables).toEqual([])
    })
  })

  describe('planModelChange', () => {
    it('adds a required column to a type with no entries as optional first, then makes it required', () => {
      const ops: ModelOp[] = [{ op: 'field.add', type: 'custom_course', field: { key: 'room', type: 'text', required: true, label: { cs: 'Místnost' } } }]
      const { doc: after } = apply(doc1, ops, { counts: { entries: { custom_course: 0 } } })
      const out = planModelChange(doc1, after, design, ops)
      expect(out.refused).toEqual([])
      expect(out.statements).toHaveLength(2)
      expect(out.statements[0]).toMatch(/^ALTER TABLE "custom_course" ADD COLUMN "room" text$/)
      expect(out.statements[1]).toBe('ALTER TABLE "custom_course" ALTER COLUMN "room" SET NOT NULL')
    })

    it('makes the tables of a new type', () => {
      const ops: ModelOp[] = [
        { op: 'type.add', name: 'custom_branch', label: { cs: 'Pobočky' } },
        { op: 'field.add', type: 'custom_branch', field: { key: 'city', type: 'text', required: true, label: { cs: 'Město' } } },
      ]
      const { doc: after } = apply(doc1, ops, { counts: { entries: { custom_branch: 0 } } })
      const out = planModelChange(doc1, after, design, ops)
      expect(out.refused).toEqual([])
      expect(out.statements.some((s) => s.startsWith('CREATE TABLE "custom_branch"'))).toBe(true)
    })

    it('hides a required field with one DROP NOT NULL', () => {
      const { doc: required } = apply(doc1, [{ op: 'field.update', type: 'custom_course', key: 'teacher', required: true }], { counts: { missing: { 'custom_course.teacher': 0 } } })
      const ops: ModelOp[] = [{ op: 'field.remove', type: 'custom_course', key: 'teacher' }]
      const { doc: after } = apply(required, ops)
      expect(planModelChange(required, after, design, ops)).toEqual({ statements: ['ALTER TABLE "custom_course" ALTER COLUMN "teacher" DROP NOT NULL'], refused: [] })
    })

    it('makes an existing optional field required with SET NOT NULL, as the function allows it', () => {
      const ops: ModelOp[] = [{ op: 'field.update', type: 'custom_course', key: 'teacher', required: true }]
      const { doc: after } = apply(doc1, ops, { counts: { missing: { 'custom_course.teacher': 0 } } })
      expect(planModelChange(doc1, after, design, ops)).toEqual({ statements: ['ALTER TABLE "custom_course" ALTER COLUMN "teacher" SET NOT NULL'], refused: [] })
    })
  })
})

describe('runModelStatements', () => {
  it('runs the allowed statements in order', async () => {
    const ran: string[] = []
    const list = ['ALTER TABLE "custom_a" ADD COLUMN "b" text', 'ALTER TABLE "custom_a" ALTER COLUMN "b" SET NOT NULL', 'DROP TABLE "custom_a"']
    await runModelStatements(async (text) => { ran.push(text) }, list)
    expect(ran).toEqual(list)
    for (const s of ran) expect(() => assertAllowedStatement(s), s).not.toThrow()
  })

  it('runs nothing for no statements', async () => {
    const exec = vi.fn()
    await runModelStatements(exec, [])
    expect(exec).not.toHaveBeenCalled()
  })

  it('refuses a statement that is not allowed (the change answers 422 not-allowed), and does not run it or the ones after it', async () => {
    const ran: string[] = []
    const exec = async (text: string) => { ran.push(text) }
    const err: any = await runModelStatements(exec, ['ALTER TABLE "custom_a" ADD COLUMN "b" text', 'DROP TABLE "cms_users"', 'DROP TABLE "custom_a"']).then(() => null, (e) => e)
    expect(err).toBeInstanceOf(ModelStatementRefused)
    expect(err.reason).toMatch(/not allowed/)
    expect(ran).toEqual(['ALTER TABLE "custom_a" ADD COLUMN "b" text'])
  })

  it('refuses two statements joined in one text', async () => {
    const exec = vi.fn()
    const err: any = await runModelStatements(exec, ['ALTER TABLE "custom_a" ADD COLUMN "b" text; DROP TABLE "post"']).then(() => null, (e) => e)
    expect(err).toBeInstanceOf(ModelStatementRefused)
    expect(exec).not.toHaveBeenCalled()
  })

  it('only ever passes statements the allowed list accepts', async () => {
    const passed: string[] = []
    const mixed = ['CREATE TYPE "custom_a_k" AS ENUM(\'a\')', 'DROP TYPE "cms_role"', 'DROP TYPE "custom_a_k"']
    await runModelStatements(async (t) => { passed.push(t) }, mixed).catch(() => {})
    expect(passed).toEqual(['CREATE TYPE "custom_a_k" AS ENUM(\'a\')'])
    for (const s of passed) expect(() => assertAllowedStatement(s)).not.toThrow()
  })
})

describe('describeDesignTypes', () => {
  it('names each type of the design with its labels and its fields, read-only', () => {
    const reg = buildRegistry({
      Post: defineEntity('post', { label: { en: 'Posts' }, labelSingular: { en: 'Post' }, icon: 'i-lucide-newspaper', titleField: 'title', fields: { title: f.text({ required: true }).label({ en: 'Title' }), views: f.number().optional() } }),
      Settings: defineSingleton('settings', { label: 'Settings', titleField: 'name', fields: { name: f.text() } }),
    } as any)
    const out = describeDesignTypes(reg)
    expect(out.find((t) => t.name === 'post')).toEqual({
      name: 'post', label: { en: 'Posts' }, labelSingular: { en: 'Post' }, icon: 'i-lucide-newspaper', singleton: false, relatable: true,
      fields: [{ key: 'title', type: 'text', label: { en: 'Title' } }, { key: 'views', type: 'number', label: 'views' }],
    })
    expect(out.find((t) => t.name === 'settings')).toMatchObject({ singleton: true, relatable: false, icon: null, labelSingular: 'Settings' })
  })

  it('offers a collection of content as the target of a link, and not redirects', () => {
    const out = describeDesignTypes(buildRegistry({
      Post: defineEntity('post', { label: 'Posts', titleField: 'title', fields: { title: f.text({ required: true }) } }),
      Redirect: defineRedirects(),
    } as any))
    expect(out.find((t) => t.name === 'post')!.relatable).toBe(true)
    expect(out.find((t) => t.name === 'redirect')!.relatable).toBe(false)
  })
})

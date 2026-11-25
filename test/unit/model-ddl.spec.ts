import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { buildRegistry, defineEntity, defineLocales, f } from '../../packages/cms/src/index'
import { assertAllowedStatement, customShape, planModelDdl, type DbShape } from '../../packages/cms/src/model-ddl'
import { applyModelOps, DEFAULT_MODEL_LIMITS, emptyModelDoc, modelPurgeDue, type ModelContext, type ModelDoc } from '../../packages/cms/src/model-doc'
import { modelEntities } from '../../packages/cms/src/model-map'

// drizzle-kit is a dependency of packages/cms, not of the root.
const kit = createRequire(new URL('../../packages/cms/package.json', import.meta.url))('drizzle-kit/api')

const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })
const Category = defineEntity('category', { label: 'Categories', titleField: 'name', fields: { name: f.text({ required: true }) }, content: { public: true } })
const design = { locales, Category }

function custom(step: 1 | 2 | 3) {
  const Teacher: any = defineEntity('custom_teacher', {
    label: 'Teachers', titleField: 'name',
    fields: { name: f.text({ required: true }), photo: f.media({ accept: 'image/*' }).optional() },
  })
  const Course = defineEntity('custom_course', {
    label: 'Courses', titleField: 'title',
    fields: {
      title: f.text({ required: true }).localized(),
      slug: f.slug({ from: 'title', unique: true }).localized(),
      price: f.number({ int: false }).optional(),
      level: f.select({ options: step === 1 ? (['beginner', 'advanced'] as const) : (['beginner', 'advanced', 'expert'] as const), default: 'beginner' }),
      body: f.richtext().optional().localized(),
      cover: f.media({ accept: 'image/*' }).optional(),
      category: f.relation({ to: () => Category, kind: 'many-to-one' }),
      teachers: f.relation({ to: () => Teacher, kind: 'many-to-many' }),
      ...(step === 2
        ? {
            seats: f.number().optional(),
            online: f.boolean(),
            perex: f.text({ multiline: true }).optional().localized(),
            kind: f.select({ options: ['course', 'workshop'] as const, default: 'course' }),
            gallery: f.gallery(),
            startsAt: f.datetime().optional(),
          }
        : {}),
    },
    content: { public: true, slug: 'slug', path: '/kurzy/:slug' },
  })
  return { Teacher, Course }
}

const EMPTY: DbShape = { enums: {}, tables: {} }
const regOf = (step: 1 | 2 | 3) => buildRegistry({ ...design, ...custom(step) } as any)
const clone = <T>(x: T): T => structuredClone(x)

// What drizzle-kit gets: the entity tables, the translation tables, the relation tables, the
// media table, and the choice types (taken from the enum columns).
function schemaOf(reg: any) {
  const s: Record<string, any> = {}
  for (const e of reg.entities) {
    s[e.name] = e.table
    if (e.localesTable) s[`${e.name}_locales`] = e.localesTable
    for (const en of e.enums) s[en.varName] = e.table[en.key].enum
  }
  for (const j of reg.junctions) s[j.name] = j.table
  s.cmsMedia = reg.cmsMedia
  return s
}

// The comparison changes spelling only:
//  - `"public".` is removed (drizzle-kit writes the schema, the planner does not),
//  - a run of white space becomes one space,
//  - a trailing `;` is removed,
//  - a name longer than 63 bytes is cut to 63 bytes, as Postgres cuts it when it runs drizzle-kit's
//    statement (the planner writes the cut name itself; the relation table of the fixture has such names).
// Nothing else is changed: names, lists, types, defaults and every word of a statement must be equal.
// Both lists are sorted, because drizzle-kit orders its statements differently from the planner.
const postgresName = (name: string) => {
  let out = ''
  for (const ch of name) {
    if (Buffer.byteLength(out + ch) > 63) break
    out += ch
  }
  return out
}
const norm = (s: string) =>
  s.replace(/"public"\./g, '').replace(/"([^"]+)"/g, (_m, name: string) => `"${postgresName(name)}"`).replace(/\s+/g, ' ').trim().replace(/;$/, '')
const sorted = (list: string[]) => list.map(norm).sort()

const allStatements: string[] = []
const plan = (...args: Parameters<typeof planModelDdl>) => {
  const out = planModelDdl(...args)
  allStatements.push(...out.statements)
  return out
}

const kitPlan = async (from: any, to: any): Promise<string[]> => {
  const j0 = kit.generateDrizzleJson(from)
  const j1 = kit.generateDrizzleJson(to, j0.id)
  return kit.generateMigration(j0, j1)
}

describe('planModelDdl against drizzle-kit', () => {
  const reg0 = buildRegistry(design as any)
  const reg1 = regOf(1)
  const reg2 = regOf(2)
  const reg3 = regOf(3)
  const shape1 = customShape(reg1)

  it('plans two new types like drizzle-kit', async () => {
    const out = plan(EMPTY, shape1)
    expect(out.refused).toEqual([])
    const theirs = await kitPlan(schemaOf(reg0), schemaOf(reg1))
    expect(sorted(out.statements)).toEqual(sorted(theirs))
    expect(out.statements.length).toBeGreaterThan(10)
  })

  it('plans new fields on a type like drizzle-kit', async () => {
    const out = plan(customShape(regOf(3)), customShape(reg2))
    expect(out.refused).toEqual([])
    const theirs = await kitPlan(schemaOf(reg3), schemaOf(reg2))
    expect(sorted(out.statements)).toEqual(sorted(theirs))
    expect(out.statements.some((s) => s.includes('ADD COLUMN "online" boolean DEFAULT false NOT NULL'))).toBe(true)
  })

  it('plans a new choice like drizzle-kit', async () => {
    const out = plan(shape1, customShape(reg3))
    expect(out.refused).toEqual([])
    expect(out.statements).toEqual([`ALTER TYPE "custom_course_level" ADD VALUE 'expert'`])
    const theirs = await kitPlan(schemaOf(reg1), schemaOf(reg3))
    expect(sorted(out.statements)).toEqual(sorted(theirs))
  })

  it('plans nothing when nothing changed', () => {
    expect(plan(shape1, clone(shape1))).toEqual({ statements: [], refused: [] })
  })

  it('orders types, tables, columns, indexes, foreign keys', () => {
    const out = plan(EMPTY, shape1)
    const kinds = out.statements.map((s) => s.split(' ').slice(0, 2).join(' '))
    const last = (k: string) => kinds.lastIndexOf(k)
    expect(last('CREATE TYPE')).toBeLessThan(kinds.indexOf('CREATE TABLE'))
    expect(last('CREATE TABLE')).toBeLessThan(kinds.indexOf('ALTER TABLE'))
  })
})

describe('hiding', () => {
  const build = (optional: boolean) => {
    const Pic = defineEntity('custom_pic', { label: 'Pics', titleField: 'name', fields: { name: f.text({ required: true }) } })
    void Pic
    const maybe = <T extends { optional: () => any }>(x: T) => (optional ? x.optional() : x)
    const T = defineEntity('custom_thing', {
      label: 'Things', titleField: 'name',
      fields: {
        name: f.text({ required: true }),
        note: maybe(f.text({ required: true })),
        picture: maybe(f.media({ accept: 'image/*' })),
        extra: f.text().optional(),
      },
    })
    return customShape(buildRegistry({ T } as any))
  }

  it('is DROP NOT NULL for the required fields, nothing for the optional one, nothing for the foreign key', () => {
    const before = build(false)
    const after = build(true)
    // The picture's foreign key goes from restrict to set null.
    expect(before.tables.custom_thing!.fks.map((k) => k.onDelete)).not.toEqual(after.tables.custom_thing!.fks.map((k) => k.onDelete))
    const out = plan(before, after)
    expect(out.refused).toEqual([])
    expect(out.statements).toEqual([
      `ALTER TABLE "custom_thing" ALTER COLUMN "note" DROP NOT NULL`,
      `ALTER TABLE "custom_thing" ALTER COLUMN "picture_id" DROP NOT NULL`,
    ])
  })
})

describe('purge', () => {
  const full = customShape(regOf(2))
  const gone = (): DbShape => {
    const s = clone(full)
    delete s.tables.custom_teacher
    delete s.tables.custom_course_to_custom_teacher
    for (const k of Object.keys(s.tables)) if (k.includes('teacher')) delete s.tables[k]
    s.tables.custom_course!.columns = s.tables.custom_course!.columns.filter((c) => c.name !== 'seats')
    delete s.enums.custom_course_kind
    return s
  }

  it('refuses everything that is gone without an allow list, and plans nothing', () => {
    const after = gone()
    const out = plan(full, after)
    expect(out.statements).toEqual([])
    expect(out.refused.join('\n')).toContain('custom_course.seats')
    expect(out.refused.join('\n')).toContain('custom_teacher')
    expect(out.refused.join('\n')).toContain('custom_course_kind')
  })

  it('drops columns, then tables (the referencing one first), then types', () => {
    const after = gone()
    const teacherTables = Object.keys(full.tables).filter((k) => k.includes('teacher'))
    const out = plan(full, after, {
      drop: { columns: ['custom_course.seats'], tables: teacherTables, types: ['custom_course_kind'] },
    })
    // The foreign key of custom_course.kind's removal is not needed: only the column "seats" is dropped.
    expect(out.statements[0]).toBe('ALTER TABLE "custom_course" DROP COLUMN "seats"')
    const tableDrops = out.statements.filter((s) => s.startsWith('DROP TABLE'))
    expect(tableDrops.length).toBe(teacherTables.length)
    const junction = Object.values(full.tables).find((t) => t.fks.some((k) => k.table === 'custom_teacher'))!
    expect(tableDrops.indexOf(`DROP TABLE "${junction.name}"`)).toBeLessThan(tableDrops.indexOf('DROP TABLE "custom_teacher"'))
    expect(out.statements[out.statements.length - 1]).toBe('DROP TYPE "custom_course_kind"')
    expect(out.statements.some((s) => s.includes('CASCADE'))).toBe(false)
  })

  it('a partial allow drops only what is named and refuses the rest', () => {
    const after = gone()
    const out = plan(full, after, { drop: { columns: ['custom_course.seats'] } })
    expect(out.statements).toEqual(['ALTER TABLE "custom_course" DROP COLUMN "seats"'])
    expect(out.refused.join('\n')).toContain('custom_teacher')
    expect(out.refused.join('\n')).toContain('custom_course_kind')
  })

  it('ignores an allowed drop of something that is still there', () => {
    expect(plan(full, clone(full), { drop: { columns: ['custom_course.seats'], tables: ['custom_teacher'], types: ['custom_course_kind'] } })).toEqual({ statements: [], refused: [] })
  })

  it('gives a column of a dropped table no statement of its own', () => {
    const after = clone(full)
    delete after.tables.custom_teacher
    const refs = Object.values(after.tables).filter((t) => t.fks.some((k) => k.table === 'custom_teacher'))
    for (const t of refs) delete after.tables[t.name]
    const names = Object.keys(full.tables).filter((k) => !after.tables[k])
    const out = plan(full, after, { drop: { tables: names, columns: ['custom_teacher.name'] } })
    expect(out.statements.every((s) => s.startsWith('DROP TABLE'))).toBe(true)
  })
})

describe('SET NOT NULL', () => {
  const before = customShape(regOf(1))
  const after = clone(before)
  after.tables.custom_course!.columns.find((c) => c.name === 'price')!.notNull = true
  after.tables.custom_course!.columns.find((c) => c.name === 'cover_id')!.notNull = true

  it('is refused without the allow list', () => {
    const out = plan(before, after)
    expect(out.statements).toEqual([])
    expect(out.refused).toHaveLength(2)
  })

  it('is planned for the named columns only', () => {
    const out = plan(before, after, { setNotNull: ['custom_course.price'] })
    expect(out.statements).toEqual(['ALTER TABLE "custom_course" ALTER COLUMN "price" SET NOT NULL'])
    expect(out.refused).toHaveLength(1)
    expect(out.refused[0]).toContain('custom_course.cover_id')
  })
})

describe('defaults', () => {
  it('sets and drops a default', () => {
    const before = customShape(regOf(1))
    const after = clone(before)
    const cols = after.tables.custom_course!.columns
    cols.find((c) => c.name === 'level')!.default = `'advanced'`
    cols.find((c) => c.name === 'price')!.default = '0'
    cols.find((c) => c.name === 'created_at')!.default = null
    const out = plan(before, after)
    expect(out.refused).toEqual([])
    expect(out.statements).toEqual([
      `ALTER TABLE "custom_course" ALTER COLUMN "price" SET DEFAULT 0`,
      `ALTER TABLE "custom_course" ALTER COLUMN "level" SET DEFAULT 'advanced'`,
      `ALTER TABLE "custom_course" ALTER COLUMN "created_at" DROP DEFAULT`,
    ])
  })
})

describe('refusals', () => {
  const before = customShape(regOf(1))
  const refusedBy = (change: (s: DbShape) => void, allow?: Parameters<typeof planModelDdl>[2]) => {
    const after = clone(before)
    change(after)
    return planModelDdl(before, after, allow)
  }
  const col = (s: DbShape, name: string) => s.tables.custom_course!.columns.find((c) => c.name === name)!

  it('a changed column type', () => {
    const out = refusedBy((s) => { col(s, 'price').type = 'text' })
    expect(out.statements).toEqual([])
    expect(out.refused[0]).toContain('custom_course.price')
  })

  it('a removed choice value', () => {
    const out = refusedBy((s) => { s.enums.custom_course_level = ['beginner'] })
    expect(out.statements).toEqual([])
    expect(out.refused[0]).toContain('advanced')
  })

  it('a column made unique', () => {
    const out = refusedBy((s) => { col(s, 'price').unique = 'custom_course_price_unique' })
    expect(out.statements).toEqual([])
    expect(out.refused[0]).toContain('custom_course.price')
  })

  it('a new unique column on an existing table', () => {
    const out = refusedBy((s) => {
      s.tables.custom_course!.columns.push({ name: 'code', type: 'text', enum: false, notNull: false, default: null, primary: false, unique: 'custom_course_code_unique' })
    })
    expect(out.statements).toEqual([])
    expect(out.refused[0]).toContain('custom_course.code')
  })

  it('a new index on an existing table', () => {
    const out = refusedBy((s) => { s.tables.custom_course!.indexes.push({ name: 'custom_course_price_idx', unique: false, columns: ['price'] }) })
    expect(out.statements).toEqual([])
    expect(out.refused[0]).toContain('custom_course_price_idx')
  })

  it('a removed index', () => {
    const out = refusedBy((s) => { s.tables.custom_course_locales!.indexes = [] })
    expect(out.statements).toEqual([])
    expect(out.refused.length).toBeGreaterThan(0)
  })

  it('a removed foreign key', () => {
    const out = refusedBy((s) => { s.tables.custom_course!.fks = [] })
    expect(out.statements).toEqual([])
    expect(out.refused.length).toBeGreaterThan(0)
  })

  it('a foreign key with another target', () => {
    const out = refusedBy((s) => { s.tables.custom_course!.fks[0]!.table = 'custom_teacher' })
    expect(out.statements).toEqual([])
    expect(out.refused[0]).toContain('changes its columns or its target')
  })

  it('a foreign key that differs only in onDelete is not refused and not planned', () => {
    const out = refusedBy((s) => { for (const k of s.tables.custom_course!.fks) k.onDelete = 'set null' })
    expect(out).toEqual({ statements: [], refused: [] })
  })

  it('a changed primary key', () => {
    const out = refusedBy((s) => { s.tables.custom_course!.pk = { name: 'custom_course_pk', columns: ['id', 'slug'] } })
    expect(out.statements).toEqual([])
    expect(out.refused[0]).toContain('primary key')
  })

  it('a table without the prefix', () => {
    const out = planModelDdl(EMPTY, customShape(buildRegistry({ ...design, ...custom(1) } as any)))
    expect(out.refused).toEqual([])
    const after = clone(before)
    after.tables.category_to_custom_course = {
      name: 'category_to_custom_course', columns: [{ name: 'id', type: 'uuid', enum: false, notNull: true, default: null, primary: true, unique: null }],
      fks: [], indexes: [], pk: null,
    }
    const refused = planModelDdl(before, after)
    expect(refused.statements).toEqual([])
    expect(refused.refused[0]).toContain('category_to_custom_course')
  })

  it('a many-to-many to a design collection makes a relation table without the prefix', () => {
    const Course = defineEntity('custom_course', {
      label: 'Courses', titleField: 'title',
      fields: { title: f.text({ required: true }), categories: f.relation({ to: () => Category, kind: 'many-to-many' }) },
    })
    const shape = customShape(buildRegistry({ ...design, Course } as any))
    const name = Object.keys(shape.tables).find((k) => !k.startsWith('custom_'))
    expect(name).toBe('category_to_custom_course')
    const out = planModelDdl(EMPTY, shape)
    expect(out.statements).toEqual([])
    expect(out.refused[0]).toContain('category_to_custom_course')
  })

  it('a required column added without a default', () => {
    const out = refusedBy((s) => {
      s.tables.custom_course!.columns.push({ name: 'must', type: 'text', enum: false, notNull: true, default: null, primary: false, unique: null })
    })
    expect(out.statements).toEqual([])
    expect(out.refused[0]).toContain('custom_course.must')
  })

  it('a required column added with a default is planned', () => {
    const after = clone(before)
    after.tables.custom_course!.columns.push({ name: 'must', type: 'text', enum: false, notNull: true, default: `'a'`, primary: false, unique: null })
    expect(plan(before, after).statements).toEqual([`ALTER TABLE "custom_course" ADD COLUMN "must" text DEFAULT 'a' NOT NULL`])
  })

  it('a foreign key on a new column is planned', () => {
    const after = clone(before)
    after.tables.custom_course!.columns.push({ name: 'boss_id', type: 'uuid', enum: false, notNull: false, default: null, primary: false, unique: null })
    after.tables.custom_course!.fks.push({ name: 'custom_course_boss_id_custom_teacher_id_fk', columns: ['boss_id'], table: 'custom_teacher', foreign: ['id'], onDelete: 'set null' })
    const out = plan(before, after)
    expect(out.statements).toEqual([
      'ALTER TABLE "custom_course" ADD COLUMN "boss_id" uuid',
      'ALTER TABLE "custom_course" ADD CONSTRAINT "custom_course_boss_id_custom_teacher_id_fk" FOREIGN KEY ("boss_id") REFERENCES "custom_teacher"("id") ON DELETE set null ON UPDATE no action',
    ])
  })
})

describe('names of 63 bytes', () => {
  const before = customShape(regOf(1))
  const withColumn = (name: string): DbShape => {
    const after = clone(before)
    after.tables.custom_course!.columns.push({ name, type: 'text', enum: false, notNull: false, default: null, primary: false, unique: null })
    return after
  }

  it('accepts a column of exactly 63 bytes and refuses 64', () => {
    expect(planModelDdl(before, withColumn('a'.repeat(63))).refused).toEqual([])
    const out = planModelDdl(before, withColumn('a'.repeat(64)))
    expect(out.statements).toEqual([])
    expect(out.refused[0]).toContain('column name')
  })

  it('counts bytes, not characters', () => {
    const out = planModelDdl(before, withColumn('č'.repeat(32)))
    expect(out.refused[0]).toContain('column name')
  })

  it('refuses a table or a choice type of 64 bytes', () => {
    const table = clone(EMPTY)
    const name = `custom_${'a'.repeat(57)}`
    table.tables[name] = { name, columns: [], fks: [], indexes: [], pk: null }
    expect(planModelDdl(EMPTY, table).refused[0]).toContain('table name')
    expect(planModelDdl(EMPTY, { enums: { [name]: ['a'] }, tables: {} }).refused[0]).toContain('choice type name')
  })

  it('cuts a long foreign key name to 63 bytes in the statement', () => {
    const after = withColumn('boss_id')
    const long = `custom_course_boss_id_${'y'.repeat(60)}_fk`
    after.tables.custom_course!.fks.push({ name: long, columns: ['boss_id'], table: 'custom_teacher', foreign: ['id'], onDelete: 'cascade' })
    const out = plan(before, after)
    expect(out.refused).toEqual([])
    const cut = long.slice(0, 63)
    expect(out.statements[1]).toBe(`ALTER TABLE "custom_course" ADD CONSTRAINT "${cut}" FOREIGN KEY ("boss_id") REFERENCES "custom_teacher"("id") ON DELETE cascade ON UPDATE no action`)
    expect(cut.length).toBe(63)
  })

  it('cuts at a character boundary', () => {
    const after = withColumn('boss_id')
    const long = `custom_course_${'č'.repeat(40)}`
    after.tables.custom_course!.fks.push({ name: long, columns: ['boss_id'], table: 'custom_teacher', foreign: ['id'], onDelete: 'cascade' })
    const out = plan(before, after)
    expect(out.statements[1]).toContain(`"custom_course_${'č'.repeat(24)}"`)
  })

  it('compares the cut names, so an unchanged long name is not a change', () => {
    const t = clone(before)
    const long = `custom_course_boss_id_${'y'.repeat(60)}_fk`
    t.tables.custom_course!.fks.push({ name: long, columns: ['cover_id'], table: 'cms_media', foreign: ['id'], onDelete: 'cascade' })
    const was = clone(t)
    was.tables.custom_course!.fks[was.tables.custom_course!.fks.length - 1]!.name = long.slice(0, 63)
    expect(planModelDdl(was, t)).toEqual({ statements: [], refused: [] })
  })

  it('refuses two constraint names of one table that become equal after the cut', () => {
    const after = withColumn('boss_id')
    const base = `custom_course_${'z'.repeat(60)}`
    after.tables.custom_course!.fks.push({ name: `${base}_a`, columns: ['boss_id'], table: 'custom_teacher', foreign: ['id'], onDelete: 'cascade' })
    after.tables.custom_course!.fks.push({ name: `${base}_b`, columns: ['boss_id'], table: 'custom_teacher', foreign: ['id'], onDelete: 'cascade' })
    const out = planModelDdl(before, after)
    expect(out.statements).toEqual([])
    expect(out.refused[0]).toContain('custom_course')
  })

  it('refuses an index name that two tables share, or that is also a table name', () => {
    const after = clone(before)
    after.tables.custom_teacher!.indexes.push({ name: 'custom_dup', unique: false, columns: ['name'] })
    after.tables.custom_course!.indexes.push({ name: 'custom_dup', unique: false, columns: ['price'] })
    expect(planModelDdl(before, after).refused.join()).toContain('custom_dup')
    const second = clone(before)
    second.tables.custom_teacher!.indexes.push({ name: 'custom_course', unique: false, columns: ['name'] })
    expect(planModelDdl(before, second).refused.join()).toContain('custom_course')
  })
})

describe('a name with a doubled quote', () => {
  it('is written and accepted', () => {
    const name = 'custom_a"b'
    const shape: DbShape = {
      enums: {},
      tables: { [name]: { name, columns: [{ name: 'i"d', type: 'uuid', enum: false, notNull: true, default: null, primary: true, unique: null }], fks: [], indexes: [], pk: null } },
    }
    const out = plan(EMPTY, shape)
    expect(out.refused).toEqual([])
    expect(out.statements).toEqual(['CREATE TABLE "custom_a""b" (\n\t"i""d" uuid PRIMARY KEY NOT NULL\n)'])
    expect(() => assertAllowedStatement('DROP TABLE "custom_a""b"')).not.toThrow()
  })
})

// The whole chain the server runs: operations change the document, the mapper builds it with the
// hidden things, and the planner compares the two builds.
describe('from the document to the statements', () => {
  const doc0 = emptyModelDoc()
  const now = new Date('2026-11-24T10:00:00.000Z')
  const later = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  const ctx = (extra: Partial<ModelContext> = {}): ModelContext => ({
    design: [{ name: 'category', singleton: false, pathPrefix: null }],
    limits: DEFAULT_MODEL_LIMITS,
    now,
    ...extra,
  })
  const shapeOf = (doc: ModelDoc) => customShape(buildRegistry({ ...design, ...modelEntities(doc, design, { withHidden: true }).entities }))
  const visible = (doc: ModelDoc) => modelEntities(doc, design).entities

  // A new type with a page and publishing, and fields of most kinds, on a type known to be empty.
  const { doc: doc1 } = applyModelOps(doc0, [
    { op: 'type.add', name: 'custom_course', label: { cs: 'Kurzy' }, page: {}, publish: true },
    { op: 'field.add', type: 'custom_course', field: { key: 'teacher', type: 'text', required: true, label: { cs: 'Lektor' } } },
    { op: 'field.add', type: 'custom_course', field: { key: 'price', type: 'number', decimal: true, label: { cs: 'Cena' } } },
    { op: 'field.add', type: 'custom_course', field: { key: 'level', type: 'select', required: true, default: 'zacatecnici', label: { cs: 'Úroveň' }, options: [{ label: { cs: 'Začátečníci' } }, { label: { cs: 'Pokročilí' } }] } },
    { op: 'field.add', type: 'custom_course', field: { key: 'cover', type: 'media', label: { cs: 'Obrázek' } } },
    { op: 'field.add', type: 'custom_course', field: { key: 'category', type: 'relation', to: 'category', label: { cs: 'Kategorie' } } },
    { op: 'field.add', type: 'custom_course', field: { key: 'photos', type: 'gallery', label: { cs: 'Fotky' } } },
  ], ctx({ counts: { entries: { custom_course: 0 } } }))

  it('makes a new type with the statements drizzle-kit makes', async () => {
    const out = plan(EMPTY, shapeOf(doc1))
    expect(out.refused).toEqual([])
    const reg1 = buildRegistry({ ...design, ...visible(doc1) })
    const theirs = await kitPlan(schemaOf(buildRegistry(design as any)), schemaOf(reg1))
    expect(sorted(out.statements)).toEqual(sorted(theirs))
  })

  it('keeps every name of a type of 32 characters whole: a choice column of 30 makes a choice type of 63 bytes', () => {
    const name = `custom_${'a'.repeat(25)}`
    const key = 'b'.repeat(30)
    expect(name.length).toBe(32)
    const { doc } = applyModelOps(doc0, [
      { op: 'type.add', name, label: { cs: 'Dlouhý' }, page: {}, publish: true },
      { op: 'field.add', type: name, field: { key, type: 'select', label: { cs: 'Volba' }, options: [{ label: { cs: 'Jedna' } }] } },
    ], ctx())
    const shape = shapeOf(doc)
    const choice = `${name}_${key}`
    expect(choice.length).toBe(63)
    expect(Object.keys(shape.enums)).toContain(choice)
    expect(Object.keys(shape.tables)).toContain(name)
    const out = plan(EMPTY, shape)
    expect(out.refused).toEqual([])
    expect(out.statements).toContain(`CREATE TYPE "${choice}" AS ENUM('jedna')`)
    expect(out.statements.some((s) => s.startsWith(`CREATE TABLE "${name}" (`) && s.includes(`"${key}" "${choice}"`))).toBe(true)
    for (const s of out.statements) expect(() => assertAllowedStatement(s)).not.toThrow()

    let problem: any
    try {
      applyModelOps(doc0, [{ op: 'type.add', name: `custom_${'a'.repeat(26)}`, label: { cs: 'Dlouhý' } }], ctx())
    }
    catch (err) {
      problem = err
    }
    expect(problem?.code).toBe('invalid-name')
    expect(problem?.message).toContain('longer than 32 characters')
  })

  it('hides a field with one DROP NOT NULL, and a second hidden field with nothing', () => {
    const { doc: doc2 } = applyModelOps(doc1, [
      { op: 'field.remove', type: 'custom_course', key: 'teacher' },
      { op: 'field.remove', type: 'custom_course', key: 'price' },
    ], ctx())
    expect(Object.keys((visible(doc2).custom_course as any).fields)).not.toContain('teacher')
    expect(plan(shapeOf(doc1), shapeOf(doc2))).toEqual({ statements: ['ALTER TABLE "custom_course" ALTER COLUMN "teacher" DROP NOT NULL'], refused: [] })
  })

  it('hides a picture with no statement: it was optional, and its foreign key already lets its target go', () => {
    const { doc: doc2 } = applyModelOps(doc1, [{ op: 'field.remove', type: 'custom_course', key: 'cover' }], ctx())
    expect(plan(shapeOf(doc1), shapeOf(doc2))).toEqual({ statements: [], refused: [] })
    expect(shapeOf(doc1).tables.custom_course!.fks.find((fk) => fk.columns[0] === 'cover_id')!.onDelete).toBe('set null')
  })

  it('restores a field as optional with no statement, or as required with SET NOT NULL when allowed', () => {
    const { doc: hidden } = applyModelOps(doc1, [{ op: 'field.remove', type: 'custom_course', key: 'teacher' }], ctx())
    const optional = applyModelOps(hidden, [{ op: 'field.restore', type: 'custom_course', key: 'teacher' }], ctx({ counts: { missing: { 'custom_course.teacher': 3 } } }))
    expect(optional.notes.map((n) => n.code)).toEqual(['restored-optional'])
    expect(plan(shapeOf(hidden), shapeOf(optional.doc))).toEqual({ statements: [], refused: [] })

    const required = applyModelOps(hidden, [{ op: 'field.restore', type: 'custom_course', key: 'teacher' }], ctx({ counts: { missing: { 'custom_course.teacher': 0 } } }))
    expect(plan(shapeOf(hidden), shapeOf(required.doc)).refused).toHaveLength(1)
    expect(plan(shapeOf(hidden), shapeOf(required.doc), { setNotNull: ['custom_course.teacher'] }).statements)
      .toEqual(['ALTER TABLE "custom_course" ALTER COLUMN "teacher" SET NOT NULL'])
  })

  it('adds a choice and a field to a type with entries, and refuses nothing', () => {
    const { doc: doc2 } = applyModelOps(doc1, [
      { op: 'field.update', type: 'custom_course', key: 'level', addOptions: [{ label: { cs: 'Experti' } }] },
      { op: 'field.add', type: 'custom_course', after: 'teacher', field: { type: 'boolean', default: true, label: { cs: 'Online' } } },
    ], ctx())
    const out = plan(shapeOf(doc1), shapeOf(doc2))
    expect(out).toEqual({
      statements: [`ALTER TYPE "custom_course_level" ADD VALUE 'experti'`, 'ALTER TABLE "custom_course" ADD COLUMN "online" boolean DEFAULT true NOT NULL'],
      refused: [],
    })
  })

  it('deletes a hidden field and a hidden type for good only when the drops are allowed', () => {
    const { doc: withBranch } = applyModelOps(doc1, [
      { op: 'type.add', name: 'custom_branch', label: { cs: 'Pobočky' } },
      { op: 'field.add', type: 'custom_branch', field: { key: 'kind', type: 'select', label: { cs: 'Druh' }, options: [{ value: 'city', label: { cs: 'Město' } }] } },
    ], ctx())
    const { doc: hidden } = applyModelOps(withBranch, [
      { op: 'field.remove', type: 'custom_course', key: 'price' },
      { op: 'type.remove', type: 'custom_branch' },
    ], ctx())
    // Nothing here was removed empty, so the server's sweep never deletes it: a person does.
    expect(modelPurgeDue(hidden, later(31))).toEqual({ types: [], fields: [] })
    const purge = { types: ['custom_branch'], fields: [{ type: 'custom_course', key: 'price' }] }
    const { doc: purged } = applyModelOps(hidden, [{ op: 'purge', ...purge }], ctx({ now: later(31) }))

    const refused = plan(shapeOf(hidden), shapeOf(purged))
    expect(refused.statements).toEqual([])
    expect(refused.refused).toHaveLength(3)

    const allowed = plan(shapeOf(hidden), shapeOf(purged), { drop: { columns: ['custom_course.price'], tables: ['custom_branch'], types: ['custom_branch_kind'] } })
    expect(allowed).toEqual({
      statements: ['ALTER TABLE "custom_course" DROP COLUMN "price"', 'DROP TABLE "custom_branch"', 'DROP TYPE "custom_branch_kind"'],
      refused: [],
    })
  })
})

describe('assertAllowedStatement', () => {
  it('accepts every statement the planner made in these tests', () => {
    expect(allStatements.length).toBeGreaterThan(30)
    for (const s of allStatements) expect(() => assertAllowedStatement(s), s).not.toThrow()
  })

  it('accepts the shapes on the list, with a final semicolon and loose spacing', () => {
    for (const s of [
      'CREATE TYPE "custom_a" AS ENUM(\'a\', \'it\'\'s\')',
      'ALTER TYPE "custom_a" ADD VALUE \'b\';',
      'CREATE TABLE "custom_a" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "p" numeric(12, 2), "t" timestamp (3) with time zone DEFAULT now() NOT NULL, "j" jsonb DEFAULT \'[]\'::jsonb NOT NULL, "k" "custom_a_kind" DEFAULT \'a\', CONSTRAINT "u" UNIQUE("p"))',
      'ALTER   TABLE "custom_a"\n ADD COLUMN "n" integer DEFAULT -3',
      'ALTER TABLE "custom_a" ADD CONSTRAINT "fk" FOREIGN KEY ("a") REFERENCES "cms_media"("id") ON DELETE no action ON UPDATE no action',
      'CREATE UNIQUE INDEX "i" ON "custom_a" USING btree ("a", "b")',
      'ALTER TABLE "custom_a" ALTER COLUMN "n" SET DEFAULT true',
      'ALTER TABLE "custom_a" DROP COLUMN "n"',
      'DROP TABLE "custom_a"',
      'DROP TYPE "custom_a"',
    ]) expect(() => assertAllowedStatement(s), s).not.toThrow()
  })

  it('refuses hostile statements', () => {
    for (const s of [
      'CREATE TABLE "custom_a" ("id" uuid); DROP TABLE "cms_users"',
      'DROP TABLE "cms_users"',
      'DROP TABLE "custom_a" CASCADE',
      'ALTER TABLE "custom_a" RENAME TO "custom_b"',
      'ALTER TABLE "custom_a" OWNER TO "postgres"',
      'GRANT ALL ON "custom_a" TO PUBLIC',
      'CREATE EXTENSION "custom_ext"',
      `COPY "custom_a" FROM '/etc/passwd'`,
      'DROP TABLE "custom_a" -- x',
      'DROP TABLE "custom_a" /* x */',
      'DROP TABLE "custom_a"; DROP TABLE "cms_users"--"',
      `ALTER TABLE "custom_a" ADD COLUMN "b" text DEFAULT ''); DROP TABLE cms_users; --'`,
      'ALTER TABLE "cms_users" ADD CONSTRAINT "fk" FOREIGN KEY ("a") REFERENCES "custom_a"("id") ON DELETE cascade ON UPDATE no action',
      'ALTER TABLE "custom_a" ADD COLUMN "b" text[]',
      'ALTER TABLE "custom_a" ADD COLUMN "b" text DEFAULT pg_sleep(10)',
      `ALTER TABLE "custom_a" ADD COLUMN "b" text DEFAULT 'a' || 'b'`,
      `DROP TABLE "custom_${'a'.repeat(57)}"`,
      'DROP TABLE "custom_a',
      'DROP TYPE "cms_role"',
      'ALTER TYPE "role" ADD VALUE \'x\'',
      'CREATE INDEX "i" ON "cms_users" USING btree ("a")',
      'CREATE TABLE "custom_a" ("id" uuid) INHERITS ("cms_users")',
      'drop table "custom_a"',
    ]) expect(() => assertAllowedStatement(s), s).toThrow(/not allowed/)
  })

  it('accepts a semicolon inside a literal or a name', () => {
    expect(() => assertAllowedStatement(`ALTER TYPE "custom_a;b" ADD VALUE 'a;--b'`)).not.toThrow()
  })

  it('names the statement in the message, cut to 200 characters', () => {
    const s = `DROP TABLE "cms_users" ${'x'.repeat(300)}`
    try {
      assertAllowedStatement(s)
      expect.unreachable()
    } catch (err: any) {
      expect(err.message).toContain('DROP TABLE "cms_users"')
      expect(err.message.length).toBeLessThan(330)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { defineEntity, f } from '../../packages/cms/src/index'
import { DEFAULT_MODEL_LIMITS, applyModelOps, emptyModelDoc, type ModelDoc, type ModelField, type ModelType } from '../../packages/cms/src/model-doc'
import { modelFileOf } from '../../packages/cms/src/model-file'
import { modelMisfits, newModelMisfits, type ModelMisfit, type ModelMisfitWhy } from '../../packages/cms/src/model-fit'

// A model file promises what the content API returns for its types (docs/model-file-plan.md,
// section 6). Each test makes the file from document A, describes the live model B (A with one
// change, written by hand where applyModelOps would refuse it) and reads the misfits.

const category = () => defineEntity('category', { label: 'Categories', titleField: 'name', fields: { name: f.text({ required: true }) }, content: { public: true } })
const tag = () => defineEntity('tag', { label: 'Tags', titleField: 'name', fields: { name: f.text({ required: true }) }, content: { public: true } })
const design = () => ({ category: category() })
const design2 = () => ({ category: category(), tag: tag() })

const WHY: ModelMisfitWhy[] = ['type-removed', 'field-removed', 'kind-changed', 'may-be-empty', 'target-changed', 'sort-removed', 'filter-removed', 'cannot-build']

const zero = new Proxy({}, { get: () => 0 }) as Record<string, number>
const ctx = () => ({
  design: [{ name: 'category', singleton: false, pathPrefix: null as string | null }],
  limits: { ...DEFAULT_MODEL_LIMITS },
  now: new Date('2026-11-25T10:00:00Z'),
  counts: { entries: zero, values: zero, missing: zero },
})

const title = (): ModelField => ({ key: 'title', type: 'text', label: { en: 'Title' }, required: true })
const field = (key: string, rest: Record<string, unknown> = { type: 'text' }): ModelField => ({ key, label: { en: key }, ...rest }) as unknown as ModelField
const type = (name: string, fields: ModelField[] = [title()], more: Partial<ModelType> = {}): ModelType => ({ name, label: { en: name }, titleField: 'title', fields, ...more })
const doc = (...types: ModelType[]): ModelDoc => ({ format: 1, types })

/** A copy of a document with one type's fields changed. */
function withFields(d: ModelDoc, typeName: string, change: (fields: ModelField[]) => ModelField[]): ModelDoc {
  const c = structuredClone(d)
  const t = c.types.find((x) => x.name === typeName)!
  t.fields = change(t.fields)
  return c
}
const replaceField = (d: ModelDoc, typeName: string, key: string, next: Partial<ModelField> | ((f: ModelField) => ModelField)): ModelDoc =>
  withFields(d, typeName, (fs) => fs.map((x) => (x.key === key ? (typeof next === 'function' ? next(x) : ({ ...x, ...next } as ModelField)) : x)))

const misfits = (a: ModelDoc, b: ModelDoc, d: Record<string, any> = design()): ModelMisfit[] => modelMisfits(modelFileOf(a, { version: 1 }), b, d)
const brief = (ms: ModelMisfit[]) => ms.map((m) => [m.type, m.field ?? null, m.why])

const base = (): ModelDoc => doc(type('custom_course', [
  title(),
  field('perex', { type: 'text', long: true }),
  field('price', { type: 'number' }),
  field('level', { type: 'select', required: true, options: [{ value: 'a', label: { en: 'A' } }, { value: 'b', label: { en: 'B' } }] }),
  field('when', { type: 'datetime' }),
  field('category', { type: 'relation', to: 'category' }),
]))

describe('modelMisfits: what fits', () => {
  it('the same model fits', () => {
    expect(misfits(base(), base())).toEqual([])
  })

  it('an empty file fits anything', () => {
    expect(misfits(doc(), base())).toEqual([])
  })

  it('a new type, a new field, a new choice, a new label, a new help text, a new order fit', () => {
    const live = base()
    live.types.push(type('custom_teacher'))
    const t = live.types[0]!
    t.fields.push(field('extra', { type: 'text', required: true }))
    const level = t.fields.find((x) => x.key === 'level') as any
    level.options.push({ value: 'c', label: { en: 'C' } })
    t.label = { en: 'Renamed' }
    t.fields.find((x) => x.key === 'perex')!.label = { en: 'Another label' }
    t.fields.find((x) => x.key === 'perex')!.help = { en: 'Some help' }
    t.fields.reverse()
    t.order = 'manual'
    expect(misfits(base(), live)).toEqual([])
  })

  it('a field turned from optional to required fits', () => {
    expect(misfits(base(), replaceField(base(), 'custom_course', 'perex', { required: true } as any))).toEqual([])
  })

  it('an optional field that stays optional fits', () => {
    expect(misfits(base(), replaceField(base(), 'custom_course', 'perex', { max: 50 } as any))).toEqual([])
  })

  it('a changed label alone fits (kind unchanged)', () => {
    expect(misfits(base(), replaceField(base(), 'custom_course', 'price', { label: { en: 'Cost' } }))).toEqual([])
  })

  it('a removed choice (still a value) fits, a new choice fits', () => {
    const fewer = replaceField(base(), 'custom_course', 'level', (x) => ({ ...x, options: [(x as any).options[0]] }) as ModelField)
    expect(misfits(base(), fewer)).toEqual([])
    expect(misfits(fewer, base())).toEqual([])
  })
})

describe('modelMisfits: type-removed', () => {
  it('a type with removedAt set', () => {
    const live = base()
    live.types[0]!.removedAt = '2026-11-25T09:00:00Z'
    expect(brief(misfits(base(), live))).toEqual([['custom_course', null, 'type-removed']])
  })

  it('a type gone from the live document', () => {
    expect(brief(misfits(base(), doc()))).toEqual([['custom_course', null, 'type-removed']])
  })

  it('fits when the type is there', () => {
    expect(misfits(base(), base())).toEqual([])
  })
})

describe('modelMisfits: field-removed', () => {
  it('a field gone', () => {
    const live = withFields(base(), 'custom_course', (fs) => fs.filter((x) => x.key !== 'perex'))
    expect(brief(misfits(base(), live))).toEqual([['custom_course', 'perex', 'field-removed']])
  })

  it('a field that turns hidden', () => {
    const live = replaceField(base(), 'custom_course', 'perex', { removedAt: '2026-11-25T09:00:00Z' })
    expect(brief(misfits(base(), live))).toEqual([['custom_course', 'perex', 'field-removed']])
  })

  it('a removed field is not also a removed sort key or filter', () => {
    // text: sortable and filterable; datetime: sortable, filterable by .from and .to
    for (const key of ['perex', 'when', 'level']) {
      const live = withFields(base(), 'custom_course', (fs) => fs.filter((x) => x.key !== key))
      expect(brief(misfits(base(), live)), key).toEqual([['custom_course', key, 'field-removed']])
    }
  })

  it('a hidden relation target makes the relation field go', () => {
    const live = base()
    live.types.push(type('custom_teacher'))
    const a = structuredClone(live)
    a.types[0]!.fields.push(field('teacher', { type: 'relation', to: 'custom_teacher' }))
    const b = structuredClone(a)
    b.types[1]!.removedAt = '2026-11-25T09:00:00Z'
    const ms = misfits(a, b)
    expect(brief(ms)).toContainEqual(['custom_teacher', null, 'type-removed'])
    expect(brief(ms)).toContainEqual(['custom_course', 'teacher', 'field-removed'])
  })
})

describe('modelMisfits: kind-changed', () => {
  it('a text turned into a number', () => {
    const live = replaceField(base(), 'custom_course', 'perex', () => field('perex', { type: 'number' }))
    expect(brief(misfits(base(), live))).toEqual([['custom_course', 'perex', 'kind-changed']])
  })

  it('a number turned decimal (a string on the wire)', () => {
    const live = replaceField(base(), 'custom_course', 'price', { decimal: true } as any)
    expect(brief(misfits(base(), live))).toEqual([['custom_course', 'price', 'kind-changed']])
  })

  it('a text turned into richtext', () => {
    const live = replaceField(base(), 'custom_course', 'perex', () => field('perex', { type: 'richtext' }))
    expect(brief(misfits(base(), live))).toEqual([['custom_course', 'perex', 'kind-changed']])
  })

  it('a text turned into a select', () => {
    const live = replaceField(base(), 'custom_course', 'perex', () => field('perex', { type: 'select', options: [{ value: 'x', label: { en: 'X' } }] }))
    expect(misfits(base(), live).map((m) => m.why)).not.toContain('field-removed')
  })

  it('fits when only the label changed', () => {
    expect(misfits(base(), replaceField(base(), 'custom_course', 'perex', { label: { en: 'Other' } }))).toEqual([])
  })
})

describe('modelMisfits: may-be-empty', () => {
  const required = () => withFields(base(), 'custom_course', (fs) => [...fs, field('note', { type: 'text', required: true })])

  it('a required text turned optional', () => {
    const live = replaceField(required(), 'custom_course', 'note', { required: false } as any)
    expect(brief(misfits(required(), live))).toEqual([['custom_course', 'note', 'may-be-empty']])
  })

  it('a required text turned into a link is still a misfit though required stays true', () => {
    const live = replaceField(required(), 'custom_course', 'note', { format: 'link' } as any)
    expect((live.types[0]!.fields.find((x) => x.key === 'note') as any).required).toBe(true)
    expect(brief(misfits(required(), live))).toEqual([['custom_course', 'note', 'may-be-empty']])
  })

  it('an optional field that becomes required fits', () => {
    expect(misfits(base(), replaceField(base(), 'custom_course', 'perex', { required: true } as any))).toEqual([])
  })

  it('an optional field that stays optional fits', () => {
    expect(misfits(required(), required())).toEqual([])
  })

  it('a required choice turned optional', () => {
    const live = replaceField(base(), 'custom_course', 'level', { required: false } as any)
    expect(brief(misfits(base(), live))).toEqual([['custom_course', 'level', 'may-be-empty']])
  })
})

describe('modelMisfits: target-changed', () => {
  const related = (to: string) => doc(type('custom_post', [title(), field('topic', { type: 'relation', to })]))

  it('a relation to category changed to tag', () => {
    expect(brief(misfits(related('category'), related('tag'), design2()))).toEqual([['custom_post', 'topic', 'target-changed']])
  })

  it('fits when the target is the same', () => {
    expect(misfits(related('category'), related('category'), design2())).toEqual([])
  })

  it('a relation to a custom type changed to another one', () => {
    const a = doc(type('custom_post', [title(), field('r', { type: 'relation', to: 'custom_one' })]), type('custom_one'), type('custom_two'))
    const b = replaceField(a, 'custom_post', 'r', { to: 'custom_two' } as any)
    expect(brief(misfits(a, b))).toEqual([['custom_post', 'r', 'target-changed']])
  })
})

describe('modelMisfits: sort-removed and filter-removed', () => {
  it('a text turned into richtext: the field is kind-changed, its sort key and filter are not reported again', () => {
    const live = replaceField(base(), 'custom_course', 'perex', () => field('perex', { type: 'richtext' }))
    const ms = misfits(base(), live)
    expect(brief(ms)).toEqual([['custom_course', 'perex', 'kind-changed']])
  })

  it('a datetime field removed: .from and .to are folded into its field-removed', () => {
    const live = withFields(base(), 'custom_course', (fs) => fs.filter((x) => x.key !== 'when'))
    const ms = misfits(base(), live)
    expect(brief(ms)).toEqual([['custom_course', 'when', 'field-removed']])
    expect(ms.some((m) => m.field === 'when.from' || m.field === 'when.to')).toBe(false)
  })

  it('a relation turned into a text (many-to-one filter becomes a text filter) is a kind change only', () => {
    const live = replaceField(base(), 'custom_course', 'category', () => field('category', { type: 'text' }))
    expect(brief(misfits(base(), live))).toEqual([['custom_course', 'category', 'kind-changed']])
  })

  it('a boolean turned into a text is a kind change only', () => {
    const a = withFields(base(), 'custom_course', (fs) => [...fs, field('on', { type: 'boolean' })])
    const live = replaceField(a, 'custom_course', 'on', () => field('on', { type: 'text' }))
    expect(brief(misfits(a, live))).toEqual([['custom_course', 'on', 'kind-changed']])
  })
})

describe('modelMisfits: cannot-build', () => {
  it('a relation to a collection the design does not have', () => {
    const a = doc(type('custom_post', [title(), field('r', { type: 'relation', to: 'ghost' })]))
    const ms = misfits(a, a)
    const cb = ms.filter((m) => m.why === 'cannot-build')
    expect(cb.length).toBeGreaterThan(0)
    expect(cb[0]).toMatchObject({ type: 'custom_post', field: 'r', why: 'cannot-build' })
  })

  it('a relation to a custom type that is not in the file', () => {
    const a = doc(type('custom_post', [title(), field('r', { type: 'relation', to: 'custom_nowhere' })]))
    const ms = misfits(a, a)
    expect(ms.filter((m) => m.why === 'cannot-build')).toMatchObject([{ type: 'custom_post', field: 'r', why: 'cannot-build' }])
  })
})

describe('modelMisfits: embedded types', () => {
  const pair = () => doc(
    type('custom_a', [title(), field('b', { type: 'relation', to: 'custom_b' })]),
    type('custom_b', [title(), field('note', { type: 'text', required: true })]),
  )

  it('a required text of B turned optional gives one may-be-empty on B', () => {
    const live = replaceField(pair(), 'custom_b', 'note', { required: false } as any)
    const ms = misfits(pair(), live)
    expect(brief(ms)).toEqual([['custom_b', 'note', 'may-be-empty']])
  })
})

describe('modelMisfits: every misfit is explained', () => {
  it('has a message and a documented why', () => {
    const live = doc(type('custom_other'))
    const a = base()
    a.types.push(type('custom_gone'))
    const b = replaceField(base(), 'custom_course', 'perex', () => field('perex', { type: 'number' }))
    b.types[0]!.fields = b.types[0]!.fields.filter((x) => x.key !== 'price')
    const ms = [...misfits(a, live), ...misfits(a, b), ...misfits(doc(type('custom_post', [title(), field('r', { type: 'relation', to: 'ghost' })])), live)]
    expect(ms.length).toBeGreaterThan(3)
    for (const m of ms) {
      expect(m.message.length).toBeGreaterThan(0)
      expect(WHY).toContain(m.why)
    }
  })
})

describe('newModelMisfits', () => {
  const m = (type: string, field: string | undefined, why: ModelMisfitWhy): ModelMisfit => ({ type, ...(field ? { field } : {}), why, message: 'x' })

  it('returns only what is new by type, field and why', () => {
    const old = m('custom_a', 'x', 'field-removed')
    const fresh = m('custom_a', 'y', 'field-removed')
    expect(newModelMisfits([old], [{ ...old, message: 'another words' }, fresh])).toEqual([fresh])
  })

  it('one that differs only in why is new', () => {
    const before = [m('custom_a', 'x', 'may-be-empty')]
    const after = [m('custom_a', 'x', 'kind-changed')]
    expect(newModelMisfits(before, after)).toEqual(after)
  })

  it('one that differs only in type or field is new', () => {
    expect(newModelMisfits([m('custom_a', 'x', 'field-removed')], [m('custom_b', 'x', 'field-removed')])).toHaveLength(1)
    expect(newModelMisfits([m('custom_a', undefined, 'type-removed')], [m('custom_a', 'x', 'type-removed')])).toHaveLength(1)
  })

  it('an empty after gives nothing', () => {
    expect(newModelMisfits([m('custom_a', 'x', 'field-removed')], [])).toEqual([])
    expect(newModelMisfits([], [])).toEqual([])
  })

  it('an empty before returns all of after', () => {
    const after = [m('custom_a', 'x', 'field-removed')]
    expect(newModelMisfits([], after)).toEqual(after)
  })

  describe('end to end', () => {
    const file = () => modelFileOf(withFields(base(), 'custom_course', (fs) => [...fs, field('note', { type: 'text' })]), { version: 1 })
    // L0 already misses the field "perex" (an old misfit)
    const l0 = () => withFields(base(), 'custom_course', (fs) => [...fs.filter((x) => x.key !== 'perex'), field('note', { type: 'text' })])

    it('L0 has exactly the one old misfit', () => {
      expect(brief(modelMisfits(file(), l0(), design()))).toEqual([['custom_course', 'perex', 'field-removed']])
    })

    it('a change that adds no misfit gives nothing', () => {
      const l1 = withFields(l0(), 'custom_course', (fs) => [...fs, field('more', { type: 'number' })])
      const before = modelMisfits(file(), l0(), design())
      const after = modelMisfits(file(), l1, design())
      expect(newModelMisfits(before, after)).toEqual([])
    })

    it('a change that removes another field gives exactly that one', () => {
      const l1 = withFields(l0(), 'custom_course', (fs) => fs.filter((x) => x.key !== 'price'))
      const before = modelMisfits(file(), l0(), design())
      const after = modelMisfits(file(), l1, design())
      expect(brief(newModelMisfits(before, after))).toEqual([['custom_course', 'price', 'field-removed']])
    })
  })
})

describe('a live model built with applyModelOps', () => {
  const made = applyModelOps(emptyModelDoc(), [
    { op: 'type.add', name: 'custom_course', label: { en: 'Courses' } },
    { op: 'field.add', type: 'custom_course', field: { key: 'teacher', type: 'text', required: true, label: { en: 'Teacher' } } },
    { op: 'field.add', type: 'custom_course', field: { key: 'category', type: 'relation', to: 'category', label: { en: 'Category' } } },
  ] as any, ctx() as any).doc
  const file = modelFileOf(made, { version: 1 })

  it('hiding a field is field-removed, restoring it fits again', () => {
    const hidden = applyModelOps(made, [{ op: 'field.remove', type: 'custom_course', key: 'teacher' }] as any, ctx() as any).doc
    expect(brief(modelMisfits(file, hidden, design()))).toEqual([['custom_course', 'teacher', 'field-removed']])
    const back = applyModelOps(hidden, [{ op: 'field.restore', type: 'custom_course', key: 'teacher' }] as any, ctx() as any).doc
    expect(modelMisfits(file, back, design())).toEqual([])
  })

  it('hiding a type is type-removed, restoring it fits again', () => {
    const hidden = applyModelOps(made, [{ op: 'type.remove', type: 'custom_course' }] as any, ctx() as any).doc
    expect(brief(modelMisfits(file, hidden, design()))).toEqual([['custom_course', null, 'type-removed']])
    const back = applyModelOps(hidden, [{ op: 'type.restore', type: 'custom_course' }] as any, ctx() as any).doc
    expect(modelMisfits(file, back, design())).toEqual([])
  })

  it('making a required field optional is may-be-empty', () => {
    const live = applyModelOps(made, [{ op: 'field.update', type: 'custom_course', key: 'teacher', required: false }] as any, ctx() as any).doc
    expect(brief(modelMisfits(file, live, design()))).toEqual([['custom_course', 'teacher', 'may-be-empty']])
  })
})

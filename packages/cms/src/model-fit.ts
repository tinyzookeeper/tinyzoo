// Does a live model still keep what a model file promised (docs/model-file-plan.md, section 6)?
// The promise is what the content API returns for the file's types: the description that
// `buildContentModel` (content-shape.ts) makes, the same one the generated types come from. The
// live model is described the same way, and the two are compared. Pure.
//
// What does not fit, by `why`:
//
// - `type-removed`    a type the file knows is gone or removed
// - `field-removed`   a field the file knows is gone or removed
// - `kind-changed`    a field holds another kind of value (text, number, a picture, a relation, …)
// - `may-be-empty`    a field that never was empty can be empty now (required turned optional, or
//                     a text turned into a link, which comes back empty when its entry is gone)
// - `target-changed`  a relation points at another collection
// - `sort-removed`    the list cannot be sorted by a key the file could sort by
// - `filter-removed`  the list cannot be filtered by a parameter the file could filter by
// - `cannot-build`    the file's own side: a type or field of the file that cannot be built over
//                     the design (a relation to a collection the design does not have)
//
// Everything the file does not know fits: a new type, a new field. A value where empty was
// allowed fits. New choices of a choice field fit (a custom type's choices are typed open).

import { buildContentModel, type ContentField, type ContentFieldType, type ContentModel, type ContentShape } from './content-shape'
import { CUSTOM_PREFIX, type ModelDoc } from './model-doc'
import { customModelConfig, modelFileDoc, type ModelFile } from './model-file'
import type { ModelMapProblem } from './model-map'

/** Why a model does not keep a file's promise. See the top of this file. @internal */
export type ModelMisfitWhy =
  | 'type-removed'
  | 'field-removed'
  | 'kind-changed'
  | 'may-be-empty'
  | 'target-changed'
  | 'sort-removed'
  | 'filter-removed'
  | 'cannot-build'

/** One thing a file promised that a model does not keep. `field` is a field key, or a sort key or filter parameter. @internal */
export interface ModelMisfit {
  type: string
  field?: string
  why: ModelMisfitWhy
  message: string
}

/** The description of one side, and what the mapper left out of it. */
function describeSide(doc: ModelDoc, design: Record<string, any>): { model: ContentModel | null; problems: ModelMapProblem[] } {
  const { config, problems } = customModelConfig(design, doc)
  try {
    return { model: buildContentModel(config), problems }
  } catch {
    // The design itself does not build: nothing of either side can be described.
    return { model: null, problems }
  }
}

/** The custom shapes of a model, top level and embedded, by name. */
function customShapes(model: ContentModel | null): { top: Map<string, ContentShape>; embedded: Map<string, { name: string; fields: ContentField[] }> } {
  const top = new Map<string, ContentShape>()
  const embedded = new Map<string, { name: string; fields: ContentField[] }>()
  for (const s of model?.entities ?? []) if (s.name.startsWith(CUSTOM_PREFIX)) top.set(s.name, s)
  for (const s of model?.embedded ?? []) if (s.name.startsWith(CUSTOM_PREFIX)) embedded.set(s.name, s)
  return { top, embedded }
}

/**
 * The kind of a value, without what may change and still fit: the values of a choice, and the
 * target of a relation (compared on its own).
 */
function kindOf(t: ContentFieldType): string {
  switch (t.kind) {
    case 'scalar': return `scalar:${t.scalar}:${t.pattern ?? ''}`
    case 'relation-one':
    case 'relation-many': return `${t.kind}:${t.public ? 'public' : 'ref'}`
    case 'blocks': return `blocks:${JSON.stringify(t.blocks.map((b) => [b.type, b.fields.map(innerKind)]))}`
    case 'group': return `group:${JSON.stringify(t.fields.map(innerKind))}`
    default: return t.kind
  }
}

const innerKind = (f: ContentField): [string, string, boolean] => [f.key, kindOf(f.type), f.nullable]
const filterField = (key: string): string => key.replace(/\.(from|to)$/, '')

/** Collects misfits, each (type, field, why) once. */
class Misfits {
  readonly list: ModelMisfit[] = []
  private readonly seen = new Set<string>()
  private readonly fields = new Set<string>()

  add(m: ModelMisfit): void {
    const id = `${m.type}\u0000${m.field ?? ''}\u0000${m.why}`
    if (this.seen.has(id)) return
    this.seen.add(id)
    this.fields.add(`${m.type}\u0000${m.field ?? ''}`)
    this.list.push(m)
  }

  /** Does this field already have a misfit (a removed field need not also be a removed sort key)? */
  has(type: string, field: string): boolean {
    return this.fields.has(`${type}\u0000${field}`)
  }
}

function compareFields(type: string, promised: ContentField[], live: ContentField[], out: Misfits): void {
  const liveByKey = new Map(live.map((f) => [f.key, f]))
  for (const f of promised) {
    const l = liveByKey.get(f.key)
    if (!l) {
      out.add({ type, field: f.key, why: 'field-removed', message: `The field ${f.key} of ${type} is gone or removed` })
      continue
    }
    if (kindOf(f.type) !== kindOf(l.type)) {
      out.add({ type, field: f.key, why: 'kind-changed', message: `The field ${f.key} of ${type} holds another kind of value now` })
      continue
    }
    if ((f.type.kind === 'relation-one' || f.type.kind === 'relation-many') && (l.type.kind === 'relation-one' || l.type.kind === 'relation-many') && f.type.target !== l.type.target) {
      out.add({ type, field: f.key, why: 'target-changed', message: `The field ${f.key} of ${type} points at ${l.type.target} now, not at ${f.type.target}` })
    }
    if (!f.nullable && l.nullable) {
      out.add({ type, field: f.key, why: 'may-be-empty', message: `The field ${f.key} of ${type} may be empty now, and it never was` })
    }
  }
}

function compareShape(promised: ContentShape, live: ContentShape | undefined, out: Misfits): void {
  const type = promised.name
  if (!live) {
    out.add({ type, why: 'type-removed', message: `The type ${type} is gone or removed` })
    return
  }
  compareFields(type, promised.fields, live.fields, out)
  const sorts = new Set(live.sortKeys)
  for (const key of promised.sortKeys) {
    if (sorts.has(key) || out.has(type, key)) continue
    out.add({ type, field: key, why: 'sort-removed', message: `The list of ${type} can no longer be sorted by ${key}` })
  }
  const filters = new Map(live.filters.map((f) => [f.key, f]))
  for (const p of promised.filters) {
    const l = filters.get(p.key)
    if (l && (l.value ?? null) === (p.value ?? null)) continue
    if (out.has(type, filterField(p.key))) continue
    out.add({ type, field: p.key, why: 'filter-removed', message: `The list of ${type} can no longer be filtered by ${p.key}` })
  }
}

/**
 * What a model file promised that the live model does not keep. Both sides are built over the
 * same design (what `cms.config.ts` exports) with the same mapper and described with
 * `buildContentModel`, so both are described by the same version of tinyzoo. A type or field the
 * file has and the design cannot carry is a misfit `cannot-build`. Empty: the model fits.
 * @internal
 */
export function modelMisfits(file: ModelFile, live: ModelDoc, design: Record<string, any>): ModelMisfit[] {
  const promised = describeSide(modelFileDoc(file), design)
  const now = describeSide(live, design)
  const out = new Misfits()
  for (const p of promised.problems) {
    out.add({ type: p.type, ...(p.field ? { field: p.field } : {}), why: 'cannot-build', message: p.message })
  }
  const a = customShapes(promised.model)
  const b = customShapes(now.model)
  for (const shape of a.top.values()) compareShape(shape, b.top.get(shape.name), out)
  // What a type embeds of another: the same fields as its top level, so this finds nothing new
  // today; it holds the rule if the two ever differ.
  for (const shape of a.embedded.values()) {
    const l = b.embedded.get(shape.name)
    if (l) compareFields(shape.name, shape.fields, l.fields, out)
  }
  return out.list
}

/**
 * What does not fit `after` a change and did fit before it: the misfits of `after` that are not
 * in `before` (by type, field and why). Only these refuse a change, so a registration that
 * already does not fit does not freeze the site.
 * @internal
 */
export function newModelMisfits(before: ModelMisfit[], after: ModelMisfit[]): ModelMisfit[] {
  const id = (m: ModelMisfit): string => `${m.type}\u0000${m.field ?? ''}\u0000${m.why}`
  const old = new Set(before.map(id))
  return after.filter((m) => !old.has(id(m)))
}

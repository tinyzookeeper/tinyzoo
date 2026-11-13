import { buildRegistry, type CmsEntity, type CmsRegistry } from './entity'
import { pascal } from './fields'
import type { FieldDescriptor } from './descriptor'

// ── ONE IR, TWO MORE SINKS ──────────────────────────────────────────────────────
// The public content API projects rows through `server/utils/cmsContent.ts`
// (projectItem + populateItems + publicProjection). This module recomputes that
// EXACT projected shape as a serializable model so the OpenAPI document and the
// generated TypeScript client can never drift from what the API actually returns.
//
// Whenever cmsContent.ts changes the projection, this file must change in lockstep
// — they are deliberately kept side by side and the adversarial drift test checks it.

export const SLUG_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$'

/** The value-kind of a single projected field. */
export type ContentFieldType =
  | { kind: 'scalar'; scalar: 'string' | 'integer' | 'number' | 'boolean' | 'datetime'; enumValues?: readonly string[]; pattern?: string }
  | { kind: 'richtext' }
  | { kind: 'media' }
  | { kind: 'relation-one'; target: string; public: boolean }
  | { kind: 'relation-many'; target: string; public: boolean }
  | { kind: 'blocks'; blocks: { type: string; fields: ContentField[] }[] }

export interface ContentField {
  key: string
  type: ContentFieldType
  /** Value may be `null` in the response (still always present as a key). */
  nullable: boolean
}

/** A filterable query parameter on the list endpoint. */
export interface FilterParam {
  key: string
  enumValues?: readonly string[]
}

/** Top-level shape of a public collection (drives `/api/content/:name` + `/:slug`). */
export interface ContentShape {
  name: string
  pascal: string
  titleField: string
  slugField?: string
  /** Whether a `published` condition gates this collection (docs only). */
  gated: boolean
  /** Projected fields in declaration order (excludes id + createdAt/updatedAt). */
  fields: ContentField[]
  /** Allowed `?sort=` values. */
  sortKeys: string[]
  /** Allowed filter query params. */
  filters: FilterParam[]
  /** Content languages, when the collection has translatable fields: items then carry `locale` + `locales`. */
  locales: string[] | null
}

/** Scalar-only projection of a PUBLIC entity when populated as another's relation. */
export interface EmbeddedShape {
  name: string
  pascal: string
  fields: ContentField[]
}

/** Minimal reference of a NON-PUBLIC entity when populated as another's relation. */
export interface RefShape {
  name: string
  pascal: string
  titleField: string
  titleType: ContentFieldType
  /** The target's title field may itself be optional → the ref title can be null. */
  titleNullable: boolean
}

export interface ContentModel {
  entities: ContentShape[]
  embedded: EmbeddedShape[]
  refs: RefShape[]
}

// ── projection helpers — mirror cmsContent.ts byte for byte ─────────────────────

function hiddenSet(e: CmsEntity): Set<string> {
  return new Set(e.content?.hidden ?? [])
}

/** media + to-one + m2m — the keys that CAN be populated (cmsContent.populatableKeys). */
function populatableKeys(e: CmsEntity): string[] {
  return Object.entries(e.fields)
    .filter(([, f]) => f.type === 'media' || f.relation?.kind === 'many-to-one' || f.relation?.kind === 'many-to-many')
    .map(([k]) => k)
}

/** The keys actually populated for this entity (cmsContent.populateItems default). */
function populateSet(e: CmsEntity): Set<string> {
  return new Set(e.content?.populate ?? populatableKeys(e))
}

function scalarType(fld: FieldDescriptor): ContentFieldType {
  switch (fld.type) {
    case 'text': return { kind: 'scalar', scalar: 'string' }
    case 'slug': return { kind: 'scalar', scalar: 'string', pattern: SLUG_PATTERN }
    // integer → JSON number; numeric (int:false) → drizzle pg `numeric` returns a
    // STRING at runtime (e.g. "19.99"), so the wire type is string, not number.
    case 'number': return { kind: 'scalar', scalar: fld.spec?.base.kind === 'integer' ? 'integer' : 'string' }
    case 'boolean': return { kind: 'scalar', scalar: 'boolean' }
    case 'datetime': return { kind: 'scalar', scalar: 'datetime' }
    case 'select': {
      const values = (fld.meta?.options as readonly string[] | undefined)
        ?? (fld.spec?.base.kind === 'enum' ? fld.spec.base.values : undefined)
      return { kind: 'scalar', scalar: 'string', enumValues: values }
    }
    case 'richtext': return { kind: 'richtext' }
    default: return { kind: 'scalar', scalar: 'string' }
  }
}

/**
 * A blocks field as the API returns it (mirror cmsContent.projectBlocks): every block
 * carries id, type and each of its type's fields (null when empty); media resolved
 * to the public media object.
 */
function blocksType(fld: FieldDescriptor): ContentFieldType {
  const blocks = Object.entries(fld.blocks ?? {}).map(([type, def]) => ({
    type,
    fields: (Object.entries(def.fields) as [string, FieldDescriptor][]).map(([key, bf]): ContentField =>
      bf.type === 'media'
        ? { key, type: { kind: 'media' }, nullable: true }
        : { key, type: scalarType(bf), nullable: !bf.isRequired }),
  }))
  return { kind: 'blocks', blocks }
}

/** Is a projected to-one relation possibly null? (optional FK, or target is publish-gated.) */
function relationOneNullable(reg: CmsRegistry, fld: FieldDescriptor): boolean {
  const optional = !fld.relation!.required
  const target = reg.byName.get(fld.relation!.to().name)
  const targetGated = !!target?.content?.published
  return optional || targetGated
}

/** The projected fields a populated relation/media field contributes (or null = dropped). */
function relationField(reg: CmsRegistry, key: string, fld: FieldDescriptor): ContentField | null {
  if (fld.type === 'media') return { key, type: { kind: 'media' }, nullable: true }
  const target = reg.byName.get(fld.relation!.to().name)
  if (!target) return null
  const isPublic = !!target.content?.public
  if (fld.relation!.kind === 'many-to-one') {
    return { key, type: { kind: 'relation-one', target: target.name, public: isPublic }, nullable: relationOneNullable(reg, fld) }
  }
  // many-to-many → always an array (never null; items are non-null published targets)
  return { key, type: { kind: 'relation-many', target: target.name, public: isPublic }, nullable: false }
}

/** Top-level projected fields (mirror cmsContent.projectItem, minus id/timestamps). */
function topLevelFields(reg: CmsRegistry, e: CmsEntity): ContentField[] {
  const hidden = hiddenSet(e)
  const populate = populateSet(e)
  const out: ContentField[] = []
  for (const [key, fld] of Object.entries(e.fields)) {
    if (hidden.has(key)) continue
    if (fld.relation?.kind === 'one-to-many') continue // virtual
    if (fld.relation || fld.type === 'media') {
      if (!populate.has(key)) continue // not populated → dropped from the response
      const f = relationField(reg, key, fld)
      if (f) out.push(f)
      continue
    }
    if (fld.type === 'blocks') {
      out.push({ key, type: blocksType(fld), nullable: false })
      continue
    }
    out.push({ key, type: scalarType(fld), nullable: fld.isOptional })
  }
  return out
}

/** Scalar projection (mirror cmsContent.projectScalars, minus id). */
function embeddedFields(e: CmsEntity): ContentField[] {
  const hidden = hiddenSet(e)
  const out: ContentField[] = []
  for (const [key, fld] of Object.entries(e.fields)) {
    // Blocks are not embedded in related items (they can hold media to resolve).
    if (hidden.has(key) || fld.relation || fld.type === 'media' || fld.type === 'blocks') continue
    out.push({ key, type: scalarType(fld), nullable: fld.isOptional })
  }
  return out
}

/** Sort allowlist (mirror index.get.ts): createdAt/updatedAt + non-hidden scalar cols. */
function sortKeys(e: CmsEntity): string[] {
  const hidden = hiddenSet(e)
  const keys = ['createdAt', 'updatedAt']
  for (const [key, fld] of Object.entries(e.fields)) {
    if (!hidden.has(key) && !fld.relation && fld.type !== 'media' && fld.type !== 'richtext' && fld.type !== 'blocks') keys.push(key)
  }
  return keys
}

/** Query keys the list endpoint reserves for paging/sort/search (index.get.ts RESERVED). */
const RESERVED_QUERY_KEYS = new Set(['page', 'limit', 'sort', 'dir', 'q', 'locale'])

/** Filter allowlist (mirror index.get.ts filter loop): non-hidden text/slug/select + to-one FKs. */
function filters(e: CmsEntity): FilterParam[] {
  const hidden = hiddenSet(e)
  const out: FilterParam[] = []
  for (const [key, fld] of Object.entries(e.fields)) {
    // Skip reserved keys: the server's filter loop ignores them, so typing them
    // as filterable would be a lie (and `sort` would collide with the sort param).
    if (hidden.has(key) || RESERVED_QUERY_KEYS.has(key)) continue
    if (fld.relation?.kind === 'many-to-one') out.push({ key })
    else if (!fld.relation && ['text', 'slug', 'select'].includes(fld.type)) {
      out.push({ key, enumValues: fld.type === 'select' ? scalarEnum(fld) : undefined })
    }
  }
  return out
}

function scalarEnum(fld: FieldDescriptor): readonly string[] | undefined {
  const t = scalarType(fld)
  return t.kind === 'scalar' ? t.enumValues : undefined
}

/** Build the full content model: top-level shapes + the embedded/ref shapes they reference. */
export function buildContentModel(config: Record<string, any>): ContentModel {
  const reg = buildRegistry(config)
  // Singletons are delivered via /api/content/_global/:name (object), not as a
  // collection list, so they are excluded from the generated collection clients.
  const publicEntities = reg.entities.filter((e) => e.content?.public && !e.singleton)

  const entities: ContentShape[] = publicEntities.map((e) => ({
    name: e.name,
    pascal: pascal(e.name),
    titleField: e.titleField,
    slugField: e.content?.slug,
    gated: !!e.content?.published,
    fields: topLevelFields(reg, e),
    sortKeys: sortKeys(e),
    filters: filters(e),
    locales: reg.locales && e.localized.length ? reg.locales.locales : null,
  }))

  // Collect every relation target reachable through a populated field.
  const embeddedByName = new Map<string, EmbeddedShape>()
  const refByName = new Map<string, RefShape>()
  for (const e of publicEntities) {
    for (const f of topLevelFields(reg, e)) {
      if (f.type.kind !== 'relation-one' && f.type.kind !== 'relation-many') continue
      const target = reg.byName.get(f.type.target)
      if (!target) continue
      if (f.type.public) {
        if (!embeddedByName.has(target.name)) {
          embeddedByName.set(target.name, { name: target.name, pascal: pascal(target.name), fields: embeddedFields(target) })
        }
      }
      else if (!refByName.has(target.name)) {
        const titleFld = target.fields[target.titleField]
        refByName.set(target.name, {
          name: target.name,
          pascal: pascal(target.name),
          titleField: target.titleField,
          titleType: titleFld ? scalarType(titleFld) : { kind: 'scalar', scalar: 'string' },
          titleNullable: titleFld?.isOptional ?? false,
        })
      }
    }
  }

  return { entities, embedded: [...embeddedByName.values()], refs: [...refByName.values()] }
}

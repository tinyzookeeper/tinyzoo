import { z, type ZodTypeAny } from 'zod'
import type { AnyFieldDescriptor, FieldDescriptor, FieldKind } from './descriptor'
import type { LocalizedText } from './i18n'

/**
 * Blocks: an ordered list of typed sections a client arranges into a page (hero,
 * text, gallery, call to action…). The developer defines each block type in code,
 * with its own fields; the editor picks, orders and fills them. Stored as one jsonb
 * array per entry:
 *
 *   [{ id: 'k3j…', type: 'hero', heading: 'Vítejte', image: '<media id>' }, …]
 *
 * Block fields use the regular field catalog, minus relations (v1): text, slug,
 * number, boolean, datetime, select, rich text and media. Rich text is sanitised on
 * write like everywhere else; media ids are resolved by the content API and counted
 * by media cleanup.
 */

/** Field types allowed inside a block. */
export const BLOCK_FIELD_TYPES = new Set(['text', 'slug', 'number', 'boolean', 'datetime', 'select', 'richtext', 'media'])

export interface BlockDef<F extends Record<string, AnyFieldDescriptor> = Record<string, AnyFieldDescriptor>> {
  /** Name in the block picker ("Hero", { cs: 'Úvod', en: 'Hero' }). */
  label: LocalizedText
  /** One line in the block picker on what the block is for. */
  description?: LocalizedText
  /** Iconify name, e.g. 'i-lucide-image'. */
  icon?: string
  fields: F
}

export function defineBlock<F extends Record<string, AnyFieldDescriptor>>(def: BlockDef<F>): BlockDef<F> {
  for (const [key, fld] of Object.entries(def.fields) as [string, FieldDescriptor][]) {
    if (key === 'id' || key === 'type') throw new Error(`Block field "${key}" is reserved (every block has an id and a type).`)
    if (!BLOCK_FIELD_TYPES.has(fld.type)) {
      throw new Error(`Block field "${key}" has type "${fld.type}", which blocks do not support (allowed: ${[...BLOCK_FIELD_TYPES].join(', ')}).`)
    }
  }
  return def
}

type KindOf<D> = D extends FieldDescriptor<infer K> ? K : never
type Prettify<T> = { [K in keyof T]: T[K] } & {}
/** One stored block of type K. Media fields hold a media id (string). */
export type BlockValue<K extends string, F> = Prettify<
  { id: string; type: K }
  & { [P in keyof F & string as KindOf<F[P]>['optionalIn'] extends true ? never : P]: KindOf<F[P]>['out'] }
  & { [P in keyof F & string as KindOf<F[P]>['optionalIn'] extends true ? P : never]?: KindOf<F[P]>['out'] | null }
>
/** The value of a blocks field: an array of any of its block types. */
export type BlocksValue<B extends Record<string, BlockDef<any>>> = Array<{ [K in keyof B & string]: BlockValue<K, B[K]['fields']> }[keyof B & string]>

/** Erased shape of any stored block (what the emitted schema types the column as). */
export interface CmsBlock { id: string; type: string; [field: string]: unknown }

/** Zod for a blocks array: each block validated against its own type's fields. */
export function blocksSchema(blocks: Record<string, BlockDef>): ZodTypeAny {
  const variants = Object.entries(blocks).map(([type, def]) => {
    const shape: Record<string, ZodTypeAny> = {
      id: z.string().min(1).max(64),
      type: z.literal(type),
    }
    for (const [key, fld] of Object.entries(def.fields) as [string, FieldDescriptor][]) {
      // Inside a block every field may be left empty while the editor is still
      // filling it in, unless it is explicitly required.
      let s = fld.zod('create')
      if (!fld.isRequired) s = s.nullish()
      shape[key] = s
    }
    return z.object(shape)
  })
  if (!variants.length) return z.array(z.never()).max(0)
  const union = variants.length === 1 ? variants[0]! : z.discriminatedUnion('type', variants as any)
  return z.array(union).max(500).superRefine((list, ctx) => {
    const seen = new Set<string>()
    list.forEach((b: any, i: number) => {
      if (seen.has(b.id)) ctx.addIssue({ code: 'custom', path: [i, 'id'], message: 'Duplicate block id' })
      seen.add(b.id)
    })
  })
}

/** Serializable description of the block types for the admin graph. */
export function blocksGraph(blocks: Record<string, BlockDef>) {
  return Object.fromEntries(Object.entries(blocks).map(([type, def]) => [type, {
    label: def.label,
    description: def.description ?? null,
    icon: def.icon ?? 'i-lucide-square',
    fields: (Object.entries(def.fields) as [string, FieldDescriptor][]).map(([key, fld]) => ({
      key,
      type: fld.type,
      optional: !fld.isRequired,
      required: fld.isRequired,
      unique: false,
      ui: fld.ui,
      meta: fld.meta,
    })),
  }]))
}

/** For each block type, the keys of its media fields (for population and cleanup). */
export function blockMediaKeys(blocks: Record<string, BlockDef>): Map<string, string[]> {
  return new Map(Object.entries(blocks).map(([type, def]) => [
    type,
    (Object.entries(def.fields) as [string, FieldDescriptor][]).filter(([, f]) => f.type === 'media').map(([k]) => k),
  ]))
}

/** Every media id referenced by a stored blocks array (media fields + images in rich text). */
export function mediaIdsInBlocks(value: unknown, blocks: Record<string, BlockDef>, out: string[] = []): string[] {
  if (!Array.isArray(value)) return out
  const mediaKeys = blockMediaKeys(blocks)
  for (const block of value as CmsBlock[]) {
    if (!block || typeof block !== 'object') continue
    for (const key of (Object.hasOwn(blocks, block.type) ? mediaKeys.get(block.type) : undefined) ?? []) {
      const v = block[key]
      if (typeof v === 'string' && v) out.push(v)
    }
    const def = Object.hasOwn(blocks, block.type) ? blocks[block.type] : undefined
    if (!def) continue
    for (const [key, fld] of Object.entries(def.fields) as [string, FieldDescriptor][]) {
      if (fld.type === 'richtext') collectEmbedded(block[key], out)
    }
  }
  return out
}

function collectEmbedded(doc: any, out: string[]) {
  if (!doc || typeof doc !== 'object') return
  if (typeof doc.attrs?.mediaId === 'string') out.push(doc.attrs.mediaId)
  if (Array.isArray(doc.content)) for (const child of doc.content) collectEmbedded(child, out)
}

export type { FieldKind }

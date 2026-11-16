import { type PgColumn, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { buildColumn, camel, snake } from './fields'
import { cmsMedia } from './media'
import { cmsAudit, cmsCollab, cmsRevisions, cmsSearch, cmsState, cmsTokens, cmsUsers } from './system'
import type { LocalesDef } from './locales'
import { pathTemplateProblem, prefixedTemplates, type PathTemplate } from './paths'
import type { AnyFieldDescriptor, FieldDescriptor } from './descriptor'
import type { LocalizedText } from './i18n'

// ── type-level inference helpers ────────────────────────────────────────────────
type Prettify<T> = { [K in keyof T]: T[K] } & {}
type KindOf<D> = D extends FieldDescriptor<infer K> ? K : never

/** DB-column property key for a field: scalars keep the key, FKs become `${K}Id`, virtual relations drop. */
type ColumnKey<K extends string, D> = KindOf<D>['col'] extends 'none' ? never
  : KindOf<D>['col'] extends 'fk' ? `${K}Id`
  : K

/** A selected row: system columns + each owned column at its DB key. */
type RowFields<F> = Prettify<
  { id: string; createdAt: Date; updatedAt: Date; createdBy: string | null; updatedBy: string | null } &
  { [K in keyof F & string as ColumnKey<K, F[K]>]: KindOf<F[K]>['out'] }
>

type Included<D> = [KindOf<D>['in']] extends [never] ? false : true   // false for one-to-many
/** Insert payload (API keys, not DB keys): required vs optional split by `optionalIn`. */
type InsertFields<F> = Prettify<
  { [K in keyof F & string as Included<F[K]> extends true ? (KindOf<F[K]>['optionalIn'] extends true ? never : K) : never]: KindOf<F[K]>['in'] } &
  { [K in keyof F & string as Included<F[K]> extends true ? (KindOf<F[K]>['optionalIn'] extends true ? K : never) : never]?: KindOf<F[K]>['in'] }
>

/** The entity's drizzle table, typed enough for `eq()` + key autocomplete in access rules. */
type TableColumns<F> = Prettify<
  { id: PgColumn; createdAt: PgColumn; updatedAt: PgColumn; createdBy: PgColumn; updatedBy: PgColumn } &
  { [K in keyof F & string as ColumnKey<K, F[K]>]: PgColumn }
>

/** Headless content-delivery config — drives the public `/api/content/*` API. */
export interface ContentConfig<F extends Record<string, AnyFieldDescriptor>> {
  /** Expose this entity through the public content API. Default: false. */
  public?: boolean
  /**
   * Drizzle condition (against the entity's own table) that an item must satisfy
   * to be delivered publicly, e.g. `(t) => eq(t.status, 'published')`. Omit to make
   * every row public (reference data such as tags/categories).
   */
  published?: (table: TableColumns<F>) => unknown
  /** Field used to look a single item up by, e.g. 'slug'. Falls back to id. */
  slug?: keyof F & string
  /**
   * The item's address on the website, e.g. '/blog/:slug' (`:field` placeholders),
   * or one per language when the address is translated:
   * { cs: '/aktuality/:slug', en: '/news/:slug' }. Used for the sitemap, webhooks and
   * cache purging (with a language prefix per `defineLocales`).
   */
  path?: PathTemplate
  /** Relation/media field keys to resolve into the response. Default: all of them. */
  populate?: (keyof F & string)[]
  /**
   * Denylist of field keys to omit from the public response — applied to this entity
   * AND when it is populated as another entity's relation. Every sensitive scalar on a
   * publicly-readable/populatable entity must be listed here.
   */
  hidden?: (keyof F & string)[]
  /**
   * The website search (`/api/content/_search`) covers every public collection with a
   * `path`: its title, text, rich text and the text inside blocks. `false` leaves the
   * collection out; `{ fields }` matches only those fields (and the title).
   */
  search?: false | { fields?: (keyof F & string)[] }
}

/** Drives the admin publish/unpublish workflow + draft preview. */
export interface PublishConfig<F extends Record<string, AnyFieldDescriptor>> {
  /** The status field toggled by publish/unpublish (e.g. 'status'). */
  field: keyof F & string
  /** Value meaning "live". */
  publishedValue: string
  /** Value meaning "draft". */
  draftValue: string
  /**
   * Optional datetime field stamped with now() on publish. A date in the future
   * schedules the entry: it goes live at that moment (see `schedule`).
   */
  dateField?: keyof F & string
  /**
   * Treat a future `dateField` as "scheduled": live only from that moment on (the
   * content API, sitemap and webhooks all follow it). Default true when there is a
   * `dateField`.
   */
  schedule?: boolean
  /**
   * Frontend preview path template with `:field` placeholders, e.g. '/blog/:slug',
   * or one per language ({ cs: '/aktuality/:slug', en: '/news/:slug' }). The admin
   * opens it (language prefix added) with `?preview` so an editor can see a draft.
   */
  preview?: PathTemplate
}

export interface EntityDef<F extends Record<string, AnyFieldDescriptor>> {
  /** Plural name shown in the admin ("Posts"). One string, or one per admin locale. */
  label: LocalizedText
  /** Singular name for buttons and messages ("New post"). Defaults to `label`. */
  labelSingular?: LocalizedText
  /** One or two sentences on what this content is for — shown in the admin's lists and empty states. */
  description?: LocalizedText
  /** Iconify name for the admin navigation, e.g. 'i-lucide-newspaper'. */
  icon?: string
  titleField: keyof F & string
  fields: F
  /** A single-row global (Settings/Homepage) — admin shows one form, no list. */
  singleton?: boolean
  /**
   * Every write takes effect on the website at once (e.g. redirects). People who may
   * not publish (authors) cannot write such content.
   */
  live?: boolean
  admin?: {
    list?: {
      columns: (keyof F & string)[]
      searchable?: (keyof F & string)[]
      /**
       * A number field holding a manual order: the list can then be arranged by
       * dragging, and the content API returns this order unless asked to sort.
       */
      orderField?: keyof F & string
      /**
       * How the list looks. Default: chosen from the content — `grid` when the first
       * column is a picture and there is no text body (albums, logos), `dated` (Upcoming / Past) when there are no drafts and a
       * date column, otherwise `table`.
       */
      layout?: CmsListLayout
    }
    /**
     * How the editor is arranged. Default: chosen from the content — `write` for a
     * rich-text body with a page on the website, `preview` for pages built from blocks
     * (and globals with a `preview` address), otherwise `form`.
     */
    editor?: CmsEditorLayout
    /**
     * Where a global (defineSingleton) shows on the website, e.g. '/' for the home
     * page: the editor then shows it beside the form. Entries use `publish.preview`.
     */
    preview?: PathTemplate
    /**
     * Tabs for a long form: each lists the fields it shows in the main column
     * (fields in no tab go into the first). The side panel is not tabbed.
     */
    tabs?: { label: LocalizedText; fields: (keyof F & string)[] }[]
    /**
     * How the form is grouped: each section is a heading (best as a plain question,
     * "When?", "Where?") over the fields it lists, in order. Fields in no section
     * follow in sections of their own kind. Unset = grouped by kind of field (dates,
     * pictures, links, related entries) once a form has enough fields to need it.
     * Long forms (four sections or more) get a section menu beside them.
     */
    sections?: CmsFormSection<keyof F & string>[]
  }
  access?: Partial<Record<'read' | 'create' | 'update' | 'delete', (ctx: { user: any; table: TableColumns<F> }) => unknown>>
  content?: ContentConfig<F>
  publish?: PublishConfig<F>
}

/** A titled group of fields in the admin form (see `admin.sections`). */
export interface CmsFormSection<K extends string = string> {
  label: LocalizedText
  /** An Iconify icon for the heading, e.g. `i-lucide-calendar`. */
  icon?: string
  /** One sentence under the heading: what the fields are for or where they show. */
  description?: LocalizedText
  fields: K[]
  /** Lay short fields (single-line text, numbers, choices) two to a row on wide screens. */
  columns?: 1 | 2
}

/** The editor's arrangement: one calm writing column, a form with a properties panel, or the form beside the live page. */
export type CmsEditorLayout = 'write' | 'form' | 'preview'
/** The list's look: rows, picture cards, or Upcoming / Past by date. */
export type CmsListLayout = 'table' | 'grid' | 'dated'

/** The precisely-typed entity returned by defineEntity. */
export interface Entity<F extends Record<string, AnyFieldDescriptor> = Record<string, AnyFieldDescriptor>> {
  __cms: 'entity'
  name: string
  label: LocalizedText
  labelSingular?: LocalizedText
  description?: LocalizedText
  icon?: string
  titleField: keyof F & string
  table: TableColumns<F>
  /** Translations of the `.localized()` fields (`<name>_locales`), or undefined. */
  localesTable?: any
  /** Keys of the `.localized()` fields. */
  localized: string[]
  fields: F
  enums: EntityEnum[]
  insertSchema: z.ZodType<InsertFields<F>>
  updateSchema: z.ZodType<Partial<InsertFields<F>>>
  singleton?: boolean
  admin?: EntityDef<F>['admin']
  access?: EntityDef<F>['access']
  content?: EntityDef<F>['content']
  publish?: EntityDef<F>['publish']
}

/** Public data-shape helpers — `Row<typeof Post>`, `Insert<typeof Post>`, `Update<typeof Post>`. */
export type Row<E> = E extends Entity<infer F> ? RowFields<F> : never
export type Insert<E> = E extends Entity<infer F> ? InsertFields<F> : never
export type Update<E> = E extends Entity<infer F> ? Partial<InsertFields<F>> : never

/** Runtime-facing (erased) entity view used by the registry/server. */
export interface CmsEntity {
  __cms: 'entity'
  name: string
  label: LocalizedText
  labelSingular?: LocalizedText
  description?: LocalizedText
  icon?: string
  titleField: string
  table: any
  localesTable?: any
  localized: string[]
  fields: Record<string, FieldDescriptor>
  enums: EntityEnum[]
  insertSchema: z.ZodTypeAny
  updateSchema: z.ZodTypeAny
  singleton?: boolean
  admin?: {
    list?: { columns: string[]; searchable?: string[]; orderField?: string; layout?: CmsListLayout }
    editor?: CmsEditorLayout
    preview?: PathTemplate
    tabs?: { label: LocalizedText; fields: string[] }[]
    sections?: CmsFormSection[]
  }
  access?: Record<string, (ctx: { user: any; table: any }) => unknown>
  content?: {
    public?: boolean
    published?: (table: any) => unknown
    slug?: string
    path?: PathTemplate
    populate?: string[]
    hidden?: string[]
    search?: false | { fields?: string[] }
  }
  publish?: { field: string; publishedValue: string; draftValue: string; dateField?: string; schedule?: boolean; preview?: PathTemplate }
  live?: boolean
  /** Set by built-in presets (e.g. 'redirects') so the runtime can find them. */
  preset?: string
}

interface EntityEnum { key: string; varName: string; enumName: string; values: readonly string[] }

/** A translated column: same type, nullable, no default, uniqueness handled per locale. */
export function translationSpec(spec: import('./descriptor').ColumnSpec): import('./descriptor').ColumnSpec {
  return { ...spec, notNull: false, unique: false, default: undefined, reference: undefined }
}

/** DB column property name for a field (FKs become `${key}Id`). */
export function propOf(key: string, fld: FieldDescriptor): string {
  return fld.spec?.nameSuffix === '_id' ? key + 'Id' : key
}

/** Field names the CMS uses itself (system columns, translations, public item keys). */
const RESERVED_FIELD_NAMES = new Set(['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'parentId', 'locale', 'locales'])

/** Entity names the CMS uses internally; user entities may not take them. */
const RESERVED_ENTITY_NAMES = new Set(['media', 'graph', 'styleguide', 'login', 'setup', 'forgot', 'reset', 'invite', 'team', 'account'])

export function defineEntity<F extends Record<string, AnyFieldDescriptor>>(
  name: string,
  def: EntityDef<F>,
): Entity<F> {
  // Reserve `_`-prefixed names and built-ins so an entity can never shadow the
  // internal API routes (/api/cms/_media, /api/cms/_graph).
  if (name.startsWith('_') || RESERVED_ENTITY_NAMES.has(name)) {
    throw new Error(
      `Invalid entity name "${name}": names starting with "_" or in `
      + `{${[...RESERVED_ENTITY_NAMES].join(', ')}} are reserved by the CMS.`,
    )
  }
  const fields = def.fields as unknown as Record<string, FieldDescriptor>
  for (const key of Object.keys(fields)) {
    if (RESERVED_FIELD_NAMES.has(key)) {
      throw new Error(`Field "${key}" in "${name}" is reserved by the CMS (${[...RESERVED_FIELD_NAMES].join(', ')}).`)
    }
  }
  const orderField = def.admin?.list?.orderField as string | undefined
  if (orderField && (fields[orderField]?.type !== 'number' || fields[orderField]?.spec?.base.kind !== 'integer')) {
    throw new Error(`admin.list.orderField of "${name}" must be a whole-number field ("${orderField}" is not).`)
  }
  const sectioned = new Set<string>()
  for (const section of def.admin?.sections ?? []) {
    for (const key of section.fields as string[]) {
      if (!fields[key]) throw new Error(`admin.sections of "${name}" lists "${key}", which is not a field.`)
      if (sectioned.has(key)) throw new Error(`admin.sections of "${name}" lists "${key}" twice.`)
      sectioned.add(key)
    }
  }

  // 1) pgEnums for select fields
  const enums: EntityEnum[] = []
  const enumInstances: Record<string, any> = {}
  for (const [key, fld] of Object.entries(fields)) {
    if (fld.spec?.base.kind === 'enum') {
      const enumName = `${name}_${snake(key)}`
      enumInstances[key] = pgEnum(enumName, [...fld.spec.base.values] as [string, ...string[]])
      enums.push({ key, varName: camel(enumName), enumName, values: fld.spec.base.values })
    }
  }

  // 2) live columns (the InferSelectModel anchor)
  const columns: Record<string, any> = { id: uuid('id').primaryKey().defaultRandom() }
  for (const [key, fld] of Object.entries(fields)) {
    if (!fld.spec) continue
    const dbName = snake(key) + (fld.spec.nameSuffix ?? '')
    const refTarget = fld.spec.reference
      ? (fld.spec.reference.target === 'media'
          ? () => cmsMedia.id
          : () => (fld.relation!.to() as CmsEntity).table.id)
      : undefined
    columns[propOf(key, fld)] = buildColumn(fld.spec, dbName, { enumInstance: enumInstances[key], refTarget })
  }
  columns.createdAt = timestamp('created_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow()
  columns.updatedAt = timestamp('updated_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow()
  // Who created / last changed the row (a CMS user id; no FK so external auth works too).
  columns.createdBy = uuid('created_by')
  columns.updatedBy = uuid('updated_by')
  const table = pgTable(name, columns)

  // Translations: one row per (entry, language) holding the localized fields.
  // Nullable — an empty translation falls back to the default language.
  const localized = Object.entries(fields).filter(([, f]) => f.isLocalized).map(([k]) => k)
  let localesTable: any
  if (localized.length) {
    const lcols: Record<string, any> = {
      id: uuid('id').primaryKey().defaultRandom(),
      parentId: uuid('parent_id').notNull().references(() => (table as any).id, { onDelete: 'cascade' }),
      locale: text('locale').notNull(),
    }
    for (const key of localized) {
      const fld = fields[key]!
      lcols[key] = buildColumn(translationSpec(fld.spec!), snake(key))
    }
    lcols.createdAt = timestamp('created_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow()
    lcols.updatedAt = timestamp('updated_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow()
    const uniqueLocalized = localized.filter((k) => fields[k]!.isUnique)
    localesTable = pgTable(`${name}_locales`, lcols, (t: any) => [
      uniqueIndex(`${name}_locales_parent_locale_unique`).on(t.parentId, t.locale),
      ...uniqueLocalized.map((k) => uniqueIndex(`${name}_locales_${snake(k)}_unique`).on(t.locale, t[k])),
    ])
  }

  // 3) validation — create and update built separately (update carries no defaults)
  const createShape: Record<string, z.ZodTypeAny> = {}
  const updateShape: Record<string, z.ZodTypeAny> = {}
  for (const [key, fld] of Object.entries(fields)) {
    if (fld.relation?.kind === 'one-to-many') continue
    createShape[key] = fld.zod('create')
    updateShape[key] = fld.zod('update')
  }

  return {
    __cms: 'entity',
    name, label: def.label, titleField: def.titleField, localesTable, localized,
    labelSingular: def.labelSingular, description: def.description, icon: def.icon,
    table, admin: def.admin, access: def.access, content: def.content, fields: def.fields,
    singleton: def.singleton, publish: def.publish, live: def.live,
    enums,
    insertSchema: z.object(createShape),
    updateSchema: z.object(updateShape),
  } as unknown as Entity<F>
}

/** Define a single-row global (Settings, Homepage). One editable record, no list. */
export function defineSingleton<F extends Record<string, AnyFieldDescriptor>>(
  name: string,
  def: Omit<EntityDef<F>, 'singleton' | 'admin'> & { admin?: Pick<NonNullable<EntityDef<F>['admin']>, 'editor' | 'preview' | 'tabs' | 'sections'> },
): Entity<F> {
  return defineEntity(name, { ...def, singleton: true } as EntityDef<F>)
}

// ── registry: junctions + serializable graph, memoized per config module ────────
export interface Junction {
  name: string
  table: any
  ownerEntity: string
  targetEntity: string
  ownerCol: string
  targetCol: string
  fieldKey: string
}

export interface CmsRegistry {
  entities: CmsEntity[]
  byName: Map<string, CmsEntity>
  junctions: Junction[]
  junctionByOwnerField: Map<string, Junction>
  schema: Record<string, any>
  graph: any[]
  /** Content languages (defineLocales), or null when content is single-language. */
  locales: LocalesDef | null
  cmsMedia: typeof cmsMedia
  cmsUsers: typeof cmsUsers
  cmsTokens: typeof cmsTokens
  cmsAudit: typeof cmsAudit
  cmsCollab: typeof cmsCollab
  cmsRevisions: typeof cmsRevisions
  cmsState: typeof cmsState
  cmsSearch: typeof cmsSearch
}

const _regCache = new WeakMap<object, CmsRegistry>()
const _junctionCache = new Map<string, any>()

function isEntity(v: any): v is CmsEntity {
  return v && typeof v === 'object' && v.__cms === 'entity'
}

export function buildRegistry(config: Record<string, any>): CmsRegistry {
  const cached = _regCache.get(config)
  if (cached) return cached

  // Sorted by name: a module namespace's key order depends on who loaded it (Node
  // sorts exports alphabetically, Vite/Rollup may keep declaration order), and
  // every generated artifact (schema.ts, typed client, OpenAPI) must not.
  const entities = Object.values(config).filter(isEntity).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const byName = new Map(entities.map((e) => [e.name, e]))

  const junctions: Junction[] = []
  const junctionByOwnerField = new Map<string, Junction>()
  for (const e of entities) {
    for (const [key, fld] of Object.entries(e.fields)) {
      if (fld.relation?.kind !== 'many-to-many') continue
      const target = fld.relation.to() as CmsEntity
      const pair = [e.name, target.name].sort()
      const jname = fld.relation.through ?? `${pair[0]}_to_${pair[1]}`
      const ownerCol = `${e.name}Id`
      const targetCol = `${target.name}Id`
      let jtable = _junctionCache.get(jname)
      if (!jtable) {
        jtable = pgTable(jname, {
          [ownerCol]: uuid(`${snake(e.name)}_id`).notNull().references(() => e.table.id, { onDelete: 'cascade' }),
          [targetCol]: uuid(`${snake(target.name)}_id`).notNull().references(() => target.table.id, { onDelete: 'cascade' }),
        }, (t: any) => [primaryKey({ columns: [t[ownerCol], t[targetCol]] })])
        _junctionCache.set(jname, jtable)
      }
      const j: Junction = { name: jname, table: jtable, ownerEntity: e.name, targetEntity: target.name, ownerCol, targetCol, fieldKey: key }
      junctions.push(j)
      junctionByOwnerField.set(`${e.name}.${key}`, j)
    }
  }

  const locales = (Object.values(config).find((v: any) => v && v.__cms === 'locales') as LocalesDef | undefined) ?? null
  const withLocalized = entities.filter((e) => e.localized?.length)
  if (withLocalized.length && !locales) {
    throw new Error(`${withLocalized.map((e) => e.name).join(', ')} ha${withLocalized.length > 1 ? 've' : 's'} localized fields, but no languages are defined. Export \`locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })\` from cms.config.ts.`)
  }

  for (const e of entities) {
    for (const [what, t] of [['content.path', e.content?.path], ['publish.preview', e.publish?.preview], ['admin.preview', e.admin?.preview]] as const) {
      const problem = pathTemplateProblem(t, locales)
      if (problem) throw new Error(`${what} of "${e.name}" ${problem}.`)
    }
  }

  const schema: Record<string, any> = { cmsMedia, cmsUsers, cmsTokens, cmsAudit, cmsCollab, cmsRevisions, cmsState, cmsSearch }
  for (const e of entities) schema[e.name] = e.table
  for (const e of entities) if (e.localesTable) schema[`${e.name}_locales`] = e.localesTable
  for (const j of junctions) schema[j.name] = j.table

  const graph = entities.map((e) => entityGraph(e, locales))
  const reg: CmsRegistry = { entities, byName, junctions, junctionByOwnerField, schema, graph, locales, cmsMedia, cmsUsers, cmsTokens, cmsAudit, cmsCollab, cmsRevisions, cmsState, cmsSearch }
  _regCache.set(config, reg)
  return reg
}

/**
 * The editor's arrangement, from what the content is (the developer can say otherwise
 * with `admin.editor`): the layout is the point → `preview`; a text to write → `write`;
 * facts to fill in → `form`.
 */
export function editorLayout(e: CmsEntity): CmsEditorLayout {
  if (e.admin?.editor) return e.admin.editor
  const page = !!(e.publish?.preview ?? e.admin?.preview)
  const types = Object.values(e.fields).filter((f) => !f.meta?.group).map((f) => f.type)
  if (page && (e.singleton || types.includes('blocks'))) return 'preview'
  if (page && types.includes('richtext')) return 'write'
  return 'form'
}

/** The list's look, from what the content is (or `admin.list.layout`). */
export function listLayout(e: CmsEntity): CmsListLayout {
  if (e.admin?.list?.layout) return e.admin.list.layout
  const columns = e.admin?.list?.columns ?? Object.keys(e.fields).slice(0, 4)
  // The picture is the content (albums, logos): it leads the list and there is no text body.
  const hasBody = Object.values(e.fields).some((f) => f.type === 'richtext' && !f.meta?.group)
  if (e.fields[columns[0] ?? '']?.type === 'media' && !hasBody) return 'grid'
  if (!e.publish && columns.some((k) => e.fields[k]?.type === 'datetime')) return 'dated'
  return 'table'
}

function entityGraph(e: CmsEntity, locales: LocalesDef | null) {
  return {
    name: e.name,
    // Content languages, for entities with localized fields (drives the editor's switcher).
    locales: e.localized?.length && locales ? { default: locales.default, all: locales.locales, labels: locales.labels } : null,
    label: e.label,
    labelSingular: e.labelSingular ?? e.label,
    description: e.description ?? null,
    icon: e.icon ?? (e.singleton ? 'i-lucide-settings-2' : 'i-lucide-folder'),
    titleField: e.titleField,
    // A ready-made kind (pages, redirects, form…) the admin may treat specially.
    preset: (e as any).preset ?? null,
    singleton: !!e.singleton,
    publish: e.publish,
    // The preview address per language, prefix included ({ cs: '/aktuality/:slug', en: '/en/news/:slug' }).
    previewPaths: prefixedTemplates(e.publish?.preview ?? e.admin?.preview, locales),
    editor: editorLayout(e),
    listLayout: listLayout(e),
    listColumns: e.admin?.list?.columns ?? Object.keys(e.fields).slice(0, 4),
    searchable: e.admin?.list?.searchable ?? [],
    orderField: e.admin?.list?.orderField ?? null,
    tabs: e.admin?.tabs ?? null,
    sections: e.admin?.sections ?? null,
    fields: Object.entries(e.fields).map(([key, fld]) => ({
      key,
      type: fld.type,
      optional: fld.isOptional,
      localized: !!fld.isLocalized,
      required: fld.isRequired,
      unique: fld.isUnique,
      // What a new entry starts with in the admin (select defaults, switches).
      default: fld.default ?? null,
      ui: fld.ui,
      meta: fld.meta,
      relation: fld.relation
        ? { to: (fld.relation.to() as CmsEntity).name, kind: fld.relation.kind, required: !!fld.relation.required }
        : undefined,
    })),
  }
}

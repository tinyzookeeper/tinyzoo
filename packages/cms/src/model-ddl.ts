import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'
import { is, SQL } from 'drizzle-orm'
import type { CmsRegistry } from './entity'
import { CUSTOM_PREFIX } from './model-doc'

// The statements a site's own content types need, made from the drizzle tables the engine
// queries with, so the statements and the queries cannot disagree. The planner only adds and
// loosens. Everything else it lists as refused, and a second check (`assertAllowedStatement`)
// lets nothing through that is not on the short list in docs/custom-types-plan.md, section 5.

/**
 * A column of a custom table as the planner compares it. `type` is the SQL type, or the name of
 * a choice type when `enum` is true. `default` is SQL text.
 *
 * @internal
 */
export interface DbColumn {
  name: string
  type: string
  enum: boolean
  notNull: boolean
  default: string | null
  primary: boolean
  /** The name of the column's unique constraint, or null. */
  unique: string | null
}

/**
 * A foreign key of a custom table.
 *
 * @internal
 */
export interface DbForeignKey {
  name: string
  columns: string[]
  table: string
  foreign: string[]
  onDelete: string
}

/**
 * An index of a custom table.
 *
 * @internal
 */
export interface DbIndex {
  name: string
  unique: boolean
  columns: string[]
}

/**
 * A custom table: its columns, keys and indexes.
 *
 * @internal
 */
export interface DbTable {
  name: string
  columns: DbColumn[]
  fks: DbForeignKey[]
  indexes: DbIndex[]
  pk: { name: string; columns: string[] } | null
}

/**
 * What the planner compares: the choice types (name to values) and the tables, both by SQL name.
 *
 * @internal
 */
export interface DbShape {
  enums: Record<string, string[]>
  tables: Record<string, DbTable>
}

/**
 * What a change may do beyond adding and loosening. Names are SQL names; a column is
 * `'<table>.<column>'`.
 *
 * @internal
 */
export interface ModelDdlAllow {
  setNotNull?: string[]
  drop?: { tables?: string[]; columns?: string[]; types?: string[] }
}

const MAX_NAME_BYTES = 63

const dialect = new PgDialect()
const encoder = new TextEncoder()
const bytes = (s: string) => encoder.encode(s).length

/** The one way an identifier gets into a statement. */
const quoteIdent = (id: string) => `"${id.replace(/"/g, '""')}"`
/** The one way a string gets into a statement. */
const quoteLiteral = (s: string) => `'${s.replace(/'/g, "''")}'`

/** Cuts a name to 63 bytes at a character boundary, the way Postgres does. */
function cutName(name: string): string {
  if (bytes(name) <= MAX_NAME_BYTES) return name
  let out = ''
  let used = 0
  for (const ch of name) {
    const n = bytes(ch)
    if (used + n > MAX_NAME_BYTES) break
    out += ch
    used += n
  }
  return out
}

// ─── reading the drizzle tables ───

function defaultSql(col: any): string | null {
  if (!col.hasDefault) return null
  const d = col.default
  if (d === undefined) return null
  if (is(d, SQL)) return dialect.sqlToQuery(d).sql
  if (typeof d === 'string') return quoteLiteral(d)
  if (typeof d === 'number' || typeof d === 'boolean') return String(d)
  if (typeof d === 'object' && d !== null) return `${quoteLiteral(JSON.stringify(d))}::jsonb`
  return null
}

function tableShape(table: any, enumNames: Set<string>): DbTable {
  const c = getTableConfig(table)
  return {
    name: c.name,
    columns: c.columns.map((col: any) => {
      const type: string = col.getSQLType()
      return {
        name: col.name,
        type,
        enum: enumNames.has(type),
        notNull: !!col.notNull,
        default: defaultSql(col),
        primary: !!col.primary,
        unique: col.isUnique ? (col.uniqueName ?? `${c.name}_${col.name}_unique`) : null,
      }
    }),
    fks: c.foreignKeys.map((fk: any) => {
      const r = fk.reference()
      return {
        name: fk.getName(),
        columns: r.columns.map((x: any) => x.name),
        table: getTableConfig(r.foreignTable).name,
        foreign: r.foreignColumns.map((x: any) => x.name),
        onDelete: fk.onDelete ?? 'no action',
      }
    }),
    indexes: c.indexes.map((i: any) => ({
      name: i.config.name,
      unique: !!i.config.unique,
      columns: i.config.columns.map((x: any) => x.name),
    })),
    pk: c.primaryKeys[0]
      ? { name: c.primaryKeys[0].getName(), columns: c.primaryKeys[0].columns.map((x: any) => x.name) }
      : null,
  }
}

/**
 * The custom part of a registry: the tables of the types whose name starts with the custom prefix,
 * their translation tables, the relation tables that have such a type on either side, and the
 * choice types of those types.
 *
 * @internal
 */
export function customShape(reg: CmsRegistry): DbShape {
  const enums: Record<string, string[]> = {}
  const tables: any[] = []
  for (const e of reg.entities) {
    if (!e.name.startsWith(CUSTOM_PREFIX)) continue
    tables.push(e.table)
    if (e.localesTable) tables.push(e.localesTable)
    for (const en of e.enums) enums[en.enumName] = [...en.values]
  }
  for (const j of reg.junctions) {
    const custom = j.ownerEntity.startsWith(CUSTOM_PREFIX) || j.targetEntity.startsWith(CUSTOM_PREFIX)
    if (custom && !tables.includes(j.table)) tables.push(j.table)
  }
  const enumNames = new Set(Object.keys(enums))
  const out: DbShape = { enums, tables: {} }
  for (const t of tables) {
    const shape = tableShape(t, enumNames)
    out.tables[shape.name] = shape
  }
  return out
}

// ─── spelling: as drizzle-kit writes it, without the schema prefix and the final semicolon ───

/** A column type as it is written in a statement. */
function typeSql(c: DbColumn): string {
  if (c.enum) return quoteIdent(c.type)
  return c.type.replace(/^timestamp\((\d+)\) with time zone$/, 'timestamp ($1) with time zone')
}

function columnSql(c: DbColumn): string {
  return `${quoteIdent(c.name)} ${typeSql(c)}${c.primary ? ' PRIMARY KEY' : ''}${c.default !== null ? ` DEFAULT ${c.default}` : ''}${c.notNull ? ' NOT NULL' : ''}`
}

const idList = (ids: string[]) => ids.map(quoteIdent).join(',')

function createTableSql(t: DbTable): string {
  const lines = t.columns.map(columnSql)
  if (t.pk) lines.push(`CONSTRAINT ${quoteIdent(t.pk.name)} PRIMARY KEY(${idList(t.pk.columns)})`)
  for (const c of t.columns) if (c.unique) lines.push(`CONSTRAINT ${quoteIdent(c.unique)} UNIQUE(${quoteIdent(c.name)})`)
  return `CREATE TABLE ${quoteIdent(t.name)} (\n\t${lines.join(',\n\t')}\n)`
}

const foreignKeySql = (table: string, fk: DbForeignKey) =>
  `ALTER TABLE ${quoteIdent(table)} ADD CONSTRAINT ${quoteIdent(fk.name)} FOREIGN KEY (${idList(fk.columns)}) REFERENCES ${quoteIdent(fk.table)}(${idList(fk.foreign)}) ON DELETE ${fk.onDelete} ON UPDATE no action`

const indexSql = (table: string, i: DbIndex) =>
  `CREATE ${i.unique ? 'UNIQUE ' : ''}INDEX ${quoteIdent(i.name)} ON ${quoteIdent(table)} USING btree (${idList(i.columns)})`

const alterColumn = (table: string, column: string, what: string) =>
  `ALTER TABLE ${quoteIdent(table)} ALTER COLUMN ${quoteIdent(column)} ${what}`

// ─── the planner ───

/** A copy of the shape with every constraint and index name cut the way Postgres cuts it. */
function withCutNames(shape: DbShape): DbShape {
  const tables: Record<string, DbTable> = {}
  for (const [key, t] of Object.entries(shape.tables)) {
    tables[key] = {
      ...t,
      columns: t.columns.map((c) => ({ ...c, unique: c.unique === null ? null : cutName(c.unique) })),
      fks: t.fks.map((fk) => ({ ...fk, name: cutName(fk.name) })),
      indexes: t.indexes.map((i) => ({ ...i, name: cutName(i.name) })),
      pk: t.pk ? { ...t.pk, name: cutName(t.pk.name) } : null,
    }
  }
  return { enums: shape.enums, tables }
}

/** The reasons the names alone make a change impossible. */
function nameProblems(before: DbShape, after: DbShape): string[] {
  const out: string[] = []
  const bad = (what: string, name: string) => out.push(`The ${what} "${name}" is longer than ${MAX_NAME_BYTES} bytes.`)
  const tableNames = new Set([...Object.keys(before.tables), ...Object.keys(after.tables)])
  const typeNames = new Set([...Object.keys(before.enums), ...Object.keys(after.enums)])
  for (const name of tableNames) {
    if (!name.startsWith(CUSTOM_PREFIX)) out.push(`The table "${name}" does not start with "${CUSTOM_PREFIX}", so it cannot be changed here.`)
  }
  for (const name of typeNames) {
    if (!name.startsWith(CUSTOM_PREFIX)) out.push(`The choice type "${name}" does not start with "${CUSTOM_PREFIX}", so it cannot be changed here.`)
  }
  for (const name of tableNames) if (bytes(name) > MAX_NAME_BYTES) bad('table name', name)
  for (const name of typeNames) if (bytes(name) > MAX_NAME_BYTES) bad('choice type name', name)
  for (const t of Object.values(after.tables)) {
    for (const c of t.columns) if (bytes(c.name) > MAX_NAME_BYTES) bad('column name', `${t.name}.${c.name}`)
    const own = new Map<string, number>()
    const seen = (name: string) => own.set(name, (own.get(name) ?? 0) + 1)
    if (t.pk) seen(t.pk.name)
    for (const c of t.columns) if (c.unique !== null) seen(c.unique)
    for (const fk of t.fks) seen(fk.name)
    for (const i of t.indexes) seen(i.name)
    for (const [name, n] of own) if (n > 1) out.push(`Two names on the table "${t.name}" are the same ("${name}"), cut to ${MAX_NAME_BYTES} bytes.`)
  }
  // Primary keys, unique constraints and indexes share one namespace with the tables.
  const owner = new Map<string, string>()
  for (const name of Object.keys(after.tables)) owner.set(name, name)
  const claim = (name: string, table: string) => {
    const was = owner.get(name)
    if (was !== undefined && was !== table) out.push(`The name "${name}" is used by both "${was}" and "${table}".`)
    else if (was === undefined) owner.set(name, table)
  }
  for (const t of Object.values(after.tables)) {
    if (t.pk) claim(t.pk.name, t.name)
    for (const c of t.columns) if (c.unique !== null) claim(c.unique, t.name)
    for (const i of t.indexes) claim(i.name, t.name)
  }
  return out
}

/**
 * The statements that take the custom tables from `before` to `after`, and what it refuses.
 *
 * It adds: choice types and choices, tables, columns, indexes and foreign keys of new tables, and
 * foreign keys of new columns. It loosens: `DROP NOT NULL`, and `SET DEFAULT` or `DROP DEFAULT`.
 * `SET NOT NULL` and every drop happen only for what `allow` names. Any other difference is listed
 * in `refused` and makes no statement.
 *
 * A problem with a name (too long, no prefix, two names that collide) refuses the whole change:
 * `statements` is then empty.
 *
 * @internal
 */
export function planModelDdl(before: DbShape, after: DbShape, allow: ModelDdlAllow = {}): { statements: string[]; refused: string[] } {
  const b = withCutNames(before)
  const a = withCutNames(after)
  const named = nameProblems(b, a)
  if (named.length) return { statements: [], refused: named }

  const refused: string[] = []
  const setNotNull = new Set(allow.setNotNull ?? [])
  const dropColumns = new Set(allow.drop?.columns ?? [])
  const dropTables = new Set(allow.drop?.tables ?? [])
  const dropTypes = new Set(allow.drop?.types ?? [])

  const types: string[] = []
  const values: string[] = []
  const tables: string[] = []
  const added: string[] = []
  const altered: string[] = []
  const indexes: string[] = []
  const fks: string[] = []
  const droppedColumns: string[] = []
  const goneTables: DbTable[] = []
  const droppedTypes: string[] = []

  for (const [name, now] of Object.entries(a.enums)) {
    const was = b.enums[name]
    if (!was) {
      types.push(`CREATE TYPE ${quoteIdent(name)} AS ENUM(${now.map(quoteLiteral).join(', ')})`)
      continue
    }
    for (const v of was) if (!now.includes(v)) refused.push(`The choice "${v}" of ${name} is removed. A choice cannot be removed from the database.`)
    for (const v of now) if (!was.includes(v)) values.push(`ALTER TYPE ${quoteIdent(name)} ADD VALUE ${quoteLiteral(v)}`)
  }
  for (const name of Object.keys(b.enums)) {
    if (a.enums[name]) continue
    if (dropTypes.has(name)) droppedTypes.push(`DROP TYPE ${quoteIdent(name)}`)
    else refused.push(`The choice type ${name} is gone, and dropping it is not allowed.`)
  }

  for (const t of Object.values(a.tables)) {
    const was = b.tables[t.name]
    if (!was) {
      tables.push(createTableSql(t))
      for (const i of t.indexes) indexes.push(indexSql(t.name, i))
      for (const fk of t.fks) fks.push(foreignKeySql(t.name, fk))
      continue
    }
    const name = t.name
    const newColumns = new Set<string>()
    const skipped = new Set<string>()
    const goneColumns = new Set<string>()

    for (const c of t.columns) {
      const old = was.columns.find((o) => o.name === c.name)
      const at = `${name}.${c.name}`
      if (!old) {
        if (c.primary) refused.push(`The new column ${at} would be a primary key.`)
        else if (c.unique !== null) refused.push(`The new column ${at} would be unique. A unique rule cannot be added to an existing table.`)
        else if (c.notNull && c.default === null) refused.push(`The new column ${at} is required but has no default.`)
        else {
          newColumns.add(c.name)
          added.push(`ALTER TABLE ${quoteIdent(name)} ADD COLUMN ${columnSql(c)}`)
          continue
        }
        skipped.add(c.name)
        continue
      }
      if (old.type !== c.type) refused.push(`The column ${at} changes its type from ${old.type} to ${c.type}.`)
      if (!old.notNull && c.notNull) {
        if (setNotNull.has(at)) altered.push(alterColumn(name, c.name, 'SET NOT NULL'))
        else refused.push(`The column ${at} becomes required, and that is not allowed here.`)
      }
      if (old.notNull && !c.notNull) altered.push(alterColumn(name, c.name, 'DROP NOT NULL'))
      if (old.default !== c.default) {
        altered.push(alterColumn(name, c.name, c.default === null ? 'DROP DEFAULT' : `SET DEFAULT ${c.default}`))
      }
      if (old.unique !== c.unique) {
        refused.push(c.unique === null ? `The unique rule of ${at} is removed.` : `The column ${at} becomes unique. A unique rule cannot be added to an existing table.`)
      }
    }
    for (const o of was.columns) {
      if (t.columns.some((c) => c.name === o.name)) continue
      const at = `${name}.${o.name}`
      if (dropColumns.has(at)) {
        goneColumns.add(o.name)
        droppedColumns.push(`ALTER TABLE ${quoteIdent(name)} DROP COLUMN ${quoteIdent(o.name)}`)
      } else refused.push(`The column ${at} is gone, and dropping it is not allowed.`)
    }

    if (JSON.stringify(was.pk) !== JSON.stringify(t.pk)) refused.push(`The primary key of ${name} changes.`)

    // A foreign key whose only difference is `onDelete` is neither planned nor refused. Making a
    // required picture or relation optional, or hiding it, turns `restrict` into `set null`, and
    // the allowed list has no statement to change a constraint. The database keeps the stricter rule.
    for (const fk of t.fks) {
      const old = was.fks.find((o) => o.name === fk.name)
      if (old) {
        if (old.columns.join() !== fk.columns.join() || old.table !== fk.table || old.foreign.join() !== fk.foreign.join()) {
          refused.push(`The foreign key ${fk.name} of ${name} changes its columns or its target.`)
        }
      } else if (fk.columns.some((c) => newColumns.has(c))) fks.push(foreignKeySql(name, fk))
      else if (!fk.columns.some((c) => skipped.has(c))) refused.push(`The foreign key ${fk.name} is new on the existing columns of ${name}.`)
    }
    for (const old of was.fks) {
      if (t.fks.some((fk) => fk.name === old.name)) continue
      if (old.columns.some((c) => goneColumns.has(c))) continue
      refused.push(`The foreign key ${old.name} of ${name} is removed.`)
    }

    for (const i of t.indexes) {
      const old = was.indexes.find((o) => o.name === i.name)
      if (!old) {
        if (!i.columns.some((c) => skipped.has(c))) refused.push(`The index ${i.name} is new on the existing table ${name}.`)
      } else if (old.unique !== i.unique || old.columns.join() !== i.columns.join()) refused.push(`The index ${i.name} of ${name} changes.`)
    }
    for (const old of was.indexes) {
      if (t.indexes.some((i) => i.name === old.name)) continue
      if (old.columns.some((c) => goneColumns.has(c))) continue
      refused.push(`The index ${old.name} of ${name} is removed.`)
    }
  }

  for (const old of Object.values(b.tables)) {
    if (a.tables[old.name]) continue
    if (dropTables.has(old.name)) goneTables.push(old)
    else refused.push(`The table ${old.name} is gone, and dropping it is not allowed.`)
  }

  // A table that has a foreign key to another dropped table goes first.
  const droppedTables: string[] = []
  const left = [...goneTables]
  while (left.length) {
    const i = left.findIndex((t) => !left.some((u) => u !== t && u.fks.some((fk) => fk.table === t.name)))
    const [t] = left.splice(i < 0 ? 0 : i, 1)
    if (t) droppedTables.push(`DROP TABLE ${quoteIdent(t.name)}`)
  }

  const statements = [...types, ...values, ...tables, ...added, ...altered, ...indexes, ...fks, ...droppedColumns, ...droppedTables, ...droppedTypes]
  for (const s of statements) assertAllowedStatement(s)
  return { statements, refused }
}

// ─── the guard ───

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const ID = '"(?:[^"]|"")+"'
const PREFIXED = `"${escapeRegExp(CUSTOM_PREFIX)}(?:[^"]|"")*"`
const LIT = "'(?:[^']|'')*'"
const IDS = `${ID}(?:\\s*,\\s*${ID})*`
const DEFAULT = `(?:${LIT}(?:::jsonb)?|-?\\d+(?:\\.\\d+)?|true|false|now\\(\\)|gen_random_uuid\\(\\))`
const TYPE = `(?:uuid|text|integer|boolean|jsonb|numeric\\(\\d+,\\s*\\d+\\)|timestamp\\s*\\(\\d\\)\\s+with\\s+time\\s+zone|${PREFIXED})`
const COLUMN = `${ID}\\s+${TYPE}(?:\\s+PRIMARY\\s+KEY)?(?:\\s+DEFAULT\\s+${DEFAULT})?(?:\\s+NOT\\s+NULL)?`
const TABLE_ITEM = `(?:${COLUMN}|CONSTRAINT\\s+${ID}\\s+PRIMARY\\s+KEY\\s*\\(\\s*${IDS}\\s*\\)|CONSTRAINT\\s+${ID}\\s+UNIQUE\\s*\\(\\s*${IDS}\\s*\\))`

const ALLOWED_SHAPES: RegExp[] = [
  `CREATE\\s+TYPE\\s+${PREFIXED}\\s+AS\\s+ENUM\\s*\\(\\s*${LIT}(?:\\s*,\\s*${LIT})*\\s*\\)`,
  `ALTER\\s+TYPE\\s+${PREFIXED}\\s+ADD\\s+VALUE\\s+${LIT}`,
  `CREATE\\s+TABLE\\s+${PREFIXED}\\s*\\(\\s*${TABLE_ITEM}(?:\\s*,\\s*${TABLE_ITEM})*\\s*\\)`,
  `ALTER\\s+TABLE\\s+${PREFIXED}\\s+ADD\\s+COLUMN\\s+${COLUMN}`,
  `ALTER\\s+TABLE\\s+${PREFIXED}\\s+ADD\\s+CONSTRAINT\\s+${ID}\\s+FOREIGN\\s+KEY\\s*\\(\\s*${IDS}\\s*\\)\\s+REFERENCES\\s+${ID}\\s*\\(\\s*${IDS}\\s*\\)\\s+ON\\s+DELETE\\s+(?:cascade|restrict|set\\s+null|no\\s+action)\\s+ON\\s+UPDATE\\s+no\\s+action`,
  `CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+${ID}\\s+ON\\s+${PREFIXED}\\s+USING\\s+btree\\s*\\(\\s*${IDS}\\s*\\)`,
  `ALTER\\s+TABLE\\s+${PREFIXED}\\s+ALTER\\s+COLUMN\\s+${ID}\\s+(?:DROP\\s+NOT\\s+NULL|SET\\s+NOT\\s+NULL|DROP\\s+DEFAULT|SET\\s+DEFAULT\\s+${DEFAULT})`,
  `ALTER\\s+TABLE\\s+${PREFIXED}\\s+DROP\\s+COLUMN\\s+${ID}`,
  `DROP\\s+TABLE\\s+${PREFIXED}`,
  `DROP\\s+TYPE\\s+${PREFIXED}`,
].map((source) => new RegExp(`^${source}$`))

/**
 * Walks the statement once. Returns what is left when quoted names and literals are taken out, and
 * the names, or null when a quote is never closed.
 */
function scanStatement(sql: string): { bare: string; identifiers: string[] } | null {
  let bare = ''
  const identifiers: string[] = []
  let i = 0
  while (i < sql.length) {
    const ch = sql[i]!
    if (ch === '"' || ch === "'") {
      let text = ''
      i++
      for (;;) {
        if (i >= sql.length) return null
        const c = sql[i]!
        if (c === ch) {
          if (sql[i + 1] === ch) { text += ch; i += 2; continue }
          i++
          break
        }
        text += c
        i++
      }
      if (ch === '"') identifiers.push(text)
      bare += ch === '"' ? 'I' : 'L'
      continue
    }
    bare += ch
    i++
  }
  return { bare, identifiers }
}

/**
 * Throws unless the statement is one of the shapes on the allowed list, changes only tables and
 * types under the custom prefix (a foreign key may point at any table), and has no name over 63
 * bytes. It refuses a second statement and comments.
 *
 * @internal
 */
export function assertAllowedStatement(sql: string): void {
  const fail = (why: string): never => {
    throw new Error(`The statement is not allowed (${why}): ${sql.slice(0, 200)}`)
  }
  if (typeof sql !== 'string') return fail('not text')
  const scanned = scanStatement(sql)
  if (!scanned) return fail('a quote is not closed')
  const semicolons = scanned.bare.indexOf(';')
  if (semicolons !== -1 && scanned.bare.slice(semicolons).trim() !== ';') return fail('more than one statement')
  if (scanned.bare.includes('--') || scanned.bare.includes('/*')) return fail('a comment')
  for (const id of scanned.identifiers) if (bytes(id) > MAX_NAME_BYTES) return fail(`a name is longer than ${MAX_NAME_BYTES} bytes`)
  const statement = sql.trim().replace(/\s*;$/, '')
  if (!ALLOWED_SHAPES.some((re) => re.test(statement))) return fail('not on the allowed list')
}

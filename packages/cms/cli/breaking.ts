/**
 * The breaking-statement guard of `tinyzoo generate`: reads a freshly generated
 * migration and names, in plain words, two classes of statements:
 *
 *  - **destructive** — loses data or breaks the version of the site that is still
 *    running during a rolling deploy (drops, type changes, renames); kept with
 *    `--allow-drop`;
 *  - **risky** — may fail on rows that already exist, so the new version cannot finish
 *    its migration at start, exits, and restarts in a loop (a required column without a
 *    default, `SET NOT NULL`, a new unique constraint or index); kept with `--allow-risky`.
 *
 * A table the same migration creates is empty, so nothing on it can fail.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type DestructiveKind = 'drop-table' | 'drop-column' | 'drop-type' | 'change-type' | 'rename'
export type RiskyKind = 'required-column' | 'set-not-null' | 'unique' | 'check'
export type BreakingKind = DestructiveKind | RiskyKind

const RISKY: ReadonlySet<BreakingKind> = new Set<RiskyKind>(['required-column', 'set-not-null', 'unique', 'check'])
/** True for statements that may fail on existing rows (as opposed to losing data). */
export const isRisky = (c: BreakingChange): boolean => RISKY.has(c.kind)

export interface BreakingChange {
  kind: BreakingKind
  /** Plain-language description, e.g. "drops column `x` of `post` — its content is lost". */
  message: string
  /** The SQL statement it came from, trimmed. */
  statement: string
}

// An identifier as drizzle-kit writes it: "name" or "schema"."name".
const ID = String.raw`(?:"[^"]+"\.)?"([^"]+)"`
const tick = (s: string) => `\`${s}\``

/** Blank out comments and string literals, so `'DROP TABLE'` in a default is not a statement. */
function stripNoise(statement: string): string {
  return statement
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
}

/** Split at commas that are not inside parentheses (`numeric(10, 2)` stays whole). */
function splitTopLevel(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) { parts.push(body.slice(from, i)); from = i + 1 }
  }
  parts.push(body.slice(from))
  return parts.map((p) => p.trim()).filter(Boolean)
}

/** `("a","b")` → `a, b`, for the message. */
const columnList = (cols: string) => cols.split(',').map((c) => c.trim().replace(/^"|"$/g, '')).map(tick).join(', ')

/** Everything in one migration file's SQL that the guard stops on. */
export function scanBreaking(migrationSql: string): BreakingChange[] {
  const found: BreakingChange[] = []
  // Tables this migration creates: empty, so a required column or unique index on them cannot fail.
  const created = new Set<string>()
  // A renamed table gets its indexes and constraints re-created under the new name (drop, then
  // create): the rows and their values are unchanged, so the unique ones cannot newly fail.
  const renamedFrom = new Map<string, string>() // new table → old table
  const dropped = new Set<string>() // names of dropped indexes and constraints
  const recreated = (table: string, name: string | undefined) => {
    const old = renamedFrom.get(table)
    return !!old && !!name && name.startsWith(table) && dropped.has(old + name.slice(table.length))
  }
  for (const raw of migrationSql.split('--> statement-breakpoint')) {
    const statement = stripNoise(raw).trim()
    if (!statement) continue
    const add = (kind: BreakingChange['kind'], message: string) => found.push({ kind, message, statement: raw.trim() })

    const createTable = new RegExp(String.raw`^CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${ID}`, 'i').exec(statement)
    if (createTable) { created.add(createTable[1]!); continue }

    const dropIndex = new RegExp(String.raw`^DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?${ID}`, 'i').exec(statement)
    if (dropIndex) { dropped.add(dropIndex[1]!); continue }

    const uniqueIndex = new RegExp(String.raw`^CREATE\s+UNIQUE\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?${ID}\s+ON\s+(?:ONLY\s+)?${ID}[^(]*\(([\s\S]*)\)`, 'i').exec(statement)
    if (uniqueIndex) {
      if (!created.has(uniqueIndex[2]!) && !recreated(uniqueIndex[2]!, uniqueIndex[1])) add('unique', `adds a unique index ${tick(uniqueIndex[1]!)} on ${columnList(uniqueIndex[3]!)} of ${tick(uniqueIndex[2]!)} — fails if rows there already share a value; check the existing rows (or clean them up) first`)
      continue
    }

    const dropTable = new RegExp(String.raw`^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?${ID}`, 'i').exec(statement)
    if (dropTable) { add('drop-table', `drops table ${tick(dropTable[1]!)} — every row in it is lost`); continue }

    const dropType = new RegExp(String.raw`^DROP\s+TYPE\s+(?:IF\s+EXISTS\s+)?${ID}`, 'i').exec(statement)
    if (dropType) { add('drop-type', `drops type ${tick(dropType[1]!)} — a column that still uses it breaks`); continue }

    const renameType = new RegExp(String.raw`^ALTER\s+TYPE\s+${ID}\s+RENAME\s+TO\s+${ID}`, 'i').exec(statement)
    if (renameType) { add('rename', `renames type ${tick(renameType[1]!)} to ${tick(renameType[2]!)} — the running version still uses the old name`); continue }

    const alter = new RegExp(String.raw`^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?${ID}\s+([\s\S]*)$`, 'i').exec(statement)
    if (!alter) continue
    const table = alter[1]!
    const body = alter[2]!
    // Several actions may share one statement when it was written by hand.
    for (const m of body.matchAll(new RegExp(String.raw`DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?${ID}`, 'gi'))) {
      add('drop-column', `drops column ${tick(m[1]!)} of ${tick(table)} — its content is lost`)
    }
    for (const m of body.matchAll(new RegExp(String.raw`ALTER\s+COLUMN\s+${ID}\s+(?:SET\s+DATA\s+)?TYPE\s+((?:\([^)]*\)|[^,;(])+)`, 'gi'))) {
      add('change-type', `changes the type of column ${tick(m[1]!)} of ${tick(table)} to ${m[2]!.trim().split(/\s+USING\s/i)[0]} — values that do not convert are lost, or the migration fails`)
    }
    for (const m of body.matchAll(new RegExp(String.raw`RENAME\s+COLUMN\s+${ID}\s+TO\s+${ID}`, 'gi'))) {
      add('rename', `renames column ${tick(m[1]!)} of ${tick(table)} to ${tick(m[2]!)} — the running version still reads the old name`)
    }
    for (const m of body.matchAll(new RegExp(String.raw`DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?${ID}`, 'gi'))) dropped.add(m[1]!)
    // What may fail on rows that exist. Skipped for a table created above in the same file.
    if (!created.has(table)) {
      for (const part of splitTopLevel(body)) {
        const addColumn = new RegExp(String.raw`^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?${ID}\s+([\s\S]*)$`, 'i').exec(part)
        if (addColumn && !/^(?:CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN)\b/i.test(part.replace(/^ADD\s+/i, ''))) {
          const [, column, def] = addColumn
          const hasDefault = /\bDEFAULT\b|\bGENERATED\b|^(?:big|small)?serial\b/i.test(def!)
          if (/\bNOT\s+NULL\b/i.test(def!) && !hasDefault) {
            add('required-column', `adds required column ${tick(column!)} to ${tick(table)} without a default — fails if ${tick(table)} has rows; give the field a default, or add it optional first, fill it, then make it required`)
          }
          if (/\bUNIQUE\b/i.test(def!) && hasDefault) {
            add('unique', `adds a unique column ${tick(column!)} to ${tick(table)} with a default — every existing row gets the same value, so it fails if ${tick(table)} has more than one row`)
          }
          continue
        }
        const setNotNull = new RegExp(String.raw`^ALTER\s+(?:COLUMN\s+)?${ID}\s+SET\s+NOT\s+NULL\b`, 'i').exec(part)
        if (setNotNull) {
          add('set-not-null', `makes column ${tick(setNotNull[1]!)} of ${tick(table)} required — fails if any row has no value there; fill the empty ones first (in an earlier release), then make it required`)
          continue
        }
        const addUnique = new RegExp(String.raw`^ADD\s+(?:CONSTRAINT\s+${ID}\s+)?UNIQUE\s*(?:NULLS\s+NOT\s+DISTINCT\s*)?\(([^)]*)\)`, 'i').exec(part)
        if (addUnique) {
          if (!recreated(table, addUnique[1])) add('unique', `adds a unique constraint${addUnique[1] ? ` ${tick(addUnique[1])}` : ''} on ${columnList(addUnique[2]!)} of ${tick(table)} — fails if rows there already share a value; check the existing rows (or clean them up) first`)
          continue
        }
        const addCheck = new RegExp(String.raw`^ADD\s+(?:CONSTRAINT\s+${ID}\s+)?CHECK\b`, 'i').exec(part)
        if (addCheck) add('check', `adds a check${addCheck[1] ? ` ${tick(addCheck[1])}` : ''} to ${tick(table)} — fails if a row already breaks it`)
      }
    }
    // Constraint and index renames never break a running version; only tables do.
    const renameTable = new RegExp(String.raw`^RENAME\s+TO\s+${ID}`, 'i').exec(body)
    if (renameTable) renamedFrom.set(renameTable[1]!, table)
    if (renameTable) add('rename', `renames table ${tick(table)} to ${tick(renameTable[1]!)} — the running version still reads the old name`)
  }
  return found
}

/**
 * Take a generated migration back out: its SQL file, its snapshot and its entry in the
 * journal. Leaves everything else in the migrations folder as it was. `journalBefore` is
 * the journal's text from before the migration was generated; it is put back verbatim
 * (drizzle-kit rewrites the file with its own formatting).
 */
export function removeMigrations(migrationsDir: string, tags: string[], journalBefore?: string): void {
  const journalPath = join(migrationsDir, 'meta/_journal.json')
  const original = readFileSync(journalPath, 'utf8')
  const journal = JSON.parse(original) as { entries: { idx: number; tag: string }[] }
  for (const tag of tags) {
    rmSync(join(migrationsDir, `${tag}.sql`), { force: true })
    const prefix = /^(\d+)_/.exec(tag)?.[1]
    const entry = journal.entries.find((e) => e.tag === tag)
    const snapshot = join(migrationsDir, 'meta', `${prefix ?? String(entry?.idx ?? 0).padStart(4, '0')}_snapshot.json`)
    if (existsSync(snapshot)) rmSync(snapshot)
  }
  if (journalBefore !== undefined) { writeFileSync(journalPath, journalBefore); return }
  journal.entries = journal.entries.filter((e) => !tags.includes(e.tag))
  writeFileSync(journalPath, JSON.stringify(journal, null, 2) + (original.endsWith('\n') ? '\n' : ''))
}

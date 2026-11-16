/**
 * The breaking-statement guard of `tinyzoo generate`: reads a freshly generated
 * migration and names, in plain words, everything in it that loses data or breaks the
 * version of the site that is still running during a rolling deploy.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface BreakingChange {
  kind: 'drop-table' | 'drop-column' | 'drop-type' | 'change-type' | 'rename'
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

/** Everything in one migration file's SQL that the guard stops on. */
export function scanBreaking(migrationSql: string): BreakingChange[] {
  const found: BreakingChange[] = []
  for (const raw of migrationSql.split('--> statement-breakpoint')) {
    const statement = stripNoise(raw).trim()
    if (!statement) continue
    const add = (kind: BreakingChange['kind'], message: string) => found.push({ kind, message, statement: raw.trim() })

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
    // Constraint and index renames never break a running version; only tables do.
    const renameTable = new RegExp(String.raw`^RENAME\s+TO\s+${ID}`, 'i').exec(body)
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

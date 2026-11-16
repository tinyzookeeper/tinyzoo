/**
 * `tinyzoo generate`, after the schema has been emitted: let drizzle-kit write the
 * migration, enable pg_trgm in it when needed, and stop on statements that lose data
 * (see breaking.ts) unless the person confirms them.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { removeMigrations, scanBreaking, type BreakingChange } from './breaking'

export interface DrizzleKitResult {
  ok: boolean
  /** drizzle-kit needed to ask a question (a rename?) and there was no terminal. */
  needsTerminal: boolean
}

export interface GenerateOptions {
  /** The host's migrations folder. */
  migrationsDir: string
  allowDrop: boolean
  /** A person can be asked a question. */
  interactive: boolean
  runDrizzleKit: () => Promise<DrizzleKitResult>
  confirm: (question: string) => Promise<boolean>
  log?: (line: string) => void
  error?: (line: string) => void
}

const journalTags = (dir: string): string[] => {
  const file = join(dir, 'meta/_journal.json')
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')).entries as { tag: string }[]).map((e) => e.tag) : []
}

export const NEEDS_TERMINAL_MESSAGE = `✗ drizzle-kit needs to ask whether a table or column was renamed or is new, and there is no terminal to answer in.
  Run \`tinyzoo generate\` in a terminal and answer the question, or write the rename into the migration by hand:
  see "Renaming a field" and "Renaming an entity" in docs/upgrading.md.`

/** Plain-language report of what a migration would do, for the terminal. */
export function describeBreaking(file: string, changes: BreakingChange[]): string {
  return [
    `${file} would:`,
    ...changes.map((c) => `  • ${c.message}`),
    '',
    'These changes cannot be undone, and the version of the site that is still running during a deploy breaks on them.',
    'Safer: spread it over two releases — first add the new column or table and write to both, drop the old one in the next release.',
    'See docs/upgrading.md, "The two-step rule" (and "Renaming a field" if this is a rename).',
  ].join('\n')
}

/** Returns the process exit code. */
export async function generateMigration(opts: GenerateOptions): Promise<number> {
  const log = opts.log ?? console.log
  const error = opts.error ?? console.error
  const journalFile = join(opts.migrationsDir, 'meta/_journal.json')
  const journalBefore = existsSync(journalFile) ? readFileSync(journalFile, 'utf8') : undefined
  const before = new Set(journalTags(opts.migrationsDir))

  const result = await opts.runDrizzleKit()
  if (result.needsTerminal) { error(NEEDS_TERMINAL_MESSAGE); return 1 }
  if (!result.ok) return 1

  const added = journalTags(opts.migrationsDir).filter((t) => !before.has(t))
  const changes: { file: string; found: BreakingChange[] }[] = []
  for (const tag of added) {
    const file = join(opts.migrationsDir, `${tag}.sql`)
    let text = readFileSync(file, 'utf8')
    // Trigram indexes (the search index) need pg_trgm, which drizzle-kit does not enable.
    // `tinyzoo up` and the app's start enable it themselves (an upgrade step); this keeps
    // a site that migrates with plain drizzle-kit working too.
    if (text.includes('gin_trgm_ops') && !text.includes('CREATE EXTENSION IF NOT EXISTS pg_trgm')) {
      text = 'CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint\n' + text
      writeFileSync(file, text)
      log(`✓ ${tag}.sql: enables pg_trgm (for the search index)`)
    }
    const found = scanBreaking(text)
    if (found.length) changes.push({ file: `${tag}.sql`, found })
  }
  if (!changes.length) return 0

  for (const c of changes) error(`\n⚠ ${describeBreaking(c.file, c.found)}`)
  if (opts.allowDrop) { log('\n--allow-drop: keeping the migration.'); return 0 }
  if (opts.interactive && await opts.confirm('\nKeep the migration anyway?')) return 0

  removeMigrations(opts.migrationsDir, added, journalBefore)
  error(`\n✗ Removed ${added.map((t) => `${t}.sql`).join(', ')} (with its snapshot and journal entry); nothing was applied.`
    + (opts.interactive ? '' : ' There is no terminal to ask in.')
    + '\n  Change the schema in two steps, or run `tinyzoo generate --allow-drop` if losing this is what you want.')
  return 1
}

/** drizzle-kit with the terminal when there is one; otherwise output is read to spot its rename question. */
export function drizzleKitRunner(cwd: string, interactive: boolean): () => Promise<DrizzleKitResult> {
  return () => new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'drizzle-kit', 'generate'], { cwd, stdio: interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'] })
    let output = ''
    // Without a terminal drizzle-kit refuses to ask its rename question and says so (and
    // still exits 0): that, not the exit code, is how it is told apart from success. Its
    // output is held back until then, so the stack trace of that refusal is not shown.
    child.stdout?.on('data', (chunk: Buffer) => { output += chunk })
    child.stderr?.on('data', (chunk: Buffer) => { output += chunk })
    child.on('error', reject)
    child.on('exit', (code) => {
      const needsTerminal = /Interactive prompts require a TTY/i.test(output)
      if (!needsTerminal) process.stdout.write(output)
      resolve({ ok: code === 0 && !needsTerminal, needsTerminal })
    })
  })
}

export async function askYesNo(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return /^y(es)?$/i.test((await rl.question(`${question} [y/N] `)).trim())
  }
  finally {
    rl.close()
  }
}

/**
 * `tinyzoo status`: what the database in DATABASE_URL has applied and what is still to do.
 * Exit code 0: nothing pending. 1: something is pending or out of order (usable in CI and
 * deploy scripts). 2: the database could not be read.
 */
import { CORE_UPGRADE_STEPS, inspectMigrations, type MigrationStatus } from '../src/index'
import { databaseUrl, describeDatabase, diskSource, errorText, withDatabase } from './db'

/** The report as text, and whether everything is up to date. */
export function formatStatus(status: MigrationStatus): { text: string; clean: boolean } {
  const lines: string[] = []
  const pendingSteps = status.steps.filter((s) => s.state === 'pending')
  const appliedSteps = status.steps.filter((s) => s.state === 'applied')
  lines.push(`Migrations: ${status.applied.length} applied, ${status.pending.length} pending${status.freshInstall ? ' (empty database)' : ''}`)
  for (const tag of status.pending) lines.push(`  pending  ${tag}`)
  lines.push(`Upgrade steps: ${appliedSteps.length} applied, ${pendingSteps.length} pending`)
  for (const s of pendingSteps) lines.push(`  pending  ${s.id} (tinyzoo ${s.since}) — ${s.description}${status.freshInstall ? ' [recorded without running on an empty database]' : ''}`)
  if (status.outOfOrder.length) {
    lines.push('', 'Out of order — these migrations were never applied, yet a newer one was, so they would be skipped:')
    for (const tag of status.outOfOrder) lines.push(`  ✗ ${tag}.sql`)
    lines.push('  Usually two branches each generated a migration. Delete that migration file, its snapshot (meta/<number>_snapshot.json)',
      '  and its entry in meta/_journal.json, then run `tinyzoo generate` again on top of the newest one.')
  }
  if (status.unknown) lines.push('', `Note: the database has ${status.unknown} migration${status.unknown > 1 ? 's' : ''} this code does not know — a newer version of the site ran here.`)
  const clean = !status.pending.length && !pendingSteps.length && !status.outOfOrder.length
  lines.push('', clean ? '✓ up to date' : '✗ not up to date — run `tinyzoo up`, or start the app with NUXT_CMS_MIGRATIONS_ON_START=true')
  return { text: lines.join('\n'), clean }
}

/** Returns the process exit code. */
export async function status(cwd: string): Promise<number> {
  try {
    const url = databaseUrl(cwd)
    const source = diskSource(cwd)
    const result = await withDatabase(url, ({ run }) => inspectMigrations(source, run, CORE_UPGRADE_STEPS))
    const { text, clean } = formatStatus(result)
    console.log(`Database: ${describeDatabase(url)}\n${text}`)
    return clean ? 0 : 1
  }
  catch (err) {
    console.error(`✗ could not read the database: ${errorText(err)}`)
    return 2
  }
}

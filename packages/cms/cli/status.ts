/**
 * `tinyzoo status`: what the database in DATABASE_URL has applied and what is still to do.
 * Exit code 0: nothing pending. 1: something is pending or out of order (usable in CI and
 * deploy scripts). 2: the database could not be read.
 */
import { docsUrl } from '../src/docs'
import { inspectMigrations, ORDER_FIX, type MigrationStatus } from '../src/index'
import { databaseUrl, describeDatabase, diskSource, errorText, siteRoleNames, siteUpgradeSteps, withDatabase } from './db'

/** Whose step it is: tinyzoo's own, or the plugin named in front of the id. */
const stepOwner = (id: string) => (id.includes(':') ? id.slice(0, id.indexOf(':')) : 'tinyzoo')

/** The report as text, and whether everything is up to date. */
export function formatStatus(status: MigrationStatus): { text: string; clean: boolean } {
  const lines: string[] = []
  const pendingSteps = status.steps.filter((s) => s.state === 'pending')
  const appliedSteps = status.steps.filter((s) => s.state === 'applied')
  lines.push(`Migrations: ${status.applied.length} applied, ${status.pending.length} pending${status.freshInstall ? ' (empty database)' : ''}`)
  for (const tag of status.pending) lines.push(`  pending  ${tag}`)
  lines.push(`Upgrade steps: ${appliedSteps.length} applied, ${pendingSteps.length} pending`)
  for (const s of pendingSteps) lines.push(`  pending  ${s.id} (${stepOwner(s.id)} ${s.since}) — ${s.description}${status.freshInstall ? ' [recorded without running on an empty database]' : ''}`)
  if (status.outOfOrder.length) {
    lines.push('', 'Out of order — these migrations were never applied, yet a newer one was, so they would be skipped:')
    for (const tag of status.outOfOrder) lines.push(`  ✗ ${tag}.sql`)
    const files = status.outOfOrder.map((t) => `${t}.sql`).join(', ')
    lines.push(`  ${ORDER_FIX.regenerate(files)}`, `  ${ORDER_FIX.appliedElsewhere}`, `  More: ${docsUrl('neverApplied')}`)
  }
  if (status.unknown) lines.push('', `Note: the database has ${status.unknown} migration${status.unknown > 1 ? 's' : ''} this code does not know — a newer version of the site ran here.`)
  const clean = !status.pending.length && !pendingSteps.length && !status.outOfOrder.length
  lines.push('', clean ? '✓ up to date' : '✗ not up to date — run `tinyzoo up`, or start the app with NUXT_CMS_MIGRATIONS_ON_START=true')
  return { text: lines.join('\n'), clean }
}

/**
 * Accounts whose role the site no longer has: they sign in and see "your role no longer exists",
 * nothing else. Told in the report so it is not found out from a person who is locked out.
 * (A warning: it does not make the report "not up to date".)
 */
export function formatRoleWarning(held: { role: string; n: number }[], known: string[]): string[] {
  const gone = held.filter((h) => !known.includes(h.role))
  if (!gone.length) return []
  const people = gone.reduce((sum, h) => sum + Number(h.n), 0)
  return [
    '',
    `! ${people} account${people === 1 ? ' has' : 's have'} a role this site no longer defines, so ${people === 1 ? 'it has' : 'they have'} no access:`,
    ...gone.map((h) => `    ${h.role}: ${h.n}`),
    '  Give them another role in Settings → Team, or define the role again in cms.config.ts (defineRoles).',
  ]
}

/** Returns the process exit code. */
export async function status(cwd: string): Promise<number> {
  try {
    const url = databaseUrl(cwd)
    const source = diskSource(cwd)
    const steps = await siteUpgradeSteps(cwd)
    const known = await siteRoleNames(cwd)
    const { result, held } = await withDatabase(url, async ({ run }) => ({
      result: await inspectMigrations(source, run, steps),
      // No table yet (an empty database) or none in use (external sign-in): nobody to warn about.
      held: await run('select role, count(*)::int as n from cms_users group by role order by role').catch(() => []) as { role: string; n: number }[],
    }))
    const { text, clean } = formatStatus(result)
    console.log(`Database: ${describeDatabase(url)}\n${[text, ...formatRoleWarning(held, known)].join('\n')}`)
    return clean ? 0 : 1
  }
  catch (err) {
    console.error(`✗ could not read the database: ${errorText(err)}`)
    return 2
  }
}

/**
 * `tinyzoo up`: apply the site's migrations and tinyzoo's upgrade steps to the database in
 * DATABASE_URL — the same runner (and the same bookkeeping) as the app's start-up
 * migrations, so either can take over from the other.
 */
import { MigrationOrderError, runUpgrade } from '../src/index'
import { databaseUrl, describeDatabase, diskSource, errorText, siteUpgradeSteps, withDatabase } from './db'

/** Returns the process exit code. */
export async function up(cwd: string): Promise<number> {
  try {
    const url = databaseUrl(cwd)
    const source = diskSource(cwd)
    const steps = await siteUpgradeSteps(cwd)
    const result = await withDatabase(url, ({ transaction }) => runUpgrade(source, transaction, steps))
    const ran = result.steps.filter((s) => s.ran).map((s) => s.id)
    if (ran.length) console.log(`✓ ran upgrade steps: ${ran.join(', ')}`)
    console.log(result.migrations.length
      ? `✓ applied migrations on ${describeDatabase(url)}: ${result.migrations.join(', ')}`
      : `✓ ${describeDatabase(url)} is up to date`)
    return 0
  }
  catch (err) {
    console.error(err instanceof MigrationOrderError ? `✗ ${err.message}` : `✗ ${errorText(err)}`)
    return 1
  }
}

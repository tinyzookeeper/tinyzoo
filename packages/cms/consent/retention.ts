import { sql } from 'drizzle-orm'
import type { CmsRetentionContext } from '../src/plugin'
import type { ResolvedConsentOptions } from './options'
import { consentLog } from './tables'

/**
 * The nightly part: records of the consent log older than `keepLogDays` are deleted. It runs
 * in tinyzoo's daily retention task (`cms:retention`), in its transaction and under its lock.
 * Explicit imports only (the CLI loads this file too).
 */
export function consentRetention(opts: Pick<ResolvedConsentOptions, 'keepLogDays'>) {
  return async ({ tx, batch }: CmsRetentionContext): Promise<Record<string, number>> => {
    const cutoff = sql`now() - make_interval(days => ${opts.keepLogDays})`
    let deleted = 0
    for (;;) {
      const res: any = await tx.execute(sql`delete from ${consentLog} where ${consentLog.id} in (select ${consentLog.id} from ${consentLog} where ${consentLog.at} < ${cutoff} limit ${batch * 4})`)
      const n = Number(res?.rowCount ?? 0)
      deleted += n
      if (n < batch * 4) break
    }
    return deleted ? { records: deleted } : {}
  }
}

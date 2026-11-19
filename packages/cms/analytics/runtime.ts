import { validTimeZone } from './core/visitor'
import type { ResolvedAnalyticsOptions } from './options'

/**
 * What the server learns when it starts, for the code that runs outside a request (the nightly
 * job). Explicit imports only: the site's config, and so this file, is also loaded by the CLI.
 */
let adminTimeZone: string | null = null

/** The admin's time zone (`cms.admin.timeZone`), set by the plugin's Nitro plugin at start. */
export function setAdminTimeZone(tz: unknown): void {
  adminTimeZone = validTimeZone(tz) ? tz : null
}

/** The time zone days are counted in: the plugin's option, else the admin's, else Europe/Prague. */
export function timeZoneOf(opts: Pick<ResolvedAnalyticsOptions, 'timeZone'> | null | undefined): string {
  return opts?.timeZone ?? adminTimeZone ?? 'Europe/Prague'
}

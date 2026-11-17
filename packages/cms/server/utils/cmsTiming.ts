/**
 * Timer intervals the test build shortens. The defaults are the production values;
 * a deploy has no reason to set these, and a value that is not a plain number of
 * milliseconds (at least 50) is ignored. Read when the timer starts, not at build time,
 * so one build serves both: the API suites start the same server with a short
 * heartbeat (CMS_TEST_LIVE_HEARTBEAT_MS, CMS_TEST_COLLAB_HEARTBEAT_MS) and webhook
 * retries (CMS_TEST_WEBHOOK_RETRY_MS) and wait for seconds instead of half a minute.
 */
export function cmsTimerMs(envName: string, defaultMs: number): number {
  const raw = typeof process !== 'undefined' ? process.env?.[envName] : undefined
  if (!raw || !/^\d+$/.test(raw.trim())) return defaultMs
  const ms = Number(raw)
  return ms >= 50 ? ms : defaultMs
}

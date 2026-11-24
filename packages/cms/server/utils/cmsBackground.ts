import { cmsProcessWide, forEachCmsSite } from './cmsSite'
import { cmsTimerMs } from './cmsTiming'

// Scheduled work in multi-tenant mode (one process, many sites) must not open every site's
// database on every tick. The tasks ask each site "is there a reason to look now?" (a cheap
// check in memory) and only then run their body there. What each task remembers is its own
// (cmsScheduler.ts, cmsImageSizes.ts); what they share is here: the slow rotation that looks
// at every site now and then regardless (another instance may have restarted holding the
// knowledge of something due), and the loop over the sites.

/** How often every site is looked at at least, whatever the memory says. Production: 15 minutes. */
const SWEEP_MS = 15 * 60_000

/** The sweep interval; a test shortens it (CMS_TEST_SWEEP_MS, at least 50). */
export function cmsSweepMs(): number {
  return cmsTimerMs('CMS_TEST_SWEEP_MS', SWEEP_MS)
}

/** A small number from a site id (FNV-1a): where in the sweep interval the site's turn falls. */
function slotOf(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  return h >>> 0
}

/**
 * Is the site's turn in the sweep due: has its slot come round since it was last looked at?
 * Each site has a slot of its own inside the interval (from its id), so thousands of sites are
 * swept on different ticks, not all on the one that is 15 minutes after the start. A site
 * never looked at (`lastLookAt` 0) is due.
 */
export function cmsSweepDue(siteId: string, lastLookAt: number, now = Date.now()): boolean {
  if (!lastLookAt) return true
  const every = cmsSweepMs()
  const phase = slotOf(siteId) % every
  return Math.floor((now - phase) / every) > Math.floor((lastLookAt - phase) / every)
}

export interface DueRun {
  /** Sites the work ran in. */
  looked: number
  /** Sites with no reason to look now. */
  skipped: number
  /** Sites where the work failed (logged with the site's id; the others went on). */
  failed: number
}

/**
 * Run `run` in every site that is not paused, a few at a time, where `due()` (asked inside the
 * site) says there is a reason. The sites, the failure isolation and the log line for a failure
 * are `forEachCmsSite`'s: paused and read-only sites are left alone, one site's failure does not
 * stop the rest.
 */
export async function runInDueSites(what: string, due: () => boolean, run: () => Promise<unknown>, concurrency = 5): Promise<DueRun> {
  let looked = 0
  let skipped = 0
  const failed = await forEachCmsSite(async () => {
    if (!due()) { skipped++; return }
    looked++
    await run()
  }, { concurrency, what })
  return { looked, skipped, failed: failed.length }
}

/** Retention runs over all sites once a day; a run that is still going when the next one starts must not be joined by it. */
export const retentionRound = cmsProcessWide({ running: false }, 'one retention round at a time in this process, whatever the sites')

// Restarts without a deploy and memory near the limit, from what a site's status says
// (tinyzoo 1.10+: `instance.memory`; every tinyzoo: `instance.startedAt`). Pure functions: the
// monitor (server/utils/monitor.ts) and the summaries call them, the unit tests too.
//
// Keeper cannot tell why an instance started again: a crash, the host killing it for using more
// memory than it may, or the host moving it to another machine. It says "restarted without a
// deploy", and adds what the memory was the last time it looked when that was close to the limit.
import type { CmsStatusMemory } from './types/status'

/** Memory this share of the limit or more is "high" (lists, the fleet summary). */
export const MEMORY_HIGH = 0.8
/** A peak this share of the limit or more before a restart: memory is the likely cause. */
export const MEMORY_NEAR_LIMIT = 0.9

const MB = 1024 * 1024

/**
 * Did the site's instance start again without a deploy? Only when the status names an instance
 * that started after the previous status was read (`previous.at`): a site with several replicas
 * answers from one or another, and one that was already running is no restart. And only when the
 * site serves the same build it served at the previous status: a new build is a deploy, its new
 * instance is expected, and a build Keeper could not read (or had not recorded yet) may hide one.
 */
export function restartedWithoutDeploy(
  previous: { startedAt?: string | null; build?: string | null; at?: Date | string | null },
  current: { startedAt?: string | null; build?: string | null },
): boolean {
  if (!previous.startedAt || !current.startedAt || previous.startedAt === current.startedAt) return false
  if (!previous.build || !current.build || previous.build !== current.build) return false
  const started = new Date(current.startedAt).getTime()
  if (!(started > new Date(previous.startedAt).getTime())) return false
  return !previous.at || started > new Date(previous.at).getTime()
}

/** The memory of a site as Keeper shows it: in bytes, and the share of the limit (the larger of now and the peak), null without a limit. */
export interface MemoryGlance {
  rss: number
  limit: number | null
  peak: number | null
  /** 0–100, rounded; null when the container has no limit (or it cannot be read). */
  percent: number | null
}

export function memoryGlance(memory: CmsStatusMemory | null | undefined): MemoryGlance | null {
  if (!memory || typeof memory.rss !== 'number') return null
  const limit = memory.limit && memory.limit > 0 ? memory.limit : null
  const used = Math.max(memory.rss, memory.peak ?? 0)
  return { rss: memory.rss, limit, peak: memory.peak ?? null, percent: limit ? Math.round((used / limit) * 100) : null }
}

/** Memory at or above `MEMORY_HIGH` of the limit. */
export const memoryHigh = (m: MemoryGlance | null | undefined) => !!m?.percent && m.percent >= MEMORY_HIGH * 100

/** Bytes as whole megabytes (MiB, as hosts state limits: 256 MB is 256 MiB). */
export const megabytes = (bytes: number) => Math.round(bytes / MB)

/**
 * "memory was at 243 of 256 MB" when the peak before a restart was at least `MEMORY_NEAR_LIMIT`
 * of the limit; null otherwise (nothing points at memory).
 */
export function memoryHint(peak: number | null | undefined, limit: number | null | undefined): string | null {
  if (!peak || !limit || peak < limit * MEMORY_NEAR_LIMIT) return null
  return `memory was at ${megabytes(peak)} of ${megabytes(limit)} MB`
}

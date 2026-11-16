/**
 * State shared by every instance of the app: rate-limit counters and pub/sub
 * messages (realtime, cache invalidation). See utils/cmsStore.ts.
 */
export interface SharedStore {
  kind: 'redis' | 'memory'
  /** Count one hit for `key` in the current window; returns the hits so far in it. */
  hit: (key: string, windowMs: number) => Promise<number>
  /** Take back the last hit of `key` (a sign-in that worked is not a failed attempt). */
  unhit: (key: string, windowMs: number) => Promise<void>
  publish: (channel: string, message: string) => Promise<void>
  /** Subscribe to a channel; returns an unsubscribe function. */
  subscribe: (channel: string, handler: (message: string) => void) => Promise<() => Promise<void>>
  /** Close connections (server shutdown). */
  close?: () => Promise<void>
}
export interface CmsStoreConfig {
  redisUrl: string
  /** Namespace for keys and channels, so environments sharing one Redis stay apart. */
  prefix?: string
}

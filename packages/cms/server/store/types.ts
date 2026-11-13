/**
 * State shared by every instance of the app: rate-limit counters and pub/sub
 * messages (realtime, cache invalidation). See utils/cmsStore.ts.
 */
export interface SharedStore {
  kind: 'redis' | 'memory'
  /** Count one hit for `key` in the current window; returns the hits so far in it. */
  hit: (key: string, windowMs: number) => Promise<number>
  publish: (channel: string, message: string) => Promise<void>
  /** Subscribe to a channel; returns an unsubscribe function. */
  subscribe: (channel: string, handler: (message: string) => void) => Promise<() => Promise<void>>
}
export interface CmsStoreConfig { redisUrl: string }

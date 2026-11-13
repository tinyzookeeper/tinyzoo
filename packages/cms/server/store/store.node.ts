import type { CmsStoreConfig, SharedStore } from './types'

// Node shared store: Redis (ioredis) when a URL is configured, else nothing (the
// caller falls back to per-process memory). Aliased as #cms/store only in Node builds.
export async function createRedisStore(cfg: CmsStoreConfig): Promise<SharedStore | null> {
  if (!cfg.redisUrl) return null
  const { default: Redis } = await import('ioredis')
  const client = new Redis(cfg.redisUrl, { maxRetriesPerRequest: 2, enableOfflineQueue: true, lazyConnect: false })
  client.on('error', (err) => console.error('[cms] redis', err.message))
  let subscriber: InstanceType<typeof Redis> | undefined
  const handlers = new Map<string, Set<(message: string) => void>>()

  return {
    kind: 'redis',
    async hit(key, windowMs) {
      // Fixed window: one counter per key and window, expiring with the window.
      const bucket = `cms:rl:${key}:${Math.floor(Date.now() / windowMs)}`
      const [[, count]] = (await client.multi().incr(bucket).pexpire(bucket, windowMs).exec()) as [[unknown, number]]
      return Number(count)
    },
    async publish(channel, message) {
      await client.publish(`cms:${channel}`, message)
    },
    async subscribe(channel, handler) {
      if (!subscriber) {
        subscriber = client.duplicate()
        subscriber.on('message', (ch: string, msg: string) => {
          for (const h of handlers.get(ch) ?? []) h(msg)
        })
      }
      const ch = `cms:${channel}`
      if (!handlers.has(ch)) {
        handlers.set(ch, new Set())
        await subscriber.subscribe(ch)
      }
      handlers.get(ch)!.add(handler)
      return async () => {
        handlers.get(ch)?.delete(handler)
        if (!handlers.get(ch)?.size) {
          handlers.delete(ch)
          await subscriber?.unsubscribe(ch)
        }
      }
    },
  }
}

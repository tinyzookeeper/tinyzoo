import type { CmsStoreConfig, SharedStore } from './types'

// Node shared store: Redis (ioredis) when a URL is configured, else nothing (the
// caller falls back to per-process memory). Aliased as #cms/store only in Node builds.
//
// Commands never wait on a Redis that is down: no offline queue, a short timeout,
// and the caller falls back (rate limits count in memory, publishes are dropped).
// The subscriber connection is the opposite — it waits and re-subscribes after
// every reconnect, so an instance that booted before Redis was up still hears the
// other replicas once it is.
export async function createRedisStore(cfg: CmsStoreConfig): Promise<SharedStore | null> {
  if (!cfg.redisUrl) return null
  const { default: Redis } = await import('ioredis')
  const prefix = cfg.prefix || 'cms'
  const client = new Redis(cfg.redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    commandTimeout: 500,
    connectTimeout: 2_000,
  })
  client.on('error', (err) => console.error('[cms] redis', err.message))
  // Give the first connection a moment, so the first commands do not fall back for
  // nothing; a Redis that is down does not hold up the start for longer.
  if (client.status !== 'ready') {
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer)
        client.off('ready', done)
        resolve()
      }
      const timer = setTimeout(done, 2_000)
      client.once('ready', done)
    })
  }
  let subscriber: InstanceType<typeof Redis> | undefined
  const handlers = new Map<string, Set<(message: string) => void>>()

  return {
    kind: 'redis',
    async hit(key, windowMs) {
      // Fixed window: one counter per key and window, expiring with the window. Keys
      // are hashed: they hold emails and IPs.
      const bucket = `${prefix}:rl:${await sha256Hex(key)}:${Math.floor(Date.now() / windowMs)}`
      const res = await client.multi().incr(bucket).pexpire(bucket, windowMs).exec()
      const [err, count] = res?.[0] ?? [new Error('empty transaction result'), null]
      if (err || typeof count !== 'number') throw err ?? new Error('rate limit counter missing')
      return count
    },
    async publish(channel, message) {
      await client.publish(`${prefix}:${channel}`, message)
    },
    async subscribe(channel, handler) {
      if (!subscriber) {
        subscriber = new Redis(cfg.redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: true, connectTimeout: 2_000 })
        subscriber.on('error', (err) => console.error('[cms] redis subscriber', err.message))
        subscriber.on('message', (ch: string, msg: string) => {
          for (const h of handlers.get(ch) ?? []) h(msg)
        })
      }
      const ch = `${prefix}:${channel}`
      if (!handlers.has(ch)) {
        handlers.set(ch, new Set())
        try {
          await subscriber.subscribe(ch)
        }
        catch (err) {
          handlers.delete(ch)
          throw err
        }
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
    async close() {
      await Promise.allSettled([client.quit(), subscriber?.quit()])
    },
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

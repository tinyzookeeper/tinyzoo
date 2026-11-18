import { createRedisStore } from '../store/redis'

import type { SharedStore } from '../store/types'

/**
 * State shared by every instance: Redis when `cms.redis.url` or REDIS_URL is set
 * (Pushbase injects REDIS_URL for a linked Redis service); otherwise this process's
 * memory — correct for one instance only.
 */
export type { SharedStore } from '../store/types'

function memoryStore(): SharedStore {
  const handlers = new Map<string, Set<(message: string) => void>>()
  return {
    kind: 'memory',
    async hit(key, windowMs) {
      // Sliding window in this process (see cmsRateLimit).
      return rateLimitCount(key, windowMs)
    },
    async unhit(key, windowMs) {
      rateLimitRefundMemory(key, windowMs)
    },
    async publish(channel, message) {
      for (const h of handlers.get(channel) ?? []) h(message)
    },
    async subscribe(channel, handler) {
      if (!handlers.has(channel)) handlers.set(channel, new Set())
      handlers.get(channel)!.add(handler)
      return async () => { handlers.get(channel)?.delete(handler) }
    },
  }
}

let store: Promise<SharedStore> | undefined

export function useCmsStore(): Promise<SharedStore> {
  store ??= (async () => {
    const cfg = (useRuntimeConfig().cms as any)?.redis ?? {}
    const env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
    const redisUrl = String(cfg.url || env.REDIS_URL || '')
    try {
      const redis = await createRedisStore({ redisUrl, prefix: cmsStorePrefix(cfg.prefix) })
      if (redis) {
        console.info('[cms] shared store: redis')
        return redis
      }
    }
    catch (err) {
      console.error('[cms] redis unavailable, falling back to memory', err)
    }
    return memoryStore()
  })()
  return store
}

/**
 * Keys and channels are namespaced so that environments sharing one Redis (staging
 * and production, two client sites) never share counters or messages:
 * `cms.redis.prefix` / NUXT_CMS_REDIS_PREFIX, else `cms:<database name>`.
 */
export function cmsStorePrefix(configured: string = (useRuntimeConfig().cms as any)?.redis?.prefix): string {
  if (configured) return String(configured)
  try {
    const env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
    const url = env.NUXT_CMS_DATABASE_URL || env.DATABASE_URL
    const name = url ? decodeURIComponent(new URL(url).pathname.slice(1)) : ''
    return name ? `cms:${name}` : 'cms'
  }
  catch {
    return 'cms'
  }
}

/** Close the store's connections (server shutdown). */
export async function closeCmsStore(): Promise<void> {
  if (!store) return
  const s = await store.catch(() => null)
  store = undefined
  await s?.close?.()
}

/**
 * Rate limit: true if this action is allowed (and counts it). Shared across instances
 * when Redis is configured. `max <= 0` means unlimited. When Redis cannot answer, this
 * instance counts on its own instead — an outage must neither lock everyone out nor
 * switch brute-force protection off.
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  if (max <= 0) return true
  try {
    const s = await useCmsStore()
    if (s.kind === 'memory') return rateLimitOk(key, max, windowMs)
    return (await s.hit(key.slice(0, 200), windowMs)) <= max
  }
  catch (err) {
    console.error('[cms] rate limit store error, counting locally:', (err as Error)?.message ?? err)
    return rateLimitOk(key, max, windowMs)
  }
}

/** Take back the hit `rateLimit` just counted for `key` (a sign-in that worked is not an attempt to guess). */
export async function rateLimitRefund(key: string, windowMs: number): Promise<void> {
  try {
    await (await useCmsStore()).unhit(key.slice(0, 200), windowMs)
  }
  catch {
    // The count only stays one higher for the rest of the window.
  }
}

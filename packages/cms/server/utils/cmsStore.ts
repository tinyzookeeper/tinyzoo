// #cms/store is aliased by the module to the node (Redis) or edge implementation.
import { createRedisStore } from '#cms/store'

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
    const redisUrl = String((useRuntimeConfig().cms as any)?.redis?.url || process.env.REDIS_URL || '')
    try {
      const redis = await createRedisStore({ redisUrl })
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
 * Rate limit: true if this action is allowed (and counts it). Shared across instances
 * when Redis is configured. `max <= 0` means unlimited. Fails open with a log line if
 * the store errors — an outage must not lock everyone out of signing in.
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  if (max <= 0) return true
  try {
    const s = await useCmsStore()
    if (s.kind === 'memory') return rateLimitOk(key, max, windowMs)
    return (await s.hit(key.slice(0, 200), windowMs)) <= max
  }
  catch (err) {
    console.error('[cms] rate limit store error', err)
    return true
  }
}

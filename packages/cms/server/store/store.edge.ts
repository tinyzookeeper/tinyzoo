import type { CmsStoreConfig, SharedStore } from './types'

// Edge (Workers): no TCP Redis client here. State stays per isolate until a
// Durable Object / KV-backed store is added; the caller falls back to memory.
export async function createRedisStore(_cfg: CmsStoreConfig): Promise<SharedStore | null> {
  return null
}

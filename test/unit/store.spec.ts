import { afterAll, describe, expect, it } from 'vitest'
import { createRedisStore } from '../../packages/cms/server/store/redis'

// Runs against a real Redis when TEST_REDIS_URL is set (CI; locally:
// `docker compose --profile redis up -d` and TEST_REDIS_URL=redis://localhost:6383).
const url = process.env.TEST_REDIS_URL
const stores: any[] = []
afterAll(async () => { for (const s of stores) await s?.close?.() })

describe.skipIf(!url)('redis shared store', () => {
  it('counts hits per key and window, shared by every client', async () => {
    const a = await createRedisStore({ redisUrl: url! })
    const b = await createRedisStore({ redisUrl: url! })
    const key = `test:${Math.random()}`
    expect(await a!.hit(key, 60_000)).toBe(1)
    expect(await b!.hit(key, 60_000)).toBe(2) // another instance sees the same counter
    expect(await a!.hit(`${key}:other`, 60_000)).toBe(1)
  })

  it('delivers published messages to subscribers on other instances', async () => {
    const a = await createRedisStore({ redisUrl: url! })
    const b = await createRedisStore({ redisUrl: url! })
    const got: string[] = []
    const off = await b!.subscribe('test-channel', (m) => got.push(m))
    await new Promise((r) => setTimeout(r, 100))
    await a!.publish('test-channel', 'hello')
    await new Promise((r) => setTimeout(r, 200))
    expect(got).toEqual(['hello'])
    await off()
  })
})

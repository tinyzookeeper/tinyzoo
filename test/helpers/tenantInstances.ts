import Redis from 'ioredis'
import type { SpawnedServer } from './server'
import { startTenants, type Tenants, type TenantSite, type TenantsOptions } from './tenants'

/**
 * Two INSTANCES of one app in multi-tenant mode, for test/api/tenants-instances.spec.ts:
 * two server processes of the built playground on the same site directory (sites A and B,
 * the same two databases), sharing their state through Redis under a prefix of this run's
 * own. That is how a platform runs two replicas of one template's app.
 *
 * A site is reached on either instance by its own host name and that instance's port:
 * http://site-a.localhost:<port of one> and http://site-a.localhost:<port of two>. The
 * directory's hosts carry no port, so both are site A; the `publicUrl` of the rows names
 * instance one (links in e-mails and the sitemap say that address on both). A session is a
 * site's, not an instance's: the cookies signed in on instance one are valid on instance two.
 *
 * Needs a Redis (TEST_REDIS_URL): without one the two processes share nothing, and the spec
 * skips itself.
 */
export interface TenantInstance {
  server: SpawnedServer
  port: number
  /** Site A and site B as reached on this instance (the same sessions, databases and folders on both). */
  a: TenantSite
  b: TenantSite
  /** This instance reached by IP (no site): the process's own health checks. */
  ipUrl: string
}

export interface TenantInstances {
  /** The two-site set-up (the tenants helper's): its `server` is instance one. */
  t: Tenants
  one: TenantInstance
  two: TenantInstance
  redis: { url: string; prefix: string }
  /** A connection to that Redis, for looking at keys and channels. Closed by `stop()`. */
  redisClient(): Redis
  /** The log of both servers, one text. */
  logs(): string
  stop(): Promise<void>
}

export async function startTenantInstances(suffix: string, env: Record<string, string> = {}, options: TenantsOptions = {}): Promise<TenantInstances> {
  const url = env.NUXT_CMS_REDIS_URL ?? process.env.TEST_REDIS_URL
  if (!url) throw new Error('two instances share their state through Redis: set TEST_REDIS_URL')
  const t = await startTenants(suffix, { NUXT_CMS_REDIS_URL: url, ...env }, options)
  let second: { server: SpawnedServer; port: number }
  try {
    second = await t.startInstance()
    const server = second.server
    await server.waitForLog(/\[cms\] shared store: redis/, 15_000).catch(() => {
      throw new Error(`the second server did not connect to Redis at ${url}:\n${server.logs.join('')}`)
    })
  }
  catch (err) {
    await t.stop()
    throw err
  }
  const on = (site: TenantSite, port: number): TenantSite => ({ ...site, url: `http://${site.host}:${port}` })
  const clients: Redis[] = []
  return {
    t,
    one: { server: t.server, port: t.port, a: t.a, b: t.b, ipUrl: t.ipUrl },
    two: { server: second.server, port: second.port, a: on(t.a, second.port), b: on(t.b, second.port), ipUrl: `http://127.0.0.1:${second.port}` },
    redis: t.redis!,
    redisClient() {
      const r = new Redis(url)
      r.on('error', () => {})
      clients.push(r)
      return r
    },
    logs: () => t.server.logs.join('') + second.server.logs.join(''),
    async stop() {
      for (const r of clients) r.disconnect()
      await t.stop()
    },
  }
}

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { expectNoSiteErrors, siteClient, startTenants, type Tenants } from '../helpers/tenants'

// The connections of all sites of one process stay under one cap (cmsDb.ts,
// NUXT_CMS_TENANCY_MAX_CONNECTIONS). Each site's pool may hold three; two sites used at the
// same moment would reach six. With a cap of three they never do, and nothing fails: the
// pool of the site that is quiet gives its connections up for the one that needs them.
const CAP = 3
let t: Tenants
beforeAll(async () => { t = await startTenants('conn', { NUXT_CMS_TENANCY_MAX_CONNECTIONS: String(CAP) }) }, 120_000)
afterAll(async () => { expectNoSiteErrors(t); await t?.stop() })

/** How many connections the two sites' database users hold right now. */
async function sample(admin: pg.Client): Promise<number> {
  const { rows } = await admin.query('select count(*)::int n from pg_stat_activity where usename = any($1)', [[t.a.role, t.b.role]])
  return rows[0].n
}

describe('one cap on the database connections of every site of the process', () => {
  it('two sites under load at the same moment never hold more than the cap, and every request is served', async () => {
    const admin = new pg.Client({ connectionString: t.adminUrl })
    await admin.connect()
    let most = 0
    let watching = true
    const watch = (async () => { while (watching) { most = Math.max(most, await sample(admin)); await new Promise((r) => setTimeout(r, 15)) } })()
    try {
      const a = siteClient(t.a, 'admin')
      const b = siteClient(t.b, 'admin')
      const statuses: number[] = []
      // Reads and writes on both sites at once, several rounds, so both pools want all they may have.
      for (let round = 0; round < 6; round++) {
        const work = [a, b].flatMap((client, i) => [
          client.get('/api/cms/tag'), client.get('/api/cms/_users'), client.get('/api/content/tag'),
          client.post('/api/cms/tag', { name: `Cap ${round} ${i}`, slug: `cap-${round}-${i}` }),
          client.get('/api/cms/_graph'), client.get('/api/content/post'),
        ])
        statuses.push(...(await Promise.all(work)).map((r) => r.status))
      }
      expect(statuses.filter((s) => s >= 400)).toEqual([])
      expect(statuses).toHaveLength(72)
    }
    finally {
      watching = false
      await watch
      await admin.end()
    }
    expect(most).toBeGreaterThan(0)
    // Counted on the Postgres side, where a connection the app has closed is still listed for a
    // moment: one or two over the cap may show. Without the cap the two sites would hold six.
    expect(most).toBeLessThanOrEqual(CAP + 2)
  })

  it('a site that was made to give its connections up works again at once', async () => {
    const a = siteClient(t.a, 'admin')
    const b = siteClient(t.b, 'admin')
    for (let i = 0; i < 5; i++) {
      expect((await a.get('/api/cms/tag')).status).toBe(200)
      expect((await b.get('/api/cms/tag')).status).toBe(200)
    }
    const onA = JSON.stringify((await a.get('/api/content/tag')).body)
    const onB = JSON.stringify((await b.get('/api/content/tag')).body)
    expect(onA).toContain('cap-0-0')
    expect(onA).not.toContain('cap-0-1')
    expect(onB).toContain('cap-0-1')
    expect(onB).not.toContain('cap-0-0')
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { playgroundDir } from '../setup/database'
import { testDb } from '../helpers/api'

const db = testDb()
afterAll(() => db.end())

// The suite migrates its database with drizzle's own migrator (the "old" runner: no
// cms_upgrades table), then starts the server with NUXT_CMS_MIGRATIONS_ON_START=true.
describe('upgrade bookkeeping at start', () => {
  it('picks up the upgrade bookkeeping on the first start after a plain drizzle migration, without migrating twice', async () => {
    const { rows: [t] } = await db.query(`select to_regclass('cms_upgrades') is not null as exists`)
    expect(t.exists).toBe(true)
    const journal = JSON.parse(readFileSync(join(playgroundDir, 'server/db/migrations/meta/_journal.json'), 'utf8'))
    const { rows } = await db.query('select count(*)::int as n from drizzle.__drizzle_migrations')
    expect(rows[0].n).toBe(journal.entries.length)
  })

  it('has the columns the runner and `tinyzoo status` rely on', async () => {
    const { rows } = await db.query(`select column_name from information_schema.columns where table_name = 'cms_upgrades' order by column_name`)
    expect(rows.map((r) => r.column_name)).toEqual(['applied_at', 'id', 'since'])
  })
})

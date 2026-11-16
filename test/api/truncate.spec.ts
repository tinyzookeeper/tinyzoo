import pg from 'pg'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { testDb, truncateAll } from '../helpers/api'

// The helper that empties the tables between specs must not deadlock with the server's
// background tasks. The test server runs retention every 3 s (test/setup/server.ts); its
// transaction holds the advisory lock and the forms' table (it deletes old submissions),
// then reaches for the audit log. TRUNCATE locks tables one at a time, in the order it is
// given them: with the audit log first it holds it and waits for the forms' table, the task
// holds the forms' table and waits for the audit log. Postgres ends one of them with
// `deadlock detected`, which showed up now and then in whichever spec truncated at that
// moment (crud, changes, … — the server's Postgres log has each one, the retention query
// against a TRUNCATE).
//
// The window is a few milliseconds every 3 s, so these tests play the task's part
// themselves, with a pause between its two steps.

const db = testDb()
afterAll(() => db.end())

const RETENTION_LOCK = 72_011_040

/** What the retention task's transaction does, step by step. */
async function retentionTask() {
  const tx = await db.connect()
  await tx.query('begin')
  await tx.query('select pg_advisory_xact_lock($1)', [RETENTION_LOCK])
  await tx.query('lock table "contact_form" in row exclusive mode') // the forms plugin's delete
  return {
    // …and then the audit log, which is the other half of the cycle.
    async finish() {
      try {
        await tx.query('select "id" from "cms_audit" limit 1')
        await tx.query('commit')
        return null
      }
      catch (err) { return err as { code?: string } }
      finally { tx.release() }
    },
  }
}

const settle = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('truncateAll next to a running background task', () => {
  it('the plain TRUNCATE, audit log first, deadlocks with the task: the reason for the fix', async () => {
    const task = await retentionTask()
    const plain = db.query('truncate "cms_audit", "contact_form" restart identity cascade').then(() => null, (err) => err as { code?: string })
    await settle(200) // the truncate holds the audit log now and waits for the forms' table
    const [truncated, ended] = await Promise.all([plain, task.finish()])
    // Postgres ends one of the two after deadlock_timeout (1 s).
    expect([truncated?.code, ended?.code]).toContain('40P01')
  })

  it('waits for the task to finish, then truncates: no deadlock, nothing lost half-way', async () => {
    const task = await retentionTask()
    let done = false
    const truncating = truncateAll(db).then(() => { done = true })
    await settle(300)
    expect(done).toBe(false) // it waits for the task's advisory lock
    expect(await task.finish()).toBeNull() // the task reached the audit log and committed
    await truncating
    expect(done).toBe(true)
  })

  it('leaves the task its round when it starts meanwhile: the task only tries for the lock', async () => {
    const holder = await db.connect()
    await holder.query('begin')
    await holder.query('select pg_advisory_xact_lock($1)', [RETENTION_LOCK])
    const truncating = truncateAll(db) // blocked on the lock the holder has
    await settle(100)
    // A task starting now (the server's own retention does exactly this) finds the lock taken and skips, never waits.
    const other = new pg.Client({ connectionString: inject('databaseUrl') }) // (the pool's two connections are taken)
    await other.connect()
    try {
      const { rows } = await other.query('select pg_try_advisory_xact_lock($1) as locked', [RETENTION_LOCK])
      expect(rows[0].locked).toBe(false)
    }
    finally { await other.end() }
    await holder.query('commit')
    holder.release()
    await truncating
  })
})

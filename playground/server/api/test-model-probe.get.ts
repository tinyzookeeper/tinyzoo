import { sql } from 'tinyzoo'

// A test's look at the model one request works with (test/api/single-custom.spec.ts): the site's
// own types when the request starts, then again after a pause the test controls (it holds a
// Postgres advisory lock; the request waits for it). A request must see one model from its start
// to its end, whatever changes meanwhile. Active only when CMS_TEST_MODEL_PROBE=1: a 404 otherwise.
export default defineEventHandler(async (event) => {
  if (process.env.CMS_TEST_MODEL_PROBE !== '1') throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const own = () => useCms().reg.entities.map((e) => e.name).filter((name) => name.startsWith('custom_')).sort()
  const before = own()
  const lock = Number(getQuery(event).lock)
  if (Number.isInteger(lock) && lock > 0) {
    await useCms().db.transaction(async (tx: any) => { await tx.execute(sql`select pg_advisory_xact_lock(${lock})`) })
  }
  return { before, after: own() }
})

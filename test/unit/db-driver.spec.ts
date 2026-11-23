import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The multi-tenant database driver (packages/cms/server/db/driver.ts) and the cap on the
// connections of all sites (cmsDb.ts): every connection is asked for through `beforeConnect`,
// which answers with room for it and is told `taken()` when the pool's own counts show it.
//
// The real node-postgres pool, with clients that connect to nothing: what is tested is the
// moment the room is given back, against what the pool does when (pg-pool hands out an idle
// connection, and opens one for a caller queued behind it, a tick AFTER `connect` returned).
const clients: FakeClient[] = []

class FakeClient extends EventEmitter {
  closed = false
  /** What the pool looks at before it keeps a released client. */
  _queryable = true
  _ending = false
  constructor() { super(); clients.push(this) }
  connect(cb: (err?: Error) => void) { setImmediate(() => cb()) }
  /** Closing takes a moment, as a socket's does. */
  end(cb?: () => void) { setTimeout(() => { this.closed = true; this.emit('end'); cb?.() }, 20) }
  query() { return Promise.resolve({ rows: [] }) }
}

vi.mock('pg', async (importOriginal) => {
  const real = await importOriginal<any>()
  const RealPool = real.Pool ?? real.default.Pool
  class Pool extends RealPool { constructor(options: any) { super({ ...options, Client: FakeClient }) } }
  return { ...real, Pool, default: { ...(real.default ?? real), Pool } }
})

/** The cap's two answers, as cmsDb.ts gives them: an idle connection nobody was promised, or room for a new one. */
function capModel() {
  const state = { granted: 0, reserved: 0, grants: 0, reservations: 0 }
  const room = async (pool: any) => {
    if (pool.idleCount > state.granted) {
      state.granted++; state.grants++
      return { pool, taken: () => { state.granted-- } }
    }
    state.reserved++; state.reservations++
    return { pool, taken: () => { state.reserved-- } }
  }
  return { state, room }
}

async function poolWithOneIdleConnection() {
  const { createCmsDb } = await import('../../packages/cms/server/db/driver')
  const cap = capModel()
  const db = createCmsDb('postgres://user:pw@nowhere.invalid/db', {}, { multiTenant: true, beforeConnect: cap.room })
  const pool = (db as any).$client
  const first = await pool.connect()
  first.release()
  expect([pool.totalCount, pool.idleCount, cap.state.reservations]).toEqual([1, 1, 1])
  return { pool, cap }
}

afterEach(() => { clients.length = 0 })

describe('the multi-tenant driver gives room back when the pool shows the connection', () => {
  it('one idle connection goes to one caller: the next caller, a moment later, is counted as a new connection', async () => {
    const { pool, cap } = await poolWithOneIdleConnection()
    // The first caller is answered "take the idle one". Right after that answer was acted on, and
    // before the pool has handed the idle connection out (its next tick), a second caller asks.
    const one = pool.connect()
    let two: Promise<any>
    await new Promise<void>((resolve) => queueMicrotask(() => { two = pool.connect(); resolve() }))
    const held = await Promise.all([one, two!])
    // Two connections exist now. The second one was opened by the pool: the cap must have made room for it.
    expect(pool.totalCount).toBe(2)
    expect(clients).toHaveLength(2)
    expect(cap.state.reservations, 'connections the cap made room for').toBe(2)
    expect(cap.state.grants, 'callers told to take the idle connection').toBe(1)
    expect([cap.state.granted, cap.state.reserved]).toEqual([0, 0])
    for (const c of held) c.release()
    await pool.end()
  })

  it('room for a new connection is not given back before the pool counts that connection', async () => {
    const { pool, cap } = await poolWithOneIdleConnection()
    // Two callers in the same breath: the first is given the idle connection, the second room for a new one.
    const one = pool.connect()
    const two = pool.connect()
    // What the cap adds up for this pool (its connections and the room it holds for new ones), looked
    // at microtask after microtask, as another site's caller would, until both have their connection.
    const counted: number[] = []
    for (let i = 0; i < 6; i++) { await Promise.resolve(); counted.push(pool.totalCount + cap.state.reserved) }
    const held = await Promise.all([one, two])
    counted.push(pool.totalCount + cap.state.reserved)
    // Two connections were going to exist from the moment the second caller was answered: never fewer are counted.
    expect(Math.min(...counted), `counted: ${counted.join(', ')}`).toBe(2)
    expect(pool.totalCount).toBe(2)
    expect([cap.state.granted, cap.state.reserved]).toEqual([0, 0])
    for (const c of held) c.release()
    await pool.end()
  })

  it('a pool that was ended is done when its connections are closed, not when it let go of them', async () => {
    const { pool } = await poolWithOneIdleConnection()
    const held = [await pool.connect(), await pool.connect()]
    for (const c of held) c.release()
    expect(clients).toHaveLength(2)
    await pool.end()
    // The cap counts a closed pool's connections until `end()` has finished (cmsDb.ts, `closing`).
    expect(clients.map((c) => c.closed)).toEqual([true, true])
  })
})

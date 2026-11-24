import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Multi-tenant mode: scheduled work looks at a site only when it has a reason
// (packages/cms/server/utils/cmsBackground.ts). The slow rotation that visits every site now and
// then is tested here for what it must do with thousands of sites: visit each one at least
// every interval, and not all on the same tick. The retention task's guard against two rounds
// at once is here too. (What the tasks do to real databases is in test/api/tenants-scheduled-work.spec.ts.)
const root = join(import.meta.dirname, '../..')
const MINUTE = 60_000
const EVERY = 15 * MINUTE

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

async function sweep() {
  return await import(/* @vite-ignore */ join(root, 'packages/cms/server/utils/cmsBackground.ts')) as typeof import('../../packages/cms/server/utils/cmsBackground')
}

describe('the slow rotation over the sites', () => {
  const ids = Array.from({ length: 3000 }, (_, i) => `s_${(i * 7919 + 13).toString(36)}${i}`)

  it('a site that was never looked at is due at once', async () => {
    const { cmsSweepDue } = await sweep()
    expect(cmsSweepDue('site-a', 0)).toBe(true)
  })

  it('a site just looked at is not due again until its turn comes round, and never later than the interval', async () => {
    const { cmsSweepDue } = await sweep()
    const start = Date.UTC(2026, 10, 23, 8, 0, 0)
    for (const id of ids.slice(0, 200)) {
      // Looked at the start (the first tick after a start looks at every site), then ticks every minute.
      let last = start
      const looks: number[] = []
      for (let at = start + MINUTE; at <= start + 3 * 60 * MINUTE; at += MINUTE) {
        if (cmsSweepDue(id, last, at)) { looks.push(at); last = at }
      }
      // Three hours: every site is swept, and the gaps are never longer than the interval (one tick of slack).
      expect(looks.length).toBeGreaterThanOrEqual(11)
      const gaps = looks.map((at, i) => at - (i ? looks[i - 1]! : start))
      for (const gap of gaps) expect(gap).toBeLessThanOrEqual(EVERY + MINUTE)
    }
  })

  it('spreads thousands of sites over the ticks: no tick takes more than a small multiple of the even share', async () => {
    const { cmsSweepDue } = await sweep()
    const start = Date.UTC(2026, 10, 23, 8, 0, 0)
    const last = new Map(ids.map((id) => [id, start]))
    const perTick: number[] = []
    // From the second hour on, past the first rounds (everything was looked at in the first tick).
    for (let at = start + MINUTE; at <= start + 4 * 60 * MINUTE; at += MINUTE) {
      let n = 0
      for (const id of ids) if (cmsSweepDue(id, last.get(id)!, at)) { last.set(id, at); n++ }
      if (at > start + 60 * MINUTE) perTick.push(n)
    }
    const share = ids.length / 15
    expect(Math.max(...perTick)).toBeLessThan(share * 2)
    expect(perTick.reduce((a, b) => a + b, 0) / perTick.length).toBeGreaterThan(share * 0.9)
  })

  it('is as long as the test knob says (CMS_TEST_SWEEP_MS), and 15 minutes without it', async () => {
    const { cmsSweepMs } = await sweep()
    expect(cmsSweepMs()).toBe(EVERY)
    vi.stubEnv('CMS_TEST_SWEEP_MS', '4000')
    expect(cmsSweepMs()).toBe(4000)
    vi.stubEnv('CMS_TEST_SWEEP_MS', '3')
    expect(cmsSweepMs()).toBe(EVERY)
  })
})

describe('the retention task in multi-tenant mode', () => {
  let loads = 0
  /** The task file loaded with the helpers it calls (Nitro auto-imports them) replaced by stand-ins. */
  async function task(sites: string[], gate: Promise<void>) {
    const ran: string[] = []
    const stand = {
      defineTask: (t: any) => t,
      cmsIsMultiTenant: () => true,
      cmsTimerMs: () => 0,
      retentionRound: { running: false },
      runReportedTask: (_: string, body: () => Promise<unknown>) => body(),
      runRetention: async () => ({ forms: {}, plugins: {}, audit: 0 }),
      forEachCmsSite: async (fn: (site: unknown) => unknown) => {
        await gate
        const failed: unknown[] = []
        for (const id of sites) {
          try { await fn({ id }); ran.push(id) }
          catch (error) { failed.push({ site: id, error }) }
        }
        return failed
      },
    }
    for (const [name, value] of Object.entries(stand)) vi.stubGlobal(name, value)
    const mod = await import(/* @vite-ignore */ `${join(root, 'packages/cms/server/tasks/cms/retention.ts')}?fresh=${++loads}`)
    return { run: mod.default.run as () => Promise<{ result: any }>, ran, round: stand.retentionRound }
  }

  it('a round still going when the next starts is not joined by it; once it ends the next one runs', async () => {
    let open!: () => void
    const gate = new Promise<void>((r) => { open = r })
    const { run, ran, round } = await task(['a', 'b', 'c'], gate)
    const first = run()
    await new Promise((r) => setTimeout(r, 10))
    expect(round.running).toBe(true)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect((await run()).result).toEqual({ skipped: 'the previous run is still going' })
    }
    finally { warn.mockRestore() }
    expect(ran).toEqual([])
    open()
    expect((await first).result).toEqual({ sites: 3, skipped: 0, failed: 0 })
    expect(round.running).toBe(false)
    expect((await run()).result).toEqual({ sites: 3, skipped: 0, failed: 0 })
  })

  it('one site failing does not stop the others, and the guard is released', async () => {
    const { run, round } = await task(['a', 'b', 'c'], Promise.resolve())
    // Retention in 'b' fails: the helper isolates it.
    let n = 0
    vi.stubGlobal('runRetention', async () => { if (++n === 2) throw new Error('b is broken'); return { forms: {}, plugins: {}, audit: 0 } })
    expect((await run()).result).toEqual({ sites: 2, skipped: 0, failed: 1 })
    expect(round.running).toBe(false)
  })
})

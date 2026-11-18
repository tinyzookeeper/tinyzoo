import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The website's starting plans (site/seed/plans.mjs, run by `pnpm seed` and `pnpm seed:plans`):
// a run adds only what the site is missing, so one that stopped halfway can be run again.
// The admin API is stood in for by a small in-memory site.

type Text = { title: string; text: string }
type Plan = { stage: string; version?: string; animal: string; cs: Text; en: Text; de: Text }
type Req = (method: string, path: string, body?: Record<string, unknown>) => Promise<any>

// (Imported by a computed path: the website's seed is plain JavaScript without type declarations.)
const { PLANS, seedPlans } = await import(/* @vite-ignore */ join(import.meta.dirname, '../../site/seed/plans.mjs')) as {
  PLANS: Plan[]
  seedPlans: (req: Req) => Promise<number>
}

/** A site's Plan collection behind the admin API's routes, as seedPlans calls them. */
function fakeSite(opts: { failAt?: number } = {}) {
  const rows: (Record<string, any> & { id: string; locales: Record<string, Text> })[] = []
  let calls = 0
  const req: Req = async (method, path, body) => {
    if (opts.failAt !== undefined && ++calls > opts.failAt) throw new Error('fetch failed')
    const url = new URL(path, 'http://site')
    const id = /^\/api\/cms\/plan\/([^/?]+)/.exec(url.pathname)?.[1]
    if (method === 'GET' && !id) {
      const limit = Number(url.searchParams.get('limit')) || 20
      const page = Number(url.searchParams.get('page')) || 1
      const list = rows.slice((page - 1) * limit, page * limit).map(({ locales: _, ...r }) => r)
      return { rows: list, total: rows.length, page, limit }
    }
    if (method === 'GET') {
      const row = rows.find((r) => r.id === id)!
      return { row: { ...row, __locales: ['cs', ...Object.keys(row.locales)] } }
    }
    if (method === 'POST') {
      const row = { ...body, id: `p${rows.length + 1}`, locales: {} }
      rows.push(row)
      return { row }
    }
    if (method === 'PATCH') {
      rows.find((r) => r.id === id)!.locales[url.searchParams.get('locale')!] = body as Text
      return { row: {} }
    }
    throw new Error(`unexpected ${method} ${path}`)
  }
  return { rows, req }
}

let log: ReturnType<typeof vi.spyOn>
beforeEach(() => { log = vi.spyOn(console, 'log').mockImplementation(() => {}) })
afterEach(() => { log.mockRestore() })

describe('seedPlans', () => {
  it('fills an empty site with every plan in all three languages, in page order', async () => {
    const site = fakeSite()
    expect(await seedPlans(site.req)).toBe(PLANS.length)
    expect(site.rows.map((r) => r.title)).toEqual(PLANS.map((p) => p.cs.title))
    expect(site.rows.map((r) => r.position)).toEqual(PLANS.map((_, i) => i + 1))
    expect(site.rows.every((r) => r.locales.en && r.locales.de)).toBe(true)
  })

  it('finishes a run that stopped halfway: the missing plans and a missing translation, nothing twice', async () => {
    const site = fakeSite({ failAt: 1 + 5 * 3 + 2 }) // the list, five plans, then the sixth one's Czech and English
    await expect(seedPlans(site.req)).rejects.toThrow('fetch failed')
    expect(site.rows).toHaveLength(6)
    expect(site.rows[5]!.locales.de).toBeUndefined()

    const again = fakeSite()
    again.rows.push(...site.rows)
    expect(await seedPlans(again.req)).toBe(PLANS.length - 6)
    expect(again.rows.map((r) => r.title)).toEqual(PLANS.map((p) => p.cs.title))
    expect(again.rows.map((r) => r.position)).toEqual(PLANS.map((_, i) => i + 1))
    expect(again.rows[5]!.locales.de).toEqual(PLANS[5]!.de)
    expect(log.mock.calls.at(-1)![0]).toBe(`✓ plans: ${PLANS.length - 6} added (cs, en, de), 1 missing translation added, 6 the site had left as they were`)
  })

  it('never changes or deletes what editors wrote, and adds nothing to a complete site', async () => {
    const site = fakeSite()
    await seedPlans(site.req)
    site.rows[0]!.text = 'Edited by an editor'
    site.rows[1]!.locales.en = { title: 'Edited', text: 'Edited' }
    site.rows.push({ id: 'own', title: 'A plan of the editors', position: 99, locales: {} })
    const before = structuredClone(site.rows)
    expect(await seedPlans(site.req)).toBe(0)
    expect(site.rows).toEqual(before)
    expect(log.mock.calls.at(-1)![0]).toBe(`· plans: the site has all ${PLANS.length}, left alone`)
  })

  it('reads every page of a long list', async () => {
    const site = fakeSite()
    for (let i = 0; i < 130; i++) site.rows.push({ id: `own${i}`, title: `Own ${i}`, position: i + 1, locales: {} })
    site.rows.push({ id: 'seeded', title: PLANS[0]!.cs.title, position: 131, locales: { en: PLANS[0]!.en, de: PLANS[0]!.de } })
    expect(await seedPlans(site.req)).toBe(PLANS.length - 1)
    expect(site.rows.filter((r) => r.title === PLANS[0]!.cs.title)).toHaveLength(1)
    expect(site.rows.at(-1)!.position).toBe(131 + PLANS.length - 1)
  })
})

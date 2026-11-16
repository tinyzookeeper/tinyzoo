import { afterEach, describe, expect, it, vi } from 'vitest'
import { upgradedCopy, upgradeStoredJson } from '../../packages/cms/server/utils/cmsBlocks'
import {
  defineEntity, blocksSchema, defineBlock, f, mediaIdsInBlocks, richTextUpgrades, storedBlockVersion, upgradeBlocks, upgradeListItems, upgradeStoredRow, UPGRADE_FAILED_KEY,
} from 'tinyzoo'

// A hero that was renamed twice: v1 { heading } → v2 { title } → v3 { title, subtitle required-ish, `lead` folded in }.
const hero = defineBlock({
  label: 'Hero',
  version: 3,
  fields: { title: f.text({ required: true }), subtitle: f.text(), image: f.media() },
  upgrade(data, from) {
    if (from === 1) {
      const { heading, ...rest } = data
      return { ...rest, title: heading }
    }
    // 2 → 3: the lead line became the subtitle
    const { lead, ...rest } = data
    return { ...rest, subtitle: lead ?? null }
  },
})
const text = defineBlock({ label: 'Text', fields: { body: f.richtext() } })
const defs = { hero, text }

afterEach(() => {
  vi.restoreAllMocks()
  richTextUpgrades.length = 0
})

describe('defineBlock versions', () => {
  it('needs an upgrade from version 2, and a sane version', () => {
    expect(() => defineBlock({ label: 'X', version: 2, fields: { a: f.text() } })).toThrow(/no `upgrade/)
    expect(() => defineBlock({ label: 'X', version: 0, fields: { a: f.text() } })).toThrow(/whole number/)
    expect(() => defineBlock({ label: 'X', version: 1.5, fields: { a: f.text() } })).toThrow(/whole number/)
    expect(() => defineBlock({ label: 'X', version: 2, upgrade: (d) => d, fields: { a: f.text() } })).not.toThrow()
    expect(() => defineBlock({ label: 'X', fields: { v: f.text() } })).toThrow(/reserved/)
  })

  it('f.list takes the same options', () => {
    expect(() => f.list({ version: 2, fields: { a: f.text() } })).toThrow(/no `upgrade/)
    const list = f.list({ version: 2, upgrade: (d) => ({ ...d, a: d.old }), fields: { a: f.text() } })
    expect(list.blocks!.item!.version).toBe(2)
  })
})

describe('upgradeBlocks', () => {
  it('chains 1 → 2 → 3, one step at a time, and stamps v', () => {
    const steps: number[] = []
    const spy = defineBlock({
      label: 'S', version: 3, fields: { n: f.text() },
      upgrade: (d, from) => { steps.push(from); return { ...d, n: `${d.n ?? ''}>${from + 1}` } },
    })
    const out: any = upgradeBlocks([{ id: 'a', type: 'spy', n: 'x' }], { spy })
    expect(steps).toEqual([1, 2])
    expect(out).toEqual([{ id: 'a', type: 'spy', n: 'x>2>3', v: 3 }])
  })

  it('starts from the stored version, and treats a missing or odd v as 1', () => {
    const at2: any = upgradeBlocks([{ id: 'a', type: 'hero', v: 2, title: 'T', lead: 'L' }], defs)
    expect(at2[0]).toEqual({ id: 'a', type: 'hero', title: 'T', subtitle: 'L', v: 3 })
    const none: any = upgradeBlocks([{ id: 'a', type: 'hero', heading: 'H', lead: 'L' }], defs)
    expect(none[0]).toEqual({ id: 'a', type: 'hero', title: 'H', subtitle: 'L', v: 3 })
    expect(storedBlockVersion({})).toBe(1)
    expect(storedBlockVersion({ v: 'x' })).toBe(1)
    expect(storedBlockVersion({ v: 0 })).toBe(1)
    expect(storedBlockVersion({ v: 2 })).toBe(2)
  })

  it('leaves current blocks alone (the very same object) and does not change its input', () => {
    const current = [{ id: 'a', type: 'hero', v: 3, title: 'T', subtitle: null }, { id: 'b', type: 'text', body: null }]
    expect(upgradeBlocks(current, defs)).toBe(current)
    const old = [{ id: 'a', type: 'hero', heading: 'H' }]
    const snapshot = structuredClone(old)
    const out: any = upgradeBlocks(old, defs)
    expect(old).toEqual(snapshot)
    expect(out).not.toBe(old)
  })

  it('keeps id and type whatever upgrade returns, and refuses a result that is not an object', () => {
    const odd = defineBlock({ label: 'O', version: 2, fields: { a: f.text() }, upgrade: () => ({ id: 'other', type: 'other', a: 'x' }) })
    expect((upgradeBlocks([{ id: 'keep', type: 'odd' }], { odd }) as any)[0]).toEqual({ id: 'keep', type: 'odd', a: 'x', v: 2 })
    const bad = defineBlock({ label: 'B', version: 2, fields: { a: f.text() }, upgrade: () => null as any })
    const onError = vi.fn()
    upgradeBlocks([{ id: 'k', type: 'bad' }], { bad }, { onError })
    expect(onError).toHaveBeenCalledOnce()
  })

  it('passes a block of an unknown type through untouched', () => {
    const gone = { id: 'g', type: 'video', url: 'u', v: 7 }
    const out: any = upgradeBlocks([gone, { id: 'a', type: 'hero', heading: 'H' }], defs)
    expect(out[0]).toBe(gone)
    expect(out[1].title).toBe('H')
    expect(upgradeBlocks('not a list', defs)).toBe('not a list')
    expect(upgradeBlocks(null, defs)).toBe(null)
    expect(upgradeBlocks([null, 3, 'x'], defs)).toEqual([null, 3, 'x'])
  })

  it('serves a block as stored when its upgrade throws, and reports where', () => {
    const boom = defineBlock({ label: 'B', version: 2, fields: { a: f.text() }, upgrade: () => { throw new Error('nope') } })
    const stored = { id: 'b1', type: 'boom', old: 1 }
    const onError = vi.fn()
    const out: any = upgradeBlocks([{ id: 'ok', type: 'text' }, stored], { boom, text }, { onError })
    expect(out[1]).toBe(stored)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: 'boom', id: 'b1', from: 1, to: 2, path: [1] }))
    expect((onError.mock.calls[0]![0].error as Error).message).toBe('nope')
    // The admin gets it flagged, with the stored version kept.
    const marked: any = upgradeBlocks([stored], { boom }, { markFailed: true })
    expect(marked[0]).toEqual({ id: 'b1', type: 'boom', old: 1, v: 1, [UPGRADE_FAILED_KEY]: true })
  })

  it('upgrades the lists inside a block (each item by the list\'s own version)', () => {
    const faq = f.list({
      version: 2, fields: { q: f.text(), a: f.text() },
      upgrade: (d) => { const { question, ...rest } = d; return { ...rest, q: question } },
    })
    const block = defineBlock({ label: 'FAQ', fields: { items: faq } })
    const out: any = upgradeBlocks([{ id: 'f', type: 'faq', items: [{ id: 'i1', type: 'item', question: 'Why?', a: 'Because' }, { id: 'i2', type: 'item', v: 2, q: 'Done', a: null }] }], { faq: block })
    expect(out[0].items).toEqual([{ id: 'i1', type: 'item', q: 'Why?', a: 'Because', v: 2 }, { id: 'i2', type: 'item', v: 2, q: 'Done', a: null }])
  })

  it('upgradeListItems is the same for an f.list', () => {
    const list = f.list({ version: 2, fields: { name: f.text() }, upgrade: (d) => ({ ...d, name: String(d.title).toUpperCase() }) })
    const out: any = upgradeListItems([{ id: 'x', type: 'item', title: 'jana' }], list.blocks!)
    expect(out).toEqual([{ id: 'x', type: 'item', title: 'jana', name: 'JANA', v: 2 }])
  })

  it('warns in development about stored keys the definition does not know (once)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const renamed = defineBlock({ label: 'R', fields: { title: f.text() } })
    upgradeBlocks([{ id: 'a', type: 'renamed', heading: 'old', title: 'new' }], { renamed })
    upgradeBlocks([{ id: 'b', type: 'renamed', heading: 'old again', title: 'new' }], { renamed })
    expect(warn).toHaveBeenCalledOnce()
    const msg = String(warn.mock.calls[0]![0])
    expect(msg).toContain('"renamed"')
    expect(msg).toContain('heading')
    expect(msg).toMatch(/version/)
    expect(msg).toMatch(/upgrade/)
  })

  it('does not warn in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('NODE_ENV', 'production')
    try {
      const prod = defineBlock({ label: 'P', fields: { title: f.text() } })
      upgradeBlocks([{ id: 'a', type: 'prodblock', heading: 'old' }], { prodblock: prod })
      expect(warn).not.toHaveBeenCalled()
    }
    finally { vi.unstubAllEnvs() }
  })
})

describe('blocksSchema with versions', () => {
  const schema = blocksSchema(defs)

  it('stamps the current v on every block written (and leaves it off at version 1)', () => {
    const out: any = schema.parse([{ id: 'a', type: 'hero', title: 'T' }, { id: 'b', type: 'text', body: null }])
    expect(out[0].v).toBe(3)
    expect('v' in out[1]).toBe(false)
  })

  it('reads a missing v as the current version (what the content API returns carries none)', () => {
    // `lead` would be folded into `subtitle` if this were treated as v1/v2 — it is not
    expect((schema.parse([{ id: 'a', type: 'hero', title: 'T', subtitle: 'S' }]) as any)[0]).toEqual({ id: 'a', type: 'hero', title: 'T', subtitle: 'S', v: 3 })
  })

  it('upgrades a block that says it is behind, then validates it against the current fields', () => {
    const out: any = schema.parse([{ id: 'a', type: 'hero', v: 1, heading: 'Vítejte', lead: 'Úvod' }])
    expect(out[0]).toEqual({ id: 'a', type: 'hero', title: 'Vítejte', subtitle: 'Úvod', v: 3 })
    // the editor-style round trip: upgraded and stamped in, same out
    expect(schema.parse(out)).toEqual(out)
  })

  it('makes a forgotten rename a validation error instead of silent loss', () => {
    const forgetful = defineBlock({
      label: 'F', version: 2, fields: { title: f.text(), body: f.text() },
      upgrade: (d) => ({ ...d, title: d.heading }), // forgot to drop (or move) `text`
    })
    const s = blocksSchema({ forgetful })
    const r = s.safeParse([{ id: 'a', type: 'forgetful', v: 1, heading: 'H', text: 'lost?' }])
    expect(r.success).toBe(false)
    expect(JSON.stringify((r as any).error.issues)).toMatch(/heading|text/)
    expect((r as any).error.issues[0].path[0]).toBe(0)
    // …while a block at the current version still just drops unknown keys, like before
    expect((s.parse([{ id: 'a', type: 'forgetful', v: 2, title: 'T', body: 'B', extra: 1 }]) as any)[0]).toEqual({ id: 'a', type: 'forgetful', title: 'T', body: 'B', v: 2 })
  })

  it('refuses a block saved by a newer version, and a bad v', () => {
    const newer = schema.safeParse([{ id: 'a', type: 'hero', v: 4, title: 'T' }])
    expect(newer.success).toBe(false)
    expect((newer as any).error.issues[0].path).toEqual([0, 'v'])
    expect(schema.safeParse([{ id: 'a', type: 'hero', v: 'x', title: 'T' }]).success).toBe(false)
  })

  it('keeps a block exactly as stored when its upgrade throws, and drops the admin flag', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = defineBlock({ label: 'B', version: 2, fields: { a: f.text() }, upgrade: () => { throw new Error('nope') } })
    const s = blocksSchema({ boom })
    const kept = { id: 'k', type: 'boom', v: 1, old: 'data' }
    expect(s.parse([{ ...kept, [UPGRADE_FAILED_KEY]: true }])).toEqual([kept])
  })

  it('keeps unknown types untouched, ids stay unique, and errors point at the right block', () => {
    const gone = { id: 'g', type: 'video', anything: [1, { a: 2 }] }
    expect(schema.parse([gone, { id: 'a', type: 'text', body: null }])).toEqual([gone, { id: 'a', type: 'text', body: null }])
    const dup = schema.safeParse([gone, { id: 'g', type: 'text' }])
    expect(dup.success).toBe(false)
    expect((dup as any).error.issues[0].path).toEqual([1, 'id'])
    const bad = schema.safeParse([gone, { id: 'h', type: 'hero', title: '' }])
    expect((bad as any).error.issues[0].path).toEqual([1, 'title'])
  })

  it('checks a list inside a block at its own version', () => {
    const faq = f.list({ version: 2, fields: { q: f.text({ required: true }) }, upgrade: ({ question, ...rest }) => ({ ...rest, q: question }) })
    const s = blocksSchema({ faq: defineBlock({ label: 'F', fields: { items: faq } }) })
    const out: any = s.parse([{ id: 'f', type: 'faq', items: [{ id: 'i', type: 'item', v: 1, question: 'Proč?' }] }])
    expect(out[0].items).toEqual([{ id: 'i', type: 'item', q: 'Proč?', v: 2 }])
    const bad = s.safeParse([{ id: 'f', type: 'faq', items: [{ id: 'i', type: 'item', v: 2, q: '' }] }])
    expect((bad as any).error.issues[0].path).toEqual([0, 'items', 0, 'q'])
  })
})

describe('upgradeStoredRow', () => {
  it('upgrades blocks and rich text in a row, leaving missing keys alone', () => {
    const fields = { title: f.text(), sections: f.blocks(defs), body: f.richtext() } as any
    const row: any = { id: 'r', title: 'T', sections: [{ id: 'a', type: 'hero', heading: 'H' }] }
    upgradeStoredRow(fields, row)
    expect(row.sections[0].title).toBe('H')
    expect('body' in row).toBe(false)
  })

  it('applies richTextUpgrades to documents (row level and inside blocks)', () => {
    richTextUpgrades.push({ id: 'rename-callout', upgrade: (doc: any) => JSON.parse(JSON.stringify(doc).replaceAll('"callout"', '"note"')) })
    const doc = { type: 'doc', content: [{ type: 'callout', content: [] }] }
    const fields = { body: f.richtext(), sections: f.blocks({ text }) } as any
    const row: any = { body: doc, sections: [{ id: 't', type: 'text', body: doc }] }
    upgradeStoredRow(fields, row)
    expect(row.body.content[0].type).toBe('note')
    expect(row.sections[0].body.content[0].type).toBe('note')
    expect(doc.content[0]!.type).toBe('callout') // the input is not changed
  })
})

describe('media in blocks that are behind', () => {
  it('counts every id when the block is stored at an older shape (the renamed key is unknown to the current one)', () => {
    const photo = defineBlock({ label: 'P', version: 2, fields: { picture: f.media() }, upgrade: (d) => ({ ...d, picture: d.image }) })
    const M = '00000000-0000-4000-8000-0000000000aa'
    expect(mediaIdsInBlocks([{ id: 'p', type: 'photo', image: M }], { photo })).toEqual([M])
    expect(mediaIdsInBlocks([{ id: 'p', type: 'photo', v: 2, picture: M }], { photo })).toEqual([M])
  })
})

describe('the server wrapper (every read site goes through it)', () => {
  const Thing = defineEntity('thing', { label: 'Thing', titleField: 'title', fields: { title: f.text(), sections: f.blocks(defs) } })
  const boom = defineBlock({ label: 'B', version: 2, fields: { a: f.text() }, upgrade: () => { throw new Error('nope') } })
  const Broken = defineEntity('broken', { label: 'Broken', titleField: 'title', fields: { title: f.text(), sections: f.blocks({ boom }) } })

  it('upgrades a row in place, and a copy leaves the row alone', () => {
    const row: any = { id: 'r1', title: 'T', sections: [{ id: 'a', type: 'hero', heading: 'H' }] }
    const copy = upgradedCopy(Thing, row)
    expect(copy.sections[0].title).toBe('H')
    expect(row.sections[0].heading).toBe('H')
    upgradeStoredJson(Thing, row)
    expect(row.sections[0]).toMatchObject({ title: 'H', v: 3 })
  })

  it('logs a failing block once with entity, record and block id, serves it as stored, and flags it for the admin only', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const block = { id: 'b1', type: 'boom', old: 1 }
    const site: any = upgradeStoredJson(Broken, { id: 'rec-1', sections: [block] })
    expect(site.sections[0]).toBe(block)
    const admin: any = upgradeStoredJson(Broken, { id: 'rec-1', sections: [block] }, { admin: true })
    expect(admin.sections[0]).toEqual({ ...block, v: 1, [UPGRADE_FAILED_KEY]: true })
    expect(error).toHaveBeenCalledOnce()
    const line = String(error.mock.calls[0]![0])
    expect(line).toContain('broken rec-1')
    expect(line).toContain('b1')
    expect(line).toContain('nope')
  })
})

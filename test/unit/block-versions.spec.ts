import { afterEach, describe, expect, it, vi } from 'vitest'
import { upgradedCopy, upgradeStoredJson } from '../../packages/cms/server/utils/cmsBlocks'
import { cmsIssueMessage } from '../../packages/cms/app/utils/cmsIssues'
import cs from '../../packages/cms/app/i18n/cs'
import { renderableBlockType } from '../../packages/cms/app/utils/cmsBlockType'
import {
  defineEntity, defineSingleton, blocksSchema, defineBlock, f, mediaIdsInBlocks, richTextUpgrades, storedBlockVersion, upgradeBlocks, upgradeListItems, upgradeStoredRow, UPGRADE_FAILED_KEY, UNKNOWN_BLOCK_TYPE,
} from 'tinyzoo'
import { writeSchema } from '../../packages/cms/server/utils/cmsBlocks'
import { listedRecipients } from '../../packages/cms/forms/server/formSettings'

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

  it('upgrades a stored block that says it is behind, then validates it against the current fields', () => {
    const stored = [{ id: 'a', type: 'hero', heading: 'Vítejte', lead: 'Úvod' }]
    const out: any = blocksSchema(defs, 500, stored).parse([{ id: 'a', type: 'hero', v: 1, heading: 'Vítejte', lead: 'Úvod' }])
    expect(out[0]).toEqual({ id: 'a', type: 'hero', title: 'Vítejte', subtitle: 'Úvod', v: 3 })
    // the editor-style round trip: upgraded and stamped in, same out
    expect(schema.parse(out)).toEqual(out)
  })

  it('makes a forgotten rename a validation error instead of silent loss', () => {
    const forgetful = defineBlock({
      label: 'F', version: 2, fields: { title: f.text(), body: f.text() },
      upgrade: (d) => ({ ...d, title: d.heading }), // forgot to drop (or move) `text`
    })
    const s = blocksSchema({ forgetful }, 500, [{ id: 'a', type: 'forgetful', heading: 'H', text: 'lost?' }])
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

  it('keeps a stored block exactly as stored when its upgrade throws, and drops the admin flag', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = defineBlock({ label: 'B', version: 2, fields: { a: f.text() }, upgrade: () => { throw new Error('nope') } })
    const kept = { id: 'k', type: 'boom', old: 'data' }
    // The admin read stamped `v` and the flag; the stored copy has neither.
    const s = blocksSchema({ boom }, 500, [kept])
    expect(s.parse([{ ...kept, v: 1, [UPGRADE_FAILED_KEY]: true }])).toEqual([kept])
  })

  it('keeps unknown types untouched when they are stored, ids stay unique, and errors point at the right block', () => {
    const gone = { id: 'g', type: 'video', anything: [1, { a: 2 }] }
    const schema = blocksSchema(defs, 500, [gone])
    expect(schema.parse([gone, { id: 'a', type: 'text', body: null }])).toEqual([gone, { id: 'a', type: 'text', body: null }])
    const dup = schema.safeParse([gone, { id: 'g', type: 'text' }])
    expect(dup.success).toBe(false)
    expect((dup as any).error.issues[0].path).toEqual([1, 'id'])
    const bad = schema.safeParse([gone, { id: 'h', type: 'hero', title: '' }])
    expect((bad as any).error.issues[0].path).toEqual([1, 'title'])
  })

  it('checks a list inside a block at its own version', () => {
    const faq = f.list({ version: 2, fields: { q: f.text({ required: true }) }, upgrade: ({ question, ...rest }) => ({ ...rest, q: question }) })
    const s = blocksSchema({ faq: defineBlock({ label: 'F', fields: { items: faq } }) }, 500, [{ id: 'f', type: 'faq', items: [{ id: 'i', type: 'item', question: 'Proč?' }] }])
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

// ── writes are not taken on the client's word ───────────────────────────────────

const issuesOf = (r: any) => (r.error.issues as { path: (string | number)[]; message: string }[])

describe('a block whose upgrade throws is not stored unchecked', () => {
  // v2 added a link; the upgrade is broken, and the new shape checks the url.
  const link = defineBlock({
    label: 'L', version: 2, fields: { href: f.text({ format: 'link' }), label: f.text() },
    upgrade: () => { throw new Error('broken upgrade') },
  })
  const evil = { id: 'e', type: 'link', v: 1, href: 'javascript:alert(1)', label: 'Click', body: '<script>x</script>' }

  it('refuses a new one, with the message on that block', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // Posted to a row that does not exist yet: nothing is stored.
    const r = blocksSchema({ link }).safeParse([evil])
    expect(r.success).toBe(false)
    expect(issuesOf(r)[0]!.path).toEqual([0, 'v']) // also not stored at that version
  })

  it('refuses one the client claims is stored: the id is stored, but the content differs', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const stored = [{ id: 'e', type: 'link', href: '/ok', label: 'Fine' }]
    const r = blocksSchema({ link }, 500, stored).safeParse([evil])
    expect(r.success).toBe(false)
    expect(issuesOf(r)[0]).toMatchObject({ path: [0], message: 'This block could not be brought up to date — remove it or fix it' })
  })

  it('refuses the same block without a v (taken for version 1)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { v: _v, ...noV } = evil
    const r = blocksSchema({ link }).safeParse([noV])
    expect(r.success).toBe(false)
    expect(issuesOf(r)[0]).toMatchObject({ path: [0], message: 'This block could not be brought up to date — remove it or fix it' })
  })

  it('keeps an untouched stored one (what the admin read gave back, flag and stamp included), but not a changed one', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const stored = { id: 'e', type: 'link', href: 'javascript:alert(1)', label: 'Old' }
    const s = blocksSchema({ link }, 500, [stored])
    expect(s.parse([{ ...stored, v: 1, [UPGRADE_FAILED_KEY]: true }])).toEqual([stored])
    expect(s.parse([stored])).toEqual([stored])
    expect(s.safeParse([{ ...stored, v: 1, label: 'Edited' }]).success).toBe(false)
    expect(s.safeParse([{ ...stored, v: 1, extra: 1 }]).success).toBe(false)
  })
})

describe('a client-sent v below the current one', () => {
  const stale = blocksSchema(defs)
  it('is refused on create (nothing is stored)', () => {
    const r = stale.safeParse([{ id: 'a', type: 'hero', v: 1, heading: 'H' }])
    expect(r.success).toBe(false)
    expect(issuesOf(r)[0]!.path).toEqual([0, 'v'])
  })

  it('is accepted only for a block id that is already stored at that version', () => {
    const at = (v: number | undefined, id = 'a') => [{ id, type: 'hero', ...(v ? { v } : {}), heading: 'H', title: 'T' }]
    const send = [{ id: 'a', type: 'hero', v: 1, heading: 'H' }]
    expect(blocksSchema(defs, 500, at(undefined)).parse(send)).toEqual([{ id: 'a', type: 'hero', title: 'H', subtitle: null, v: 3 }])
    // stored at another version, under another id, or as another type: refused
    expect(blocksSchema(defs, 500, at(2)).safeParse(send).success).toBe(false)
    expect(blocksSchema(defs, 500, at(undefined, 'other')).safeParse(send).success).toBe(false)
    expect(blocksSchema(defs, 500, [{ id: 'a', type: 'text' }]).safeParse(send).success).toBe(false)
    expect(blocksSchema(defs, 500, 'not a list').safeParse(send).success).toBe(false)
  })

  it('an explicit current v needs no stored copy', () => {
    expect(blocksSchema(defs).parse([{ id: 'a', type: 'hero', v: 3, title: 'T' }])).toEqual([{ id: 'a', type: 'hero', title: 'T', v: 3 }])
  })
})

describe('a block without v is never trusted to be current, and never loses keys silently', () => {
  // v1 { title } → v2 { heading } (a rename)
  const page = defineBlock({
    label: 'P', version: 2, fields: { heading: f.text(), size: f.number().optional() },
    upgrade: ({ title, ...rest }) => ({ ...rest, heading: title }),
  })
  const v1only = defineBlock({ label: 'Q', fields: { title: f.text() } })

  it('a stale editor tab: the old shape is upgraded, not stripped', () => {
    const out: any = blocksSchema({ page }).parse([{ id: 'a', type: 'page', title: 'Keep me' }])
    expect(out).toEqual([{ id: 'a', type: 'page', heading: 'Keep me', v: 2 }])
  })

  it('a block of the current shape stays current', () => {
    expect(blocksSchema({ page }).parse([{ id: 'a', type: 'page', heading: 'New', size: 3 }])).toEqual([{ id: 'a', type: 'page', heading: 'New', size: 3, v: 2 }])
  })

  it('a version-1 definition refuses keys it does not know, naming them', () => {
    const r = blocksSchema({ q: v1only }).safeParse([{ id: 'a', type: 'q', title: 'T', heading: 'H', extra: 1 }])
    expect(r.success).toBe(false)
    const [issue] = issuesOf(r)
    expect(issue!.path).toEqual([0])
    expect(issue!.message).toMatch(/heading, extra/)
    expect(issue!.message).toMatch(/reload/)
    // a value that is wrong is still reported as such
    const bad = blocksSchema({ q: defineBlock({ label: 'R', fields: { title: f.text({ required: true }) } }) }).safeParse([{ id: 'a', type: 'q', title: '' }])
    expect(issuesOf(bad)[0]!.path).toEqual([0, 'title'])
  })

  it('an explicit current v still strips unknown keys, like an editor value always did', () => {
    expect(blocksSchema({ q: v1only }).parse([{ id: 'a', type: 'q', v: 1, title: 'T', extra: 1 }])).toEqual([{ id: 'a', type: 'q', title: 'T' }])
  })

  it('the same for list items, inside a block and in a plain list', () => {
    const items = f.list({ version: 2, fields: { name: f.text() }, upgrade: ({ label, ...rest }) => ({ ...rest, name: label }) })
    const withList = defineBlock({ label: 'W', fields: { items } })
    const out: any = blocksSchema({ w: withList }).parse([{ id: 'w', type: 'w', items: [{ id: 'i', type: 'item', label: 'Keep me' }] }])
    expect(out[0].items).toEqual([{ id: 'i', type: 'item', name: 'Keep me', v: 2 }])
    expect((items.zod('update').parse([{ id: 'i', type: 'item', label: 'Keep me' }]) as any)).toEqual([{ id: 'i', type: 'item', name: 'Keep me', v: 2 }])
    const plain = f.list({ fields: { name: f.text() } })
    const r = plain.zod('update').safeParse([{ id: 'i', type: 'item', name: 'N', label: 'old name' }])
    expect(r.success).toBe(false)
    expect(issuesOf(r)[0]!.message).toMatch(/label/)
  })

  it('lists in a block are checked against the list stored in the same block: a stale item must be stored', () => {
    const items = f.list({ version: 2, fields: { name: f.text() }, upgrade: ({ label, ...rest }) => ({ ...rest, name: label }) })
    const withList = defineBlock({ label: 'W', fields: { items } })
    const body = [{ id: 'w', type: 'w', items: [{ id: 'i', type: 'item', v: 1, label: 'Old' }] }]
    expect(blocksSchema({ w: withList }).safeParse(body).success).toBe(false)
    const stored = [{ id: 'w', type: 'w', items: [{ id: 'i', type: 'item', label: 'Old' }] }]
    expect(blocksSchema({ w: withList }, 500, stored).parse(body)).toEqual([{ id: 'w', type: 'w', items: [{ id: 'i', type: 'item', name: 'Old', v: 2 }] }])
  })
})

describe('what the admin reads carries v on every block and list item', () => {
  it('stamps v: 1 on blocks of version 1, lists included, and leaves unknown types as they are', () => {
    const items = f.list({ fields: { name: f.text() } })
    const withList = defineBlock({ label: 'W', fields: { items } })
    const stored = [{ id: 't', type: 'text', body: null }, { id: 'w', type: 'w', items: [{ id: 'i', type: 'item', name: 'N' }] }, { id: 'g', type: 'video' }]
    const out: any = upgradeBlocks(stored, { text, w: withList }, { stamp: true })
    expect(out[0]).toEqual({ id: 't', type: 'text', body: null, v: 1 })
    expect(out[1].v).toBe(1)
    expect(out[1].items).toEqual([{ id: 'i', type: 'item', name: 'N', v: 1 }])
    expect(out[2]).toBe(stored[2])
    expect(stored[0]).toEqual({ id: 't', type: 'text', body: null }) // the input is not changed
    // without it nothing changes (the content API, the search index)
    expect(upgradeBlocks(stored, { text, w: withList })).toBe(stored)
  })

  it('upgradeStoredJson stamps for the admin only, and a stamped block goes back to the server as it came', () => {
    const Page = defineEntity('stampy', { label: 'S', titleField: 'title', fields: { title: f.text(), sections: f.blocks({ text }), items: f.list({ fields: { name: f.text() } }) } })
    const row = (): any => ({ id: 'r', title: 'T', sections: [{ id: 't', type: 'text', body: null }], items: [{ id: 'i', type: 'item', name: 'N' }] })
    expect(upgradeStoredJson(Page, row()).sections[0].v).toBeUndefined()
    const admin = upgradeStoredJson(Page, row(), { admin: true })
    expect(admin.sections[0].v).toBe(1)
    expect(admin.items[0].v).toBe(1)
    const back: any = (writeSchema(Page, 'update', row()) as any).parse({ sections: admin.sections, items: admin.items })
    expect(back.sections).toEqual([{ id: 't', type: 'text', body: null }]) // version 1: stored without v
    expect(back.items).toEqual([{ id: 'i', type: 'item', name: 'N' }])
  })
})

describe('unknown block types', () => {
  const gone = { id: 'g', type: 'video', url: 'https://example.com/v.mp4' }
  const known = defineBlock({ label: 'K', fields: { a: f.text() } })
  const kinds = { hero: known, 'my-block': known, myCard: known }

  it('the spelling an unknown type may have', () => {
    for (const ok of ['video', 'embed-2', 'old_gallery', '3d']) expect(UNKNOWN_BLOCK_TYPE.test(ok)).toBe(true)
    for (const bad of ['Link', 'Video', '_hero', '-hero', '', 'a b', 'hé']) expect(UNKNOWN_BLOCK_TYPE.test(bad)).toBe(false)
  })

  it('a new block of an unknown type is refused: it would be kept without being checked', () => {
    const r = blocksSchema(kinds).safeParse([gone])
    expect(r.success).toBe(false)
    expect(issuesOf(r)[0]!.path).toEqual([0])
    // …also on a row that has other blocks stored
    expect(blocksSchema(kinds, 500, [{ id: 'x', type: 'hero', a: 'A' }]).safeParse([gone]).success).toBe(false)
  })

  it('a stored one is kept, exactly as stored; changed, or moved onto another id or type, it is refused', () => {
    const s = blocksSchema(kinds, 500, [gone])
    expect(s.parse([gone])).toEqual([gone])
    expect(s.parse([{ ...gone, [UPGRADE_FAILED_KEY]: true }])).toEqual([gone])
    expect(s.safeParse([{ ...gone, url: 'javascript:alert(1)' }]).success).toBe(false)
    expect(s.safeParse([{ ...gone, id: 'g2' }]).success).toBe(false)
    // a stored unknown block turned into a known type is checked as that type (here its `url` is not a field)
    expect(s.safeParse([{ ...gone, type: 'hero' }]).success).toBe(false)
  })

  it('a type that would be drawn as a known one is refused: other case, stray _ or -, different separators', () => {
    for (const type of ['Hero', 'HERO', '_hero', '-hero', 'hero_', 'hero-', 'he-ro', 'my_block', 'mycard', 'my-card', 'Link']) {
      const r = blocksSchema(kinds, 500, [{ id: 'g', type, anything: 1 }]).safeParse([{ id: 'g', type, anything: 1 }])
      // Stored already → still kept (it cannot be un-stored by a save); the name only matters for new ones.
      expect(r.success).toBe(true)
      const fresh = blocksSchema(kinds).safeParse([{ id: 'n', type, anything: 1 }])
      expect(fresh.success).toBe(false)
      expect(issuesOf(fresh)[0]).toMatchObject({ path: [0, 'type'], message: 'Unknown block type' })
    }
  })
})

describe('what CmsBlocks may draw', () => {
  it('only a type spelled the way a definition spells it', () => {
    for (const ok of ['hero', 'text', 'faqList', 'my-block', 'my_block', 'cta2']) expect(renderableBlockType(ok)).toBe(true)
    for (const bad of ['Link', 'Hero', '_hero', '-hero', 'hero_', 'hero-', 'a--b', '', 'a b', 1, null, undefined, {}]) expect(renderableBlockType(bad as any)).toBe(false)
  })
})

describe('who is told about a form submission', () => {
  // The recipients list moved from { address } to { email } in its version 2.
  const settings = Object.assign(defineSingleton('formSettings', {
    label: 'Forms', titleField: 'notifyTo',
    fields: { notifyTo: f.list({ version: 2, fields: { email: f.text() }, upgrade: ({ address, ...rest }) => ({ ...rest, email: address }) }) },
  } as any), { preset: 'formSettings' })
  it('reads the recipients through the upgrade, so a bump of the list version does not end the emails', () => {
    const row = { notifyTo: [{ id: 'a', type: 'item', address: 'old@example.com' }, { id: 'b', type: 'item', v: 2, email: 'new@example.com' }] }
    expect(listedRecipients(settings, row)).toEqual(['old@example.com', 'new@example.com'])
    expect(row.notifyTo[0]).toEqual({ id: 'a', type: 'item', address: 'old@example.com' }) // the stored row is as it was
    expect(listedRecipients(settings, undefined)).toEqual([]) // no settings row yet
  })
})

describe('the editor is told in its own language why a block was refused', () => {
  const t = (key: string, params?: Record<string, any>) => `${key}${params ? JSON.stringify(params) : ''}`
  const said = (r: any) => issuesOf(r).map((i) => cmsIssueMessage(i, null, t))
  const v1 = defineBlock({ label: 'Q', fields: { title: f.text() } })
  const boom = defineBlock({ label: 'B', version: 2, fields: { a: f.text() }, upgrade: () => { throw new Error('nope') } })

  it('has a message for every refusal blocksSchema makes about a block', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(said(blocksSchema({ boom }).safeParse([{ id: 'a', type: 'boom', old: 'x' }]))).toEqual(['validation.blockStale'])
    expect(said(blocksSchema({ boom }).safeParse([{ id: 'a', type: 'boom', v: 1 }]))).toEqual(['validation.blockOutOfDate'])
    expect(said(blocksSchema({ q: v1 }).safeParse([{ id: 'a', type: 'q', old: 1, older: 2 }]))).toEqual(['validation.blockUnknownFields{"keys":"old, older"}'])
    expect(said(blocksSchema({ q: v1 }).safeParse([{ id: 'a', type: 'video' }]))).toEqual(['validation.blockTypeGone'])
    expect(said(blocksSchema({ q: v1 }).safeParse([{ id: 'a', type: 'Q' }]))).toEqual(['validation.blockTypeGone'])
    expect(said(blocksSchema({ boom }).safeParse([{ id: 'a', type: 'boom', v: 9 }]))).toEqual(['validation.blockNewer'])
  })

  it('and those keys exist in the admin (Czech shown here; the translation spec keeps the three in step)', () => {
    for (const k of ['blockStale', 'blockOutOfDate', 'blockUnknownFields', 'blockTypeGone', 'blockNewer']) expect((cs as any).validation[k]).toBeTruthy()
  })
})

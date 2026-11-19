import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

// The parts of scripts/upgrade-check.mjs that are plain functions: how two recordings of a
// site are compared, how a documented difference is matched, and what is read from a checkout.
// The script itself (a real upgrade, ~1 minute) runs in CI as the `upgrade` job.
const site: any = await import('../../scripts/upgrade-check/site.mjs' as string)
const workspace: any = await import('../../scripts/upgrade-check/workspace.mjs' as string)
const root = new URL('../..', import.meta.url).pathname

describe('upgrade check: comparing recordings', () => {
  const before: any = { content: { page: { cs: { 'aaaaaaaa-0000-4000-8000-000000000001': { title: 'A', sections: [{ id: 'h', type: 'hero', heading: 'Hi' }] } } } } }

  it('finds nothing in equal recordings and names added, removed and changed fields', () => {
    expect(site.diff(before, structuredClone(before))).toEqual([])
    const after = structuredClone(before)
    const page = after.content.page.cs['aaaaaaaa-0000-4000-8000-000000000001']
    page.title = 'B'
    page.breadcrumbs = []
    delete page.sections[0].heading
    const found = site.diff(before, after).map((d: any) => `${d.kind} ${d.path}`).sort()
    expect(found).toEqual(['added content.page.cs.breadcrumbs', 'changed content.page.cs.title', 'removed content.page.cs.sections[].heading'])
  })

  it('leaves out ignored keys anywhere', () => {
    const after = structuredClone(before) as any
    after.content.page.cs['aaaaaaaa-0000-4000-8000-000000000001'].updatedAt = 'now'
    expect(site.diff(before, after, { ignoreKeys: ['updatedAt'] })).toEqual([])
    expect(site.diff(before, after)).toHaveLength(1)
  })

  it('allows a difference only when a documented rule with a reason covers it', () => {
    const after = structuredClone(before) as any
    after.content.page.cs['aaaaaaaa-0000-4000-8000-000000000001'].breadcrumbs = []
    after.content.page.cs['aaaaaaaa-0000-4000-8000-000000000001'].title = 'B'
    const differences = site.diff(before, after)
    const { allowed, unexpected } = site.applyRules(differences, [{ path: 'content.page.*.breadcrumbs', kind: 'added', why: 'page tree' }])
    expect(allowed.map((d: any) => [d.path, d.why])).toEqual([['content.page.cs.breadcrumbs', 'page tree']])
    expect(unexpected.map((d: any) => d.path)).toEqual(['content.page.cs.title'])
    // the kind has to match: a removal of the same field is not what the rule documents
    expect(site.applyRules(site.diff(after, before), [{ path: 'content.page.*.breadcrumbs', kind: 'added', why: 'x' }]).unexpected).toHaveLength(2)
    expect(() => site.applyRules(differences, [{ path: '**' }])).toThrow(/why/)
  })

  it('matches `**` across segments and array positions', () => {
    const d = [{ kind: 'added', path: 'admin.page.default.sections[].v', where: '', before: undefined, after: 1 }]
    expect(site.applyRules(d, [{ path: 'admin.**.v', kind: 'added', why: 'x' }]).allowed).toHaveLength(1)
    expect(site.applyRules(d, [{ path: 'content.**.v', why: 'x' }]).allowed).toHaveLength(0)
  })

  it('makes a valid PNG of the size asked for', () => {
    const bytes = Buffer.from(site.png(7, [10, 20, 30]))
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(bytes.readUInt32BE(16)).toBe(7) // IHDR width
    const idat = bytes.subarray(bytes.indexOf('IDAT') + 4, bytes.indexOf('IEND') - 4)
    expect(inflateSync(idat).length).toBe(7 * (1 + 7 * 3))
  })
})

describe('upgrade check: facts about a checkout', () => {
  it('reads the versions the lockfile resolved for the starter', () => {
    const pins = workspace.lockfileVersions(root, 'packages/cms/starter')
    expect(pins.nuxt).toMatch(/^4\.\d+\.\d+$/) // no peer suffix
    expect(pins.tinyzoo).toBeUndefined() // a workspace link, not a version
    expect(workspace.lockfileVersions(root, 'packages/nope')).toEqual({})
  })

  it('reads the workspace overrides', () => {
    expect(workspace.workspaceOverrides(root)).toMatchObject({ '@tiptap/core': expect.any(String), 'prosemirror-view': expect.any(String) })
  })

  it('picks the newest release tag, in either tag style', () => {
    expect(workspace.newestTag([])).toBeUndefined()
    expect(workspace.newestTag(['v0.2.0', 'v0.10.0', 'v0.9.1'])).toBe('v0.10.0')
    expect(workspace.newestTag(['v0.2.0', 'tinyzoo@0.3.0'])).toBe('tinyzoo@0.3.0')
    expect(workspace.newestTag(['v0.3.0-rc.1', 'v0.3.0'])).toBe('v0.3.0')
    expect(workspace.newestTag(['v0.3.0-rc.1', 'v0.2.9'])).toBe('v0.3.0-rc.1')
  })

  it('reads a baseline from npm', () => {
    expect(workspace.npmBaseline('npm:tinyzoo@0.2.0')).toEqual({ version: '0.2.0', tag: 'tinyzoo@0.2.0' })
    expect(workspace.npmBaseline('npm:tinyzoo@1.1.0-rc.1')).toEqual({ version: '1.1.0-rc.1', tag: 'tinyzoo@1.1.0-rc.1' })
    for (const ref of ['tinyzoo@0.2.0', 'npm:tinyzoo', 'npm:tinyzoo@^0.2.0', 'npm:other@0.2.0', '2506403', 'latest-tag']) expect(workspace.npmBaseline(ref)).toBeNull()
  })
})

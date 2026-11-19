import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { describe, expect, it } from 'vitest'
import { and, buildRegistry, defineEntity, defineSingleton, f } from 'tinyzoo'

// `mediaUsage()` lists where a file is used, with each entry's title. Changing a picture's alt
// text calls it to tell the website which live entries changed. A global with a picture field
// and no `titleField` (it is a single record, it needs no title) made it select `table[undefined]`,
// and drizzle threw "Cannot convert undefined or null to object": PATCH /api/cms/_media/:id → 500.

// Loaded by path: the file leans on Nitro's auto-imports, which are stood in for below.
const utils = join(import.meta.dirname, '../../packages/cms/server/utils')
const g = globalThis as any
g.accessWhere = () => ({ allowed: true, where: undefined })
g.unreadableFields = () => new Set()
g.both = (a: any, b: any) => (b ? (a ? and(a, b) : b) : a)
const { mediaUsage } = await import(/* @vite-ignore */ join(utils, 'cmsMediaGc.ts'))

// A real drizzle over a client that answers every query with the rows given: the select is
// built and its result mapped as against Postgres, so a missing column fails as it does there.
function fakeDb(rows: (sql: string) => any[]) {
  const sqls: string[] = []
  const client = {
    query: async (q: any) => {
      const text = typeof q === 'string' ? q : q.text
      sqls.push(text)
      const r = rows(text)
      // drizzle asks for arrays (rowMode 'array') when it maps selected fields.
      return { rows: q?.rowMode === 'array' ? r.map((o) => Object.values(o)) : r, rowCount: r.length }
    },
  }
  return { db: drizzle({ client: client as any }), sqls }
}

const MEDIA = '00000000-0000-4000-8000-0000000000aa'
const ROW = '00000000-0000-4000-8000-000000000001'

describe('mediaUsage()', () => {
  it('lists a global that holds the file when the global has no titleField', async () => {
    const Schedule = defineSingleton('schedule', {
      label: 'Schedule',
      fields: { intro: f.text(), poster: f.media({ accept: 'image/*' }).optional() },
    } as any)
    const reg = buildRegistry({ Schedule })
    const { db } = fakeDb((sql) => (sql.includes('"poster_id"') ? [{ id: ROW, title: null }] : []))
    const usage = await mediaUsage(db, reg, { id: 'system', role: 'admin' }, MEDIA, 'a.jpg')
    expect(usage).toEqual([{ entity: 'schedule', id: ROW, title: null, locale: null }])
  })

  it('lists an entry whose titleField is a picture (its column is <field>Id), without a title', async () => {
    const Photo = defineEntity('photo', {
      label: 'Photos',
      titleField: 'picture',
      fields: { picture: f.media({ accept: 'image/*' }) },
    })
    const reg = buildRegistry({ Photo })
    const { db } = fakeDb((sql) => (sql.includes('"picture_id"') ? [{ id: ROW, title: null }] : []))
    const usage = await mediaUsage(db, reg, { id: 'system', role: 'admin' }, MEDIA, 'a.jpg')
    expect(usage).toEqual([{ entity: 'photo', id: ROW, title: null, locale: null }])
  })

  it('still gives the title of an entry that has one', async () => {
    const Post = defineEntity('post', {
      label: 'Posts',
      titleField: 'title',
      fields: { title: f.text({ required: true }), cover: f.media().optional() },
    })
    const reg = buildRegistry({ Post })
    const { db } = fakeDb((sql) => (sql.includes('"cover_id"') ? [{ id: ROW, title: 'Hello' }] : []))
    const usage = await mediaUsage(db, reg, { id: 'system', role: 'admin' }, MEDIA, 'a.jpg')
    expect(usage).toEqual([{ entity: 'post', id: ROW, title: 'Hello', locale: null }])
  })
})

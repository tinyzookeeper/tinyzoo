import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { cmsAudit, cmsMedia, cmsTokens, cmsUsers } from '@my-cms/core'
import * as emitted from '../../playground/server/db/schema'

// The CMS's own tables exist twice: as runtime Drizzle tables and as source
// emitted into the host's schema.ts (what migrations are generated from). They
// must describe the same columns, or the server would query columns that the
// migrations never created.
const shape = (t: any) => {
  const c = getTableConfig(t)
  return {
    name: c.name,
    columns: c.columns.map((col) => [col.name, col.columnType, col.notNull, col.hasDefault]).sort(),
    indexes: c.indexes.map((i) => i.config.name).sort(),
    fks: c.foreignKeys.length,
  }
}

describe('system tables: runtime definition = emitted schema', () => {
  it.each([
    ['cms_media', cmsMedia, emitted.cmsMedia],
    ['cms_users', cmsUsers, emitted.cmsUsers],
    ['cms_tokens', cmsTokens, emitted.cmsTokens],
    ['cms_audit', cmsAudit, emitted.cmsAudit],
  ])('%s', (_, runtime, source) => {
    expect(shape(source)).toEqual(shape(runtime))
  })

  it('every entity table carries created_by / updated_by', () => {
    for (const t of [emitted.post, emitted.author, emitted.tag, emitted.siteSettings]) {
      const names = getTableConfig(t).columns.map((c) => c.name)
      expect(names).toEqual(expect.arrayContaining(['created_by', 'updated_by']))
    }
  })
})

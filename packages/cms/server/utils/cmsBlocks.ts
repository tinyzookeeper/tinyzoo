import { logUpgradeFailure, upgradeStoredRow } from 'tinyzoo'
import type { CmsEntity } from 'tinyzoo'
import type { ZodTypeAny } from 'zod'

/**
 * Stored JSON (blocks, lists, rich text) is brought to the current shape wherever it
 * is READ, so a deploy never has to rewrite it (`tinyzoo content:migrate` does that
 * when wanted). One place for every read site: the content API, the admin's form,
 * the search index, revisions. Mutates `row` (a fresh database row, or a copy) and
 * returns it.
 *
 * A block whose `upgrade` throws is logged once (entity, record, block id) and left
 * as stored. With `admin`, it is also flagged (`__upgradeFailed`) so the editor can
 * show it as needing attention instead of as a normal block, and every block and list
 * item carries its `v` (version 1 included), so the editor sends it back and a save
 * from an editor that is behind a deploy is recognised.
 */
export function upgradeStoredJson<R extends Record<string, any>>(e: CmsEntity, row: R, opts: { admin?: boolean; recordId?: string } = {}): R {
  const where = `${e.name} ${opts.recordId ?? row.id ?? ''}`.trim()
  return upgradeStoredRow(e.fields, row, {
    markFailed: !!opts.admin,
    stamp: !!opts.admin,
    where,
    onError: (issue) => logUpgradeFailure(issue, where),
  })
}

/** The same on a copy: a translation or revision row that must stay as loaded. */
export function upgradedCopy<R extends Record<string, any>>(e: CmsEntity, row: R, opts: { admin?: boolean; recordId?: string } = {}): R {
  return upgradeStoredJson(e, { ...row }, opts)
}

/**
 * The schema a write is checked with: `e.insertSchema` / `e.updateSchema`, with the
 * blocks and list fields told what the row holds now (`stored`: the raw row, or the
 * translation row for a translation; nothing for a new row). Blocks that are behind,
 * whose upgrade fails, or whose type is gone are only kept when they are stored
 * already — see `blocksSchema`.
 */
export function writeSchema(e: CmsEntity, mode: 'create' | 'update', stored?: Record<string, any> | null): ZodTypeAny {
  const base: any = mode === 'create' ? e.insertSchema : e.updateSchema
  const own: Record<string, ZodTypeAny> = {}
  for (const [key, fld] of Object.entries(e.fields)) {
    if (fld.type === 'blocks') own[key] = fld.zod(mode, { stored: stored?.[key] })
  }
  return Object.keys(own).length ? base.extend(own) : base
}

import { logUpgradeFailure, upgradeStoredRow } from 'tinyzoo'
import type { CmsEntity } from 'tinyzoo'

/**
 * Stored JSON (blocks, lists, rich text) is brought to the current shape wherever it
 * is READ, so a deploy never has to rewrite it (`tinyzoo content:migrate` does that
 * when wanted). One place for every read site: the content API, the admin's form,
 * the search index, revisions. Mutates `row` (a fresh database row, or a copy) and
 * returns it.
 *
 * A block whose `upgrade` throws is logged once (entity, record, block id) and left
 * as stored. With `admin`, it is also flagged (`__upgradeFailed`) so the editor can
 * show it as needing attention instead of as a normal block.
 */
export function upgradeStoredJson<R extends Record<string, any>>(e: CmsEntity, row: R, opts: { admin?: boolean; recordId?: string } = {}): R {
  const where = `${e.name} ${opts.recordId ?? row.id ?? ''}`.trim()
  return upgradeStoredRow(e.fields, row, {
    markFailed: !!opts.admin,
    where,
    onError: (issue) => logUpgradeFailure(issue, where),
  })
}

/** The same on a copy: a translation or revision row that must stay as loaded. */
export function upgradedCopy<R extends Record<string, any>>(e: CmsEntity, row: R, opts: { admin?: boolean; recordId?: string } = {}): R {
  return upgradeStoredJson(e, { ...row }, opts)
}

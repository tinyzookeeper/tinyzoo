import type { CmsEntity } from 'tinyzoo'
import { upgradedCopy } from '../../server/utils/cmsBlocks'

/**
 * The addresses listed in the Forms settings row (`notifyTo`, a list of `{ email }`),
 * read like every stored list: through its upgrade, so a new version of the list's
 * items cannot silently end the notifications. `row` is the stored row, as it is.
 */
export function listedRecipients(settings: CmsEntity, row: Record<string, any> | null | undefined): string[] {
  const read = row ? upgradedCopy(settings, row) : row
  return (Array.isArray(read?.notifyTo) ? read.notifyTo : []).map((i: any) => String(i?.email ?? '').trim()).filter(Boolean)
}

import { parseLinkRef } from 'tinyzoo'

// POST /api/cms/_links/resolve { refs: ['cms:page/…'], locale } — what the admin shows
// beside a stored link: the target's title, its address in the language being edited
// and whether it is live, a draft, gone or not readable by this person. Feeds the link
// fields, the rich-text link popover and the lists. Only what the signed-in user may read.
const MAX_REFS = 100

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const body = await readBody<{ refs?: unknown; locale?: unknown }>(event)
  const refs = [...new Set((Array.isArray(body?.refs) ? body.refs : []).filter((r): r is string => typeof r === 'string' && !!parseLinkRef(r)))].slice(0, MAX_REFS)
  const wanted = typeof body?.locale === 'string' ? body.locale : null
  const locale = reg.locales ? (wanted && reg.locales.locales.includes(wanted) ? wanted : reg.locales.default) : null
  return { locale, items: await describeLinkRefs(db, reg, user, refs, locale) }
})

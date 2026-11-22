import { z } from 'zod'
import { slugProblem } from '#shared/slug'
import { templateById } from '#shared/templates'

// Make a website: a template, a name and an address. It is made in the background; the
// answer is the site as it is now (its page shows the steps).
const input = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().max(80),
  template: z.string().max(40),
})

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const data = await readInput(event, input)
  if (tooManyAttempts(`create:${me.id}`, 10, 60 * 60_000)) throw fail(429, 'tooMany', 'Too many attempts, try again later')
  const template = templateById(data.template)
  if (!template?.ready) throw fail(422, 'template.unavailable', 'This template is not available')
  const problem = slugProblem(data.slug)
  if (problem) throw fail(422, `slug.${problem}`, 'This address cannot be used')
  const max = maxSitesPerUser()
  if (await siteCount(me.id) >= max) throw fail(403, 'sites.limit', `An account can have ${max} websites`, { max })
  if (await slugTaken(data.slug)) throw fail(409, 'slug.taken', 'This address is taken')
  const row = await createSite(me, { name: data.name, slug: data.slug, template: template.id })
  setResponseStatus(event, 201)
  return { site: toSiteView(row) }
})

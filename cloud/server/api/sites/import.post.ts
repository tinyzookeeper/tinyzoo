import { slugProblem } from '#shared/slug'
import { lookOf, templateById } from '#shared/templates'
import { importProblem } from '#shared/transfer'
import { hostingDriverName } from '../../hosting'
import { sharedBuildVersion } from '../../hosting/shared'

// POST /api/sites/import?slug=<address>&name=<name>: move a website in. The body is the
// archive itself (`tinyzoo backup` with the `site.json` an export adds), sent as
// application/x-tar: not a form, so no other website can make a browser send it
// (server/middleware/csrf.ts). It is streamed into a file of the cloud's own, limited in
// size, looked at, and then becomes a new website of the archive's template, owned by
// whoever brought it. Refused in plain words: a template that is not here, an archive of a
// newer tinyzoo than the template runs on, an address that is taken.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  if (tooManyAttempts(`import:${me.id}`, 12, 60 * 60_000)) throw fail(429, 'tooMany', 'Too many attempts, try again later')
  if (hostingDriverName() !== 'shared') throw fail(409, 'import.unavailable', 'Websites cannot be moved in here')
  const query = getQuery(event)
  const slug = String(query.slug ?? '').slice(0, 80)
  const problem = slugProblem(slug)
  if (problem) throw fail(422, `slug.${problem}`, 'This address cannot be used', { field: 'slug' })
  const max = maxSitesPerUser()
  if (await siteCount(me.id) >= max) throw fail(403, 'sites.limit', `An account can have ${max} websites`, { max })
  if (await slugTaken(slug)) throw fail(409, 'slug.taken', 'This address is taken', { field: 'slug' })

  const archive = await receiveArchive(event)
  try {
    const found = await inspectArchive(archive)
    const template = found.site ? templateById(found.site.template) : undefined
    const buildVersion = template?.ready ? sharedBuildVersion(template) : ''
    const refused = importProblem({ site: found.site, manifest: found.manifest, templateReady: !!template?.ready && !!buildVersion, buildVersion })
    if (refused === 'archive') throw fail(422, 'import.archive', 'This is not an archive of a tinyzoo website')
    if (refused === 'template') throw fail(422, 'import.template', 'The template of this website is not available here', { template: found.site!.template })
    if (refused === 'newer') throw fail(422, 'import.newer', 'This website ran on a newer tinyzoo than the one here', { theirs: found.manifest!.tinyzooVersion, ours: buildVersion })
    // The address may have been taken while the archive was on its way.
    if (await slugTaken(slug)) throw fail(409, 'slug.taken', 'This address is taken', { field: 'slug' })
    const from = found.site!
    const name = String(query.name ?? '').trim().slice(0, 80) || from.name || slug
    const row = await createImportedSite(me, { name, slug, template: template!.id, look: lookOf(template!, from.look)?.id ?? null, archive, from })
    setResponseStatus(event, 201)
    return { site: toSiteView(row) }
  }
  catch (err) {
    discardUpload(archive)
    throw err
  }
})

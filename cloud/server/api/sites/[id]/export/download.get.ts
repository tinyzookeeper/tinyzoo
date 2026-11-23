import { createReadStream, statSync } from 'node:fs'
import { basename } from 'node:path'

// The website's archive, for its owner and nobody else (anybody else gets the same 404 as for
// a website that does not exist). Streamed from the website's own folder; it has no public address.
export default defineEventHandler(async (event) => {
  const { site } = await requireOwnSite(event)
  const path = archivePathOf(site)
  if (!path) throw fail(404, 'move.noArchive', 'There is no archive of this website')
  setResponseHeader(event, 'content-type', 'application/x-tar')
  setResponseHeader(event, 'content-length', statSync(path).size)
  setResponseHeader(event, 'content-disposition', `attachment; filename="${basename(path)}"`)
  setResponseHeader(event, 'cache-control', 'private, no-store')
  setResponseHeader(event, 'x-content-type-options', 'nosniff')
  return sendStream(event, createReadStream(path))
})

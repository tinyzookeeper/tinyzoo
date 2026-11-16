import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

// GET /api/cms/_media/raw/** — serve an uploaded file. Public on purpose: media behave
// like CDN assets (the frontend renders them in <img>). But only files the CMS itself
// stored: a key without a cms_media row (an object some other tool put in a shared
// bucket, a path that merely exists) is a 404 — see cmsMediaKeys.ts.
//
//  - local driver: streams the file from disk;
//  - S3 with delivery 'proxy' (the default for a private bucket): streams the object from
//    the bucket — never held in memory, so a video larger than the pod's RAM is fine;
//  - S3 with delivery 'redirect': 302 to a signed address that lives five minutes (made
//    per request, never stored);
//  - S3 with delivery 'public': new files are stored under the bucket's own address and
//    this route is not used for them; it still serves the app paths of rows made before
//    a switch (a site that moved from the local driver).
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')
  if (!key) throw createError({ statusCode: 400, statusMessage: 'Missing key' })

  const media = await servedMedia(key)
  if (!media) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  // A PDF opened in the browser's viewer and saved from there should carry its name,
  // not the uuid of its key.
  const disposition = contentDispositionFor(media)

  const storage = useCmsStorage()

  if (storage.delivery === 'redirect' && storage.presign) {
    let address: string
    try {
      address = await storage.presign(key, PRESIGN_SECONDS, disposition)
    }
    catch (err: any) {
      if (err?.statusCode) throw err
      throw createError({ statusCode: 502, statusMessage: 'Media storage is not available', cause: new Error('Could not sign an address') })
    }
    // The browser may keep the redirect for less time than the address lives.
    setResponseHeader(event, 'Cache-Control', 'private, max-age=' + REDIRECT_CACHE_SECONDS)
    return sendRedirect(event, address, 302)
  }

  const obj = await storage.read(key, {
    range: String(getRequestHeader(event, 'range') ?? '') || undefined,
    ifNoneMatch: String(getRequestHeader(event, 'if-none-match') ?? '') || undefined,
  })
  if (!obj) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  setResponseHeader(event, 'Content-Type', obj.contentType)
  // Defense in depth against a hostile blob that slipped the upload allowlist:
  // never sniff a different type, and neutralize any inline script execution.
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Content-Security-Policy', "default-src 'none'; sandbox")
  setResponseHeader(event, 'Content-Disposition', disposition)
  // Byte ranges: Safari will not play a video without them, and every browser seeks
  // and resumes with them. One range only (bytes=a-b, a-, -n); others get the whole file.
  setResponseHeader(event, 'Accept-Ranges', 'bytes')
  if (obj.etag) setResponseHeader(event, 'ETag', obj.etag)
  if (obj.lastModified) setResponseHeader(event, 'Last-Modified', obj.lastModified)

  if (obj.status === 416) {
    if (obj.contentRange) setResponseHeader(event, 'Content-Range', obj.contentRange)
    throw createError({ statusCode: 416, statusMessage: 'Range not satisfiable' })
  }
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setResponseStatus(event, obj.status)
  if (obj.status === 304 || !obj.body) return null
  if (obj.status === 206 && obj.contentRange) setResponseHeader(event, 'Content-Range', obj.contentRange)
  if (obj.contentLength !== undefined) setResponseHeader(event, 'Content-Length', obj.contentLength)
  if (event.method === 'HEAD') {
    await obj.body.cancel().catch(() => {})
    return ''
  }

  // A Node pipeline, not h3's stream helper: it waits for the socket to drain (a slow
  // phone does not make the pod buffer the video) and, when the visitor leaves, cancels
  // the read from the bucket or the disk.
  try {
    await pipeline(Readable.fromWeb(obj.body as any), event.node.res)
  }
  catch (err: any) {
    // A visitor who closes the tab ends the pipeline early: not an error.
    if (err?.code !== 'ERR_STREAM_PREMATURE_CLOSE') console.error('[cms] a file could not be streamed', scrubError(err))
  }
})

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { ConnectionTest } from '#keeper/types/keeper'

// Try an address (and a token) before saving: does it answer, and can the status be read?
const input = z.object({ url: z.string().max(500), token: z.string().max(500).optional(), siteId: z.string().uuid().optional() })

export default defineEventHandler(async (event): Promise<ConnectionTest> => {
  const me = await requireAccess(event)
  if (!me.memberships.some((m) => canWriteIn(me, m))) throw createError({ statusCode: 403, statusMessage: 'Only people who can add sites can test them' })
  const data = await readInput(event, input)
  const url = normalizeUrl(data.url)
  if (!url) throw createError({ statusCode: 422, statusMessage: 'url: Not a web address' })
  // On the edit form an empty token field means the stored one.
  let token = data.token || null
  if (!token && data.siteId) {
    const [site] = await useDb().select({ tokenEnc: schema.sites.tokenEnc }).from(schema.sites)
      .where(and(eq(schema.sites.id, data.siteId), visibleSites(me)))
    token = decryptSecret(site?.tokenEnc)
  }
  const ready = await probeReady(url)
  const status = token ? await probeStatus(url, token) : null
  return {
    reachable: ready.code !== null,
    responseMs: ready.ms,
    ready: ready.ok ? 'Ready' : (ready.error ?? 'Not ready'),
    status: status ? ('status' in status ? { ok: true, version: status.status.tinyzoo } : { ok: false, error: status.error }) : null,
  }
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { scratchDatabase, type SpawnedServer, startServer } from '../helpers/server'

// The OpenAPI document's `servers[].url`: `cms.content.publicUrl` when set, otherwise `cms.publicUrl`
// (so a site that set one address for emails and the sitemap does not need a second for the spec),
// otherwise relative. Never the request's Host. Own servers: the document is built once per process.
let db: Awaited<ReturnType<typeof scratchDatabase>>
const servers: SpawnedServer[] = []
const start = async (env: Record<string, string>) => {
  const s = await startServer(db.url, env)
  servers.push(s)
  return s
}
const serversOf = async (s: SpawnedServer) => ((await (await fetch(s.baseURL + '/api/openapi.json')).json()) as { servers: { url: string }[] }).servers

beforeAll(async () => { db = await scratchDatabase('apirefine') }, 60_000)
afterAll(async () => { await Promise.all(servers.map((s) => s.stop())); await db?.drop() })

describe('the OpenAPI server address', () => {
  it('is relative when no address is configured', async () => {
    expect(await serversOf(await start({ NUXT_CMS_PUBLIC_URL: '', NUXT_CMS_CONTENT_PUBLIC_URL: '' }))).toEqual([{ url: '/' }])
  }, 120_000)

  it('falls back to cms.publicUrl when cms.content.publicUrl is empty', async () => {
    expect(await serversOf(await start({ NUXT_CMS_PUBLIC_URL: 'https://www.example.cz', NUXT_CMS_CONTENT_PUBLIC_URL: '' }))).toEqual([{ url: 'https://www.example.cz' }])
  }, 120_000)

  it('prefers cms.content.publicUrl when both are set', async () => {
    expect(await serversOf(await start({ NUXT_CMS_PUBLIC_URL: 'https://www.example.cz', NUXT_CMS_CONTENT_PUBLIC_URL: 'https://cms.example.cz' }))).toEqual([{ url: 'https://cms.example.cz' }])
  }, 120_000)
})

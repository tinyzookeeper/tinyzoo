import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client, doc } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'
import { scratchDatabase, type SpawnedServer, startServer } from '../helpers/server'

// A site with NUXT_CMS_CONTENT_TOKEN set: the website's own server-side requests (its pages
// fetching /api/content/* while they render) work with no token in sight; anyone else
// asking from outside still needs it, and it never reaches a browser.
const TOKEN = 'content-token-that-must-never-leak-0123456789'
const SETUP = 'token-setup'
let db: Awaited<ReturnType<typeof scratchDatabase>>
let server: SpawnedServer
let admin: Client

beforeAll(async () => {
  db = await scratchDatabase('contenttoken')
  server = await startServer(db.url, { NUXT_CMS_CONTENT_TOKEN: TOKEN, NUXT_CMS_AUTH_SETUP_TOKEN: SETUP })
  admin = new Client(server.baseURL)
  expect((await admin.post('/api/cms/_auth/setup', { name: 'Ada Admin', email: 'ada@example.com', password: 'correct horse battery', token: SETUP })).status).toBe(201)
  const author = await createAuthor(admin)
  await createPost(admin, { author: author.id, slug: 'zebra-v-tokenu', title: 'Zebra v tokenu', status: 'published', body: doc('Text zebry') })
}, 120_000)
afterAll(async () => { await server?.stop(); await db?.drop() })

const outside = (path: string, headers: Record<string, string> = {}) => fetch(server.baseURL + path, { headers })

describe('content token and the website itself', () => {
  it("the site's pages render their content — fetched in-process during server rendering, without the token", async () => {
    const res = await outside('/blog')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Zebra v tokenu')
    expect(html).not.toContain('No published posts yet')
    const page = await (await outside('/blog/zebra-v-tokenu')).text()
    expect(page).toContain('Zebra v tokenu')
  })

  it('the token never appears in a page, its data payload or a response header', async () => {
    for (const path of ['/blog', '/blog/zebra-v-tokenu', '/', '/_nuxt/builds/latest.json']) {
      const res = await outside(path)
      const text = await res.text()
      expect(text, path).not.toContain(TOKEN)
      const headers: string[] = []
      res.headers.forEach((value, name) => headers.push(`${name}: ${value}`))
      expect(headers.join('\n'), path).not.toContain(TOKEN)
    }
  })

  it('an outside request without the token is refused, with it is served, with a wrong one is refused', async () => {
    expect((await outside('/api/content/post')).status).toBe(401)
    expect((await outside('/api/content/post/zebra-v-tokenu')).status).toBe(401)
    expect((await outside('/api/content/_global/siteSettings')).status).toBe(401)
    expect((await outside('/api/content/post', { 'x-api-key': 'wrong' })).status).toBe(401)
    const ok = await outside('/api/content/post', { 'x-api-key': TOKEN })
    expect(ok.status).toBe(200)
    expect((await ok.json()).items.map((i: any) => i.slug)).toEqual(['zebra-v-tokenu'])
    expect((await outside('/api/content/post', { authorization: 'Bearer ' + TOKEN })).status).toBe(200)
  })

  it('cannot be tricked into trusting an outside request: headers a proxy or a client sets mean nothing', async () => {
    const forged = { 'x-forwarded-for': '127.0.0.1', 'x-real-ip': '127.0.0.1', host: 'localhost', 'x-nitro-internal': '1', 'x-cms-internal': '1', 'x-unenv': '1' }
    expect((await outside('/api/content/post', forged)).status).toBe(401)
  })

  it('preview of drafts still needs the token or a session — rendering a page in-process does not unlock it', async () => {
    const author = await createAuthor(admin)
    await createPost(admin, { author: author.id, slug: 'koncept-v-tokenu', title: 'Koncept v tokenu', status: 'draft', body: doc('x') })
    expect((await outside('/api/content/post/koncept-v-tokenu?preview')).status).toBe(401)
    expect(await (await outside('/blog?preview')).text()).not.toContain('Koncept v tokenu')
  })

  it('says once in the log that requests were refused for the token, with what to do', async () => {
    for (let i = 0; i < 5; i++) await outside('/api/content/post')
    await server.waitForLog(/content token/i)
    const lines = server.logs.join('').split('\n').filter((l) => /content token/i.test(l) && /refused/i.test(l))
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('NUXT_CMS_CONTENT_TOKEN')
  })
})

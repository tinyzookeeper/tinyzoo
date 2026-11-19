import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { Client as McpClient, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { anonymous, type Client, newAccount, PNG_1x1, signIn, testDb } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

// The MCP server at /api/mcp with personal access tokens (tzp_…): made on the account page,
// shown once, acting as their person with the rights they were given, through the admin's own
// routes. Real MCP calls with the SDK's client.

type Rights = { write: boolean; publish: boolean; delete: boolean; media: boolean; entities: string[] | null }
const READ: Rights = { write: false, publish: false, delete: false, media: false, entities: null }
const ALL: Rights = { write: true, publish: true, delete: true, media: true, entities: null }

let admin: Client
let editor: Client
let author: Client
const db = testDb()
const clients: McpClient[] = []
let ip = 0

async function makeToken(c: Client, rights: Rights, name = 'Test token') {
  const res = await c.post('/api/cms/_auth/tokens', { name, rights, expiresInDays: null })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body as { token: { id: string; prefix: string; rights: Rights }; value: string }
}

async function connect(token: string) {
  const client = new McpClient({ name: 'tinyzoo-test', version: '1' })
  const headers = { 'authorization': `Bearer ${token}`, 'x-forwarded-for': `198.19.7.${++ip}` }
  await client.connect(new StreamableHTTPClientTransport(new URL(`${inject('baseURL')}/api/mcp`), { requestInit: { headers } }))
  clients.push(client)
  return client
}

async function tool(client: McpClient, name: string, args: Record<string, unknown> = {}) {
  const res: any = await client.callTool({ name, arguments: args })
  const text = res.content?.[0]?.text ?? ''
  let body: any = text
  try { body = JSON.parse(text) }
  catch { /* an error message */ }
  return { error: !!res.isError, body, text }
}

const rpc = (headers: Record<string, string>, method = 'POST') => fetch(`${inject('baseURL')}/api/mcp`, {
  method,
  headers: { 'content-type': 'application/json', 'accept': 'application/json, text/event-stream', 'x-forwarded-for': `198.19.8.${++ip}`, ...headers },
  body: method === 'POST' ? JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) : undefined,
})

let authorId: string
beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
  author = await signIn('author')
  authorId = (await createAuthor(admin)).id
})
afterAll(async () => {
  await Promise.all(clients.map((c) => c.close().catch(() => {})))
  await db.end()
})

describe('making tokens', () => {
  it('shows the token once and keeps only its hash', async () => {
    const made = await makeToken(editor, READ, 'Laptop')
    expect(made.value).toMatch(/^tzp_[\w-]{43}$/)
    expect(made.value.startsWith(made.token.prefix)).toBe(true)
    const list = await editor.get('/api/cms/_auth/tokens')
    expect(list.status).toBe(200)
    expect(JSON.stringify(list.body)).not.toContain(made.value)
    expect(list.body.tokens.map((t: any) => t.name)).toContain('Laptop')
    const { rows } = await db.query('select token_hash from cms_access_tokens where id = $1', [made.token.id])
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/)
    // Another person does not see it.
    expect((await author.get('/api/cms/_auth/tokens')).body.tokens.map((t: any) => t.id)).not.toContain(made.token.id)
  })

  it('never gives a token more than the role: an author cannot publish, rights need write', async () => {
    const made = await makeToken(author, ALL)
    expect(made.token.rights).toMatchObject({ write: true, publish: false, delete: true })
    const ro = await makeToken(editor, { write: false, publish: true, delete: true, media: true, entities: null })
    expect(ro.token.rights).toEqual(READ)
    expect((await editor.post('/api/cms/_auth/tokens', { name: 'x', rights: { ...READ, entities: ['nope'] }, expiresInDays: null })).status).toBe(422)
  })

  it('is for signed-in people only, and a token cannot make tokens', async () => {
    expect((await anonymous().get('/api/cms/_auth/tokens')).status).toBe(401)
    const made = await makeToken(editor, ALL)
    const res = await anonymous().request('GET', '/api/cms/_auth/tokens', { headers: { authorization: `Bearer ${made.value}` } })
    expect(res.status).toBe(401)
  })

  it('revokes a token at once', async () => {
    const made = await makeToken(editor, READ)
    const client = await connect(made.value)
    expect((await tool(client, 'describe_site')).error).toBe(false)
    expect((await editor.delete(`/api/cms/_auth/tokens/${made.token.id}`)).status).toBe(200)
    expect((await rpc({ authorization: `Bearer ${made.value}` })).status).toBe(401)
    // Not someone else's.
    const other = await makeToken(editor, READ)
    expect((await author.delete(`/api/cms/_auth/tokens/${other.token.id}`)).status).toBe(404)
  })
})

describe('/api/mcp', () => {
  it('takes only a token', async () => {
    const none = await rpc({})
    expect(none.status).toBe(401)
    expect(none.headers.get('www-authenticate')).toMatch(/^Bearer/)
    expect((await rpc({ authorization: 'Bearer tzp_wrong' })).status).toBe(401)
    // The admin's session cookie is not a way in.
    const cookie = await fetch(`${inject('baseURL')}/api/mcp`, { method: 'POST', headers: { 'cookie': admin.cookie, 'content-type': 'application/json', 'accept': 'application/json, text/event-stream' }, body: '{}' })
    expect(cookie.status).toBe(401)
    expect((await rpc({}, 'GET')).status).toBe(405)
  })

  it('stops working when the token expires or its person is disabled', async () => {
    const someone = await newAccount('editor')
    const made = await makeToken(someone.client, READ)
    expect((await rpc({ authorization: `Bearer ${made.value}` })).status).toBe(200)
    await db.query(`update cms_access_tokens set expires_at = now() - interval '1 minute' where id = $1`, [made.token.id])
    expect((await rpc({ authorization: `Bearer ${made.value}` })).status).toBe(401)
    await db.query('update cms_access_tokens set expires_at = null where id = $1', [made.token.id])
    expect((await admin.patch(`/api/cms/_users/${someone.id}`, { status: 'disabled' })).status).toBe(200)
    expect((await rpc({ authorization: `Bearer ${made.value}` })).status).toBe(401)
  })

  it('refuses the internal header from outside', async () => {
    const res = await anonymous().request('GET', '/api/cms/post', { headers: { 'x-tinyzoo-mcp': 'guess.00000000-0000-0000-0000-000000000000' } })
    expect(res.status).toBe(401)
  })
})

describe('the tools', () => {
  it('lists its tools and describes the site', async () => {
    const client = await connect((await makeToken(editor, READ)).value)
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(['describe_site', 'list_entries', 'get_entry', 'create_entry', 'publish_entry', 'update_global', 'upload_media']))
    const site = (await tool(client, 'describe_site')).body
    expect(site.languages).toEqual({ default: 'cs', all: ['cs', 'en'] })
    expect(site.token).toMatchObject({ write: false })
    const post = site.areas.find((a: any) => a.name === 'post')
    expect(post).toMatchObject({ kind: 'collection', publish: { field: 'status', published: 'published', draft: 'draft' } })
    expect(post.fields.body).toMatchObject({ type: 'richtext', localized: true })
    const shape = (await tool(client, 'describe_collection', { name: 'post' })).body
    expect(shape.schema.properties).toHaveProperty('title')
  })

  it('a read-only token reads and is refused every write', async () => {
    const post = await createPost(editor, { author: authorId, title: 'MCP read zebra' })
    const client = await connect((await makeToken(editor, READ)).value)
    const got = await tool(client, 'get_entry', { collection: 'post', id: post.id })
    expect(got.body.entry.title).toBe('MCP read zebra')
    const listed = await tool(client, 'list_entries', { collection: 'post', q: 'read zebra' })
    expect(listed.body.entries.map((e: any) => e.id)).toContain(post.id)
    const refused = await tool(client, 'create_entry', { collection: 'tag', data: { name: 'x', slug: 'x' } })
    expect(refused.error).toBe(true)
    expect(refused.text).toMatch(/only reads/)
  })

  it('writes drafts with Markdown, as its person, recorded as done through MCP', async () => {
    const made = await makeToken(editor, { ...READ, write: true })
    const client = await connect(made.value)
    const created = await tool(client, 'create_entry', {
      collection: 'post',
      data: { title: 'Written over MCP', slug: `mcp-${Date.now()}`, author: authorId, body: '## Hello\n\nSome **bold** text and a [link](https://example.com).\n\n- one\n- two' },
    })
    expect(created.error, created.text).toBe(false)
    expect(created.body.created.status).toBe('draft')
    const id = created.body.created.id
    const md = await tool(client, 'get_entry', { collection: 'post', id, richText: 'markdown' })
    expect(md.body.entry.body).toBe('## Hello\n\nSome **bold** text and a [link](https://example.com).\n\n- one\n- two')
    // Publishing was not given.
    const pub = await tool(client, 'publish_entry', { collection: 'post', id })
    expect(pub.error).toBe(true)
    // Nor deleting.
    expect((await tool(client, 'delete_entry', { collection: 'post', id })).error).toBe(true)
    const { rows } = await db.query(`select user_id, meta from cms_audit where action = 'entry.create' and record_id = $1`, [id])
    expect(rows[0].meta).toMatchObject({ via: 'mcp', tokenId: made.token.id })
    const [{ updated_by }] = (await db.query('select updated_by from post where id = $1', [id])).rows
    expect(rows[0].user_id).toBe(updated_by)
  })

  it('publishes, translates and deletes with the rights to', async () => {
    const client = await connect((await makeToken(editor, ALL)).value)
    const post = await createPost(editor, { author: authorId, title: 'MCP publish zebra' })
    expect((await tool(client, 'publish_entry', { collection: 'post', id: post.id })).body.published.status).toBe('published')
    const tr = await tool(client, 'update_entry', { collection: 'post', id: post.id, locale: 'en', data: { title: 'MCP publish zebra (en)' } })
    expect(tr.error, tr.text).toBe(false)
    expect((await tool(client, 'get_entry', { collection: 'post', id: post.id, locale: 'en' })).body.entry.title).toBe('MCP publish zebra (en)')
    expect((await tool(client, 'unpublish_entry', { collection: 'post', id: post.id })).body.unpublished.status).toBe('draft')
    expect((await tool(client, 'delete_entry', { collection: 'post', id: post.id })).error).toBe(false)
    expect((await editor.get(`/api/cms/post/${post.id}`)).status).toBe(404)
  })

  it('reaches only the collections it was given', async () => {
    const client = await connect((await makeToken(editor, { ...ALL, entities: ['tag'] })).value)
    expect((await tool(client, 'list_entries', { collection: 'tag' })).error).toBe(false)
    const posts = await tool(client, 'list_entries', { collection: 'post' })
    expect(posts.error).toBe(true)
    const site = (await tool(client, 'describe_site')).body
    expect(site.areas.map((a: any) => a.name)).toEqual(['tag'])
  })

  it('changes some fields of a global and keeps the rest; a global is live, so that is publishing', async () => {
    expect((await editor.put('/api/cms/_singleton/siteSettings', { siteName: 'Zebra site', tagline: 'Before' })).status).toBe(200)
    const drafts = await connect((await makeToken(editor, { ...READ, write: true })).value)
    expect((await tool(drafts, 'update_global', { name: 'siteSettings', data: { tagline: 'After' } })).error).toBe(true)
    const client = await connect((await makeToken(editor, { ...READ, write: true, publish: true })).value)
    const res = await tool(client, 'update_global', { name: 'siteSettings', data: { tagline: 'After' } })
    expect(res.error, res.text).toBe(false)
    const now = (await editor.get('/api/cms/_singleton/siteSettings')).body.row
    expect(now).toMatchObject({ siteName: 'Zebra site', tagline: 'After' })
  })

  it('uploads a file only with the right to', async () => {
    const without = await connect((await makeToken(editor, { ...READ, write: true })).value)
    const file = { filename: 'dot.png', base64: Buffer.from(PNG_1x1).toString('base64'), alt: 'A dot' }
    expect((await tool(without, 'upload_media', file)).error).toBe(true)
    const withMedia = await connect((await makeToken(editor, { ...READ, write: true, media: true })).value)
    const up = await tool(withMedia, 'upload_media', file)
    expect(up.error, up.text).toBe(false)
    expect(up.body.uploaded).toMatchObject({ mime: 'image/png', width: 1, height: 1 })
    const listed = await tool(withMedia, 'list_media', { q: 'A dot' })
    expect(listed.body.files.map((f: any) => f.id)).toContain(up.body.uploaded.id)
  })
})

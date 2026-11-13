import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type Client, DEMO, signIn, testDb, truncateAll } from '../helpers/api'
import { createAuthor, createPost } from '../helpers/fixtures'

// The playground's Post rule: admins update anything, others only rows whose
// author id equals their user id (row-level, AND-ed into the query).
const db = testDb()
let admin: Client
let editor: Client

beforeAll(async () => {
  admin = await signIn('admin')
  editor = await signIn('editor')
})
beforeEach(() => truncateAll(db))
afterAll(() => db.end())

async function editorsOwnAuthor() {
  // An author row whose id is the editor's user id, so the row-level rule matches.
  await db.query('insert into author (id, name, email) values ($1, $2, $3)', [DEMO.editor.id, 'Edie', 'edie@example.com'])
  return DEMO.editor.id
}

describe('row-level access', () => {
  it('lets an editor update their own post', async () => {
    const post = await createPost(admin, { author: await editorsOwnAuthor() })
    const res = await editor.patch(`/api/cms/post/${post.id}`, { title: 'Mine' })
    expect(res.status).toBe(200)
    expect(res.body.row.title).toBe('Mine')
  })

  it("hides someone else's post from an editor's update as 404, and changes nothing", async () => {
    const other = await createAuthor(admin)
    const post = await createPost(admin, { author: other.id, title: 'Theirs' })
    const res = await editor.patch(`/api/cms/post/${post.id}`, { title: 'Hijacked' })
    expect(res.status).toBe(404)
    const { rows } = await db.query('select title from post where id = $1', [post.id])
    expect(rows[0].title).toBe('Theirs')
  })

  it('lets an admin update any post', async () => {
    const post = await createPost(admin, { author: await editorsOwnAuthor() })
    expect((await admin.patch(`/api/cms/post/${post.id}`, { title: 'Admin edit' })).status).toBe(200)
  })

  it('reports the permission in the graph', async () => {
    const graph = (await editor.get('/api/cms/_graph')).body
    // The rule returns a row condition for editors, so update is allowed in principle.
    expect(graph.find((g: any) => g.name === 'post').can.update).toBe(true)
  })
})

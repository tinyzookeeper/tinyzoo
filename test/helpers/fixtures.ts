import type { Client } from './api'
import { doc } from './api'

let n = 0
const uniq = () => `${Date.now().toString(36)}${(n++).toString(36)}`

export async function createAuthor(c: Client, over: Record<string, unknown> = {}) {
  const id = uniq()
  const res = await c.post('/api/cms/author', { name: `Author ${id}`, email: `a-${id}@example.com`, ...over })
  if (res.status !== 201) throw new Error(`createAuthor: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body.row
}

export async function createTag(c: Client, over: Record<string, unknown> = {}) {
  const id = uniq()
  const res = await c.post('/api/cms/tag', { name: `Tag ${id}`, slug: `tag-${id}`, ...over })
  if (res.status !== 201) throw new Error(`createTag: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body.row
}

export async function createPost(c: Client, over: Record<string, unknown> & { author: string }) {
  const id = uniq()
  const res = await c.post('/api/cms/post', { title: `Post ${id}`, slug: `post-${id}`, body: doc('Hello'), ...over })
  if (res.status !== 201) throw new Error(`createPost: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body.row
}

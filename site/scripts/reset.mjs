// Put a site back to its seeded state: delete every entry and every media file
// through the admin API, then run the seed again. Accounts stay (the demo account
// repairs itself on its next sign-in). For the public demo, run it every night:
//
//   SEED_URL=https://demo.example SEED_EMAIL=… SEED_PASSWORD=… node scripts/reset.mjs
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = (process.env.SEED_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
const email = process.env.SEED_EMAIL ?? 'admin@example.com'
const password = process.env.SEED_PASSWORD
if (!password) { console.error('Set SEED_PASSWORD (and SEED_EMAIL) for an administrator.'); process.exit(2) }

let cookie = ''
async function req(method, path, body) {
  const headers = { accept: 'application/json', origin: base }
  if (cookie) headers.cookie = cookie
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
  const set = res.headers.getSetCookie(); if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ')
  const text = await res.text(); let json = text; try { json = JSON.parse(text) } catch {}
  return { status: res.status, body: json }
}

const status = (await req('GET', '/api/cms/_auth/status')).body
if (!status?.needsSetup) {
  const login = await req('POST', '/api/cms/_auth/login', { email, password })
  if (login.status !== 200) { console.error('Sign-in failed:', login.status); process.exit(1) }
  const graph = (await req('GET', '/api/cms/_graph')).body
  let removed = 0
  for (const e of Array.isArray(graph) ? graph : []) {
    if (e.singleton) continue // settings are overwritten by the seed
    for (let guard = 0; guard < 200; guard++) {
      const { body } = await req('GET', `/api/cms/${e.name}?limit=100`)
      const rows = body?.rows ?? []
      if (!rows.length) break
      for (const r of rows) { if ((await req('DELETE', `/api/cms/${e.name}/${r.id}`)).status < 300) removed++ }
    }
  }
  // Files: everything left once no entry uses them.
  for (let guard = 0; guard < 200; guard++) {
    const { body } = await req('GET', '/api/cms/_media?limit=60')
    const items = body?.items ?? []
    if (!items.length) break
    let gone = 0
    for (const m of items) { if ((await req('DELETE', `/api/cms/_media/${m.id}`)).status < 300) { gone++; removed++ } }
    if (!gone) break // the rest is still in use somewhere
  }
  console.log(`✓ cleared ${removed} entries and files`)
}

const seed = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'seed.mjs')], { stdio: 'inherit', env: process.env })
process.exit(seed.status ?? 1)

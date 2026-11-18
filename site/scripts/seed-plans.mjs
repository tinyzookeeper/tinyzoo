// Fill the Plan collection (the "Plány" page) of a running site, only when it is empty:
// a site whose editors already have plans keeps them. For a site seeded before the
// collection existed, such as the live website after the deploy that added it:
//
//   SEED_URL=https://tinyzoo.pushbase.app SEED_EMAIL=… SEED_PASSWORD=… pnpm seed:plans
//
// It signs in as an existing administrator and touches nothing but the plans.
// `pnpm seed` does the same as part of a full seed.
import { seedPlans } from '../seed/plans.mjs'

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
  if (res.status >= 300) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json).slice(0, 400)}`)
  return json
}

const status = await req('GET', '/api/cms/_auth/status')
if (status?.needsSetup) { console.error(`${base} has no administrator yet: run \`pnpm seed\` for a new site.`); process.exit(1) }
await req('POST', '/api/cms/_auth/login', { email, password })
await seedPlans(req)

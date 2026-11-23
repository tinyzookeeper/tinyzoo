import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDatabaseUrl } from '../setup/database'
import { startServer, type SpawnedServer } from '../helpers/server'
import { noSiteErrorLines } from '../helpers/tenants'

// Many NEW sites used at the same moment: the cap on the connections of all sites of one
// process (cmsDb.ts, NUXT_CMS_TENANCY_MAX_CONNECTIONS) holds while every site is migrated at
// its first use, and nothing fails.
//
// tenants-connections.spec.ts shows the cap with two sites under load. This is the other
// case, which two sites cannot show: a site's first use is several pieces of work at once
// (its migration, then its search index, its setup code and the request that woke it), on
// a pool that has just one idle connection. That is where the cap once let the pool open a
// connection nobody had made room for: one more per site, 52 under a cap of 30 with 50 sites.
//
// Each site: an empty database of its own and its own user, as the hosting makes them.
const SITES = 24
const CAP = 6

let server: SpawnedServer | undefined
let admin: pg.Client
let dirs: string
let port: number
const base = new URL(testDatabaseUrl())
const testDb = base.pathname.replace(/^\//, '')
const dbName = (i: number) => `${testDb}_many_${i}`
const roleName = (i: number) => `${testDb}_many_${i}_user`
const ident = (name: string) => {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`odd identifier: ${name}`)
  return `"${name}"`
}

async function dropAll() {
  for (let i = 0; i < SITES; i++) await admin.query(`drop database if exists ${ident(dbName(i))} with (force)`)
  for (let i = 0; i < SITES; i++) await admin.query(`drop role if exists ${ident(roleName(i))}`)
}

const freePort = () => new Promise<number>((resolve, reject) => {
  const srv = createServer()
  srv.on('error', reject)
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address() as { port: number }; srv.close(() => resolve(port)) })
})

beforeAll(async () => {
  const adminUrl = new URL(base)
  adminUrl.pathname = '/postgres'
  admin = new pg.Client({ connectionString: adminUrl.toString() })
  await admin.connect()
  await dropAll()
  for (let i = 0; i < SITES; i++) {
    await admin.query(`create role ${ident(roleName(i))} login password 'pw_many_${i}' nosuperuser nocreatedb nocreaterole`)
    await admin.query(`create database ${ident(dbName(i))} owner ${ident(roleName(i))}`)
    await admin.query(`revoke connect on database ${ident(dbName(i))} from public`)
  }
  dirs = mkdtempSync(join(tmpdir(), 'cms-many-'))
  port = await freePort()
  // The sites' databases straight from Postgres, or through the pooler of the run (TEST_SITES_VIA, as the tenants helper).
  const via = process.env.TEST_SITES_VIA ? new URL(process.env.TEST_SITES_VIA) : null
  const siteUrl = (i: number) => {
    const u = new URL(base)
    u.username = roleName(i); u.password = `pw_many_${i}`; u.pathname = `/${dbName(i)}`
    if (via) { u.hostname = via.hostname; u.port = via.port }
    return u.toString()
  }
  const file = join(dirs, 'sites.json')
  writeFileSync(file, JSON.stringify({
    sites: Array.from({ length: SITES }, (_, i) => ({
      id: `many-${i}`,
      hosts: [`many-${i}.localhost`],
      publicUrl: `http://many-${i}.localhost:${port}`,
      databaseUrl: siteUrl(i),
      secret: `secret-of-many-site-${i}-at-least-32-characters`,
      config: { auth: { setupToken: `setup-code-${i}` }, storage: { driver: 'local', local: { dir: join(dirs, `uploads-${i}`) } }, mail: { file: { dir: join(dirs, `mail-${i}`) } } },
    })),
  }))
  server = await startServer('', {
    PORT: String(port),
    DATABASE_URL: '', NUXT_CMS_DATABASE_URL: '', NUXT_CMS_PUBLIC_URL: '',
    NUXT_CMS_TENANCY_MODE: 'multi', NUXT_CMS_TENANCY_FILE: file,
    NUXT_CMS_MAIL_TRANSPORT: 'file',
    NUXT_CMS_TENANCY_MAX_CONNECTIONS: String(CAP),
  })
}, 120_000)

afterAll(async () => {
  await server?.stop()
  if (dirs) rmSync(dirs, { recursive: true, force: true })
  await dropAll()
  await admin.end()
})

describe('many new sites used at the same moment', () => {
  it(`${SITES} sites, each migrated at its first use, under a cap of ${CAP} connections: every site answers and the cap holds`, async () => {
    const counter = new pg.Client({ connectionString: (() => { const u = new URL(base); u.pathname = '/postgres'; return u.toString() })() })
    await counter.connect()
    const pattern = `${testDb}_many_%`.replace(/_/g, '\\_')
    let most = 0
    let watching = true
    const watch = (async () => {
      while (watching) {
        const { rows } = await counter.query('select count(*)::int n from pg_stat_activity where usename like $1', [pattern])
        most = Math.max(most, rows[0].n)
        await new Promise((r) => setTimeout(r, 10))
      }
    })()
    let answers: { status: number; body: string }[]
    try {
      // Right after the start: the server's own sweep is going through the sites too.
      answers = await Promise.all(Array.from({ length: SITES }, async (_, i) => {
        const res = await fetch(`http://many-${i}.localhost:${port}/api/content/tag`, { headers: { accept: 'application/json' } })
        return { status: res.status, body: await res.text() }
      }))
      // And once more while their start-up work may still be going on.
      answers.push(...await Promise.all(Array.from({ length: SITES }, async (_, i) => {
        const res = await fetch(`http://many-${i}.localhost:${port}/api/content/post`, { headers: { accept: 'application/json' } })
        return { status: res.status, body: await res.text() }
      })))
      await new Promise((r) => setTimeout(r, 300))
    }
    finally {
      watching = false
      await watch
      await counter.end()
    }
    expect(answers.filter((a) => a.status !== 200).map((a) => [a.status, a.body.slice(0, 200)])).toEqual([])
    expect(answers).toHaveLength(SITES * 2)
    // Every site was migrated by the app, as its own user.
    const check = new pg.Client({ connectionString: (() => { const u = new URL(base); u.pathname = `/${dbName(SITES - 1)}`; return u.toString() })() })
    await check.connect()
    try { expect((await check.query(`select count(*)::int n from information_schema.tables where table_schema = 'public' and table_name = 'cms_users'`)).rows[0].n).toBe(1) }
    finally { await check.end() }
    expect(most).toBeGreaterThan(0)
    // Counted on the Postgres side, where a connection the app has closed is still listed for a
    // moment: one or two over the cap may show (as in tenants-connections.spec.ts).
    // Behind a pooler (TEST_SITES_VIA) Postgres lists the pooler's connections, not the app's: it
    // keeps some per site for its idle time, whatever the app's cap (test/pgbouncer/README.md).
    if (!process.env.TEST_SITES_VIA) expect(most, `connections of the sites' users at once, cap ${CAP}`).toBeLessThanOrEqual(CAP + 2)
    // Nothing waited for room until it gave up, and nothing ran without a site.
    const log = server!.logs.join('')
    expect(log.split('\n').filter((line) => /Too many database connections|migrations failed|could not build the search index/.test(line))).toEqual([])
    expect(noSiteErrorLines({ server: server! })).toEqual([])
  }, 60_000)
})

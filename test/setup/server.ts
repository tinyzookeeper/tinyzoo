import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { appendFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TestProject } from 'vitest/node'
import { playgroundDir, prepareTestDatabase, repoRoot, testDatabaseUrl } from './database'
import { BUILD_CRON, TEST_TIMERS } from './timers'

/**
 * Global setup for the API suites.
 *
 *  1. Fresh `<db>_test` database, migrated from the playground's migrations.
 *  2. A production build of the playground into node_modules/.cache/cms-test
 *     (skipped with CMS_TEST_REUSE_BUILD=1 when one exists — handy while iterating
 *     on specs; CI sets it only when its cache holds the build of exactly these files).
 *  3. The built Nitro server started on a free port, pointed at the test database
 *     and a throwaway upload directory. Specs talk to it over real HTTP.
 *
 * Only the server process started here is ever stopped (by its own PID).
 */
const cacheDir = join(repoRoot, 'node_modules/.cache/cms-test')
const buildDir = join(cacheDir, 'nuxt')
const outputDir = join(cacheDir, 'output')

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number }
      srv.close(() => resolve(port))
    })
  })
}

async function waitForServer(baseURL: string, child: ChildProcess, logs: string[]): Promise<void> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Test server exited with ${child.exitCode}:\n${logs.join('')}`)
    }
    try {
      const res = await fetch(`${baseURL}/api/cms/_graph`)
      if (res.status === 401) return // up, and auth-gated as expected
    }
    catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Test server did not come up within 60s:\n${logs.join('')}`)
}

export default async function setup(project: TestProject) {
  const databaseUrl = testDatabaseUrl()
  await prepareTestDatabase(databaseUrl)
  // Rate-limit counters in Redis outlive a run; start every run clean.
  if (process.env.TEST_REDIS_URL) {
    const { default: Redis } = await import('ioredis')
    const r = new Redis(process.env.TEST_REDIS_URL)
    const keys = await r.keys('cms:*')
    if (keys.length) await r.del(...keys)
    await r.quit()
  }

  const serverEntry = join(outputDir, 'server/index.mjs')
  const reuse = process.env.CMS_TEST_REUSE_BUILD === '1' && existsSync(serverEntry)
  if (!reuse) {
    const started = Date.now()
    const res = spawnSync(process.execPath, [join(import.meta.dirname, 'build-playground.mjs'), playgroundDir, buildDir, outputDir], {
      cwd: playgroundDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      // Scheduled entries are checked every second in tests (every minute by default), retention every 3 s (daily).
      env: { ...process.env, NODE_ENV: 'production', ...BUILD_CRON },
    })
    if (res.status !== 0) {
      throw new Error(`Playground build failed:\n${res.stdout}\n${res.stderr}`)
    }
    console.log(`[cms-test] built playground in ${((Date.now() - started) / 1000).toFixed(1)}s`)
  }
  else if (!existsSync(join(playgroundDir, '.nuxt', 'tsconfig.app.json'))) {
    // A reused build (CI restores it from cache) skips build-playground.mjs, and with it the
    // `nuxt prepare` a fresh clone needs: specs that import playground code make Vite read
    // playground/tsconfig.json, which points at .nuxt/tsconfig.*.json.
    const prep = spawnSync('pnpm', ['exec', 'nuxt', 'prepare'], { cwd: playgroundDir, stdio: 'inherit' })
    if (prep.status !== 0) throw new Error('`nuxt prepare` failed in playground')
  }

  const uploadsDir = mkdtempSync(join(tmpdir(), 'cms-test-uploads-'))
  const mailDir = mkdtempSync(join(tmpdir(), 'cms-test-mail-'))
  const hooks = await startWebhookReceiver()
  const port = await freePort()
  const baseURL = `http://127.0.0.1:${port}`
  const logs: string[] = []
  // The server runs as in production: without Vitest's TEST flag, which would make
  // Nitro skip its scheduled tasks (std-env's isTest).
  const { TEST: _test, VITEST: _vitest, ...parentEnv } = process.env
  const child = spawn(process.execPath, [serverEntry], {
    cwd: playgroundDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...parentEnv,
      NODE_ENV: 'production',
      // Presence, shared-editing and webhook-retry timers on a short leash (the build is the same).
      ...TEST_TIMERS,
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      NUXT_CMS_DATABASE_URL: databaseUrl,
      NUXT_APP_SECRET: 'test-app-secret-at-least-32-characters-long',
      NUXT_CMS_STORAGE_DRIVER: 'local',
      NUXT_CMS_STORAGE_LOCAL_DIR: uploadsDir,
      // Every spec uploads as the same seeded admin: the default 60 a minute would be used up by the suites together.
      NUXT_CMS_STORAGE_UPLOAD_RATE_PER_MIN: '1000',
      NUXT_CMS_PUBLIC_URL: baseURL,
      NUXT_CMS_MAIL_TRANSPORT: 'file',
      // The database was migrated by drizzle's migrator above; migrating again at
      // start must be a no-op (same bookkeeping) — every run checks that.
      NUXT_CMS_MIGRATIONS_ON_START: 'true',
      // With TEST_REDIS_URL (CI, or the compose 'redis' profile), the server shares
      // rate limits / realtime through Redis, exercising that path.
      ...(process.env.TEST_REDIS_URL ? { NUXT_CMS_REDIS_URL: process.env.TEST_REDIS_URL } : {}),
      NUXT_CMS_MAIL_FILE_DIR: mailDir,
      // Publish webhooks go to a receiver in this process (see startWebhookReceiver).
      NUXT_CMS_WEBHOOKS_URLS: `${hooks.url}/ok, ${hooks.url}/flaky`,
      NUXT_CMS_WEBHOOKS_SECRET: WEBHOOK_SECRET,
      // First-run setup needs this code (seedAccounts sends it).
      NUXT_CMS_AUTH_SETUP_TOKEN: SETUP_TOKEN,
      // A public demo account (cms.demo): created on its first sign-in (demo.spec.ts).
      NUXT_PUBLIC_CMS_DEMO_EMAIL: 'demo@test.local',
      NUXT_PUBLIC_CMS_DEMO_PASSWORD: 'try it out please',
    },
  })
  // CMS_TEST_SERVER_LOG_FILE=path: the server's output, as it happens (for debugging).
  const logFile = process.env.CMS_TEST_SERVER_LOG_FILE
  const keep = (d: unknown) => {
    logs.push(String(d))
    if (logFile) appendFileSync(logFile, String(d))
  }
  child.stdout?.on('data', keep)
  child.stderr?.on('data', keep)

  try {
    await waitForServer(baseURL, child, logs)
  }
  catch (err) {
    child.kill()
    throw err
  }

  let accounts: TestAccounts
  try {
    accounts = await seedAccounts(baseURL)
  }
  catch (err) {
    child.kill()
    throw new Error(`Seeding test accounts failed: ${(err as Error).message}\n${logs.join('')}`)
  }

  project.provide('baseURL', baseURL)
  project.provide('databaseUrl', databaseUrl)
  project.provide('uploadsDir', uploadsDir)
  project.provide('mailDir', mailDir)
  project.provide('hooksDir', hooks.dir)
  project.provide('accounts', accounts)

  return async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM')
      await new Promise((r) => child.once('exit', r))
    }
    rmSync(uploadsDir, { recursive: true, force: true })
    rmSync(mailDir, { recursive: true, force: true })
    await hooks.close()
    if (process.env.CMS_TEST_SERVER_LOGS === '1') console.log(logs.join(''))
  }
}

export const WEBHOOK_SECRET = 'test-webhook-secret'
export const SETUP_TOKEN = 'test-setup-code'

/**
 * Receives the server's publish webhooks and writes each request into a temp dir as
 * JSON ({ path, headers, body }), where specs read them (they run in other processes).
 * /ok always answers 200; /flaky fails the first attempt of every delivery (500), to
 * exercise retries.
 */
async function startWebhookReceiver(): Promise<{ url: string; dir: string; close: () => Promise<void> }> {
  const dir = mkdtempSync(join(tmpdir(), 'cms-test-hooks-'))
  const failedOnce = new Set<string>()
  let seq = 0
  const server = createHttpServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      const delivery = String(req.headers['x-cms-delivery'] ?? '')
      const fail = req.url === '/flaky' && !failedOnce.has(delivery)
      if (fail) failedOnce.add(delivery)
      writeFileSync(join(dir, `${String(++seq).padStart(6, '0')}.json`), JSON.stringify({ path: req.url, headers: req.headers, body, failed: fail }))
      res.statusCode = fail ? 500 : 200
      res.end()
    })
  })
  const port = await freePort()
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', r))
  return {
    url: `http://127.0.0.1:${port}`,
    dir,
    close: async () => {
      await new Promise((r) => server.close(r))
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

export type TestRole = 'admin' | 'editor' | 'author'
export type TestAccounts = Record<TestRole, { id: string; email: string; password: string; cookie: string }>
export const TEST_PASSWORD = 'correct horse battery'

/** POST JSON, return { status, body, cookie } (cookie = the session the response set). */
async function post(baseURL: string, path: string, body: unknown, cookie = '') {
  const res = await fetch(baseURL + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
  const setCookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
  return { status: res.status, body: await res.json() as any, cookie: setCookie }
}

/**
 * One account per role, created the way a real install gets them: the first
 * administrator through first-run setup, the others invited and accepting their
 * invitation. Their sessions are shared with every spec (signIn() reuses them), so
 * specs that sign out or change passwords use their own throwaway accounts.
 */
async function seedAccounts(baseURL: string): Promise<TestAccounts> {
  const admin = await post(baseURL, '/api/cms/_auth/setup', { name: 'Ada Admin', email: 'admin@test.local', password: TEST_PASSWORD, token: SETUP_TOKEN })
  if (admin.status !== 201) throw new Error(`setup: ${admin.status} ${JSON.stringify(admin.body)}`)
  const accounts = { admin: { id: admin.body.user.id, email: 'admin@test.local', password: TEST_PASSWORD, cookie: admin.cookie } } as TestAccounts
  for (const [role, name] of [['editor', 'Eda Editor'], ['author', 'Alma Author']] as const) {
    const email = `${role}@test.local`
    const invited = await post(baseURL, '/api/cms/_users', { email, role }, admin.cookie)
    if (invited.status !== 201) throw new Error(`invite ${role}: ${invited.status} ${JSON.stringify(invited.body)}`)
    const token = String(invited.body.inviteUrl).split('/').pop()
    const accepted = await post(baseURL, '/api/cms/_auth/accept', { token, name, password: TEST_PASSWORD })
    if (accepted.status !== 200) throw new Error(`accept ${role}: ${accepted.status} ${JSON.stringify(accepted.body)}`)
    accounts[role] = { id: accepted.body.user.id, email, password: TEST_PASSWORD, cookie: accepted.cookie }
  }
  return accounts
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseURL: string
    databaseUrl: string
    uploadsDir: string
    mailDir: string
    hooksDir: string
    accounts: TestAccounts
  }
}

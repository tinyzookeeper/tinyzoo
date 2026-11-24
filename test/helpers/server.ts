import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { join } from 'node:path'
import pg from 'pg'
import { prepareTestDatabase, repoRoot, testDatabaseUrl } from '../setup/database'
import { TEST_TIMERS } from '../setup/timers'

/** The production build of the playground the API suites share (made by the global setup). */
export const builtServer = join(repoRoot, 'node_modules/.cache/cms-test/output/server/index.mjs')

/** A scratch database next to the suite's own (`<test db>_<suffix>`), migrated and empty. */
export async function scratchDatabase(suffix: string): Promise<{ url: string; drop: () => Promise<void> }> {
  const base = new URL(testDatabaseUrl())
  const url = new URL(base)
  url.pathname = `/${base.pathname.replace(/^\//, '')}_${suffix}`
  await prepareTestDatabase(url.toString())
  return {
    url: url.toString(),
    drop: async () => {
      const admin = new URL(url)
      admin.pathname = '/postgres'
      const c = new pg.Client({ connectionString: admin.toString() })
      await c.connect()
      try { await c.query(`drop database if exists "${url.pathname.replace(/^\//, '')}" with (force)`) }
      finally { await c.end() }
    },
  }
}

const freePort = () => new Promise<number>((resolve, reject) => {
  const srv = createServer()
  srv.unref()
  srv.on('error', reject)
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address() as { port: number }; srv.close(() => resolve(port)) })
})

export interface SpawnedServer {
  baseURL: string
  /** The process id, for measuring its memory. */
  pid: number
  logs: string[]
  /** Resolves with the first match of `pattern` in the server's output (already printed or to come). */
  waitForLog(pattern: RegExp, timeoutMs?: number): Promise<RegExpExecArray>
  stop(): Promise<void>
}

/**
 * Another instance of the built playground, pointed at its own database and with its own
 * environment — for behaviour the shared test server cannot show (no setup token, a
 * broken storage driver…). Only the process started here is ever stopped. `entry`: another build
 * of the playground than the shared one.
 */
export async function startServer(databaseUrl: string, env: Record<string, string> = {}, entry: string = builtServer): Promise<SpawnedServer> {
  // `env.PORT`: a port the caller chose (the multi-tenant helper writes it into its site directory first).
  const port = env.PORT ? Number(env.PORT) : await freePort()
  const baseURL = `http://127.0.0.1:${port}`
  const logs: string[] = []
  // The app secret is only what this server is given: a secret (or stand-in) exported in the
  // shell running the tests must not change what the start-up checks see.
  const {
    TEST: _t, VITEST: _v, NUXT_CMS_AUTH_SETUP_TOKEN: _s,
    NUXT_APP_SECRET: _a, NITRO_APP_SECRET: _na, NUXT_SESSION_PASSWORD: _p, NITRO_SESSION_PASSWORD: _np,
    ...parentEnv
  } = process.env
  const child = spawn(process.execPath, [entry], {
    cwd: join(repoRoot, 'playground'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...parentEnv,
      ...TEST_TIMERS,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      DATABASE_URL: databaseUrl, NUXT_CMS_DATABASE_URL: databaseUrl,
      NUXT_APP_SECRET: 'test-app-secret-at-least-32-characters-long',
      NUXT_CMS_STORAGE_DRIVER: 'local', NUXT_CMS_PUBLIC_URL: baseURL, NUXT_CMS_MAIL_TRANSPORT: 'log',
      NUXT_CMS_MIGRATIONS_ON_START: 'true',
      ...env,
    },
  })
  const keep = (d: unknown) => logs.push(String(d))
  child.stdout?.on('data', keep)
  child.stderr?.on('data', keep)

  const deadline = Date.now() + 60_000
  for (;;) {
    if (child.exitCode !== null) throw new Error(`Server exited with ${child.exitCode}:\n${logs.join('')}`)
    try { if ((await fetch(`${baseURL}/api/health/ready`)).ok) break }
    catch { /* not listening yet */ }
    if (Date.now() > deadline) { child.kill(); throw new Error(`Server did not start:\n${logs.join('')}`) }
    await new Promise((r) => setTimeout(r, 150))
  }
  return {
    baseURL, logs, pid: child.pid!,
    async waitForLog(pattern, timeoutMs = 10_000) {
      const until = Date.now() + timeoutMs
      for (;;) {
        const m = pattern.exec(logs.join(''))
        if (m) return m
        if (Date.now() > until) throw new Error(`No log line matching ${pattern} within ${timeoutMs} ms:\n${logs.join('')}`)
        await new Promise((r) => setTimeout(r, 50))
      }
    },
    async stop() {
      if (child.exitCode === null) {
        child.kill('SIGTERM')
        await new Promise((r) => child.once('exit', r))
      }
    },
  }
}

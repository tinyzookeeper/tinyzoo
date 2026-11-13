import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TestProject } from 'vitest/node'
import { playgroundDir, prepareTestDatabase, repoRoot, testDatabaseUrl } from './database'

/**
 * Global setup for the API suites.
 *
 *  1. Fresh `<db>_test` database, migrated from the playground's migrations.
 *  2. A production build of the playground into node_modules/.cache/cms-test
 *     (skipped with CMS_TEST_REUSE_BUILD=1 when one exists — handy while iterating
 *     on specs; never in CI).
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

  const serverEntry = join(outputDir, 'server/index.mjs')
  const reuse = process.env.CMS_TEST_REUSE_BUILD === '1' && existsSync(serverEntry)
  if (!reuse) {
    const started = Date.now()
    const res = spawnSync(process.execPath, [join(import.meta.dirname, 'build-playground.mjs'), playgroundDir, buildDir, outputDir], {
      cwd: playgroundDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production' },
    })
    if (res.status !== 0) {
      throw new Error(`Playground build failed:\n${res.stdout}\n${res.stderr}`)
    }
    console.log(`[cms-test] built playground in ${((Date.now() - started) / 1000).toFixed(1)}s`)
  }

  const uploadsDir = mkdtempSync(join(tmpdir(), 'cms-test-uploads-'))
  const port = await freePort()
  const baseURL = `http://127.0.0.1:${port}`
  const logs: string[] = []
  const child = spawn(process.execPath, [serverEntry], {
    cwd: playgroundDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      NUXT_CMS_DATABASE_URL: databaseUrl,
      NUXT_SESSION_PASSWORD: 'test-session-password-at-least-32-characters-long',
      NUXT_CMS_STORAGE_DRIVER: 'local',
      NUXT_CMS_STORAGE_LOCAL_DIR: uploadsDir,
    },
  })
  child.stdout?.on('data', (d) => logs.push(String(d)))
  child.stderr?.on('data', (d) => logs.push(String(d)))

  try {
    await waitForServer(baseURL, child, logs)
  }
  catch (err) {
    child.kill()
    throw err
  }

  project.provide('baseURL', baseURL)
  project.provide('databaseUrl', databaseUrl)
  project.provide('uploadsDir', uploadsDir)

  return async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM')
      await new Promise((r) => child.once('exit', r))
    }
    rmSync(uploadsDir, { recursive: true, force: true })
    if (process.env.CMS_TEST_SERVER_LOGS === '1') console.log(logs.join(''))
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseURL: string
    databaseUrl: string
    uploadsDir: string
  }
}

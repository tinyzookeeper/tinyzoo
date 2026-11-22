// Shared by scripts/e2e.mjs and scripts/walkthrough.mjs: starting a cloud app of their own
// (own database, own folder of sites, own ports, so nothing of the developer's is touched),
// finding and stopping the site processes those runs made, and a visible mouse cursor for
// recorded videos.
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs'
import net from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import pg from 'pg'

const run = promisify(execFile)
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const cloudDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const repoRoot = resolve(cloudDir, '..')
export const templateEntry = join(repoRoot, 'packages/cms/starter/.output/server/index.mjs')
export const PG_URL = process.env.CLOUD_PG_URL || 'postgres://cms:cms@localhost:5434/postgres'

export function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const next = process.argv[i + 1]
  return next && !next.startsWith('--') ? next : true
}

export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

export function portFree(port) {
  return new Promise((done) => {
    const server = net.createServer()
    server.once('error', () => done(false))
    server.listen({ port, host: '127.0.0.1' }, () => server.close(() => done(true)))
  })
}

export async function freePortFrom(start) {
  for (let p = start; p < start + 50; p++) if (await portFree(p)) return p
  throw new Error(`no free port from ${start}`)
}

// ── Postgres ──

export async function withPg(fn, url = PG_URL) {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try { return await fn(client) }
  finally { await client.end() }
}

export const dbUrl = (name) => { const u = new URL(PG_URL); u.pathname = `/${name}`; return u.toString() }

/** Only databases these scripts own: the cloud's (tz_cloud…) and the sites' (tzc_…). */
function own(name) {
  if (!/^(tz_cloud|tzc_)[a-z0-9_]*$/.test(name)) throw new Error(`refusing to touch database ${name}`)
  return `"${name}"`
}
export const dropDatabase = (name) => withPg((c) => c.query(`drop database if exists ${own(name)} with (force)`))
export async function recreateDatabase(name) {
  await dropDatabase(name)
  await withPg((c) => c.query(`create database ${own(name)}`))
}
export const databaseExists = (name) => withPg(async (c) => (await c.query('select 1 from pg_database where datname = $1', [name])).rowCount > 0)
/** Drop every site database whose name starts with `prefix` (e.g. "tzc_e2e_"). */
export async function dropSiteDatabases(prefix) {
  if (!/^tzc_[a-z0-9_]+$/.test(prefix)) throw new Error(`refusing prefix ${prefix}`)
  const rows = await withPg(async (c) => (await c.query('select datname from pg_database where datname like $1', [`${prefix.replace(/_/g, '\\_')}%`])).rows)
  for (const r of rows) await dropDatabase(r.datname)
  return rows.length
}

// ── the site processes of one data folder ──

/** The processes started for sites under `dataDir`: recognised by the `--site-dir=<folder>` argument the local driver gives them. */
export async function siteProcesses(dataDir) {
  const { stdout } = await run('ps', ['-axo', 'pid=,rss=,command='])
  const marker = `--site-dir=${resolve(dataDir)}/`
  return stdout.split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .filter((m) => m[3].includes(marker))
    .map((m) => ({ pid: Number(m[1]), rssBytes: Number(m[2]) * 1024, slug: m[3].split(marker)[1].split(/\s/)[0], command: m[3] }))
}

export async function alive(pid) {
  try { return (await run('ps', ['-o', 'pid=', '-p', String(pid)])).stdout.trim() !== '' }
  catch { return false }
}

/** Stop the site processes of `dataDir` (only those: each pid's command line names a folder under it). */
export async function stopSiteProcesses(dataDir, only = null) {
  const procs = (await siteProcesses(dataDir)).filter((p) => !only || only.includes(p.slug))
  for (const p of procs) { try { process.kill(p.pid, 'SIGTERM') } catch { /* gone */ } }
  for (let i = 0; i < 40; i++) {
    if (!(await Promise.all(procs.map((p) => alive(p.pid)))).some(Boolean)) break
    await sleep(250)
  }
  return procs
}

/** Remove everything a run left behind: its site processes, its site databases, its folder. */
export async function cleanSites(dataDir, dbPrefix) {
  await stopSiteProcesses(dataDir)
  await dropSiteDatabases(dbPrefix)
  if (existsSync(dataDir) && resolve(dataDir).startsWith(join(cloudDir, '.data') + '/')) rmSync(dataDir, { recursive: true, force: true })
}

export const siteFolders = (dataDir) => (existsSync(dataDir) ? readdirSync(dataDir) : [])

// ── a cloud app of the script's own ──

/**
 * Start `nuxt dev` for the cloud in its own process group, with its own settings, and wait
 * until it answers. `stop()` ends that group (the script's own processes, nothing else).
 */
export async function startCloud({ port, env = {}, logFile }) {
  if (!(await portFree(port))) throw new Error(`port ${port} is in use`)
  mkdirSync(dirname(logFile), { recursive: true })
  const out = openSync(logFile, 'a')
  const child = spawn('pnpm', ['exec', 'nuxt', 'dev', '--port', String(port)], {
    cwd: cloudDir, detached: true, stdio: ['ignore', out, out],
    // A second dev server in this folder, beside the developer's: its own build folder, and
    // past Nuxt's one-server-per-folder check.
    env: { ...process.env, NUXT_PUBLIC_URL: `http://localhost:${port}`, CLOUD_BUILD_DIR: '.nuxt-scripts', NUXT_IGNORE_LOCK: '1', ...env },
  })
  const url = `http://localhost:${port}`
  let exited = false
  child.on('exit', () => { exited = true })
  const until = Date.now() + 180_000
  for (;;) {
    if (exited) throw new Error(`the cloud app exited while starting; see ${logFile}`)
    try { if ((await fetch(`${url}/api/account`, { signal: AbortSignal.timeout(3000) })).ok) break } catch { /* not up yet */ }
    if (Date.now() > until) throw new Error(`the cloud app did not answer; see ${logFile}`)
    await sleep(500)
  }
  // The first page render compiles the client bundle: do it once here, so the browser does not wait on it.
  await fetch(url, { signal: AbortSignal.timeout(120_000) }).catch(() => {})
  return {
    url, pid: child.pid,
    async stop() {
      if (exited) return
      try { process.kill(-child.pid, 'SIGTERM') } catch { /* gone */ }
      for (let i = 0; i < 40 && !exited; i++) await sleep(250)
      if (!exited) { try { process.kill(-child.pid, 'SIGKILL') } catch { /* gone */ } }
      for (let i = 0; i < 40 && !(await portFree(port)); i++) await sleep(250)
    },
  }
}

/** Open an address and wait until the app there is interactive (app/plugins/ready.client.ts). */
export async function open(page, url) {
  await page.goto(url)
  await page.waitForSelector('html[data-app-ready]', { timeout: 60_000 })
}

/** Wait until `fn()` is truthy. */
export async function waitFor(fn, { timeout = 30_000, every = 250, what = 'condition' } = {}) {
  const until = Date.now() + timeout
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`)
    await sleep(every)
  }
}

// ── a visible mouse for recorded videos ──

/**
 * Playwright's video does not draw the mouse. This draws one: an arrow (or a touch dot) that
 * follows the real pointer on every page of the context, with a ring at each click.
 */
export async function installCursor(context, { touch = false } = {}) {
  await context.addInitScript((touch) => {
    if (window.top !== window) return
    const make = () => {
      if (document.getElementById('__cursor')) return
      const el = document.createElement('div')
      el.id = '__cursor'
      el.innerHTML = touch
        ? '<div style="width:34px;height:34px;border-radius:50%;background:rgba(46,48,53,.28);border:2px solid rgba(255,255,255,.9);box-shadow:0 2px 8px rgba(0,0,0,.25);transform:translate(-50%,-50%)"></div>'
        : '<svg width="30" height="30" viewBox="0 0 24 24" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><path d="M4.5 2.5 L4.5 19 L8.9 14.9 L11.9 21.6 L14.6 20.4 L11.6 13.8 L17.6 13.8 Z" fill="#131313" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>'
      Object.assign(el.style, { position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none', transform: 'translate(-100px,-100px)', transition: 'none', willChange: 'transform' })
      const ring = document.createElement('div')
      ring.id = '__cursor_ring'
      Object.assign(ring.style, { position: 'fixed', left: '0', top: '0', width: '44px', height: '44px', marginLeft: '-22px', marginTop: '-22px', borderRadius: '50%', border: '3px solid #C8644F', zIndex: '2147483646', pointerEvents: 'none', opacity: '0', transform: 'translate(-100px,-100px) scale(.4)' })
      document.documentElement.appendChild(ring)
      document.documentElement.appendChild(el)
      const last = JSON.parse(sessionStorage.getItem('__cursor') || 'null')
      if (last) el.style.transform = `translate(${last.x}px,${last.y}px)`
      const move = (e) => {
        el.style.transform = `translate(${e.clientX}px,${e.clientY}px)`
        try { sessionStorage.setItem('__cursor', JSON.stringify({ x: e.clientX, y: e.clientY })) } catch { /* private */ }
      }
      window.addEventListener('mousemove', move, true)
      window.addEventListener('mousedown', (e) => {
        ring.style.transition = 'none'
        ring.style.opacity = '.9'
        ring.style.transform = `translate(${e.clientX}px,${e.clientY}px) scale(.4)`
        requestAnimationFrame(() => {
          ring.style.transition = 'transform 420ms ease-out, opacity 420ms ease-out'
          ring.style.transform = `translate(${e.clientX}px,${e.clientY}px) scale(1.15)`
          ring.style.opacity = '0'
        })
      }, true)
    }
    if (document.documentElement) make()
    document.addEventListener('DOMContentLoaded', make)
  }, touch)
}

/** A hand on the mouse: smooth paths, human pacing, typing with small pauses. */
export function human(page, { speed = 1 } = {}) {
  let at = { x: 720, y: 450 }
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
  async function moveTo(x, y) {
    const from = { ...at }
    const dist = Math.hypot(x - from.x, y - from.y)
    const steps = Math.max(12, Math.min(60, Math.round(dist / 14)))
    // A slight arc, as a wrist makes.
    const bend = Math.min(60, dist * 0.12) * (Math.random() < 0.5 ? -1 : 1)
    const nx = dist ? -(y - from.y) / dist : 0, ny = dist ? (x - from.x) / dist : 0
    for (let i = 1; i <= steps; i++) {
      const t = ease(i / steps)
      const arc = Math.sin(Math.PI * t) * bend
      await page.mouse.move(from.x + (x - from.x) * t + nx * arc, from.y + (y - from.y) * t + ny * arc)
      await sleep(Math.round((9 + Math.random() * 6) / speed))
    }
    at = { x, y }
  }
  async function target(locator) {
    await locator.waitFor({ state: 'visible', timeout: 30_000 })
    await locator.scrollIntoViewIfNeeded()
    await sleep(150)
    const box = await locator.boundingBox()
    if (!box) throw new Error('nothing to point at')
    return { x: box.x + box.width * (0.35 + Math.random() * 0.3), y: box.y + box.height * (0.4 + Math.random() * 0.2) }
  }
  return {
    /** Put the mouse somewhere at the start (no travel). */
    async place(x, y) { await page.mouse.move(x, y); at = { x, y } },
    async hover(locator) { const p = await target(locator); await moveTo(p.x, p.y) },
    async click(locator, { after = 350 } = {}) {
      const p = await target(locator)
      await moveTo(p.x, p.y)
      await sleep(Math.round(180 / speed))
      await page.mouse.down()
      await sleep(70)
      await page.mouse.up()
      await sleep(after)
    },
    async type(locator, text, { clear = false } = {}) {
      await this.click(locator, { after: 250 })
      if (clear) { await page.keyboard.press('ControlOrMeta+a'); await sleep(120); await page.keyboard.press('Backspace'); await sleep(200) }
      for (const ch of text) {
        await page.keyboard.type(ch)
        await sleep(Math.round((45 + Math.random() * 75 + (ch === ' ' ? 60 : 0)) / speed))
      }
      await sleep(300)
    },
    async read(ms) { await sleep(ms) },
    async scroll(dy, ms = 900) {
      const steps = Math.max(8, Math.round(ms / 30))
      for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await sleep(30) }
      await sleep(250)
    },
  }
}

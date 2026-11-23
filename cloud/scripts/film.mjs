// What the recorded walkthrough (scripts/walkthrough.mjs) is filmed with:
//
//   showcaseProxy   real-looking addresses (https://<slug>.pushbase.app) that work inside the
//                   recording browser only: a small https proxy on this machine, and the
//                   Chromium flags that send those names to it and nothing anywhere else
//   film            a sharp, evenly paced video of a page: the page is slowed down, its picture
//                   is taken at device resolution for every frame of the video, and ffmpeg
//                   makes the film from the pictures
//   hand            a visible mouse (or finger) that moves, clicks, types and scrolls like a
//                   person, at the film's pace
import { execFile, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { log, sleep } from './lib.mjs'

const run = promisify(execFile)

// ── real-looking addresses, on this machine only ────────────────────────────────

/**
 * An https proxy on a port of this machine that answers for `tinyzoo.<domain>` (the cloud app)
 * and `<slug>.<domain>` (the site in `<dataDir>/<slug>/`, whose port is in its site.json), with
 * a certificate made on the spot. Web sockets pass through (the dev server's own).
 *
 * `browserArgs` are the Chromium flags that send those names to the proxy and make every other
 * name unknown, so no request of the recording browser leaves this machine. `check(browser)`
 * proves the browser obeys them, with a name that does not exist anywhere (.invalid), before
 * anything is opened under the real-looking ones: without the mapping it throws.
 */
export async function showcaseProxy({ domain, cloudPort, dataDir }) {
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) throw new Error(`not a domain: ${domain}`)
  const dir = mkdtempSync(join(tmpdir(), 'tinyzoo-showcase-'))
  const key = join(dir, 'key.pem'), cert = join(dir, 'cert.pem')
  const CANARY = 'showcase-canary.invalid'
  await run('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-days', '2', '-keyout', key, '-out', cert,
    '-subj', `/CN=*.${domain}`, '-addext', `subjectAltName=DNS:*.${domain},DNS:${domain},DNS:${CANARY}`])
  const nonce = randomBytes(16).toString('hex')

  /** Where a host name really runs on this machine; null when it is none of ours. */
  const targetOf = (host) => {
    const name = String(host || '').split(':')[0].toLowerCase()
    // (the dev server listens on "localhost", whichever of this machine's addresses that is; the sites on 127.0.0.1)
    if (name === `tinyzoo.${domain}`) return { host: 'localhost', port: cloudPort }
    if (!name.endsWith(`.${domain}`)) return null
    const slug = name.slice(0, -domain.length - 1)
    if (!/^[a-z0-9-]+$/.test(slug)) return null
    try {
      const port = Number(JSON.parse(readFileSync(join(dataDir, slug, 'site.json'), 'utf8')).port)
      return port ? { host: '127.0.0.1', port } : null
    }
    catch { return null }
  }
  const forwarded = (req) => ({ ...req.headers, 'x-forwarded-proto': 'https', 'x-forwarded-host': req.headers.host ?? '' })

  const server = https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
    if (req.url === '/__showcase') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); res.end(nonce); return }
    const target = targetOf(req.headers.host)
    if (!target) { res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' }); res.end(`showcase proxy: nothing runs as ${req.headers.host}`); return }
    const up = http.request({ ...target, method: req.method, path: req.url, headers: forwarded(req) }, (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers)
      answer.pipe(res)
    })
    up.on('error', (err) => { if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' }); res.end(`showcase proxy: ${err.message}`) })
    req.pipe(up)
  })
  server.on('upgrade', (req, socket, head) => {
    const target = targetOf(req.headers.host)
    if (!target) { socket.destroy(); return }
    const up = net.connect(target.port, target.host, () => {
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`]
      for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`)
      up.write(`${lines.join('\r\n')}\r\n\r\n`)
      if (head?.length) up.write(head)
      socket.pipe(up).pipe(socket)
    })
    up.on('error', () => socket.destroy())
    socket.on('error', () => up.destroy())
  })
  await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done) })
  const port = server.address().port

  return {
    port, domain,
    cloudUrl: `https://tinyzoo.${domain}`,
    siteUrlPattern: `https://{slug}.${domain}`,
    // The names of the showcase go to the proxy; every other name is unknown to this browser.
    browserArgs: [`--host-resolver-rules=MAP *.${domain} 127.0.0.1:${port}, MAP ${domain} 127.0.0.1:${port}, MAP ${CANARY} 127.0.0.1:${port}, MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1`],
    async check(browser) {
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
      try {
        const page = await ctx.newPage()
        // A name that exists nowhere: it only answers when the browser sends it to the proxy.
        const answer = await page.goto(`https://${CANARY}/__showcase`, { timeout: 15_000 }).then((r) => r?.text()).catch((e) => `(${e.message.split('\n')[0]})`)
        if (answer !== nonce) throw new Error(`the recording browser does not send the showcase's names to this machine ${answer}: refusing to go on, the addresses would reach the real ${domain}`)
        const own = await page.goto(`https://tinyzoo.${domain}/__showcase`, { timeout: 15_000 }).then((r) => r?.text())
        if (own !== nonce) throw new Error(`https://tinyzoo.${domain} is not answered by this machine: refusing to go on`)
        // And a name outside the showcase is not resolved at all.
        const outside = await page.goto('https://example.com/', { timeout: 8000 }).then(() => 'answered').catch(() => 'unknown')
        if (outside !== 'unknown') throw new Error('the recording browser can reach other names: refusing to go on')
      }
      finally { await ctx.close() }
    },
    async stop() {
      await new Promise((done) => { server.close(done); server.closeAllConnections?.() })
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

// ── the film ────────────────────────────────────────────────────────────────────

/**
 * In the page: time runs `slow` times slower for scripts (timers, animation frames, the
 * monotonic clock), so everything a page does by itself (a debounce, a poll, a toast that
 * leaves, an animation in script) takes as many frames of the film as it should. The wall
 * clock (Date) is left alone: it is compared with the server's. CSS animations and
 * transitions are slowed separately (the browser's own playback rate, in `film`).
 */
function slowTime(slow) {
  if (window.__slow) return
  window.__slow = slow
  const real = performance.now.bind(performance)
  const t0 = real()
  const scaled = (t) => t0 + (t - t0) / slow
  performance.now = () => scaled(real())
  const { setTimeout: st, setInterval: si, requestAnimationFrame: raf } = window
  window.setTimeout = (fn, ms, ...rest) => st(fn, (Number(ms) || 0) * slow, ...rest)
  window.setInterval = (fn, ms, ...rest) => si(fn, (Number(ms) || 0) * slow, ...rest)
  window.requestAnimationFrame = (fn) => raf((t) => fn(scaled(t)))
}

/**
 * Film what a context's page shows. `page` may change its site and its process on the way.
 *
 *   const reel = await film(context, page, { out, fps: 60, slow: 8, scale: 2 })
 *   … drive the page with hand(page, reel) …
 *   await reel.cut()         // writes the MP4
 *
 * How: the page lives `slow` times slower than the film; every 1/fps of the film (slow/fps of
 * real time) its picture is taken at `scale` device pixels per CSS pixel and handed to ffmpeg.
 * A picture that does not come in time (the page is between two documents) is replaced by the
 * one before it; `reel.stats()` says how often that happened.
 *
 * `reel.wait(ms)` waits in the film's time; `reel.slow` is the factor.
 */
export async function film(context, page, { out, fps = 60, slow = 8, scale = 2, quality = 95, crf = 18, preset = 'medium', ffmpeg = 'ffmpeg' } = {}) {
  const { width, height } = page.viewportSize()
  const every = (1000 * slow) / fps
  mkdirSync(join(out, '..'), { recursive: true })

  // CSS animations and transitions at the film's pace, on every document of the page.
  let animations = null
  const slowAnimations = async () => {
    try {
      animations ??= await context.newCDPSession(page)
      await animations.send('Animation.enable')
      await animations.send('Animation.setPlaybackRate', { playbackRate: 1 / slow })
    }
    catch { animations = null }
  }
  await slowAnimations()
  const onNavigated = (frame) => { if (frame === page.mainFrame()) void slowAnimations() }
  page.on('framenavigated', onNavigated)

  // JPEG pictures in, H.264 out. JPEG is full-range BT.601; the film is tagged and converted to
  // the BT.709 video range every player expects.
  const encoder = spawn(ffmpeg, [
    '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_range=full:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709:flags=lanczos+accurate_rnd,format=yuv420p',
    '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-g', String(fps * 2), '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', out,
  ], { stdio: ['pipe', 'ignore', 'pipe'] })
  let encoderError = ''
  encoder.stderr.on('data', (d) => { encoderError += d })
  const done = new Promise((ok) => encoder.on('close', (code) => ok(code)))
  const feed = (buffer) => new Promise((ok) => { if (encoder.stdin.write(buffer)) ok(); else encoder.stdin.once('drain', ok) })

  let cdp = await context.newCDPSession(page)
  const shoot = async () => {
    const { cssVisualViewport: v } = await cdp.send('Page.getLayoutMetrics')
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, clip: { x: v.pageX, y: v.pageY, width, height, scale }, captureBeyondViewport: false })
    return Buffer.from(shot.data, 'base64')
  }

  let running = true
  let frames = 0, repeated = 0, late = 0
  let last = null
  const began = performance.now()
  const loop = (async () => {
    while (running) {
      const due = began + frames * every
      const wait = due - performance.now()
      if (wait > 0) await sleep(wait)
      let picture = null
      try {
        picture = await Promise.race([shoot(), sleep(Math.max(every * 0.9, 250)).then(() => null)])
      }
      catch {
        // Between two sites the page changes its process: take a new line to it.
        try { cdp = await context.newCDPSession(page) } catch { /* the page is closing */ }
      }
      if (!picture) { picture = last; if (picture) repeated++ }
      if (!picture) continue
      last = picture
      // Every slot of the film gets a picture: slots that passed meanwhile get this one too.
      const behind = Math.floor((performance.now() - began) / every) - frames
      const copies = 1 + Math.max(0, Math.min(behind, fps))
      if (copies > 1) late += copies - 1
      for (let i = 0; i < copies; i++) { await feed(picture); frames++ }
    }
  })()

  return {
    slow, fps, width, height, scale,
    /** Wait in the film's time. */
    wait: (ms) => sleep(ms * slow),
    /** The length of the film so far, in seconds. */
    length: () => frames / fps,
    stats: () => ({ frames, seconds: Math.round((frames / fps) * 10) / 10, repeated, late }),
    async cut() {
      running = false
      await Promise.race([loop, sleep(5000)])
      page.off('framenavigated', onNavigated)
      encoder.stdin.end()
      const code = await done
      if (code !== 0 || !existsSync(out)) throw new Error(`ffmpeg could not make ${out}: ${encoderError.slice(-600)}`)
      return { file: out, bytes: statSync(out).size, ...this.stats() }
    },
  }
}

/** Slow every page of a context down for a film (before its first page is opened). */
export const slowDown = (context, slow) => context.addInitScript(slowTime, slow)

/** A smaller copy of a film (the 1080p one for sharing). */
export async function smallerCopy(file, out, { width, height, crf = 20, ffmpeg = 'ffmpeg' }) {
  await run(ffmpeg, ['-loglevel', 'error', '-y', '-i', file, '-vf', `scale=${width}:${height}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', '-an', out], { maxBuffer: 1 << 26 })
  return { file: out, bytes: statSync(out).size }
}

// ── a visible mouse, or finger ──────────────────────────────────────────────────

/**
 * Draws the pointer on every page of the context (a film has none of its own): an arrow, or a
 * round touch point, that follows the real pointer, with a ring at each click. A new page asks
 * where the pointer is (`where()`), so it is there from the page's first picture.
 */
export async function drawPointer(context, { touch = false, where }) {
  await context.exposeBinding('__pointerHome', () => where())
  await context.addInitScript((touch) => {
    // A page inside the page (the admin's live preview) passes the pointer's place up.
    if (window.top !== window) {
      const up = (type) => (e) => {
        try {
          const frame = window.frameElement
          if (!frame) return
          const r = frame.getBoundingClientRect()
          const k = frame.offsetWidth ? r.width / frame.offsetWidth : 1
          window.parent.postMessage({ __pointer: type, x: r.left + e.clientX * k, y: r.top + e.clientY * k }, '*')
        }
        catch { /* another site's page: nothing to pass */ }
      }
      window.addEventListener('mousemove', up('move'), true)
      window.addEventListener('mousedown', up('down'), true)
      window.addEventListener('mouseup', up('up'), true)
      return
    }
    let el = null, ring = null
    const at = { x: -100, y: -100 }
    const draw = () => { if (el) el.style.transform = `translate(${at.x}px,${at.y}px)` }
    const make = () => {
      if (el?.isConnected || !document.documentElement) return
      el = document.createElement('div')
      el.id = '__pointer'
      el.setAttribute('aria-hidden', 'true')
      el.innerHTML = touch
        ? '<div class="__tip" style="width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(40,42,48,.26);border:2px solid rgba(255,255,255,.95);box-shadow:0 2px 10px rgba(0,0,0,.28);transition:transform 120ms ease-out, background 120ms"></div>'
        : '<svg class="__tip" width="26" height="38" viewBox="0 0 26 38" style="display:block;margin:-2px 0 0 -3px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));transform-origin:4px 3px;transition:transform 110ms ease-out"><path d="M4 3 L4 27.5 L9.6 22.3 L13.6 31.6 L17.5 29.9 L13.6 20.8 L21.4 20.8 Z" fill="#111214" stroke="#fff" stroke-width="1.9" stroke-linejoin="round"/></svg>'
      Object.assign(el.style, { position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none', willChange: 'transform' })
      ring = document.createElement('div')
      ring.id = '__pointer_ring'
      Object.assign(ring.style, { position: 'fixed', left: '0', top: '0', width: '52px', height: '52px', margin: '-26px 0 0 -26px', borderRadius: '50%', border: '3px solid #C8644F', background: 'rgba(200,100,79,.14)', zIndex: '2147483646', pointerEvents: 'none', opacity: '0' })
      document.documentElement.append(ring, el)
      draw()
    }
    const move = (x, y) => { at.x = x; at.y = y; make(); draw() }
    const press = (down) => {
      make()
      const tip = el.querySelector('.__tip')
      tip.style.transform = down ? 'scale(.84)' : 'none'
      if (touch) tip.style.background = down ? 'rgba(40,42,48,.42)' : 'rgba(40,42,48,.26)'
      if (!down) return
      ring.style.transition = 'none'
      ring.style.opacity = '1'
      ring.style.transform = `translate(${at.x}px,${at.y}px) scale(.35)`
      void ring.offsetWidth
      ring.style.transition = 'transform 480ms cubic-bezier(.2,.7,.2,1), opacity 480ms ease-out'
      ring.style.transform = `translate(${at.x}px,${at.y}px) scale(1.2)`
      ring.style.opacity = '0'
    }
    window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY), true)
    window.addEventListener('mousedown', () => press(true), true)
    window.addEventListener('mouseup', () => press(false), true)
    window.addEventListener('message', (e) => {
      const m = e.data
      if (!m || typeof m !== 'object' || !m.__pointer) return
      if (m.__pointer === 'move') move(m.x, m.y)
      else { move(m.x, m.y); press(m.__pointer === 'down') }
    })
    const start = () => { make(); window.__pointerHome?.().then((p) => { if (p && at.x < 0) move(p.x, p.y) }).catch(() => {}) }
    start()
    document.addEventListener('DOMContentLoaded', start)
  }, touch)
}

/**
 * A hand on the mouse, at the film's pace: it travels (never jumps), slows down as it arrives,
 * presses visibly, types letter by letter and scrolls the way a wheel is turned. Every wait is
 * in the film's time. `reel` is the film (`film()`), or null to act in real time.
 */
export function hand(page, reel, { start = { x: 720, y: 450 } } = {}) {
  const fps = reel?.fps ?? 60
  const wait = (ms) => (reel ? reel.wait(ms) : sleep(ms))
  const frame = () => wait(1000 / fps)
  let at = { ...start }
  // Slow out, slow in, never a constant speed: the curve of a reaching hand.
  const ease = (t) => t * t * t * (t * (6 * t - 15) + 10)
  const rand = (a, b) => a + Math.random() * (b - a)

  async function travel(x, y, { ms } = {}) {
    const from = { ...at }
    const dist = Math.hypot(x - from.x, y - from.y)
    if (dist < 1) return
    // Longer ways take longer, but not in proportion.
    const time = ms ?? Math.min(1150, 260 + 26 * Math.sqrt(dist) + rand(-40, 60))
    const steps = Math.max(4, Math.round((time / 1000) * fps))
    // A slight arc, as a wrist makes.
    const bend = Math.min(46, dist * 0.09) * (Math.random() < 0.5 ? -1 : 1)
    const nx = -(y - from.y) / dist, ny = (x - from.x) / dist
    for (let i = 1; i <= steps; i++) {
      const t = ease(i / steps)
      const arc = Math.sin(Math.PI * t) * bend
      at = { x: from.x + (x - from.x) * t + nx * arc, y: from.y + (y - from.y) * t + ny * arc }
      await page.mouse.move(at.x, at.y)
      await frame()
    }
    at = { x, y }
  }

  /** A point on what the locator shows, scrolled into view first when it is outside. */
  async function aim(locator, { spot } = {}) {
    await locator.waitFor({ state: 'visible', timeout: 60_000 })
    const view = page.viewportSize()
    let box = await locator.boundingBox()
    if (!box) throw new Error('nothing to point at')
    // Out of view: turn the wheel until its middle is comfortably on the screen.
    const middle = box.y + box.height / 2
    if (middle < 90 || middle > view.height - 110) {
      await api.scroll(middle - view.height * 0.5, { ms: Math.min(1400, 500 + Math.abs(middle - view.height / 2) * 0.6) })
      box = await locator.boundingBox()
      if (!box) throw new Error('nothing to point at')
    }
    const fx = spot?.x ?? rand(0.38, 0.62), fy = spot?.y ?? rand(0.42, 0.58)
    return { x: box.x + box.width * fx, y: Math.min(view.height - 6, Math.max(6, box.y + box.height * fy)) }
  }

  const api = {
    where: () => ({ ...at }),
    wait,
    /** Hold on a finished screen so it can be read. */
    read: (ms = 1000) => wait(ms),
    /** Put the pointer somewhere without travelling (before the film starts). */
    async place(x, y) { at = { x, y }; await page.mouse.move(x, y) },
    /** A new page has loaded: show the pointer where the hand is. */
    async settle() { await page.mouse.move(at.x + 0.5, at.y); await page.mouse.move(at.x, at.y) },
    /** Go somewhere out of the way of what is being read. */
    rest: (x, y, opts) => travel(x, y, opts),
    async hover(locator, opts) { const p = await aim(locator, opts); await travel(p.x, p.y) },
    async click(locator, { after = 420, spot } = {}) {
      const p = await aim(locator, { spot })
      await travel(p.x, p.y)
      await wait(rand(110, 190))
      await page.mouse.down()
      await wait(90)
      await page.mouse.up()
      await wait(after)
    },
    /** Click a field and type into it, letter by letter. */
    async type(locator, text, { clear = false, after = 350 } = {}) {
      await api.click(locator, { after: 260 })
      if (clear) { await page.keyboard.press('ControlOrMeta+a'); await wait(160); await page.keyboard.press('Backspace'); await wait(260) }
      for (const ch of text) {
        await page.keyboard.type(ch)
        await wait(rand(55, 125) + (ch === ' ' ? 70 : 0) + (Math.random() < 0.06 ? 160 : 0))
      }
      await wait(after)
    },
    async key(name, { after = 300 } = {}) { await page.keyboard.press(name); await wait(after) },
    /** Turn the wheel by `dy` pixels over `ms` of the film: starting and stopping softly. */
    async scroll(dy, { ms = 1100, after = 250 } = {}) {
      const steps = Math.max(6, Math.round((ms / 1000) * fps))
      let sent = 0
      for (let i = 1; i <= steps; i++) {
        const target = Math.round(dy * ease(i / steps))
        if (target !== sent) { await page.mouse.wheel(0, target - sent); sent = target }
        await frame()
      }
      await wait(after)
    },
  }
  return api
}

/** One line about a finished film, for the log. */
export const filmLine = (r) => `${r.file.split('/').pop()}: ${r.seconds} s, ${(r.bytes / 1e6).toFixed(1)} MB, ${r.frames} frames (${r.repeated} repeated, ${r.late} late)`
export { log }

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// The public demo puts itself back to the seeded content every night (nuxt.config:
// scheduledTasks). Only where it is switched on — SITE_DEMO_RESET=true plus an
// administrator to sign in as (SEED_EMAIL, SEED_PASSWORD) — so the website itself
// never resets. Runs the image's own scripts/reset.mjs against this instance.
export default defineTask({
  meta: { name: 'site:demo-reset', description: 'Reset the demo to its seeded content' },
  async run() {
    if (process.env.SITE_DEMO_RESET !== 'true') return { result: 'off' }
    const script = join(process.cwd(), 'scripts', 'reset.mjs')
    if (!existsSync(script) || !process.env.SEED_PASSWORD) {
      console.error('[site] demo reset: missing scripts/reset.mjs or SEED_PASSWORD')
      return { result: 'misconfigured' }
    }
    const port = process.env.PORT || '3000'
    const code = await new Promise<number>((resolve) => {
      const child = spawn(process.execPath, [script], {
        stdio: 'inherit',
        env: { ...process.env, SEED_URL: process.env.SEED_URL || 'http://127.0.0.1:' + port },
      })
      child.on('close', (c) => resolve(c ?? 1))
      child.on('error', () => resolve(1))
    })
    console.info(code === 0 ? '[site] demo reset: done' : '[site] demo reset failed: exit ' + code)
    return { result: code === 0 ? 'done' : 'failed' }
  },
})

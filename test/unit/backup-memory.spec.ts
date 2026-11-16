import { spawn } from 'node:child_process'
import { closeSync, mkdtempSync, openSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3'
import { repoRoot } from '../setup/database'

// `tinyzoo backup` copies each file of the media library into the archive. A 400 MB video
// used to be read whole into memory first (1.56 GB for it); now it streams to disk. Measured
// in a child process (its own peak memory), against a bucket that makes the object up as it is read.
const MB = 1024 * 1024
let s3: FakeS3
let dir: string
beforeAll(async () => { s3 = await startFakeS3(); dir = mkdtempSync(join(tmpdir(), 'backup-memory-')) })
afterAll(async () => { await s3?.close(); rmSync(dir, { recursive: true, force: true }) })

function runChild(script: string): Promise<{ code: number | null; out: string; err: string }> {
  const file = join(dir, 'child.mts')
  writeFileSync(file, script)
  return new Promise((resolve) => {
    const child = spawn(join(repoRoot, 'packages/cms/node_modules/.bin/tsx'), [file], { cwd: repoRoot, env: { ...process.env } })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { err += d })
    child.on('close', (code) => resolve({ code, out, err }))
  })
}

describe('backup of the media', () => {
  it('copies a 500 MB file from the bucket without holding it in memory, byte for byte', async () => {
    const SIZE = 500 * MB
    s3.putGenerated('2026/11/film.mp4', SIZE, 'video/mp4')
    const target = join(dir, 'media')
    const script = `
      import { copyMedia, s3Store } from ${JSON.stringify(join(repoRoot, 'packages/cms/cli/backup.ts'))}
      const store = s3Store({ endpoint: ${JSON.stringify(s3.endpoint)}, region: 'us-east-1', bucket: ${JSON.stringify(s3.bucket)}, accessKeyId: ${JSON.stringify(s3.accessKeyId)}, secretAccessKey: ${JSON.stringify(s3.secretAccessKey)} } as any)
      const done = await copyMedia(store, [{ key: '2026/11/film.mp4', mime: 'video/mp4' }, { key: '2026/11/gone.mp4', mime: 'video/mp4' }], ${JSON.stringify(target)})
      console.log(JSON.stringify({ ...done, maxRssMb: process.resourceUsage().maxRSS / 1024 }))
    `
    const res = await runChild(script)
    expect(res.code, res.err).toBe(0)
    const done = JSON.parse(res.out.trim().split('\n').pop()!)
    expect(done.media).toEqual([{ key: '2026/11/film.mp4', mime: 'video/mp4', size: SIZE }])
    expect(done.missing).toEqual(['2026/11/gone.mp4'])
    expect(statSync(join(target, '2026/11/film.mp4')).size).toBe(SIZE)
    // The pattern is byte i = i % 251: spot-check the start, a middle and the end.
    const fd = openSync(join(target, '2026/11/film.mp4'), 'r')
    try {
      for (const i of [0, 1, 250, 251, 150 * MB, SIZE - 1]) {
        const one = Buffer.alloc(1)
        readSync(fd, one, 0, 1, i)
        expect(one[0], `byte ${i}`).toBe(i % 251)
      }
    }
    finally { closeSync(fd) }
    // Reading it whole took 3.5 times its size (1 GB for 300 MB). Streaming leaves the process at
    // its own ~100 MB plus the short-lived buffers Node has not collected yet (about 160 MB, whatever the size).
    expect(done.maxRssMb, `peak memory ${done.maxRssMb.toFixed(0)} MB`).toBeLessThan(350)
  }, 120_000)
})

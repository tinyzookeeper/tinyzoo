import { describe, expect, it } from 'vitest'
import { cmsImageJob, cmsImageQueueState, cmsSharp } from '../../packages/cms/server/utils/cmsImageQueue'

// Every picture the server decodes goes through one queue: one job at a time per process, and a
// visitor's job before background work (server/utils/cmsImageQueue.ts).

const tick = () => new Promise((r) => setTimeout(r, 5))

describe('the picture queue', () => {
  it('runs one job at a time, however many are waiting', async () => {
    let running = 0
    let most = 0
    const job = async () => {
      running++
      most = Math.max(most, running)
      await tick()
      running--
    }
    await Promise.all([
      ...Array.from({ length: 8 }, () => cmsImageJob(job, 'now')),
      ...Array.from({ length: 8 }, () => cmsImageJob(job, 'background')),
    ])
    expect(most).toBe(1)
    expect(cmsImageQueueState()).toEqual({ running: 0, waiting: 0 })
  })

  it('lets a visitor\'s job go before the background jobs that wait, not before the one that runs', async () => {
    const order: string[] = []
    const job = (name: string) => async () => { order.push(name); await tick() }
    const all = [
      cmsImageJob(job('background 1'), 'background'),
      cmsImageJob(job('background 2'), 'background'),
      cmsImageJob(job('background 3'), 'background'),
    ]
    await tick() // background 1 is running
    all.push(cmsImageJob(job('visitor'), 'now'))
    await Promise.all(all)
    expect(order).toEqual(['background 1', 'visitor', 'background 2', 'background 3'])
  })

  it('goes on after a job that fails, and hands the failure to whoever waits for it', async () => {
    const failed = cmsImageJob(async () => { throw new Error('damaged file') })
    const next = cmsImageJob(async () => 'drawn')
    await expect(failed).rejects.toThrow('damaged file')
    await expect(next).resolves.toBe('drawn')
  })

  it('sets sharp up for a small server: one thread per picture, no cache of decoded files', () => {
    const sharp = cmsSharp()
    expect(sharp.concurrency()).toBe(1)
    expect(sharp.cache()).toMatchObject({ files: { max: 0 }, items: { max: 0 } })
  })
})

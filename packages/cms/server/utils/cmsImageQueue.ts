import sharp from 'sharp'

// Every picture the server decodes goes through this queue: one at a time per process.
//
// A decoded photo is big (a 12-megapixel phone picture is about 50 MB of pixels), and a page
// asks for all its pictures at once. Decoded side by side, a dozen of them took a site with
// 256 MB of memory over its limit and the host killed it. One at a time, a burst only waits a
// little longer; memory stays where one picture puts it.
//
// sharp is told the same: one thread per picture (its default is one per CPU core the machine
// has, which in a container is the host's cores, not the container's share) and no cache of
// decoded files (the queue never decodes the same file twice in a row, so the cache would only
// hold memory). Only code that goes through `cmsSharp()` gets these settings applied first.
//
// Two lanes: `now` (a visitor waits for the answer) goes before `background` (sizes made after
// an upload, or for pictures uploaded before sizes were made that way). A background job never
// holds up a visitor for longer than the one step that is already running.

const configured = processWide({ done: false }, 'sharp is set up once for the whole process')

/** sharp, set up for a small server (one thread per picture, no cache). */
export function cmsSharp(): typeof sharp {
  if (!configured.done) {
    sharp.concurrency(1)
    sharp.cache(false)
    configured.done = true
  }
  return sharp
}

/** Which lane a job waits in: `now` when a visitor waits for it, else `background`. */
export type CmsImageLane = 'now' | 'background'

interface Job {
  run: () => Promise<unknown>
  resolve: (value: any) => void
  reject: (err: unknown) => void
}

const MAX_RUNNING = 1
// One queue for the whole process on purpose: sharp decodes one picture at a time, whichever site asked.
const lanes = processWide<Record<CmsImageLane, Job[]>>({ now: [], background: [] }, 'one picture at a time for the whole process')
const state = processWide({ running: 0 }, 'one picture at a time for the whole process')

function next(): void {
  while (state.running < MAX_RUNNING) {
    const job = lanes.now.shift() ?? lanes.background.shift()
    if (!job) return
    state.running++
    // A job that throws synchronously still ends here; the queue never stalls on one.
    Promise.resolve()
      .then(job.run)
      .then(job.resolve, job.reject)
      .finally(() => { state.running--; next() })
  }
}

/**
 * Run `work` when it is its turn: at most one picture job runs at a time in this process.
 * Keep a job to one step (one decode, one size): a visitor's job waits for the step that is
 * running, not for a whole picture's worth of sizes.
 */
export function cmsImageJob<T>(work: () => Promise<T>, lane: CmsImageLane = 'now'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // The next job starts from the previous one's .finally: each runs in the site that queued it.
    lanes[lane].push({ run: bindToSite(work), resolve, reject })
    next()
  })
}

/** How busy the queue is (for the status and the tests). */
export function cmsImageQueueState(): { running: number; waiting: number } {
  return { running: state.running, waiting: lanes.now.length + lanes.background.length }
}

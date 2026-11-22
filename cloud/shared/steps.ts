// How a website gets made, as a small state machine kept in the database (sites.steps):
// four steps in a fixed order, each pending → running → done, or failed with a reason.
// Pure functions over plain data, so the server can store, resume and retry them, and
// the browser can draw them.

export const STEP_IDS = ['database', 'start', 'content', 'account'] as const
export type StepId = typeof STEP_IDS[number]
export type StepState = 'pending' | 'running' | 'done' | 'failed'

export interface Step {
  id: StepId
  state: StepState
  /** ISO times of the latest attempt. */
  startedAt: string | null
  finishedAt: string | null
  /** Why it failed: a short code the pages put into words (see the dictionary's `fail.*`). */
  message: string | null
  /** How many times it was started. */
  attempts: number
}

const blank = (id: StepId): Step => ({ id, state: 'pending', startedAt: null, finishedAt: null, message: null, attempts: 0 })

export function initialSteps(): Step[] {
  return STEP_IDS.map(blank)
}

const STATES: ReadonlySet<string> = new Set(['pending', 'running', 'done', 'failed'])

/** The steps as stored, made whole: unknown steps dropped, missing ones added as pending, in order. */
export function normalizeSteps(raw: unknown): Step[] {
  const list = Array.isArray(raw) ? raw : []
  return STEP_IDS.map((id) => {
    const s = list.find((x) => x && typeof x === 'object' && (x as any).id === id) as Partial<Step> | undefined
    if (!s) return blank(id)
    return {
      id,
      state: STATES.has(String(s.state)) ? s.state as StepState : 'pending',
      startedAt: typeof s.startedAt === 'string' ? s.startedAt : null,
      finishedAt: typeof s.finishedAt === 'string' ? s.finishedAt : null,
      message: typeof s.message === 'string' ? s.message : null,
      attempts: Number.isInteger(s.attempts) && s.attempts! > 0 ? s.attempts! : 0,
    }
  })
}

const indexOf = (id: StepId) => STEP_IDS.indexOf(id)
const patch = (steps: Step[], id: StepId, change: Partial<Step>): Step[] => steps.map((s) => (s.id === id ? { ...s, ...change } : s))
const iso = (now: Date | string) => (typeof now === 'string' ? now : now.toISOString())

export class StepOrderError extends Error {}

/**
 * Start a step. Every step before it must be done, and nothing else may be running. Starting
 * a step that is already done changes nothing (a driver reports its steps again on a resume).
 */
export function beginStep(steps: Step[], id: StepId, now: Date | string = new Date()): Step[] {
  const step = steps[indexOf(id)]
  if (!step) throw new StepOrderError(`Unknown step: ${id}`)
  if (step.state === 'done') return steps
  const before = steps.slice(0, indexOf(id)).find((s) => s.state !== 'done')
  if (before) throw new StepOrderError(`"${id}" cannot start before "${before.id}" is done`)
  const other = steps.find((s) => s.state === 'running' && s.id !== id)
  if (other) throw new StepOrderError(`"${id}" cannot start while "${other.id}" is running`)
  if (step.state === 'running') return steps
  return patch(steps, id, { state: 'running', startedAt: iso(now), finishedAt: null, message: null, attempts: step.attempts + 1 })
}

/** Finish a running step. Finishing a done step changes nothing; a step that never started cannot finish. */
export function completeStep(steps: Step[], id: StepId, now: Date | string = new Date()): Step[] {
  const step = steps[indexOf(id)]
  if (!step) throw new StepOrderError(`Unknown step: ${id}`)
  if (step.state === 'done') return steps
  if (step.state !== 'running') throw new StepOrderError(`"${id}" cannot finish: it is ${step.state}`)
  return patch(steps, id, { state: 'done', finishedAt: iso(now), message: null })
}

/**
 * Mark a step failed, with why. A step that is done stays done. A step that failed before it
 * was even started (something was wrong before the work began) counts as tried once.
 */
export function failStep(steps: Step[], id: StepId, message: string, now: Date | string = new Date()): Step[] {
  const step = steps[indexOf(id)]
  if (!step) throw new StepOrderError(`Unknown step: ${id}`)
  if (step.state === 'done') return steps
  const begun = step.state === 'running'
  return patch(steps, id, { state: 'failed', finishedAt: iso(now), message, startedAt: begun ? step.startedAt ?? iso(now) : iso(now), attempts: begun ? step.attempts : step.attempts + 1 })
}

/**
 * Ready to go on after a failure or a restart of the server: what is done stays done, a step
 * that failed or was cut off mid-way waits again (keeping how often it was tried).
 */
export function resumeSteps(steps: Step[]): Step[] {
  return steps.map((s) => (s.state === 'done' ? s : { ...s, state: 'pending', finishedAt: null, message: null }))
}

/** The step to run next (the first that is not done), or null when all are. */
export function nextStep(steps: Step[]): StepId | null {
  return steps.find((s) => s.state !== 'done')?.id ?? null
}

export const isDone = (steps: Step[], id: StepId): boolean => steps[indexOf(id)]?.state === 'done'
export const failedStep = (steps: Step[]): Step | null => steps.find((s) => s.state === 'failed') ?? null
export const runningStep = (steps: Step[]): Step | null => steps.find((s) => s.state === 'running') ?? null

/** The whole run in one word. */
export function overall(steps: Step[]): StepState {
  if (steps.every((s) => s.state === 'done')) return 'done'
  if (steps.some((s) => s.state === 'failed')) return 'failed'
  if (steps.some((s) => s.state === 'running' || s.state === 'done')) return 'running'
  return 'pending'
}

/** How far along, 0 to 1: done steps count whole, a running one half. */
export function progress(steps: Step[]): number {
  if (!steps.length) return 0
  const sum = steps.reduce((n, s) => n + (s.state === 'done' ? 1 : s.state === 'running' ? 0.5 : 0), 0)
  return sum / steps.length
}

/** How long a step took, in milliseconds, or null while it has not finished. */
export function stepDuration(step: Step): number | null {
  if (!step.startedAt || !step.finishedAt) return null
  const ms = Date.parse(step.finishedAt) - Date.parse(step.startedAt)
  return Number.isFinite(ms) && ms >= 0 ? ms : null
}

import { describe, expect, it } from 'vitest'
import {
  beginStep, completeStep, failedStep, failStep, initialSteps, isDone, nextStep, normalizeSteps, overall, progress, resumeSteps,
  runningStep, STEP_IDS, stepDuration, StepOrderError, type Step,
} from '../../cloud/shared/steps'

// How a website gets made in the hosted product: four steps in order, stored in the database,
// resumable after a failure or a restart of the server.
const T0 = '2026-11-22T10:00:00.000Z'
const T1 = '2026-11-22T10:00:01.500Z'
const states = (steps: Step[]) => steps.map((s) => s.state)
const run = (steps: Step[], ...ids: (typeof STEP_IDS)[number][]) => ids.reduce((acc, id) => completeStep(beginStep(acc, id, T0), id, T1), steps)

describe('the steps of making a site', () => {
  it('are four, in a fixed order, all waiting at first', () => {
    expect(STEP_IDS).toEqual(['database', 'start', 'content', 'account'])
    const steps = initialSteps()
    expect(states(steps)).toEqual(['pending', 'pending', 'pending', 'pending'])
    expect(steps.every((s) => s.attempts === 0 && s.startedAt === null && s.finishedAt === null && s.message === null)).toBe(true)
    expect(nextStep(steps)).toBe('database')
    expect(overall(steps)).toBe('pending')
    expect(progress(steps)).toBe(0)
  })

  it('run one after another to the end', () => {
    let steps = initialSteps()
    steps = beginStep(steps, 'database', T0)
    expect(states(steps)).toEqual(['running', 'pending', 'pending', 'pending'])
    expect(runningStep(steps)?.id).toBe('database')
    expect(overall(steps)).toBe('running')
    expect(progress(steps)).toBe(0.125)
    steps = completeStep(steps, 'database', T1)
    expect(steps[0]).toMatchObject({ state: 'done', startedAt: T0, finishedAt: T1, attempts: 1 })
    expect(stepDuration(steps[0]!)).toBe(1500)
    expect(nextStep(steps)).toBe('start')
    steps = run(steps, 'start', 'content', 'account')
    expect(states(steps)).toEqual(['done', 'done', 'done', 'done'])
    expect(nextStep(steps)).toBeNull()
    expect(overall(steps)).toBe('done')
    expect(progress(steps)).toBe(1)
  })

  it('never change the steps they are given', () => {
    const steps = initialSteps()
    const copy = JSON.stringify(steps)
    beginStep(steps, 'database')
    failStep(steps, 'database', 'x')
    resumeSteps(steps)
    expect(JSON.stringify(steps)).toBe(copy)
  })

  it('refuse a step out of order', () => {
    const steps = initialSteps()
    expect(() => beginStep(steps, 'start')).toThrow(StepOrderError)
    expect(() => beginStep(steps, 'account')).toThrow(/cannot start before "database"/)
    expect(() => completeStep(steps, 'database')).toThrow(/cannot finish/)
    const one = beginStep(steps, 'database')
    expect(() => beginStep(one, 'start')).toThrow(StepOrderError)
    expect(() => beginStep(steps, 'nope' as never)).toThrow(/Unknown step/)
  })

  it('take a second report of the same thing calmly', () => {
    // A hosting driver reports its steps again when a site is resumed.
    const begun = beginStep(initialSteps(), 'database', T0)
    expect(beginStep(begun, 'database', T1)).toBe(begun)
    const done = completeStep(begun, 'database', T1)
    expect(beginStep(done, 'database')).toBe(done)
    expect(completeStep(done, 'database')).toBe(done)
    expect(done[0]!.attempts).toBe(1)
  })
})

describe('a failure', () => {
  it('is written on the step, with its reason', () => {
    let steps = run(initialSteps(), 'database')
    steps = failStep(beginStep(steps, 'start', T0), 'start', 'start_timeout', T1)
    expect(states(steps)).toEqual(['done', 'failed', 'pending', 'pending'])
    expect(failedStep(steps)).toMatchObject({ id: 'start', message: 'start_timeout', finishedAt: T1, attempts: 1 })
    expect(overall(steps)).toBe('failed')
    expect(nextStep(steps)).toBe('start')
  })

  it('before the step even started counts as one try', () => {
    const steps = failStep(initialSteps(), 'database', 'template_not_built', T0)
    expect(steps[0]).toMatchObject({ state: 'failed', attempts: 1, startedAt: T0, finishedAt: T0, message: 'template_not_built' })
  })

  it('never undoes a step that is done', () => {
    const steps = run(initialSteps(), 'database')
    expect(failStep(steps, 'database', 'late')).toBe(steps)
  })
})

describe('going on', () => {
  it('after a failure: what is done stays, the failed step waits again and remembers its tries', () => {
    let steps = run(initialSteps(), 'database', 'start')
    steps = failStep(beginStep(steps, 'content', T0), 'content', 'seed_failed', T1)
    const resumed = resumeSteps(steps)
    expect(states(resumed)).toEqual(['done', 'done', 'pending', 'pending'])
    expect(resumed[2]).toMatchObject({ message: null, finishedAt: null, attempts: 1 })
    expect(nextStep(resumed)).toBe('content')
    const again = completeStep(beginStep(resumed, 'content', T0), 'content', T1)
    expect(again[2]).toMatchObject({ state: 'done', attempts: 2 })
    expect(isDone(again, 'content')).toBe(true)
  })

  it('after the server restarted mid-step: the step that was running waits again', () => {
    const cut = beginStep(run(initialSteps(), 'database'), 'start', T0)
    const resumed = resumeSteps(cut)
    expect(states(resumed)).toEqual(['done', 'pending', 'pending', 'pending'])
    expect(runningStep(resumed)).toBeNull()
    expect(overall(resumed)).toBe('running')
    // Resuming twice is the same as once.
    expect(resumeSteps(resumed)).toEqual(resumed)
  })

  it('leaves a finished run alone', () => {
    const done = run(initialSteps(), 'database', 'start', 'content', 'account')
    expect(resumeSteps(done)).toEqual(done)
  })
})

describe('steps read back from the database', () => {
  it('are made whole: missing ones added, unknown ones dropped, in order', () => {
    const stored = [{ id: 'start', state: 'done', startedAt: T0, finishedAt: T1, attempts: 1 }, { id: 'mystery', state: 'done' }, { id: 'database', state: 'done', attempts: 2 }]
    const steps = normalizeSteps(stored)
    expect(steps.map((s) => s.id)).toEqual([...STEP_IDS])
    expect(states(steps)).toEqual(['done', 'done', 'pending', 'pending'])
    expect(steps[0]!.attempts).toBe(2)
  })

  it('survive nonsense', () => {
    for (const raw of [null, undefined, 'x', 42, {}, [null, 1, 'a'], [{ id: 'database', state: 'exploded', attempts: -3, startedAt: 7 }]]) {
      const steps = normalizeSteps(raw)
      expect(steps).toHaveLength(4)
      expect(states(steps)).toEqual(['pending', 'pending', 'pending', 'pending'])
      expect(steps[0]).toMatchObject({ attempts: 0, startedAt: null })
    }
  })

  it('give no duration until a step has finished', () => {
    expect(stepDuration(initialSteps()[0]!)).toBeNull()
    expect(stepDuration(beginStep(initialSteps(), 'database', T0)[0]!)).toBeNull()
  })
})

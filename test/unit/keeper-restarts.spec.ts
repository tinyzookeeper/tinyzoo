import { describe, expect, it } from 'vitest'
import { memoryGlance, memoryHigh, memoryHint, restartedWithoutDeploy } from '../../keeper/shared/restarts'

// Keeper's restarts without a deploy and memory near the limit, from what a site's status says
// (keeper/shared/restarts.ts).

const MB = 1024 * 1024

describe('restartedWithoutDeploy', () => {
  const before = { startedAt: '2026-11-22T12:00:00.000Z', build: 'b1', at: '2026-11-22T12:40:00.000Z' }

  it('is a new instance, started since the last look, with the same build', () => {
    expect(restartedWithoutDeploy(before, { startedAt: '2026-11-22T12:43:24.000Z', build: 'b1' })).toBe(true)
  })

  it('is not the same instance, nor a deploy (a new build)', () => {
    expect(restartedWithoutDeploy(before, { startedAt: before.startedAt, build: 'b1' })).toBe(false)
    expect(restartedWithoutDeploy(before, { startedAt: '2026-11-22T12:43:24.000Z', build: 'b2' })).toBe(false)
  })

  it('is not another replica that was already running when Keeper last looked', () => {
    expect(restartedWithoutDeploy(before, { startedAt: '2026-11-22T12:10:00.000Z', build: 'b1' })).toBe(false)
    // nor one that started before the one seen last time
    expect(restartedWithoutDeploy(before, { startedAt: '2026-11-22T11:00:00.000Z', build: 'b1' })).toBe(false)
  })

  it('says nothing when it cannot be sure: no previous status, or a build it could not read', () => {
    expect(restartedWithoutDeploy({}, { startedAt: '2026-11-22T12:43:24.000Z', build: 'b1' })).toBe(false)
    expect(restartedWithoutDeploy({ ...before, build: null }, { startedAt: '2026-11-22T12:43:24.000Z', build: 'b1' })).toBe(false)
    expect(restartedWithoutDeploy(before, { startedAt: '2026-11-22T12:43:24.000Z', build: null })).toBe(false)
  })
})

describe('memory', () => {
  it('is a share of the limit, taking the larger of now and the peak', () => {
    expect(memoryGlance({ rss: 100 * MB, limit: 256 * MB, peak: 230 * MB })).toEqual({ rss: 100 * MB, limit: 256 * MB, peak: 230 * MB, percent: 90 })
    expect(memoryGlance({ rss: 128 * MB, limit: 256 * MB, peak: null })?.percent).toBe(50)
  })

  it('has no share without a limit, and nothing before tinyzoo 1.10', () => {
    expect(memoryGlance({ rss: 100 * MB, limit: null, peak: null })).toEqual({ rss: 100 * MB, limit: null, peak: null, percent: null })
    expect(memoryGlance(undefined)).toBeNull()
  })

  it('is high from 80 % of the limit', () => {
    expect(memoryHigh(memoryGlance({ rss: 205 * MB, limit: 256 * MB, peak: null }))).toBe(true)
    expect(memoryHigh(memoryGlance({ rss: 200 * MB, limit: 256 * MB, peak: null }))).toBe(false)
    expect(memoryHigh(memoryGlance({ rss: 900 * MB, limit: null, peak: null }))).toBe(false)
  })

  it('points at memory before a restart only when the peak was at 90 % of the limit', () => {
    expect(memoryHint(243 * MB, 256 * MB)).toBe('memory was at 243 of 256 MB')
    expect(memoryHint(200 * MB, 256 * MB)).toBeNull()
    expect(memoryHint(243 * MB, null)).toBeNull()
    expect(memoryHint(null, 256 * MB)).toBeNull()
  })
})

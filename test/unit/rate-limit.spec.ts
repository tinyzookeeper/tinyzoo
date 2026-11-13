import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rateLimitOk } from '../../packages/cms/server/utils/cmsRateLimit'

describe('rateLimitOk (sliding window)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('allows up to max per window, then refuses until the window slides', () => {
    const key = `k-${Math.random()}`
    expect([1, 2, 3].map(() => rateLimitOk(key, 3, 1000))).toEqual([true, true, true])
    expect(rateLimitOk(key, 3, 1000)).toBe(false)
    vi.advanceTimersByTime(1001)
    expect(rateLimitOk(key, 3, 1000)).toBe(true)
  })

  it('keeps keys independent and treats max <= 0 as unlimited', () => {
    const a = `a-${Math.random()}`
    const b = `b-${Math.random()}`
    rateLimitOk(a, 1, 1000)
    expect(rateLimitOk(a, 1, 1000)).toBe(false)
    expect(rateLimitOk(b, 1, 1000)).toBe(true)
    expect(Array.from({ length: 100 }, () => rateLimitOk(a, 0, 1000)).every(Boolean)).toBe(true)
  })
})

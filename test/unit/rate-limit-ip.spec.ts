import { describe, expect, it } from 'vitest'
import { pickClientIp, rateLimitKeyCount, rateLimitOk } from '../../packages/cms/server/utils/cmsRateLimit'

describe('client IP behind proxies', () => {
  it('reads X-Forwarded-For from the end, as many hops as there are trusted proxies', () => {
    // The client wrote "6.6.6.6" itself; the ingress appended the real address.
    expect(pickClientIp('6.6.6.6, 203.0.113.7', '10.0.0.2', 1)).toBe('203.0.113.7')
    expect(pickClientIp('6.6.6.6, 203.0.113.7, 10.1.1.1', '10.0.0.2', 2)).toBe('203.0.113.7')
  })

  it('uses the socket address when no proxy is trusted or the header is absent', () => {
    expect(pickClientIp('6.6.6.6', '198.51.100.1', 0)).toBe('198.51.100.1')
    expect(pickClientIp(undefined, '198.51.100.1', 1)).toBe('198.51.100.1')
  })
})

describe('rate limiter memory', () => {
  it('stays bounded under a flood of distinct keys', () => {
    for (let i = 0; i < 25_000; i++) rateLimitOk(`flood:${i}:${'x'.repeat(500)}`, 5, 60_000)
    expect(rateLimitKeyCount()).toBeLessThanOrEqual(10_001)
  })
})

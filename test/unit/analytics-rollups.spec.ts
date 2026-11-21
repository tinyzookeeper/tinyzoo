import { describe, expect, it } from 'vitest'
import { answerDays, liveHoursOf, liveListOf, parseRollupsRange, rollupDaysOf } from '../../packages/cms/analytics/core/rollups'

// The pure part of GET /api/content/_analytics/rollups: the range a request asks for and the
// days of the answer (the route itself: test/api/analytics-rollups.spec.ts).
describe('the range of a rollups request', () => {
  it('takes two real days, in order, at most 400 days apart', () => {
    expect(parseRollupsRange('2026-01-01', '2026-01-31')).toEqual({ from: '2026-01-01', to: '2026-01-31' })
    expect(parseRollupsRange('2026-01-01', '2026-01-01')).toEqual({ from: '2026-01-01', to: '2026-01-01' })
    expect(parseRollupsRange('2025-01-01', '2026-02-04')).toEqual({ from: '2025-01-01', to: '2026-02-04' }) // 400 days
    expect(parseRollupsRange('2025-01-01', '2026-02-05')).toEqual({ error: expect.stringContaining('400') })
    expect(parseRollupsRange('2026-02-01', '2026-01-01')).toEqual({ error: expect.any(String) })
    expect(parseRollupsRange('2026-02-30', '2026-03-01')).toEqual({ error: expect.any(String) })
    expect(parseRollupsRange('2026-1-1', '2026-01-02')).toEqual({ error: expect.any(String) })
    expect(parseRollupsRange(undefined, '2026-01-02')).toEqual({ error: expect.any(String) })
    expect(parseRollupsRange(['2026-01-01'], '2026-01-02')).toEqual({ error: expect.any(String) })
  })

  it('answers the days between the first totals and the last ones', () => {
    expect(answerDays('2026-01-01', '2026-01-10', '2026-01-04', '2026-01-06')).toEqual(['2026-01-04', '2026-01-05', '2026-01-06'])
    expect(answerDays('2026-01-05', '2026-01-10', '2026-01-01', '2026-01-20')).toHaveLength(6)
    expect(answerDays('2026-01-01', '2026-01-03', '2026-01-04', '2026-01-06')).toEqual([])
    expect(answerDays('2026-01-01', '2026-01-03', null, null)).toEqual([])
  })
})

describe('the days of the answer', () => {
  const row = (day: string, dimension: string, value: string, visitors: number) =>
    ({ day, dimension, value, visitors, visits: visitors + 1, pageviews: visitors * 2, bounces: 1, engagedMs: 1000 })

  it('has every day, zeros where nobody came, and the four lists with titles of entries', () => {
    const days = rollupDaysOf(['2026-01-01', '2026-01-02'], [
      row('2026-01-01', 'total', '', 9),
      row('2026-01-01', 'page', '/blog/a', 5),
      row('2026-01-01', 'page', '/', 3),
      row('2026-01-01', 'source', 'Google', 6),
      row('2026-01-01', 'country', 'CZ', 9),
      row('2026-01-01', 'device', 'mobile', 7),
      row('2026-01-01', 'browser', 'Chrome', 9), // not a list of the answer
      row('2026-01-05', 'total', '', 1), // not a day of the answer
    ], new Map([['/blog/a', 'Jak péct chleba']]))
    expect(days).toEqual([
      {
        day: '2026-01-01', visitors: 9, visits: 10, pageviews: 18, bounces: 1, engagedMs: 1000,
        pages: [{ value: '/blog/a', title: 'Jak péct chleba', visitors: 5, visits: 6, pageviews: 10 }, { value: '/', visitors: 3, visits: 4, pageviews: 6 }],
        sources: [{ value: 'Google', visitors: 6, visits: 7, pageviews: 12 }],
        countries: [{ value: 'CZ', visitors: 9, visits: 10, pageviews: 18 }],
        devices: [{ value: 'mobile', visitors: 7, visits: 8, pageviews: 14 }],
      },
      { day: '2026-01-02', visitors: 0, visits: 0, pageviews: 0, bounces: 0, engagedMs: 0, pages: [], sources: [], countries: [], devices: [] },
    ])
  })
})

describe('today’s visits (the live answer)', () => {
  it('keeps the first few items of a list, in the rollups’ shape', () => {
    const items = [
      { value: '/blog/a', title: 'Jak péct chleba', entity: 'posts', id: 'x', visitors: 5, visits: 6, pageviews: 9 },
      { value: '/', visitors: 3, visits: 3, pageviews: 3 },
      { value: '/kontakt', title: '', visitors: 1, visits: 1, pageviews: 1 },
    ]
    expect(liveListOf(items, 2)).toEqual([
      { value: '/blog/a', title: 'Jak péct chleba', visitors: 5, visits: 6, pageviews: 9 },
      { value: '/', visitors: 3, visits: 3, pageviews: 3 },
    ])
    expect(liveListOf(items, 10)[2]).toEqual({ value: '/kontakt', visitors: 1, visits: 1, pageviews: 1 })
  })

  it('has every hour from midnight to now, empty ones as zeros', () => {
    expect(liveHoursOf([{ key: '1', visitors: 2, pageviews: 5 }, { key: '3', visitors: 1, pageviews: 1 }], 3)).toEqual([
      { hour: 0, visitors: 0, pageviews: 0 },
      { hour: 1, visitors: 2, pageviews: 5 },
      { hour: 2, visitors: 0, pageviews: 0 },
      { hour: 3, visitors: 1, pageviews: 1 },
    ])
    expect(liveHoursOf([], 0)).toEqual([{ hour: 0, visitors: 0, pageviews: 0 }])
    expect(liveHoursOf([{ key: '23', visitors: 1, pageviews: 1 }], 23)).toHaveLength(24)
  })
})

import { describe, expect, it } from 'vitest'
import { fromZonedInput, toZonedInput } from '../../packages/cms/app/utils/cmsTime'

const PRG = 'Europe/Prague'

describe('admin date fields (wall clock in the admin time zone)', () => {
  it('shows a stored instant as Prague time, winter and summer', () => {
    expect(toZonedInput('2026-01-15T08:00:00.000Z', PRG)).toBe('2026-01-15T09:00') // CET +1
    expect(toZonedInput('2026-06-29T10:00:00.000Z', PRG)).toBe('2026-06-29T12:00') // CEST +2
  })

  it('stores what the editor typed as the instant it means in Prague', () => {
    expect(fromZonedInput('2026-01-15T09:00', PRG)).toBe('2026-01-15T08:00:00.000Z')
    expect(fromZonedInput('2026-06-29T12:00', PRG)).toBe('2026-06-29T10:00:00.000Z')
  })

  it('round-trips across the DST changes', () => {
    for (const local of ['2026-03-29T01:30', '2026-03-29T03:30', '2026-10-25T01:30', '2026-10-25T03:30']) {
      expect(toZonedInput(fromZonedInput(local, PRG), PRG)).toBe(local)
    }
  })

  it('treats empty and invalid values as no date', () => {
    expect(toZonedInput(null, PRG)).toBe('')
    expect(toZonedInput('nonsense', PRG)).toBe('')
    expect(fromZonedInput('', PRG)).toBeNull()
  })

  it('works for other zones too', () => {
    expect(fromZonedInput('2026-06-29T12:00', 'America/New_York')).toBe('2026-06-29T16:00:00.000Z')
    expect(toZonedInput('2026-06-29T10:00:00.000Z', 'UTC')).toBe('2026-06-29T10:00')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cmsDeprecated, cmsDeprecations, resetCmsDeprecations } from 'tinyzoo'

// Under vitest NODE_ENV is "test", so warnings are silent unless the flag asks.
describe('cmsDeprecated', () => {
  const env = { ...process.env }
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetCmsDeprecations()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
    process.env.NODE_ENV = env.NODE_ENV
    if (env.TINYZOO_DEPRECATIONS === undefined) delete process.env.TINYZOO_DEPRECATIONS
    else process.env.TINYZOO_DEPRECATIONS = env.TINYZOO_DEPRECATIONS
  })

  it('is silent under NODE_ENV=test but still collects', () => {
    process.env.NODE_ENV = 'test'
    delete process.env.TINYZOO_DEPRECATIONS
    cmsDeprecated('old-option', '`oldOption` is replaced by `newOption`.', { removeIn: '0.4.0' })
    expect(warn).not.toHaveBeenCalled()
    expect(cmsDeprecations()).toEqual([{ id: 'old-option', message: '`oldOption` is replaced by `newOption`.', removeIn: '0.4.0' }])
  })

  it('warns once per id, with the version that removes it', () => {
    process.env.NODE_ENV = 'production'
    cmsDeprecated('old-option', '`oldOption` is replaced by `newOption`.', { removeIn: '0.4.0' })
    cmsDeprecated('old-option', '`oldOption` is replaced by `newOption`.', { removeIn: '0.4.0' })
    cmsDeprecated('other', 'Something else.')
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0]![0]).toBe('[tinyzoo] deprecated: `oldOption` is replaced by `newOption`. Will be removed in 0.4.0. (old-option)')
    expect(warn.mock.calls[1]![0]).toContain('Will be removed in a later release.')
    expect(cmsDeprecations().map((d) => d.id)).toEqual(['old-option', 'other'])
  })

  it('TINYZOO_DEPRECATIONS=1 prints under test, =0 silences everywhere', () => {
    process.env.NODE_ENV = 'test'
    process.env.TINYZOO_DEPRECATIONS = '1'
    cmsDeprecated('loud', 'Loud.')
    expect(warn).toHaveBeenCalledTimes(1)

    process.env.NODE_ENV = 'production'
    process.env.TINYZOO_DEPRECATIONS = '0'
    cmsDeprecated('quiet', 'Quiet.')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(cmsDeprecations().map((d) => d.id)).toEqual(['loud', 'quiet'])
  })

  it('reset makes the next call warn again', () => {
    process.env.NODE_ENV = 'production'
    cmsDeprecated('again', 'Again.')
    resetCmsDeprecations()
    expect(cmsDeprecations()).toEqual([])
    cmsDeprecated('again', 'Again.')
    expect(warn).toHaveBeenCalledTimes(2)
  })
})

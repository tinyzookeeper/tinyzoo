import { describe, expect, it } from 'vitest'
import { asEmailRevert, asPendingEmailChange, emailChangeDead, emailChangeStateKey, emailChangeUsable, emailRevertStateKey, emailRevertStatePattern, isUniqueViolation, maskEmail } from '../../packages/cms/server/utils/cmsEmailChangeRules'

const now = new Date('2026-11-17T12:00:00Z')
const later = new Date(now.getTime() + 60_000).toISOString()
const earlier = new Date(now.getTime() - 60_000).toISOString()
const pending = { tokenId: 't1', email: 'new@example.com', sv: 3, expiresAt: later }
const token = { id: 't1', expiresAt: later }
const user = { status: 'active', sessionVersion: 3 }

describe('emailChangeUsable', () => {
  it('lets the newest link of an active account through before it expires', () => {
    expect(emailChangeUsable(pending, token, user, now)).toBe(true)
  })

  it('refuses a link that a newer request replaced', () => {
    expect(emailChangeUsable({ ...pending, tokenId: 't2' }, token, user, now)).toBe(false)
  })

  it('refuses once the account’s session version moved on (password changed or reset, disabled, new role)', () => {
    expect(emailChangeUsable(pending, token, { ...user, sessionVersion: 4 }, now)).toBe(false)
  })

  it('refuses for an account that is not active', () => {
    expect(emailChangeUsable(pending, token, { ...user, status: 'disabled' }, now)).toBe(false)
    expect(emailChangeUsable(pending, token, { ...user, status: 'invited' }, now)).toBe(false)
  })

  it('refuses an expired link (by the token or by the recorded change)', () => {
    expect(emailChangeUsable(pending, { ...token, expiresAt: earlier }, user, now)).toBe(false)
    expect(emailChangeUsable({ ...pending, expiresAt: earlier }, token, user, now)).toBe(false)
  })

  it('refuses when nothing is pending', () => {
    expect(emailChangeUsable(null, token, user, now)).toBe(false)
  })
})

describe('asPendingEmailChange', () => {
  it('reads a stored change and nothing else', () => {
    expect(asPendingEmailChange(pending)).toEqual(pending)
    expect(asPendingEmailChange({ ...pending, extra: 1 })).toEqual(pending)
    expect(asPendingEmailChange(null)).toBeNull()
    expect(asPendingEmailChange('x')).toBeNull()
    expect(asPendingEmailChange({ ...pending, sv: '3' })).toBeNull()
    expect(asPendingEmailChange({ tokenId: 't1', email: 'a@b.cz' })).toBeNull()
  })

  it('is kept per account', () => {
    expect(emailChangeStateKey('abc')).toBe('email-change:abc')
  })
})

describe('maskEmail', () => {
  it('shows the first and last letter of the name and the whole domain', () => {
    expect(maskEmail('jana.novakova@example.com')).toBe('j…a@example.com')
    expect(maskEmail('jo@x.cz')).toBe('j…@x.cz')
    expect(maskEmail('j@x.cz')).toBe('j…@x.cz')
  })

  it('shows only the first letter of a short name (two of three letters would all but spell it)', () => {
    expect(maskEmail('jan@x.cz')).toBe('j…@x.cz')
    expect(maskEmail('eva@x.cz')).toBe('e…@x.cz')
    expect(maskEmail('jana@x.cz')).toBe('j…a@x.cz')
  })

  it('never shows the whole name, and copes with odd input', () => {
    expect(maskEmail('ab@x.cz')).not.toContain('ab@')
    expect(maskEmail('no-at-sign')).toBe('…')
    expect(maskEmail('@x.cz')).toBe('…')
    expect(maskEmail('a@b@x.cz')).toBe('a…@x.cz')
    expect(maskEmail('ab@c@x.cz')).toBe('a…c@x.cz')
    expect(maskEmail('žofie@x.cz')).toBe('ž…e@x.cz')
  })
})

describe('emailChangeDead', () => {
  const own = { id: 't1', expiresAt: later, usedAt: null }
  it('is alive while its own link is unused, unexpired, and the account unchanged', () => {
    expect(emailChangeDead(pending, own, user, now)).toBe(false)
  })
  it('is dead once its own link is used or gone, it expired, or the account moved on', () => {
    expect(emailChangeDead(pending, { ...own, usedAt: now }, user, now)).toBe(true)
    expect(emailChangeDead(pending, null, user, now)).toBe(true)
    expect(emailChangeDead(pending, { ...own, expiresAt: earlier }, user, now)).toBe(true)
    expect(emailChangeDead({ ...pending, expiresAt: earlier }, own, user, now)).toBe(true)
    expect(emailChangeDead(pending, own, { ...user, sessionVersion: 4 }, now)).toBe(true)
    expect(emailChangeDead(pending, own, { ...user, status: 'disabled' }, now)).toBe(true)
    expect(emailChangeDead(pending, own, null, now)).toBe(true)
  })
})

describe('the way back (email-revert)', () => {
  it('is keyed by account and link, so one account can have several', () => {
    expect(emailRevertStateKey('u1', 't1')).toBe('email-revert:u1:t1')
    expect(emailRevertStatePattern('u1')).toBe('email-revert:u1:%')
  })
  it('reads only well-formed values', () => {
    expect(asEmailRevert({ email: 'old@example.com', expiresAt: later })).toEqual({ email: 'old@example.com', expiresAt: later })
    expect(asEmailRevert({ email: 'old@example.com' })).toBeNull()
    expect(asEmailRevert('old@example.com')).toBeNull()
    expect(asEmailRevert(null)).toBeNull()
  })
})

describe('isUniqueViolation', () => {
  it('knows a unique violation, also wrapped by Drizzle', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true)
    expect(isUniqueViolation({ message: 'Failed query', cause: { code: '23505' } })).toBe(true)
    expect(isUniqueViolation({ code: '23503' })).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation(new Error('x'))).toBe(false)
  })
})

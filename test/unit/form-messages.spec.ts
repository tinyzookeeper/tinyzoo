import { describe, expect, it } from 'vitest'
import { f } from 'tinyzoo'
import { formIssueMessage, formMessages, localizeFormIssues } from '../../packages/cms/forms/messages'

describe('what a visitor is told when a website form is refused', () => {
  const select = { type: 'select' }
  it('says "choose" for a choice, whatever the validator said', () => {
    for (const issue of [
      { code: 'invalid_value', path: ['topic'], message: 'Invalid option: expected one of "a"|"b"' },
      { code: 'invalid_type', path: ['topic'], message: 'Invalid input: expected string, received undefined' },
    ]) expect(formIssueMessage(issue, select, 'cs')).toBe('Vyberte jednu z možností.')
    expect(formIssueMessage({ code: 'invalid_value' }, select, 'en')).toBe('Please choose one of the options.')
  })

  it('knows missing, email, url, length and number problems', () => {
    const text = { type: 'text' }
    expect(formIssueMessage({ code: 'invalid_type', message: 'Invalid input: expected string, received undefined' }, text, 'cs')).toBe('Vyplňte prosím.')
    expect(formIssueMessage({ code: 'too_small', origin: 'string', minimum: 1 }, text, 'en')).toBe('Please fill this in.')
    expect(formIssueMessage({ code: 'too_small', origin: 'string', minimum: 8 }, text, 'en')).toBe('This is too short (at least 8 characters).')
    expect(formIssueMessage({ code: 'invalid_format', format: 'email' }, text, 'de')).toBe('Bitte geben Sie eine gültige E-Mail-Adresse ein.')
    expect(formIssueMessage({ code: 'invalid_format', format: 'url' }, text, 'cs')).toContain('adresu')
    expect(formIssueMessage({ code: 'too_big', origin: 'string', maximum: 200 }, text, 'cs')).toBe('Text je příliš dlouhý (nejvýše 200 znaků).')
    expect(formIssueMessage({ code: 'invalid_type', message: 'Invalid input: expected number, received NaN' }, { type: 'number' }, 'en')).toBe('Please enter a number.')
    expect(formIssueMessage({ code: 'too_big', origin: 'number', maximum: 10 }, { type: 'number' }, 'en')).toBe('The number must be at most 10.')
  })

  it('asks for a ticked box on a boolean, and uses English for a language it has no words for', () => {
    expect(formIssueMessage({ code: 'custom' }, { type: 'boolean', meta: { mustBeTrue: true } }, 'cs')).toBe('Pro odeslání je potřeba toto políčko zaškrtnout.')
    expect(formMessages('fr-FR').required).toBe('Please fill this in.')
    expect(formMessages('cs-CZ').required).toBe('Vyplňte prosím.')
    expect(formMessages(undefined).required).toBe('Please fill this in.')
  })

  it('keeps the code and path of each issue and only words the message', () => {
    const out = localizeFormIssues([{ code: 'invalid_format', format: 'email', path: ['email'], message: 'Invalid email address' }], { email: { type: 'text' } }, 'cs')
    expect(out).toEqual([{ code: 'invalid_format', format: 'email', path: ['email'], message: 'Zadejte prosím platný e-mail.' }])
  })
})

describe('f.boolean({ mustBeTrue })', () => {
  it('refuses false and accepts true; a plain boolean takes both', () => {
    const must = f.boolean({ mustBeTrue: true })
    expect(must.zod('create').safeParse(true).success).toBe(true)
    expect(must.zod('create').safeParse(false).success).toBe(false)
    expect(must.zod('create').safeParse(undefined).success).toBe(false) // the default is false, which is refused
    expect(must.meta).toMatchObject({ mustBeTrue: true })
    const plain = f.boolean()
    expect(plain.zod('create').safeParse(false).success).toBe(true)
    expect(plain.meta?.mustBeTrue).toBeUndefined()
  })
})

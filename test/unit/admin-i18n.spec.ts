import { describe, expect, it } from 'vitest'
import en from '../../packages/cms/app/i18n/en'
import cs from '../../packages/cms/app/i18n/cs'
import de from '../../packages/cms/app/i18n/de'
import { resolveText } from 'tinyzoo'

type Tree = { [k: string]: string | Tree }
const isPlural = (v: unknown): v is Record<string, string> => !!v && typeof v === 'object' && typeof (v as any).other === 'string'

/** key → leaf (string or plural object) */
function leaves(tree: Tree, prefix = ''): Map<string, string | Record<string, string>> {
  const out = new Map<string, string | Record<string, string>>()
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix + k
    if (typeof v === 'string' || isPlural(v)) out.set(key, v as any)
    else for (const [kk, vv] of leaves(v as Tree, `${key}.`)) out.set(kk, vv)
  }
  return out
}
const placeholders = (v: string | Record<string, string>) =>
  [...new Set((typeof v === 'string' ? [v] : Object.values(v)).flatMap((s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort()

describe('admin translations', () => {
  const source = leaves(en as unknown as Tree)
  const czech = leaves(cs as unknown as Tree)
  const german = leaves(de as unknown as Tree)

  it('Czech has exactly the English keys', () => {
    expect([...czech.keys()].sort()).toEqual([...source.keys()].sort())
  })

  it('German has exactly the English keys and placeholders, with no empty messages', () => {
    expect([...german.keys()].sort()).toEqual([...source.keys()].sort())
    for (const [key, v] of german) {
      const original = source.get(key)!
      expect(isPlural(v), key).toBe(isPlural(original))
      expect(placeholders(v), key).toEqual(placeholders(original))
      const texts = typeof v === 'string' ? [v] : Object.values(v)
      for (const text of texts) expect(text.trim(), key).not.toBe('')
    }
  })

  it('no message is empty', () => {
    for (const [key, v] of czech) {
      const texts = typeof v === 'string' ? [v] : Object.values(v)
      for (const text of texts) expect(text.trim(), key).not.toBe('')
    }
  })

  it('plurals cover the categories each language needs', () => {
    for (const [key, v] of source) if (isPlural(v)) expect(Object.keys(v), key).toEqual(expect.arrayContaining(['one', 'other']))
    for (const [key, v] of czech) if (isPlural(v)) expect(Object.keys(v), key).toEqual(expect.arrayContaining(['one', 'few', 'other']))
    const germanCategories = new Intl.PluralRules('de').resolvedOptions().pluralCategories
    for (const [key, v] of german) if (isPlural(v)) expect(Object.keys(v).sort(), key).toEqual([...germanCategories].sort())
    expect(new Intl.PluralRules('cs').select(3)).toBe('few') // the rule the catalogue relies on
  })

  // A translation may drop a placeholder on purpose (Czech avoids declining
  // {label}), but must never invent one the code does not pass.
  it('Czech uses no placeholder the English message does not have', () => {
    for (const [key, v] of czech) {
      const allowed = placeholders(source.get(key)!)
      for (const p of placeholders(v)) expect(allowed, `${key} uses {${p}}`).toContain(p)
    }
  })
})

describe('resolveText (config labels)', () => {
  const label = { en: 'Posts', cs: 'Články' }
  it('picks the locale, then its language, then the fallbacks, then anything', () => {
    expect(resolveText(label, 'cs')).toBe('Články')
    expect(resolveText(label, 'cs-CZ')).toBe('Články')
    expect(resolveText(label, 'de')).toBe('Posts')
    expect(resolveText({ cs: 'Jen česky' }, 'de', ['en'])).toBe('Jen česky')
    expect(resolveText('Same everywhere', 'cs')).toBe('Same everywhere')
    expect(resolveText(undefined, 'cs')).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import { cmsRequestError } from '../../packages/cms/app/utils/cmsIssues'
import en from '../../packages/cms/app/i18n/en'
import cs from '../../packages/cms/app/i18n/cs'
import de from '../../packages/cms/app/i18n/de'

// What an editor reads after a refused request: a sentence in their language, never
// the server's English ("Not found or not permitted").
const say = (catalogue: any) => (key: string) => key.split('.').reduce((o, k) => o?.[k], catalogue) as string
const refused = (statusCode: number, statusMessage: string) => ({ statusCode, data: { statusMessage } })

describe('refused requests in the editor\'s language', () => {
  for (const [name, catalogue] of [['cs', cs], ['en', en], ['de', de]] as const) {
    it(`never shows the server's English (${name})`, () => {
      const t = say(catalogue) as any
      const cases: [number, string][] = [
        [404, 'Not found or not permitted'], [409, 'Save the default language first'], [409, 'Value already in use'],
        [400, 'Bad request'], [422, 'Validation failed'], [403, 'Your role can write drafts but not publish'], [418, 'Teapot'],
      ]
      for (const [status, message] of cases) {
        const text = cmsRequestError(refused(status, message), t)
        expect(text, `${status} ${message}`).toBeTruthy()
        if (name !== 'en') expect(text).not.toContain(message)
        expect(text).not.toMatch(/^(Not found or|Validation failed|Bad request|Value already|Teapot)/)
      }
    })
  }
})

describe('a site whose storage is full', () => {
  // As the server sends it: 413 with data.code 'storage_full' (the response body's `data`).
  const full = { statusCode: 413, data: { statusMessage: 'There is not enough storage space left for this file.', data: { code: 'storage_full', limitBytes: 3000, usedBytes: 3000 } } }
  const sizeOnly = { statusCode: 413, data: { statusMessage: 'File too large (max 10MB)', data: { code: 'file_too_large', maxMb: 10 } } }
  for (const [name, catalogue, words] of [['cs', cs, /úložišti/], ['en', en, /storage space/], ['de', de, /Speicher/]] as const) {
    it(`says so in the editor's language, not "the file is too large" (${name})`, () => {
      const t = say(catalogue) as any
      const text = cmsRequestError(full, t)
      expect(text).toBe(t('errors.storageFull'))
      expect(text).toMatch(words)
      expect(text).not.toBe(t('errors.tooLarge'))
      if (name !== 'en') expect(text).not.toContain('There is not enough')
      // A file over the single-file cap still names that cap.
      expect(cmsRequestError(sizeOnly, t)).toBe(t('errors.tooLargeMax'))
    })
  }
})

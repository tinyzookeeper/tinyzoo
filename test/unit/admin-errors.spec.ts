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

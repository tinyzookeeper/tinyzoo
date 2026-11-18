import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyWebhookSignature } from '../helpers/webhookSignature'

// What the server signs (server/utils/cmsWebhooks.ts; test/api/changes.spec.ts checks a real delivery).
const signWebhook = async (secret: string, t: number, body: string) => createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')

// A receiver splits X-CMS-Signature on "," and accepts any matching `v1=`: the header may carry
// more parts later (a second `v1=` while a secret changes, another scheme) without breaking it.
describe('checking X-CMS-Signature', () => {
  const body = '{"type":"entry.published"}'
  const now = 1_800_000_000_000
  const t = now / 1000

  it('accepts the header tinyzoo sends', async () => {
    const header = `t=${t},v1=${await signWebhook('s3cret', t, body)}`
    expect(verifyWebhookSignature(header, body, 's3cret', 300, now)).toBe(true)
  })

  it('accepts any matching v1, in any order, next to parts it does not know', async () => {
    const good = await signWebhook('s3cret', t, body)
    const old = await signWebhook('old secret', t, body)
    expect(verifyWebhookSignature(`t=${t},v1=${old},v1=${good}`, body, 's3cret', 300, now)).toBe(true)
    expect(verifyWebhookSignature(`v2=abc, t=${t}, v1=${good}`, body, 's3cret', 300, now)).toBe(true)
  })

  it('refuses a wrong body, a wrong secret, no v1, and an old delivery', async () => {
    const good = await signWebhook('s3cret', t, body)
    expect(verifyWebhookSignature(`t=${t},v1=${good}`, `${body} `, 's3cret', 300, now)).toBe(false)
    expect(verifyWebhookSignature(`t=${t},v1=${good}`, body, 'other', 300, now)).toBe(false)
    expect(verifyWebhookSignature(`t=${t},v2=${good}`, body, 's3cret', 300, now)).toBe(false)
    expect(verifyWebhookSignature(`t=${t},v1=${good}`, body, 's3cret', 300, now + 301_000)).toBe(false)
    expect(verifyWebhookSignature(undefined, body, 's3cret', 300, now)).toBe(false)
  })
})

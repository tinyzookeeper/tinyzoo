import { describe, expect, it } from 'vitest'
import { safeErrorMessage, safeUrl, scrubError } from '../../packages/cms/server/utils/cmsScrub'

/** What drizzle throws for a failed insert, and what h3 makes of it. */
function failedQuery() {
  const driver = Object.assign(new Error('relation "post" does not exist'), { code: '42P01', detail: 'Key (email)=(ana@example.test) is bad' })
  const query = new Error('Failed query: insert into "post" ("email", "body") values ($1, $2)\nparams: ana@example.test,Dear diary, my password is hunter2', { cause: driver })
  const h3 = Object.assign(new Error(query.message, { cause: query }), { name: 'H3Error', statusCode: 500, data: { email: 'ana@example.test' } })
  return { driver, query, h3 }
}

const chain = (e: any): any[] => (e ? [e, ...chain(e.cause)] : [])

describe('scrubError', () => {
  it('drops a failed query\'s values from the message, the causes and the stack', () => {
    const { h3 } = failedQuery()
    const out = scrubError(h3)
    expect(out).toBeInstanceOf(Error)
    expect(out.name).toBe('H3Error')
    expect(out.message).toBe('Query failed: relation "post" does not exist (42P01)')
    for (const e of chain(out)) {
      expect(e.message).not.toMatch(/Failed query|params:/)
      expect(`${e.message}\n${e.stack}`).not.toMatch(/ana@example|hunter2|diary/)
    }
    expect(JSON.stringify(out, Object.getOwnPropertyNames(out))).not.toMatch(/ana@example|hunter2|diary/)
    expect((out as any).data).toBeUndefined()
    expect((out as any).statusCode).toBeUndefined()
  })

  it('keeps the stack frames, with the safe message as its header', () => {
    const out = scrubError(failedQuery().h3)
    const [header, ...frames] = out.stack!.split('\n')
    expect(header).toBe(`H3Error: ${out.message}`)
    expect(frames.length).toBeGreaterThan(0)
    expect(frames.every((l) => /^\s+at /.test(l))).toBe(true)
  })

  it('scrubs a cause chain of several layers, and stops at a sane depth', () => {
    const { h3 } = failedQuery()
    expect(chain(scrubError(h3)).length).toBe(3)
    let deep: any = new Error('bottom')
    for (let i = 0; i < 20; i++) deep = new Error(`layer ${i}`, { cause: deep })
    expect(chain(scrubError(deep)).length).toBeLessThanOrEqual(6)
  })

  it('leaves an ordinary error as it is, and copes with things that are not errors', () => {
    const plain = new TypeError('x is not a function')
    const out = scrubError(plain)
    expect(out.name).toBe('TypeError')
    expect(out.message).toBe('x is not a function')
    expect(out).not.toBe(plain)
    expect(scrubError('boom').message).toBe('boom')
    expect(scrubError(undefined).message).toBe('unknown')
  })

  it('safeErrorMessage reaches the driver error through h3\'s copy of the message', () => {
    expect(safeErrorMessage(failedQuery().h3)).toBe('Query failed: relation "post" does not exist (42P01)')
    expect(safeErrorMessage(new Error('Failed query: select 1\nparams: secret'))).toBe('Query failed')
  })
})

describe('safeUrl (webhook address in logs and the error hook)', () => {
  it('keeps the origin and a short hash of the path, never the path, query or credentials', () => {
    const slack = safeUrl('https://user:pw@hooks.slack.com/services/T000/B000/XXXXSECRET?token=abc')
    expect(slack).toMatch(/^https:\/\/hooks\.slack\.com\/…#[0-9a-f]{8}$/)
    expect(slack).not.toMatch(/XXXXSECRET|services|user|pw|abc/)
  })

  it('tells two webhooks on one host apart, and is stable', () => {
    const a = safeUrl('https://discord.com/api/webhooks/1/aaa')
    expect(a).toBe(safeUrl('https://discord.com/api/webhooks/1/aaa?x=1'))
    expect(a).not.toBe(safeUrl('https://discord.com/api/webhooks/2/bbb'))
  })

  it('has no hash for a bare origin, and copes with garbage', () => {
    expect(safeUrl('http://127.0.0.1:8080/')).toBe('http://127.0.0.1:8080')
    expect(safeUrl('not a url')).toBe('(invalid url)')
  })
})

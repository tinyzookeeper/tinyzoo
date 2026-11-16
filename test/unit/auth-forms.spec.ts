import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// A form that is submitted before the page has hydrated is a native form submit. Without a
// method that is a GET: the browser puts every field into the address — the password of
// /admin/login?email=…&password=… in the address bar, the history, a proxy's and the server's log.
// With method="post" the fields travel in the body, which nothing logs and the page ignores.
const pages = ['login.vue', 'setup.vue', 'forgot.vue', 'reset/[token].vue', 'invite/[token].vue', 'account.vue']
const dir = join(import.meta.dirname, '../../packages/cms/app/pages/admin')

describe('forms of the sign-in and account pages', () => {
  it.each(pages)('%s: every <form> says method="post"', (page) => {
    const source = readFileSync(join(dir, page), 'utf8')
    const forms = source.match(/<form\b[^>]*>/g) ?? []
    expect(forms.length, page).toBeGreaterThan(0)
    for (const tag of forms) expect(tag, `${page}: ${tag}`).toMatch(/\bmethod="post"/)
  })
})

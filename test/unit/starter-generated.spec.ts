import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emitContentTypes, emitSchema } from 'tinyzoo'
import * as config from '../../packages/cms/starter/cms.config'

const starter = join(import.meta.dirname, '../../packages/cms/starter')
const read = (p: string) => readFileSync(join(starter, p), 'utf8')

// `tinyzoo init` copies the starter, so what it ships has to be what its config says: the
// block components are typed from the generated client (app/lib/cms-content.ts), and a
// stale one would hide a renamed field from the type checker. Regenerate with
// `pnpm cms:client` and `pnpm db:generate` in packages/cms/starter.
describe('the starter\'s generated files are in sync with its cms.config.ts', () => {
  it('db schema (server/db/schema.ts)', () => {
    expect(emitSchema(config)).toBe(read('server/db/schema.ts'))
  })

  it('typed content client (app/lib/cms-content.ts)', () => {
    expect(emitContentTypes(config)).toBe(read('app/lib/cms-content.ts'))
  })
})

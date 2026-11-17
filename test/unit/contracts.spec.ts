import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildOpenApiDocument, emitContentTypes } from 'tinyzoo'
import * as config from '../../playground/cms.config'
import { contractsDir as dir, readableDiff, UPDATE_CONTRACTS as UPDATE } from '../helpers/golden'

// Contract snapshots: the public content API as the playground's config produces it,
// committed as golden files. A site's frontend depends on these shapes, so a change
// here is a change to the API: it fails until someone looks at it and accepts it
// (`pnpm contracts:update`), and the changeset then says whether it breaks sites.
// See "Contracts" in CONTRIBUTING.md. The other frozen surfaces (the exported API of each entry
// point, module options, hooks, CLI, webhook) are in api-surface.spec.ts.

const contracts: { file: string; what: string; render: () => string }[] = [
  {
    file: 'openapi.playground.json',
    what: 'the OpenAPI document of the public content API',
    render: () => `${JSON.stringify(buildOpenApiDocument(config, { title: 'Content API' }), null, 2)}\n`,
  },
  {
    file: 'client-types.playground.ts',
    what: 'the generated types of the typed content client',
    render: () => emitContentTypes(config),
  },
]

describe('contract snapshots (test/contracts)', () => {
  for (const { file, what, render } of contracts) {
    it(file, () => {
      const path = join(dir, file)
      const fresh = render()
      if (UPDATE) {
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, fresh)
        return
      }
      if (!existsSync(path)) {
        throw new Error(`No golden file for ${what}: test/contracts/${file}.\nCreate it with: pnpm contracts:update`)
      }
      const golden = readFileSync(path, 'utf8')
      if (golden === fresh) return
      throw new Error([
        `The public content API changed: ${what} no longer matches test/contracts/${file}.`,
        '(- committed golden file, + what the playground config produces now)',
        '',
        readableDiff(golden, fresh),
        '',
        'If this is intended, accept it with:  pnpm contracts:update',
        'then commit the golden file and say in the changeset whether it breaks sites (CONTRIBUTING.md, "Contracts").',
      ].join('\n'))
    })
  }
})

describe('contract diff', () => {
  it('shows the changed lines with context and the line number, not the whole file', () => {
    const golden = ['{', '  "a": 1,', '  "b": 2,', '  "c": 3,', '  "d": 4,', '  "e": 5', '}'].join('\n')
    const fresh = golden.replace('"c": 3', '"c": 30')
    // Context lines start with two spaces, removed ones with "- ", added ones with "+ ".
    expect(readableDiff(golden, fresh, 1)).toBe(['@@ line 4 @@', '    "b": 2,', '-   "c": 3,', '+   "c": 30,', '    "d": 4,'].join('\n'))
  })

  it('caps a long difference', () => {
    const golden = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n')
    const fresh = Array.from({ length: 200 }, (_, i) => `changed ${i}`).join('\n')
    const diff = readableDiff(golden, fresh, 0, 10)
    expect(diff.split('\n').length).toBeLessThan(30)
    expect(diff).toContain('190 more lines')
  })
})

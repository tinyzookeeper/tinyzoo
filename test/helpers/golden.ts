import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Golden files: a public surface written down as text and committed, so that a change to it
// fails a test with the lines that differ until someone looks and accepts it
// (`pnpm contracts:update`). The changeset then says whether the change breaks sites.
// See "Contracts" in CONTRIBUTING.md.

export const contractsDir = join(import.meta.dirname, '../contracts')
export const UPDATE_CONTRACTS = process.env.UPDATE_CONTRACTS === '1'

/** The part of two texts that differs, with a little context: enough to read, never a wall. */
export function readableDiff(golden: string, fresh: string, context = 3, cap = 40): string {
  const a = golden.split('\n')
  const b = fresh.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB-- }

  const out: string[] = []
  const before = a.slice(Math.max(0, start - context), start)
  const after = a.slice(endA, endA + context)
  const show = (sign: '-' | '+', lines: string[]) => {
    for (const line of lines.slice(0, cap)) out.push(`${sign} ${line}`)
    if (lines.length > cap) out.push(`${sign} … ${lines.length - cap} more lines`)
  }
  out.push(`@@ line ${start + 1} @@`)
  for (const line of before) out.push(`  ${line}`)
  show('-', a.slice(start, endA))
  show('+', b.slice(start, endB))
  for (const line of after) out.push(`  ${line}`)
  return out.join('\n')
}

export interface Golden {
  /** The file in test/contracts. */
  file: string
  /** What it holds, for the failure message ("the OpenAPI document of the content API"). */
  what: string
  /** The text as the code produces it now. */
  render: () => string | Promise<string>
}

/** One test per golden file: it fails with a readable diff, and rewrites the file under `pnpm contracts:update`. */
export function goldenTests(title: string, goldens: Golden[], changed: string): void {
  describe(title, () => {
    for (const { file, what, render } of goldens) {
      it(file, async () => {
        const path = join(contractsDir, file)
        const fresh = await render()
        if (UPDATE_CONTRACTS) {
          mkdirSync(dirname(path), { recursive: true })
          writeFileSync(path, fresh)
          return
        }
        if (!existsSync(path)) {
          throw new Error(`No golden file for ${what}: test/contracts/${file}.\nCreate it with: pnpm contracts:update`)
        }
        const golden = readFileSync(path, 'utf8')
        if (golden === fresh) return
        // `expect` keeps vitest's failure formatting for the message.
        expect.fail([
          `${changed}: ${what} no longer matches test/contracts/${file}.`,
          '(- committed golden file, + what the code produces now)',
          '',
          readableDiff(golden, fresh),
          '',
          'If this is intended, accept it with:  pnpm contracts:update',
          'then commit the golden file and say in the changeset whether it breaks sites (CONTRIBUTING.md, "Contracts").',
        ].join('\n'))
      })
    }
  })
}

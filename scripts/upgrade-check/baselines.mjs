// The baselines scripts/upgrade-check.mjs checks when it is not given `--from`: the lines of
// .github/upgrade-baseline, plus `latest-tag` (the newest release) when the file does not list it.
// A module of its own, without dependencies, so heavy.yml can read the list before anything is
// installed: every entry is one `upgrade` job there (`--from <entry>`).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function listedBaselines(root) {
  const file = join(root, '.github/upgrade-baseline')
  const listed = existsSync(file)
    ? readFileSync(file, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
    : []
  // Once releases exist the latest one is a baseline without anyone adding it.
  return listed.includes('latest-tag') ? listed : [...listed, 'latest-tag']
}

// Run by `prepack` (so by `pnpm pack` and `pnpm publish`): puts what the package needs to
// make a site into `bundle/`, copied from tinyzoo itself, so the two cannot differ:
//   bundle/init.mjs      packages/cms/cli/init.mjs, the code behind `tinyzoo init`
//   bundle/starter/      packages/cms/starter, the site that is copied
//   bundle/tinyzoo.json  the version of tinyzoo the new site pins
// `create-tinyzoo` does not depend on `tinyzoo`: that would install Nuxt, the editor and
// every other dependency of the CMS (700+ packages) just to copy a folder.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const here = join(import.meta.dirname, '..')
const cms = join(here, '..', 'cms')
const bundle = join(here, 'bundle')
if (!existsSync(join(cms, 'starter', 'cms.config.ts'))) throw new Error(`The starter is not at ${cms}/starter: run this inside the tinyzoo repository.`)

rmSync(bundle, { recursive: true, force: true })
mkdirSync(bundle)
cpSync(join(cms, 'cli', 'init.mjs'), join(bundle, 'init.mjs'))
const skip = new Set(['node_modules', '.nuxt', '.output', '.env', '.cms-uploads', '.cms-mail', '.data'])
cpSync(join(cms, 'starter'), join(bundle, 'starter'), { recursive: true, filter: (src) => !skip.has(basename(src)) })
const { version } = JSON.parse(readFileSync(join(cms, 'package.json'), 'utf8'))
writeFileSync(join(bundle, 'tinyzoo.json'), JSON.stringify({ version }) + '\n')
console.log(`create-tinyzoo: bundled the starter and init.mjs of tinyzoo ${version}`)

// Production-builds the playground into a scratch dir, so the API suites run against
// the same Nitro output a deploy would ship — without touching playground/.nuxt or
// playground/.output (a developer's own dev server or build stays as it was).
//
//   node test/setup/build-playground.mjs <rootDir> <buildDir> <outputDir>
//
// Runs in its own process: Nuxt's build pulls in Vite, which does not belong
// inside the Vitest process that will run the specs.
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

const [rootDir, buildDir, outputDir] = process.argv.slice(2)
if (!rootDir || !buildDir || !outputDir) {
  console.error('usage: build-playground.mjs <rootDir> <buildDir> <outputDir>')
  process.exit(2)
}

// Tailwind's CSS resolver looks packages up relative to the working directory, so the
// build must run from inside the app, exactly as `nuxt build` would.
process.chdir(rootDir)

// Resolve Nuxt from the host app, not from here — the root workspace does not depend on it.
const require = createRequire(join(rootDir, 'package.json'))
const { loadNuxt, buildNuxt } = await import(pathToFileURL(require.resolve('nuxt/kit')).href)

const nuxt = await loadNuxt({
  cwd: rootDir,
  dev: false,
  overrides: {
    buildDir,
    nitro: { output: { dir: outputDir } },
    devtools: { enabled: false },
  },
})
await buildNuxt(nuxt)
await nuxt.close()

import { defineBuildConfig } from 'unbuild'

// Produces dist/index.mjs + dist/index.d.ts for publishing to non-Nuxt consumers.
// The monorepo + Nuxt hosts consume ./src directly (transpiled by Vite).
export default defineBuildConfig({
  entries: ['src/index'],
  declaration: true,
  clean: true,
  rollup: { emitCJS: false, esbuild: { target: 'es2022' } },
})

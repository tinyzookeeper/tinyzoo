import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { MODEL_FILE_ASSET, MODEL_FILE_NAME } from '../../packages/cms/src/model-file'

// The module's part in the app's model file (experimental custom types): it goes into the
// server build as a server asset when it is there, and in development a change of it restarts
// the server. The module's setup() runs against a stub of @nuxt/kit, as in api-surface.spec.ts.
vi.setConfig({ testTimeout: 60_000 })

// (By the path under packages/cms: @nuxt/kit is a dependency of that package, not of the workspace root.)
vi.mock('../../packages/cms/node_modules/@nuxt/kit', () => ({
  defineNuxtModule: (def: Record<string, unknown>) => def,
  addComponentsDir: () => {},
  addServerHandler: () => {},
  addServerPlugin: () => {},
  extendPages: () => {},
  addTypeTemplate: () => {},
  addTemplate: () => {},
  hasNuxtModule: () => false,
}))

const roots: string[] = []
afterAll(() => { for (const dir of roots) rmSync(dir, { recursive: true, force: true }) })

/** Runs setup() in a fresh root dir (with the model file, or without), then the recorded `nitro:config` callback on an empty config. */
async function build({ withFile, dev }: { withFile: boolean; dev: boolean }) {
  const rootDir = mkdtempSync(join(tmpdir(), 'cms-model-file-build-'))
  roots.push(rootDir)
  if (withFile) writeFileSync(join(rootDir, MODEL_FILE_NAME), JSON.stringify({ format: 1, version: 1, types: [] }))
  const mod = (await import(/* @vite-ignore */ join(import.meta.dirname, '../../packages/cms/module'))).default as unknown as {
    defaults: object
    setup: (options: Record<string, unknown>, nuxt: unknown) => Promise<void>
  }
  const hooks = new Map<string, (arg: any) => void>()
  const watch: string[] = []
  const nuxt = {
    options: { rootDir, dev, watch, alias: {}, runtimeConfig: { public: {} } },
    hook: (name: string, fn: (arg: any) => void) => { hooks.set(name, fn) },
  }
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try { await mod.setup({ ...mod.defaults }, nuxt) }
  finally { warn.mockRestore() }
  const nitro: any = {}
  hooks.get('nitro:config')!(nitro)
  return { rootDir, nitro, watch }
}

const ours = (nitro: any): any[] => (nitro.serverAssets || []).filter((a: any) => a.baseName === MODEL_FILE_ASSET)

describe('the module and the app\'s model file', () => {
  it('without a model file in the root folder nothing is bundled and nothing is watched', async () => {
    const { rootDir, nitro, watch } = await build({ withFile: false, dev: true })
    expect(existsSync(join(rootDir, MODEL_FILE_NAME))).toBe(false)
    expect(ours(nitro)).toEqual([])
    // Dev watches the path even before the file exists: creating it restarts the server.
    expect(watch).toEqual([join(rootDir, MODEL_FILE_NAME)])
  })

  it('with a model file it is bundled as one server asset', async () => {
    const { rootDir, nitro } = await build({ withFile: true, dev: false })
    expect(ours(nitro)).toEqual([{ baseName: MODEL_FILE_ASSET, dir: rootDir, pattern: MODEL_FILE_NAME }])
  })

  it('in development the file\'s path is watched; in a build the watch list is left alone', async () => {
    const dev = await build({ withFile: true, dev: true })
    expect(dev.watch).toEqual([join(dev.rootDir, MODEL_FILE_NAME)])
    const prod = await build({ withFile: true, dev: false })
    expect(prod.watch).toEqual([])
  })
})

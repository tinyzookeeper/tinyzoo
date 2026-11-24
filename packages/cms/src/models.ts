import { collectPlugins, planPlugins } from './plugin'

/** One content model of a build: its `cms.config` exports, and where its drizzle-kit migrations live. */
export interface CmsModelDef {
  /** What the model's own `cms.config.ts` exports (`import * as shop from './models/shop/cms.config'`). */
  config: Record<string, unknown>
  /** The model's drizzle-kit migrations folder, relative to the app's rootDir (like `cms.migrations.dir`). */
  migrations: string
}

/** What `defineModels` returns: the models by name. Its marker is not enumerable, so `Object.keys` gives the names only. */
export type CmsModels<T extends Record<string, CmsModelDef>> = T & { readonly __cms?: 'models' }

const MODEL_NAME = /^[a-z][a-z0-9-]{0,39}$/

/** The name of the model of the app's own `cms.config.ts` (a site whose row names no model uses it). @internal */
export const DEFAULT_MODEL = 'default'

/**
 * Experimental: may change in a minor release.
 *
 * Declares the content models one build carries, so one process can serve sites of different
 * content models (multi-tenant mode: each site's directory row names its model). Export the
 * result from the app's `cms.config.ts`:
 *
 *   export const models = defineModels({ shop: { config: shop, migrations: 'models/shop/server/db/migrations' } })
 *
 * Without it the app's `cms.config.ts` is the one model, as always.
 */
export function defineModels<T extends Record<string, CmsModelDef>>(models: T): CmsModels<T> {
  if (!models || typeof models !== 'object' || Array.isArray(models)) throw new Error('[tinyzoo] defineModels() takes an object of models by name.')
  for (const [name, def] of Object.entries(models)) {
    if (!MODEL_NAME.test(name)) throw new Error(`[tinyzoo] defineModels(): the model name "${name}" must be 1-40 characters of a-z, 0-9 and -, starting with a letter.`)
    if (name === DEFAULT_MODEL) throw new Error(`[tinyzoo] defineModels(): "${DEFAULT_MODEL}" is the model of the app's own cms.config.ts and cannot be a name here.`)
    if (!def || typeof def !== 'object' || !def.config || typeof def.config !== 'object') throw new Error(`[tinyzoo] defineModels(): the model "${name}" needs a \`config\`, the exports of its cms.config.`)
    if (Object.values(def.config).some(isCmsModels)) throw new Error(`[tinyzoo] defineModels(): the config of the model "${name}" exports defineModels() itself; models do not nest.`)
    if (typeof def.migrations !== 'string' || !def.migrations.trim()) throw new Error(`[tinyzoo] defineModels(): the model "${name}" needs \`migrations\`, its drizzle-kit migrations folder.`)
  }
  const out = { ...models } as CmsModels<T>
  Object.defineProperty(out, '__cms', { value: 'models', enumerable: false })
  return out
}

/**
 * Is this a `defineModels` value? A property check, never `instanceof`: the build reads
 * the config through jiti, which loads another copy of this module.
 *
 * @internal
 */
export function isCmsModels(v: unknown): v is CmsModels<Record<string, CmsModelDef>> {
  return !!v && typeof v === 'object' && (v as any).__cms === 'models'
}

const isEntityValue = (v: any): boolean => !!v && typeof v === 'object' && v.__cms === 'entity'

/**
 * The models of an app's config (its exports). Without `defineModels`, one model `default`
 * whose config is the app config itself. With it, the app's own exports are the model
 * `default` only when at least one of them is an entity (they come first), and the named
 * models follow in their order. `migrations` of `default` is null: it is `cms.migrations.dir`.
 *
 * @internal
 */
export function modelsOf(appConfig: Record<string, any>): { models: Map<string, { name: string; config: Record<string, any>; migrations: string | null }>; hasDefault: boolean } {
  const models = new Map<string, { name: string; config: Record<string, any>; migrations: string | null }>()
  const found = Object.entries(appConfig).filter(([, v]) => isCmsModels(v))
  if (!found.length) {
    models.set(DEFAULT_MODEL, { name: DEFAULT_MODEL, config: appConfig, migrations: null })
    return { models, hasDefault: true }
  }
  if (found.length > 1) throw new Error(`[tinyzoo] cms.config exports defineModels() more than once (${found.map(([key]) => `\`${key}\``).join(', ')}): a build has one set of models.`)
  const [key, declared] = found[0]!
  // The app's own exports, without the models themselves.
  const own = Object.fromEntries(Object.entries(appConfig).filter(([k]) => k !== key))
  const hasDefault = Object.values(own).some(isEntityValue)
  if (hasDefault) models.set(DEFAULT_MODEL, { name: DEFAULT_MODEL, config: own, migrations: null })
  for (const [name, def] of Object.entries(declared as Record<string, CmsModelDef>)) {
    models.set(name, { name, config: def.config as Record<string, any>, migrations: def.migrations })
  }
  return { models, hasDefault }
}

/** The server asset a model's migrations are bundled under: `cms-migrations` for `default` (as always). @internal */
export function modelMigrationsAsset(name: string): string {
  return name === DEFAULT_MODEL ? 'cms-migrations' : `cms-migrations-${name}`
}

/**
 * The plugins must be the same for every model of a build: the build registers their pages,
 * routes, components and texts once. Returns what is wrong, or null.
 *
 * @internal
 */
export function modelPluginsProblem(models: Iterable<{ name: string; config: Record<string, any> }>): string | null {
  let first: { name: string; shown: string; plan: string } | null = null
  for (const model of models) {
    let plan
    try {
      plan = planPlugins(collectPlugins(model.config))
    }
    catch (err: any) {
      throw new Error(`the plugins of the content model "${model.name}": ${err?.message ?? err}`, { cause: err })
    }
    const mine = { name: model.name, shown: plan.plugins.map((p) => `${p.name}@${p.version}`).join(', ') || 'none', plan: JSON.stringify(plan) }
    if (!first) { first = mine; continue }
    if (mine.plan === first.plan) continue
    const same = mine.shown === first.shown
    const sameSet = !same && [...mine.shown.split(', ')].sort().join() === [...first.shown.split(', ')].sort().join()
    return `the content models "${first.name}" and "${mine.name}" use different plugins (${first.name}: ${first.shown}; ${mine.name}: ${mine.shown}), `
      + 'but the build registers the plugins\' pages, routes, components and texts once, for all models. '
      + (sameSet ? 'They are the same plugins in a different order, which changes the order the build registers them in. ' : '')
      + (same ? 'The names and versions are equal: a plugin is registered with options that change what the build registers (pages, routes, texts…). ' : '')
      + 'Register the same plugins, with the same options, in every model.'
  }
  return null
}

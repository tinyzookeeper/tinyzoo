import { buildRegistry, CUSTOM_PREFIX, DEFAULT_MODEL, modelEntities, modelPurgeDue, modelsOf, parseModelDoc, sql, type CmsRegistry, type ModelDoc, type ModelMapProblem } from 'tinyzoo'
// virtual alias provided by the module (build-time); typed through the host's tsconfig paths.
// The only server file that reads the build's config: everything else asks for the site's model here.
import * as appConfig from '#cms/config'
import { scrubError } from './cmsScrub'

/** A content model as the server uses it: its name, what its cms.config exports, and its registry. */
export interface CmsSiteModel {
  name: string
  config: Record<string, any>
  reg: CmsRegistry
}

// Worked out on first use, so a build that is misconfigured is reported by the start check
// (server/plugins/cms-plugins.ts) and not when this file is imported.
const models = cmsProcessWide<{ table?: ReturnType<typeof modelsOf>; ready: Map<string, CmsSiteModel> }>(
  { ready: new Map() },
  'the content models this build carries: their structure only, never content; a site uses the one its row names',
)

function table(): ReturnType<typeof modelsOf> {
  return models.table ??= modelsOf(appConfig as Record<string, any>)
}

/** The names of the content models this build carries. */
export function cmsModelNames(): string[] {
  return [...table().models.keys()]
}

/** Every model of the build with its config: for the start check, which looks at all of them. */
export function cmsModelConfigs(): { name: string; config: Record<string, any> }[] {
  return [...table().models.values()].map(({ name, config }) => ({ name, config }))
}

function modelNamed(name: string, site: string): CmsSiteModel {
  const have = models.ready.get(name)
  if (have) return have
  const declared = table().models.get(name)
  if (!declared) throw new Error(`[tinyzoo] site ${site}: its content model "${name}" is not one of this build's (${cmsModelNames().join(', ')})`)
  // One registry per model (buildRegistry keeps it by config object), so the sites of a model share it.
  const made: CmsSiteModel = { name, config: declared.config, reg: buildRegistry(declared.config) }
  models.ready.set(name, made)
  return made
}

/**
 * The model of the current site's design: the code-first types only, shared by every site of
 * the design. Migrations, the upgrade steps and the structure function work with this one.
 */
export function cmsDesignModel(): CmsSiteModel {
  if (!cmsIsMultiTenant()) {
    if (!table().models.has(DEFAULT_MODEL)) {
      throw new Error(`[tinyzoo] this build carries several content models (${cmsModelNames().join(', ')}) and none of its own; `
        + 'run it in multi-tenant mode, where each site\'s row names its model')
    }
    return modelNamed(DEFAULT_MODEL, DEFAULT_MODEL)
  }
  const site = useCmsSite('the content model')
  return modelNamed(site.model, site.id)
}

/**
 * The content model of the current site: the one place that decides it. Single mode: the model
 * `default`. Multi mode: the one the site's directory row names; outside a site this throws, as
 * `useCms().db` does. A site with its own content types (cmsCustomTypes.ts) gets the design's
 * model with its own types laid over it, once they are loaded (`cmsSiteReady`); before that, and
 * for a site with none, the design's shared model, the same objects for every site of the design.
 */
export function cmsSiteModel(): CmsSiteModel {
  const design = cmsDesignModel()
  if (!cmsSiteCounted()) return design
  return custom.peek()?.loaded?.model ?? design
}

// ── a site's own content types ─────────────────────────────────────────────────
//
// The custom part is read once per site instance, before the instance serves anything, and
// never changes for the instance's life. A change of structure retires the instance
// (cmsModelChange.ts); the next request makes a fresh one, which reads the new model.

/** What an instance loaded of the site's own types. `model` is null when they add nothing (none, or none could be built). */
export interface CmsCustomPart {
  /** The version of `cms_model` it was read from (0: the site never changed its structure). */
  version: number
  /** The whole document, hidden things included; null when there is none or it could not be read. */
  doc: ModelDoc | null
  model: CmsSiteModel | null
  /** What the mapper left out, and a document that could not be read. */
  problems: ModelMapProblem[]
}

const custom = cmsSiteScoped<{ loaded: CmsCustomPart | null; loading: Promise<void> | null }>(() => ({ loaded: null, loading: null }))

/** The deletion of things hidden empty while the site stays loaded: one timer per site, stopped when its memory goes. */
const sweep = cmsSiteScoped<{ timer: ReturnType<typeof setInterval> | null }>(() => ({ timer: null }), {
  dispose: (s) => { if (s.timer) clearInterval(s.timer) },
})

/** How often a loaded site looks for hidden empty things that are due. Production: every 6 hours. */
const SWEEP_MS = 6 * 60 * 60 * 1000

const LOAD_FAILED = Symbol('cmsModelLoadFailed')

/** Was this error a failure to read the site's own content types (the gates answer 503 and the next request tries again)? */
export function cmsIsModelLoadError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as any)[LOAD_FAILED] === true
}

const rowsOf = (res: any): any[] => res?.rows ?? res ?? []

/** Does the design of the current site have a type whose name starts with the custom prefix? Its own types are then not loaded. */
export function cmsDesignUsesCustomPrefix(): boolean {
  return cmsDesignModel().reg.entities.some((e) => e.name.startsWith(CUSTOM_PREFIX))
}

/**
 * The test build shortens the waits (at least 50 ms each): how long after hiding the server deletes
 * what was hidden empty, and how long after hiding a person may delete a thing for good.
 * Production uses the document's own rules.
 */
export function cmsModelPurgeTimes(): { purgeEmptyAfterMs?: number; deleteWaitMs?: number } {
  const out: { purgeEmptyAfterMs?: number; deleteWaitMs?: number } = {}
  const empty = cmsTimerMs('CMS_TEST_MODEL_PURGE_EMPTY_MS', 0)
  const wait = cmsTimerMs('CMS_TEST_MODEL_DELETE_WAIT_MS', 0)
  if (empty) out.purgeEmptyAfterMs = empty
  if (wait) out.deleteWaitMs = wait
  return out
}

/** The newest stored version of the site's model, or null when the site never changed its structure (no table, or no row). */
async function readStored(db: any): Promise<{ version: number; doc: unknown } | null> {
  const [exists] = rowsOf(await db.execute(sql`select to_regclass('public.cms_model') as t`))
  if (!exists?.t) return null
  const [row] = rowsOf(await db.execute(sql`select version, doc from "cms_model" order by version desc limit 1`))
  return row ? { version: Number(row.version), doc: row.doc } : null
}

/** Does the document hold something the sweep could ever delete: a type or a field hidden while it held nothing? Nothing else is deleted by a timer. */
const hasSweepable = (doc: ModelDoc): boolean => doc.types.some((t) => (!!t.removedAt && t.removedEmpty === true) || t.fields.some((f) => !!f.removedAt && f.removedEmpty === true))

/** Read the site's own types from its database and build them over the design's model. */
async function readCustomPart(): Promise<CmsCustomPart> {
  const site = useCmsSite()
  const none: CmsCustomPart = { version: 0, doc: null, model: null, problems: [] }
  if (!cmsCustomTypes().on) {
    if (customTypesEnabled(site.config?.customTypes) && cmsDesignUsesCustomPrefix()) {
      console.error(`[cms] site ${site.id}: its own content types are not loaded: the design has a type whose name starts with "${CUSTOM_PREFIX}", which is kept for them. Rename that type in the design`)
    }
    return none
  }
  const design = cmsDesignModel()
  const { db } = useCms()
  const stored = await readStored(db)
  if (!stored) return none
  let version = stored.version
  let doc: ModelDoc
  try {
    doc = parseModelDoc(stored.doc)
  }
  catch (err) {
    const message = (err as Error)?.message ?? String(err)
    console.error(`[cms] site ${site.id}: its content types (version ${version}) cannot be read, so the site runs with its design's types only: ${message}`)
    return { ...none, version, problems: [{ type: '', message }] }
  }

  // Things hidden empty that are due go for good now (if still empty), before the entities are built: the instance has not served yet.
  const due = modelPurgeDue(doc, new Date(), cmsModelPurgeTimes())
  if (due.types.length || due.fields.length) {
    try {
      const done = await cmsChangeModelBeforeLoad({ baseVersion: version, ops: [{ op: 'purge', ...due }], internal: true })
      version = done.version
      doc = done.doc
    }
    catch (err) {
      // Another instance did it first (the version moved on), or the tables were busy: read what is stored now, as it is.
      const again = await readStored(db).catch(() => null)
      if (again && again.version !== version) {
        try { doc = parseModelDoc(again.doc); version = again.version }
        catch { /* keep the document read first */ }
      }
      else if ((err as any)?.data?.code !== 'busy') console.warn(`[cms] site ${site.id}: hidden content types could not be deleted yet:`, scrubError(err).message)
    }
  }

  const built = modelEntities(doc, design.config)
  for (const p of built.problems) console.warn(`[cms] site ${site.id}: ${p.message}`)
  if (hasSweepable(doc)) startSweep()
  const names = Object.keys(built.entities)
  if (!names.length) return { version, doc, model: null, problems: built.problems }
  // The site's own config: the design's exports and its own types, under keys no export of the design can have.
  const config: Record<string, any> = { ...design.config }
  for (const name of names) config[`custom:${name}`] = built.entities[name]
  return { version, doc, model: { name: design.name, config, reg: buildRegistry(config) }, problems: built.problems }
}

/** While a site with things hidden empty stays loaded, look for what is due now and then, through the structure function. */
function startSweep(): void {
  const mine = sweep()
  if (mine.timer) return
  const site = useCmsSite()
  const retired = cmsSiteRetiredCheck()
  mine.timer = setInterval(() => {
    // Only in this instance, and without making the site "used": a retired one is being replaced.
    if (retired()) return
    void cmsPeekInSite(site, () => sweepDue())
  }, cmsTimerMs('CMS_TEST_MODEL_SWEEP_MS', SWEEP_MS))
  mine.timer.unref?.()
}

async function sweepDue(): Promise<void> {
  const loaded = custom.peek()?.loaded
  if (!loaded?.doc) return
  const due = modelPurgeDue(loaded.doc, new Date(), cmsModelPurgeTimes())
  if (!due.types.length && !due.fields.length) return
  try {
    await cmsChangeModel(null, { baseVersion: loaded.version, ops: [{ op: 'purge', ...due }], internal: true })
  }
  catch (err) {
    // Another instance did it first (the version moved on), or the tables were busy: the next round looks again.
    const code = (err as any)?.data?.code
    if (code === 'stale-version' || code === 'busy') return
    console.error(`[cms] site ${useCmsSite().id}: hidden content types could not be deleted`, scrubError(err))
  }
}

/**
 * Read the current site's own content types, once per site instance (a counted site, with the
 * feature on for the site; otherwise at once). A failure (the database could not be read)
 * is not kept: the caller answers 503 and the next one tries again.
 */
export function cmsLoadSiteModel(): Promise<void> {
  if (!cmsSiteCounted() || !cmsCustomTypesSwitch()) return Promise.resolve()
  const state = custom()
  if (state.loaded) return Promise.resolve()
  if (state.loading) return state.loading
  const loading = readCustomPart().then((part) => { state.loaded = part }, (err) => {
    console.error(`[cms] site ${useCmsSite().id}: its own content types could not be read; its requests answer 503 until they can`, scrubError(err))
    throw Object.assign(new Error(`site ${useCmsSite().id}: its own content types could not be read`, { cause: scrubError(err) }), { [LOAD_FAILED]: true })
  })
  state.loading = loading
  loading.then(() => { state.loading = null }, () => { if (state.loading === loading) state.loading = null })
  return loading
}

/**
 * Resolves when the current site can serve: its migrations have run, and then its own content
 * types are loaded. With the feature off this is `cmsMigrationsReady()` and nothing else. Single
 * mode: the app's own model file is taken in first, once per process (cmsAppModelFile.ts).
 */
export function cmsSiteReady(): Promise<void> {
  if (!cmsSiteCounted() || !cmsCustomTypesSwitch()) return cmsMigrationsReady()
  if (!cmsIsMultiTenant()) return cmsMigrationsReady().then(() => cmsAppModelFileReady()).then(() => cmsLoadSiteModel())
  return cmsMigrationsReady().then(() => cmsLoadSiteModel())
}

/**
 * Run `fn` once the current site is ready, for work that reaches the site without passing a
 * gate (a socket's hooks, a message from another instance). At once when the feature is off or
 * the site's types are loaded already, so the order of such work is kept.
 */
export function cmsAfterSiteReady<T>(fn: () => T, failed?: (err: unknown) => unknown): T | Promise<Awaited<T>> {
  if (!cmsSiteCounted() || !cmsCustomTypesSwitch() || custom.peek()?.loaded) return fn()
  return cmsSiteReady().then(() => fn() as Awaited<T>, (err) => {
    if (!failed) throw err
    return failed(err) as Awaited<T>
  })
}

/** What the current instance loaded of the site's own types; null before the load and with the feature off. Never loads. */
export function cmsLoadedCustomPart(): CmsCustomPart | null {
  if (!cmsSiteCounted()) return null
  return custom.peek()?.loaded ?? null
}

/** Whether the current instance has read its own types yet: `idle` (nobody asked), `loading` or `loaded`. Never loads. */
export function cmsCustomPartState(): 'idle' | 'loading' | 'loaded' {
  const state = cmsSiteCounted() ? custom.peek() : undefined
  return state?.loaded ? 'loaded' : state?.loading ? 'loading' : 'idle'
}

import { buildRegistry, DEFAULT_MODEL, modelsOf, type CmsRegistry } from 'tinyzoo'
// virtual alias provided by the module (build-time); typed through the host's tsconfig paths.
// The only server file that reads the build's config: everything else asks for the site's model here.
import * as appConfig from '#cms/config'

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
 * The content model of the current site: the one place that decides it (a later step lays a
 * site's own types over the model here). Single mode: the model `default`. Multi mode: the one
 * the site's directory row names; outside a site this throws, as `useCms().db` does.
 */
export function cmsSiteModel(): CmsSiteModel {
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

// Check the content models and the plugins when the server starts: a plugin registered
// twice, a taken name, an entity that needs a plugin that is not registered, models whose
// plugins differ (the build registers one set for all of them), a single-mode server whose
// build has no model of its own. Every model's registry is built here (an error names the
// model); a registry is otherwise built by the first request that needs it, which would then
// answer 500 to everything. In production a failure stops the start with the message (the
// platform restarts or rolls back); in development it is logged and shown again on every request.
import { buildRegistry, DEFAULT_MODEL, modelPluginsProblem } from 'tinyzoo'

export default defineNitroPlugin(() => {
  try {
    const names = cmsModelNames()
    if (!cmsIsMultiTenant() && !names.includes(DEFAULT_MODEL)) cmsSiteModel()
    const built = cmsModelConfigs()
    for (const { name, config } of built) {
      try { buildRegistry(config) }
      catch (err: any) {
        throw new Error(names.length > 1 || name !== DEFAULT_MODEL ? `the content model "${name}": ${err?.message ?? err}` : (err?.message ?? String(err)), { cause: err })
      }
    }
    const problem = modelPluginsProblem(built)
    if (problem) throw new Error(problem)
  }
  catch (err: any) {
    console.error(`[cms] the content model or a plugin is misconfigured: ${err?.message ?? err}`)
    if (process.env.NODE_ENV === 'production') throw err
  }
})

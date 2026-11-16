// Check the content model and the plugins when the server starts: a plugin registered
// twice, a taken name, an entity that needs a plugin that is not registered. The
// registry is otherwise built by the first request, which would then answer 500 to
// everything. In production a failure stops the start with the message (the platform
// restarts or rolls back); in development it is logged and shown again on every request.
import { buildRegistry } from 'tinyzoo'
import * as cmsConfig from '#cms/config'

export default defineNitroPlugin(() => {
  try {
    buildRegistry(cmsConfig as Record<string, any>)
  }
  catch (err: any) {
    console.error(`[cms] the content model or a plugin is misconfigured: ${err?.message ?? err}`)
    if (process.env.NODE_ENV === 'production') throw err
  }
})

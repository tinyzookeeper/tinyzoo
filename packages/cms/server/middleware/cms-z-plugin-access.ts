import { pluginRouteAccess } from 'tinyzoo'

// Plugin routes (/api/cms/_p/<plugin>/…) are closed unless the plugin says otherwise:
// a signed-in person by default, an administrator or anyone when the handler declares
// `access: 'admin'` / `'public'`. Checked here, before the handler runs, so a plugin
// cannot forget it. Runs after cms-session (which says who is signed in): Nitro orders middleware by file name, hence the "z".
// Plugin routes on the content API (`contentPath`) are open, like the content API itself.
export default defineEventHandler((event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/cms/_p/')) return
  const access = pluginRouteAccess(useCms().reg.plugins, event.method, path)
  if (access === 'public' || access === null) return
  const user = requireCmsUser(event)
  if (access === 'admin' && !roleOf(user)?.manage) throw createError({ statusCode: 403, statusMessage: 'Administrators only' })
})

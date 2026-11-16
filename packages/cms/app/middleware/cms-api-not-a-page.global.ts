// An /api/… address that no API route answered is a 404, never a website page.
// Without this, Nuxt renders it as a page: a catch-all page ([...slug].vue) then
// fetches /api/content/page/<that address>, which nothing answers either, renders
// again… a request loop that eats the server's memory (a bot asking for
// /.well-known/x was enough to bring a site down). Stopped before any page code runs.
export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/api' || to.path.startsWith('/api/')) {
    return abortNavigation(createError({ statusCode: 404, statusMessage: 'Not found', fatal: true }))
  }
})

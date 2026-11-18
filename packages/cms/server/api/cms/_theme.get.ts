// The admin's theme (name, brand colour, logos) as JSON, for the admin's pages. Public:
// the sign-in page needs it before anyone is signed in, and it holds nothing that the
// admin's own pages do not show to every visitor of /admin.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  return cmsPublicAdminTheme(event)
})

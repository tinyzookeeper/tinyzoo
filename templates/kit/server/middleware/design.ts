// The design a site is drawn in is its content model: a Photographer site is drawn with
// Photographer's components. Put on the request for the app, which reads it while it draws the
// page on the server (app/plugins/design.ts), and for the handlers a design brings, which answer
// only on that design's sites (the kit's module wraps them). A template's own build has one
// design and needs nothing; only the one app runs in multi-tenant mode.
export default defineEventHandler((event) => {
  if (cmsIsMultiTenant() && event.context.cmsSite) event.context.siteDesign = cmsSiteModel().name
})

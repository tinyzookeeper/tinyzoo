// DELETE /api/cms/_model/code/<name> — remove a registration: the code it stands for is no longer
// asked before a change of structure. { removed: name }; 404 `no-registration` when there is none.
// An administrator signed in, or an access token with the right "Content types"; 404 when the
// feature is off for the site.
export default defineEventHandler(async (event) => {
  await requireModelCaller(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return cmsRemoveCode(event, getRouterParam(event, 'name') ?? '')
})

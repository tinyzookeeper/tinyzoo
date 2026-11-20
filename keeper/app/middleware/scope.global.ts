// After auth: every page of a signed-in person knows their workspaces (GET /api/me). Pages under
// /w/<workspace>/t/<team|all> must name a workspace they are in (404 otherwise) and a team they
// see ("all" otherwise), and the place is remembered for the next visit.
export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) return
  const me = useMe()
  if (!me.value) await refreshMe()
  // Every workspace is for people who work in several; the others go to theirs.
  if ((to.path === '/home' || to.path.startsWith('/home/')) && !hasEverywhere(me.value)) {
    const where = scopePath(me.value, useLastScope().value)
    return navigateTo(where ? `${where}${to.path.slice(5)}` : '/', { replace: true })
  }
  const ws = typeof to.params.ws === 'string' ? to.params.ws : null
  if (!ws) return
  const w = me.value?.workspaces.find((x) => x.slug === ws)
  if (!w) return abortNavigation(createError({ statusCode: 404, statusMessage: 'No such workspace', fatal: true }))
  const team = typeof to.params.team === 'string' ? to.params.team : 'all'
  if (team !== 'all' && !w.teams.some((t) => t.slug === team)) {
    return navigateTo(to.path.replace(`/w/${ws}/t/${team}`, `/w/${ws}/t/all`), { replace: true })
  }
  useLastScope().value = `${ws}/${team}`
})

// Protect the dashboard. Public routes (/, /login, …) pass through.
export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith('/admin')) return
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})

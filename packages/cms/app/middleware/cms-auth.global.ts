// Admin routes need a signed-in session; the sign-in pages are the exception (and
// send someone who is already signed in straight to the admin).
const PUBLIC = ['/admin/login', '/admin/setup', '/admin/forgot', '/admin/reset/', '/admin/invite/']

export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith('/admin')) return
  const { loggedIn } = useUserSession()
  const isPublic = PUBLIC.some((p) => to.path === p || (p.endsWith('/') && to.path.startsWith(p)))
  if (isPublic) {
    if (loggedIn.value && (to.path === '/admin/login' || to.path === '/admin/setup')) return navigateTo('/admin')
    return
  }
  if (!loggedIn.value) {
    return navigateTo({ path: '/admin/login', query: to.fullPath !== '/admin' ? { redirect: to.fullPath } : {} })
  }
})

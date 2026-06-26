export default defineEventHandler(async (event) => {
  const { email, password } = await readBody<{ email: string; password: string }>(event)
  const user = findUser(email ?? '', password ?? '')
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  await setUserSession(event, {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  })
  return { ok: true }
})

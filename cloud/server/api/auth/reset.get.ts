// Whether a reset link still works (the page shows the form, or says it has expired).
export default defineEventHandler(async (event) => {
  const token = String(getQuery(event).token ?? '')
  return { valid: await peekEmailToken(token, 'reset') }
})

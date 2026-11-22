// Know who is signed in before the first page renders (the route middleware and the top bar need it).
export default defineNuxtPlugin(async () => {
  const loaded = useState('account-loaded', () => false)
  if (loaded.value) return
  const { refresh, user } = useAccount()
  await refresh()
  loaded.value = true
  // A signed-in person's own language wins over the browser's cookie.
  const cookie = useLocaleCookie()
  if (user.value && cookie.value !== user.value.locale) cookie.value = user.value.locale
})

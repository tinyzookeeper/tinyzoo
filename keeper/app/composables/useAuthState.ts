/** Whether Keeper still needs its first account, and whether that asks for the setup token. */
export function useAuthState() {
  return useFetch<{ needsSetup: boolean; needsToken: boolean }>('/api/auth/state', {
    key: 'auth-state',
    default: () => ({ needsSetup: false, needsToken: false }),
  })
}

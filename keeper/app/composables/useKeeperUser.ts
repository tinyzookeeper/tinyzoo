export interface KeeperUser {
  id: string
  name: string
  email: string
  role: 'owner' | 'member'
  workspaceId: string
  workspaceName: string
}

/** The signed-in person, typed the way Keeper's session stores them. */
export function useKeeperUser() {
  const { user, clear, fetch } = useUserSession()
  const me = computed(() => (user.value as unknown as KeeperUser | null) ?? null)
  const isOwner = computed(() => me.value?.role === 'owner')
  async function signOut() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    await clear()
    await navigateTo('/login')
  }
  return { me, isOwner, signOut, refresh: fetch }
}

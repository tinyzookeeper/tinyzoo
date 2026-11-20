import type { WorkspaceRole } from '#keeper/types/keeper'

export interface KeeperUser {
  id: string
  name: string
  email: string
}

export const ROLE_LABELS: Record<WorkspaceRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member', guest: 'Guest' }

export const ROLE_HELP: Record<WorkspaceRole, string> = {
  owner: 'Everything, including making and removing owners.',
  admin: 'The workspace, its teams and people, and every site.',
  member: 'The sites of their teams: adds, changes, checks and removes them.',
  guest: 'Only looks at the sites of their teams. For a client’s own people.',
}

/** The signed-in person, typed the way Keeper's session stores them. Their roles are per workspace: useScope(). */
export function useKeeperUser() {
  const { user, clear, fetch } = useUserSession()
  const me = computed(() => (user.value as unknown as KeeperUser | null) ?? null)
  async function signOut() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    await clear()
    useState('keeper-me').value = null
    await navigateTo('/login')
  }
  return { me, signOut, refresh: fetch }
}

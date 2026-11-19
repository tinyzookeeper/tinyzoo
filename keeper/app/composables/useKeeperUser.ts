import type { MemberRole } from '#keeper/types/keeper'

export interface KeeperUser {
  id: string
  name: string
  email: string
  role: MemberRole
  workspaceId: string
  workspaceName: string
}

export const ROLE_LABELS: Record<MemberRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' }

/** The signed-in person, typed the way Keeper's session stores them. */
export function useKeeperUser() {
  const { user, clear, fetch } = useUserSession()
  const me = computed(() => (user.value as unknown as KeeperUser | null) ?? null)
  const isOwner = computed(() => me.value?.role === 'owner')
  /** Owners and admins: the team, the clients and the settings. */
  const isManager = computed(() => me.value?.role === 'owner' || me.value?.role === 'admin')
  /** Everyone but viewers may add, change, check and remove sites. */
  const canWrite = computed(() => !!me.value && me.value.role !== 'viewer')
  async function signOut() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    await clear()
    await navigateTo('/login')
  }
  return { me, isOwner, isManager, canWrite, signOut, refresh: fetch }
}

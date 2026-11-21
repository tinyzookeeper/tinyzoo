import type { MeResponse, MeTeam, MeWorkspace } from '#keeper/types/keeper'

/** Every workspace I am in, with the teams I see (GET /api/me), loaded by the scope middleware. */
export const useMe = () => useState<MeResponse | null>('keeper-me', () => null)

/** Load (or reload) /api/me into useMe(). */
export async function refreshMe(): Promise<MeResponse | null> {
  const me = useMe()
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  me.value = await fetcher<MeResponse>('/api/me').catch(() => null)
  return me.value
}

/** The last place someone was (a cookie), to land there again: `<workspace>/<team>`. */
export const useLastScope = () => useCookie<string | null>('keeper-scope', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })

/** The workspaces where I am more than a guest: what the Every workspace page covers. */
export const workingWorkspaces = (me: MeResponse | null) => (me?.workspaces ?? []).filter((w) => w.role !== 'guest')

/** Whether someone gets the Every workspace page: they work in more than one workspace. */
export const hasEverywhere = (me: MeResponse | null) => workingWorkspaces(me).length > 1

/**
 * The first page to open: Every workspace for someone who works in several; otherwise the last
 * workspace and team, or the first workspace; null without any.
 */
export function homePath(me: MeResponse | null, last: string | null | undefined): string | null {
  if (!me?.workspaces.length) return null
  if (hasEverywhere(me)) return '/home'
  return scopePath(me, last)
}

/** The last workspace and team (still mine), or the first workspace: `/w/<ws>/t/<team|all>`. */
export function scopePath(me: MeResponse | null, last: string | null | undefined): string | null {
  if (!me?.workspaces.length) return null
  const [ws, team] = (last ?? '').split('/')
  const w = me.workspaces.find((x) => x.slug === ws)
  if (w) return `/w/${w.slug}/t/${team && (team === 'all' || w.teams.some((t) => t.slug === team)) ? team : 'all'}`
  return `/w/${me.workspaces[0]!.slug}/t/all`
}

/**
 * Where I am: the workspace and team in the address (/w/<workspace>/t/<team|all>/…), my role
 * there and what it lets me do, and links inside this scope.
 */
export function useScope() {
  const route = useRoute()
  const me = useMe()
  const wsSlug = computed(() => (typeof route.params.ws === 'string' ? route.params.ws : ''))
  const teamSlug = computed(() => (typeof route.params.team === 'string' ? route.params.team : 'all'))
  const workspace = computed<MeWorkspace | null>(() => me.value?.workspaces.find((w) => w.slug === wsSlug.value) ?? null)
  /** The team in the address; null on "All teams". */
  const team = computed<MeTeam | null>(() => (teamSlug.value === 'all' ? null : workspace.value?.teams.find((t) => t.slug === teamSlug.value) ?? null))
  const role = computed(() => workspace.value?.role ?? null)
  const isOwner = computed(() => role.value === 'owner')
  const isManager = computed(() => role.value === 'owner' || role.value === 'admin')
  /** Adds, changes, checks and removes sites here: everyone but guests. */
  const canWrite = computed(() => !!role.value && role.value !== 'guest')
  /** A client's person here: the guest view, their sites in plain words. */
  const isGuest = computed(() => role.value === 'guest')
  /** Who looks after this workspace's sites, as guests read it. */
  const signature = computed(() => workspace.value?.signature || workspace.value?.name || '')
  const base = computed(() => (workspace.value ? `/w/${workspace.value.slug}/t/${teamSlug.value}` : ''))
  /** A path inside this workspace and team: link('/versions'). */
  const link = (path = '') => `${base.value}${path}`
  /** The same page in another workspace or team. */
  function swap(ws: string, team = 'all'): string {
    const rest = base.value && route.path.startsWith(base.value) ? route.path.slice(base.value.length) : ''
    // A site or a team's settings belong to one place: go to the list instead.
    const keep = /^\/(versions|traffic|settings(\/[a-z-]+)?)?$/.test(rest) ? rest : ''
    return `/w/${ws}/t/${team}${keep}`
  }
  /** On the Every workspace pages (/home). */
  const everywhere = computed(() => route.path === '/home' || route.path.startsWith('/home/'))
  return { me, workspace, team, wsSlug, teamSlug, role, isOwner, isManager, canWrite, isGuest, signature, base, link, swap, everywhere }
}

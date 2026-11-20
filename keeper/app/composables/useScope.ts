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

/** The first page to open: the last workspace and team, or the first workspace, or null without any. */
export function homePath(me: MeResponse | null, last: string | null | undefined): string | null {
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
  const base = computed(() => (workspace.value ? `/w/${workspace.value.slug}/t/${teamSlug.value}` : ''))
  /** A path inside this workspace and team: link('/versions'). */
  const link = (path = '') => `${base.value}${path}`
  /** The same page in another workspace or team. */
  function swap(ws: string, team = 'all'): string {
    const rest = base.value && route.path.startsWith(base.value) ? route.path.slice(base.value.length) : ''
    // A site or a team's settings belong to one place: go to the list instead.
    const keep = /^\/(versions|settings(\/[a-z-]+)?)?$/.test(rest) ? rest : ''
    return `/w/${ws}/t/${team}${keep}`
  }
  return { me, workspace, team, wsSlug, teamSlug, role, isOwner, isManager, canWrite, base, link, swap }
}

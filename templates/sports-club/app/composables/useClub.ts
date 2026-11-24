// What the Sports club's blocks draw from: the collections, and the club's facts worked out of
// them (the next match, the last result, the form, the place in the table). (The site-wide
// content, the page and `useSiteList` are the template kit's.)
import type { AgeGroup, Article, Committee, Match, Player, Sponsor, Squad, Standing } from '../lib/cms-content'

/** The teams, in the editors' order: the first one is the club's main team. */
export const useSquads = () => useSiteList<Squad>('site-squads', 'squad')
/** Every match, by date. */
export const useMatches = () => useSiteList<Match>('site-matches', 'match', { sort: 'date', dir: 'asc' })
/** The squad, in the editors' order. */
export const usePlayers = () => useSiteList<Player>('site-players', 'player')
/** The league table, in the order of the table. */
export const useStandings = () => useSiteList<Standing>('site-standings', 'standing')
/** The age groups a child can join, in the editors' order. */
export const useAgeGroups = () => useSiteList<AgeGroup>('site-age-groups', 'ageGroup')
/** The partners, in the editors' order. */
export const useSponsors = () => useSiteList<Sponsor>('site-sponsors', 'sponsor')
/** The committee, in the editors' order. */
export const useCommittee = () => useSiteList<Committee>('site-committee', 'committee')
/** The published articles, newest first. */
export const useArticles = () => useSiteList<Article>('site-articles', 'article', { sort: 'date', dir: 'desc' })

/**
 * The time, once the page is mounted. It is null on the server and in the browser's first
 * drawing, so what depends on the time (which match is next) is drawn the same by both and then
 * corrected. Call it at the start of `setup`, before any `await`.
 */
export function useNow(): Ref<number | null> {
  const now = ref<number | null>(null)
  onMounted(() => { now.value = Date.now() })
  return now
}

export interface NextView {
  /** The next match of the main team; null when there is none. */
  match: MatchView | null
  squad: Squad | null
  /** The club's own place in the table. */
  ours: Place | null
  /** The opponent's place in the table, when it is in it. */
  theirs: Place | null
}

/** The next match of the main team, with the club's place and the opponent's. */
export async function useNextMatch(now: Ref<number | null>): Promise<ComputedRef<NextView>> {
  const [{ name }, squads, matches, standings] = await Promise.all([useSite(), useSquads(), useMatches(), useStandings()])
  return computed(() => {
    const squad = mainSquad(squads.value)
    const found = nextMatchOf(matches.value, squad?.id, now.value)
    const match = found ? viewOf(found, name.value) : null
    return { match, squad, ours: ourPlace(standings.value), theirs: match ? placeOfClub(standings.value, match.opponent) : null }
  })
}

export interface LastView {
  /** The last played match of the main team; null when none is played. */
  match: MatchView | null
  /** The outcomes of its last five matches, oldest first. */
  form: Outcome[]
  ours: Place | null
}

/** The last result of the main team, its form and its place in the table. */
export async function useLastResult(): Promise<ComputedRef<LastView>> {
  const [{ name }, squads, matches, standings] = await Promise.all([useSite(), useSquads(), useMatches(), useStandings()])
  return computed(() => {
    const squad = mainSquad(squads.value)
    const last = playedOf(matches.value, squad?.id)[0]
    return { match: last ? viewOf(last, name.value) : null, form: formOf(matches.value, squad?.id, name.value), ours: ourPlace(standings.value) }
  })
}

export interface TableView {
  rows: Standing[]
  ours: Place | null
  form: Outcome[]
}

/** The league table with the club's place and form. */
export async function useTable(): Promise<ComputedRef<TableView>> {
  const [{ name }, squads, matches, standings] = await Promise.all([useSite(), useSquads(), useMatches(), useStandings()])
  return computed(() => ({ rows: standings.value, ours: ourPlace(standings.value), form: formOf(matches.value, mainSquad(squads.value)?.id, name.value) }))
}

/** The teams that get a tab in the fixtures, and every match as the looks draw it. */
export async function useFixtures() {
  const [{ name }, squads, matches] = await Promise.all([useSite(), useSquads(), useMatches()])
  return {
    squads: computed(() => squads.value.filter((s) => s.inMatches)),
    matches: computed(() => matches.value.map((m) => viewOf(m, name.value))),
  }
}

/** The page's sections, for a block that needs to know what else the page shows (the table beside the fixtures). */
export async function usePageSections() {
  const { page } = await useSitePage()
  return computed(() => page.value?.sections ?? [])
}

/** The club as the looks write it: its name, its settings, the words and the header's button. */
export async function useClub() {
  const { settings, name } = await useSite()
  const words = useSiteWords()
  return {
    settings, name, words,
    /** The header's button: its text and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null)),
  }
}

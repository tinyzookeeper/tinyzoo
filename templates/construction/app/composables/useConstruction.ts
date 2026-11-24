// What the blocks draw from: the facts of the firm (Site settings) and the collections.
// (The site-wide content, the page and `useSiteList` are the template kit's.)
import type { Person, Project, Service, Testimonial, Town } from '~/lib/cms-content'

/** The projects, finished and under construction, in the editors' order. */
export const useProjects = () => useSiteList<Project>('site-projects', 'project')
/** The services, in the editors' order. */
export const useServices = () => useSiteList<Service>('site-services', 'service')
/** The people, in the editors' order. */
export const usePeople = () => useSiteList<Person>('site-people', 'person')
/** What clients say, in the editors' order. */
export const useTestimonials = () => useSiteList<Testimonial>('site-testimonials', 'testimonial')
/** The towns the firm builds in, in the editors' order. */
export const useTowns = () => useSiteList<Town>('site-towns', 'town')

/** The firm as the looks write it: its name, phone, address and the rest of what Site settings hold. */
export async function useFirm() {
  const { settings, name } = await useSite()
  const words = useSiteWords()
  return {
    settings, name, words,
    /** "tel:123456701"; null without a phone. */
    tel: computed(() => (settings.value?.phone ? telHref(settings.value.phone) : null)),
    /** "583 01 Chotěboř" */
    postalTown: computed(() => postalTown(settings.value)),
    /** The header's button: its text and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null)),
    /** The small notes beside menu links in a phone's menu, by the link's address. */
    noteOf: (url: string) => (settings.value?.menuNotes ?? []).find((n) => siteHref(n.link) === url)?.note ?? '',
  }
}

/** The page's sections, for a block that needs to know what stands beside it. */
export async function usePageSections() {
  const { page } = await useSitePage()
  return computed(() => page.value?.sections ?? [])
}

/**
 * The moment for what depends on today (the week a build is in, "state of 23. 11. 2026"): null
 * on the server and in the browser's first drawing, so both draw the same, and the real moment
 * once the page is up. A switch for testing (`?now=2026-11-23` in the address) works only in development.
 */
export function useNow() {
  const now = ref<number | null>(null)
  onMounted(() => {
    const fixed = import.meta.dev ? new URL(location.href).searchParams.get('now') : null
    const t = fixed ? Date.parse(fixed) : Date.now()
    now.value = Number.isNaN(t) ? Date.now() : t
  })
  return now
}

/** The filter of the projects, the same in every look: one kind at a time, or all. */
export function useKindFilter(projects: MaybeRefOrGetter<Project[]>) {
  /** A kind, or null for all */
  const active = ref<Project['kind'] | null>(null)
  return {
    active,
    kinds: computed(() => kindCounts(toValue(projects))),
    total: computed(() => toValue(projects).length),
    shown: computed(() => toValue(projects).filter((p) => active.value === null || p.kind === active.value)),
    isShown: (p: Project) => active.value === null || p.kind === active.value,
    choose: (kind: Project['kind'] | null) => { active.value = kind },
  }
}

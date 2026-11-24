// What the Software template's blocks draw from: the facts of the product (Site settings) and
// the collections. (The site-wide content, the page and `useSiteList` are the template kit's.)
import type { Feature, Plan, PlanLimit, Question, Release, Testimonial } from '~/lib/cms-content'

/** What the product does, in the editors' order. */
export const useFeatures = () => useSiteList<Feature>('site-features', 'feature')
/** The plans of the price list, in the editors' order. */
export const usePlans = () => useSiteList<Plan>('site-plans', 'plan')
/** The rows of the comparison table under the plans. */
export const usePlanLimits = () => useSiteList<PlanLimit>('site-plan-limits', 'planLimit')
/** The testimonials, in the editors' order. */
export const useTestimonials = () => useSiteList<Testimonial>('site-testimonials', 'testimonial')
/** The questions, in the editors' order. */
export const useQuestions = () => useSiteList<Question>('site-questions', 'question')

/** The releases of the changelog, the newest first. */
export async function useReleases() {
  const all = await useSiteList<Release>('site-releases', 'release')
  return computed(() => [...all.value].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')))
}

/** The product as the looks write it: its name, the words, how to reach support, the company's line. */
export async function useSoftware() {
  const { settings, name } = await useSite()
  const words = useSiteWords()
  return {
    settings, name, words,
    /** The header's button: its text (the longer one for the phone) and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl
      ? { label: settings.value.ctaLabel, longLabel: settings.value.ctaLongLabel || settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) }
      : null)),
    /** The sign-in link: its text and where it leads. */
    login: computed(() => (settings.value?.loginLabel && settings.value.loginUrl ? { label: settings.value.loginLabel, url: settings.value.loginUrl } : null)),
    /** The company's line in the footer: name, address, numbers, the register. */
    legalLine: computed(() => {
      const s = settings.value
      return [s?.legalName, s?.address, s?.companyId && `${words.value.companyId} ${s.companyId}`, s?.vatId && `${words.value.vatId} ${s.vatId}`, s?.registry].filter(Boolean).join(' · ')
    }),
    /** "stav.odpolka.example": the status page's address without the scheme. */
    statusHost: computed(() => (settings.value?.statusUrl ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '')),
  }
}

/** The page's sections, for a block that needs to know what else the page shows (Návod's numbers). */
export async function usePageSections() {
  const { page } = await useSitePage()
  return computed(() => page.value?.sections ?? [])
}

/** The home page's sections: where a look finds the times of its sections (One Day's menu). */
export async function useHomeSections() {
  const { data } = await useFetch<{ item: { sections: Array<Record<string, any>> } | null }>('/api/content/page/home', { key: 'site-home-sections' })
  return computed(() => data.value?.item?.sections ?? [])
}

/** The prices of a plan as the billing switch shows them: what is paid per month, and what for the year. */
export function planPrice(plan: { monthly: number; yearly: number }, billing: 'monthly' | 'yearly') {
  return {
    amount: formatPrice(billing === 'monthly' ? plan.monthly : plan.yearly),
    note: { perMonthYearly: formatPrice(plan.yearly), perYear: formatPrice(yearTotal(plan.yearly)) },
  }
}

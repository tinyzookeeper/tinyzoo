// What the blocks draw from: the collections, in the editors' order (the articles newest first).
// (The site-wide content, the page and `useSiteList` are the template kit's.)
import type { Article, Project, Service, Testimonial } from '~/lib/cms-content'

/** The services of the price list. */
export const useServices = () => useSiteList<Service>('site-services', 'service')
/** The published projects. */
export const useProjects = () => useSiteList<Project>('site-projects', 'project')
/** What clients said. */
export const useTestimonials = () => useSiteList<Testimonial>('site-testimonials', 'testimonial')
/** The published articles, newest first. */
export const useArticles = () => useSiteList<Article>('site-articles', 'article', { sort: 'date', dir: 'desc' })

/** The site as the looks write it: the settings, the name, the website's words and the header's button. */
export async function useProfile() {
  // (asked for before the first wait: after one, Nuxt no longer knows which request this is)
  const year = useState('footer-year', () => new Date().getFullYear())
  const { settings, name } = await useSite()
  const words = useSiteWords()
  return {
    settings, name, words,
    /** The header's button: its text and where it leads. */
    cta: computed(() => (settings.value?.ctaLabel && settings.value.ctaUrl ? { label: settings.value.ctaLabel, url: siteHref(settings.value.ctaUrl) } : null)),
    /** The social links the owner filled in, in the footer's order. */
    socials: computed(() => {
      const s = settings.value
      const w = words.value
      return [
        { id: 'linkedin', label: w.linkedin, icon: 'i-lucide-linkedin', url: s?.linkedinUrl },
        { id: 'instagram', label: w.instagram, icon: 'i-lucide-instagram', url: s?.instagramUrl },
        { id: 'newsletter', label: w.newsletter, icon: 'i-lucide-rss', url: s?.newsletterUrl },
      ].filter((x): x is typeof x & { url: string } => !!x.url)
    }),
    /** The year in the footer: fixed once on the server and sent to the browser, so the two never disagree. */
    year,
  }
}

import { consentConfig } from './state'

// GET /api/content/_consent/config?locale=cs — what the banner shows (useConsent(), and
// <CmsConsent> on it): the texts and the categories with their services in the page's language, the version of the texts (a choice under an older one is
// asked again) and how many days a choice holds. The same for everyone, so it is cached briefly.
export default defineEventHandler(async (event) => {
  const locale = getQuery(event).locale
  const config = await consentConfig(typeof locale === 'string' ? locale : '')
  setResponseHeader(event, 'cache-control', 'public, max-age=60')
  return config
})

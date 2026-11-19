import { consentConfig } from './state'

// GET /api/content/_consent/config?locale=cs — what <CmsConsent> shows: the texts and the
// categories in the page's language, the version of the texts (a choice under an older one is
// asked again) and how many days a choice holds. The same for everyone, so it is cached briefly.
export default defineEventHandler(async (event) => {
  const locale = getQuery(event).locale
  const config = await consentConfig(typeof locale === 'string' ? locale : '')
  setResponseHeader(event, 'cache-control', 'public, max-age=60')
  return config
})

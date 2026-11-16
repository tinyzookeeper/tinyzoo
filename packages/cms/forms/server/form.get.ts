import { formEntity, formSchema } from './forms'

// GET /api/content/_form/:name?locale= — what the website needs to draw a form
// (defineForm): its fields with labels, help and choices in one language, the button
// and the thank-you message. <CmsForm> reads it; a custom form can too.
export default defineEventHandler((event) => {
  const { reg } = useCms()
  const e = formEntity(reg, getRouterParam(event, 'name'))
  const wanted = getQuery(event).locale
  const locale = typeof wanted === 'string' && reg.locales?.locales.includes(wanted)
    ? wanted
    : (reg.locales?.default ?? 'en')
  setResponseHeader(event, 'cache-control', 'public, max-age=60')
  return formSchema(e, locale)
})

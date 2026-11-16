import { formEntity, formLocale, formSchema } from './forms'

// GET /api/content/_form/:name?locale= — what the website needs to draw a form
// (defineForm): its fields with labels, help and choices in one language, the button
// and the thank-you message. <CmsForm> reads it; a custom form can too.
export default defineEventHandler((event) => {
  const { reg } = useCms()
  const e = formEntity(reg, getRouterParam(event, 'name'))
  const locale = formLocale(reg, getQuery(event).locale)
  setResponseHeader(event, 'cache-control', 'public, max-age=60')
  return formSchema(e, locale)
})

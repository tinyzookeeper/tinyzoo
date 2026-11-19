import { requireAnalyticsReader } from './context'
import { activeNow } from './queries'

// GET /api/cms/_p/analytics/live — visitors in the last five minutes (the page asks every 30 s).
export default defineEventHandler(async (event) => {
  requireAnalyticsReader(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return { active: await activeNow(useCms().db) }
})

/**
 * Who else reads the website: AI assistants, AI crawlers, search engines and other robots, told
 * apart by their user agent. None of them runs the tracker, so they are never in the visitor
 * numbers; the server counts the pages they load instead (server/robots.ts), one number per day
 * and robot, kept as rows of `analytics_daily` with the dimension `robot`.
 *
 * Names only, never the user agent itself: a robot not in the list below is "Other".
 * No `import`s of anything server-side: the admin page uses this file too.
 */
import { isRobot } from './ua'

/**
 * - `assistant`: an AI assistant opening a page because a person asked it to (ChatGPT, Claude…).
 * - `ai`: an AI company's crawler, reading pages to learn from or to answer from later.
 * - `search`: a search engine's crawler (Google, Seznam, Bing…).
 * - `other`: link previews, SEO tools, monitors, scripts.
 */
export type RobotGroup = 'assistant' | 'ai' | 'search' | 'other'

export const ROBOT_GROUPS: readonly RobotGroup[] = ['assistant', 'ai', 'search', 'other']

/** The dimension of the robots' rows in `analytics_daily`. */
export const ROBOT_DIMENSION = 'robot'

type Known = readonly [group: RobotGroup, name: string, test: RegExp]

/**
 * Robots by name, as their makers document them. The first that matches wins: an assistant's
 * fetcher is listed before the same company's crawler (`Claude-User` before `ClaudeBot`).
 */
export const KNOWN_ROBOTS: readonly Known[] = [
  // AI assistants, for a person who asked
  ['assistant', 'ChatGPT', /\bChatGPT-User\b/i],
  ['assistant', 'Claude', /\bClaude-User\b/i],
  ['assistant', 'Perplexity', /\bPerplexity-User\b/i],
  ['assistant', 'Mistral', /\bMistralAI-User\b/i],
  ['assistant', 'DuckDuckGo', /\bDuckAssistBot\b/i],
  ['assistant', 'Meta AI', /\bMeta-ExternalFetcher\b/i],
  // AI crawlers
  ['ai', 'OpenAI', /\bGPTBot\b|\bOAI-SearchBot\b/i],
  ['ai', 'Anthropic', /\bClaudeBot\b|\bClaude-SearchBot\b|\bClaude-Web\b|\banthropic-ai\b/i],
  ['ai', 'Perplexity', /\bPerplexityBot\b/i],
  ['ai', 'Common Crawl', /\bCCBot\b/i],
  ['ai', 'ByteDance', /\bBytespider\b/i],
  ['ai', 'Meta', /\bmeta-externalagent\b|\bFacebookBot\b/i],
  ['ai', 'Amazon', /\bAmazonbot\b/i],
  ['ai', 'Cohere', /\bcohere-ai\b|\bcohere-training-data-crawler\b/i],
  ['ai', 'Diffbot', /\bDiffbot\b/i],
  // Search engines
  ['search', 'Google', /\bGooglebot\b|\bGoogle-InspectionTool\b|\bGoogleOther\b|\bStorebot-Google\b|\bAdsBot-Google\b/i],
  ['search', 'Bing', /\bbingbot\b|\bBingPreview\b|\bmsnbot\b/i],
  ['search', 'Seznam', /\bSeznamBot\b|\bSeznam screenshot-generator\b/i],
  ['search', 'Apple', /\bApplebot\b/i],
  ['search', 'DuckDuckGo', /\bDuckDuckBot\b/i],
  ['search', 'Yandex', /\bYandex(Bot|Images|MobileBot|Accessibility)\b/i],
  ['search', 'Baidu', /\bBaiduspider\b/i],
  ['search', 'Yahoo', /\bSlurp\b/i],
  // Link previews and tools
  ['other', 'Facebook', /\bfacebookexternalhit\b|\bfacebookcatalog\b/i],
  ['other', 'WhatsApp', /\bWhatsApp\b/i],
  ['other', 'LinkedIn', /\bLinkedInBot\b/i],
  ['other', 'X', /\bTwitterbot\b/i],
  ['other', 'Slack', /\bSlackbot\b/i],
  ['other', 'Discord', /\bDiscordbot\b/i],
  ['other', 'Telegram', /\bTelegramBot\b/i],
  ['other', 'Ahrefs', /\bAhrefs(Bot|SiteAudit)\b/i],
  ['other', 'Semrush', /\bSemrushBot\b|\bSiteAuditBot\b/i],
  ['other', 'Majestic', /\bMJ12bot\b/i],
  ['other', 'Moz', /\bDotBot\b|\brogerbot\b/i],
  ['other', 'Lighthouse', /\bLighthouse\b|\bPageSpeed\b/i],
]

/** The name of a robot that is in no list. */
export const OTHER_ROBOT = 'Other'

export interface Robot {
  group: RobotGroup
  name: string
}

/** The robot a user agent belongs to, or null for a person's browser. */
export function robotOf(ua: string | null | undefined): Robot | null {
  const s = String(ua ?? '').slice(0, 512)
  for (const [group, name, test] of KNOWN_ROBOTS) if (test.test(s)) return { group, name }
  return isRobot(s) ? { group: 'other', name: OTHER_ROBOT } : null
}

/** The `value` of a robot's row in `analytics_daily`: `assistant:Claude`. */
export const robotKey = (r: Robot): string => `${r.group}:${r.name}`

/** A row's value read back; null for one this version does not know how to read. */
export function parseRobotKey(value: string): Robot | null {
  const i = value.indexOf(':')
  if (i < 0) return null
  const group = value.slice(0, i) as RobotGroup
  const name = value.slice(i + 1)
  return ROBOT_GROUPS.includes(group) && name ? { group, name } : null
}

/** What the admin shows for a period: the pages each robot loaded, and the totals of each group. */
export interface RobotReport {
  groups: Record<RobotGroup, number>
  /** Most pages first. */
  items: (Robot & { pages: number })[]
}

/** The report from rows of `analytics_daily` (value and pageviews), any number of days. */
export function robotReport(rows: readonly { value: string; pageviews: number }[]): RobotReport {
  const groups = Object.fromEntries(ROBOT_GROUPS.map((g) => [g, 0])) as Record<RobotGroup, number>
  const byKey = new Map<string, Robot & { pages: number }>()
  for (const row of rows) {
    const r = parseRobotKey(row.value)
    const n = Number(row.pageviews) || 0
    if (!r || n <= 0) continue
    groups[r.group] += n
    const key = robotKey(r)
    const had = byKey.get(key)
    if (had) had.pages += n
    else byKey.set(key, { ...r, pages: n })
  }
  const items = [...byKey.values()].sort((a, b) => b.pages - a.pages || a.name.localeCompare(b.name))
  return { groups, items }
}

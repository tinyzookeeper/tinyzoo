/**
 * Browser, system and robots from a user agent, written as data: the first rule that matches
 * wins, so the order matters (Edge and Opera say "Chrome" too, Chrome says "Safari").
 * Names only, no versions: that is all the reports show.
 */

type Rule = readonly [name: string, test: RegExp]

/** Browsers, most specific first. */
export const BROWSERS: readonly Rule[] = [
  ['Seznam', /SznProhlizec|Seznam\.cz/i],
  ['Edge', /\bEdg(e|A|iOS)?\//],
  ['Opera', /\bOPR\/|\bOPT\/|\bOpera\b/],
  ['Samsung Internet', /SamsungBrowser\//],
  ['Yandex', /YaBrowser\//],
  ['Vivaldi', /Vivaldi\//],
  ['UC Browser', /UCBrowser\//],
  ['Facebook', /\bFBAN\/|\bFBAV\//],
  ['Instagram', /\bInstagram\b/],
  ['Firefox', /\bFirefox\/|\bFxiOS\//],
  ['Chrome', /\bChrome\/|\bCriOS\/|\bCrMo\//],
  ['Safari', /\bVersion\/[\d.]+.*Safari\/|\bMobile\/\w+ Safari\/|AppleWebKit.*Mobile\/\w+$/],
  ['Internet Explorer', /\bMSIE |\bTrident\//],
]

/** Systems, most specific first (iPadOS and Android say "like Mac OS X" and "Linux"). */
export const SYSTEMS: readonly Rule[] = [
  ['iOS', /\b(iPhone|iPad|iPod)\b/],
  ['Android', /\bAndroid\b/],
  ['Windows', /\bWindows\b/],
  ['ChromeOS', /\bCrOS\b/],
  ['macOS', /\bMac OS X\b|\bMacintosh\b/],
  ['Linux', /\bLinux\b|\bUbuntu\b|\bFedora\b/],
]

/**
 * Robots, crawlers, previews and scripts. A real browser never says these words; what slips
 * through is also stopped by the tracker itself, which a robot without JavaScript never runs.
 */
export const ROBOTS = /bot\b|bot\/|crawl|spider|slurp|scrap|fetch|headless|lighthouse|pagespeed|pingdom|uptime|monitor|statuscake|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl\/|wget\/|python|httpclient|java\/|go-http|okhttp|axios|node-fetch|undici|phantomjs|selenium|puppeteer|playwright|cypress|seznambot|bingpreview|google-|adsbot|mediapartners|feedfetcher|validator|checker|scanner|nessus|zgrab|masscan/i

export interface ParsedUserAgent {
  browser: string | null
  os: string | null
  bot: boolean
}

const first = (rules: readonly Rule[], ua: string): string | null => {
  for (const [name, test] of rules) if (test.test(ua)) return name
  return null
}

export function isRobot(ua: string | null | undefined): boolean {
  const s = String(ua ?? '').trim()
  // No user agent, or one too short to be a browser's: a script.
  if (s.length < 20) return true
  return ROBOTS.test(s)
}

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  const s = String(ua ?? '').slice(0, 512)
  return { browser: first(BROWSERS, s), os: first(SYSTEMS, s), bot: isRobot(s) }
}

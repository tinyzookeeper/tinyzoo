/**
 * The visitor's choice in the browser, shared by `<CmsConsent>`, `useConsent()` and the
 * analytics tracker: a small store over the cookie. Framework-free, so it can be tested
 * without Nuxt; the app plugin (consent.ts) makes one per app and provides it as `$cmsConsent`.
 *
 * While the page is rendered on the server nothing is known: `ready` is false and only
 * `necessary` is granted, so no page cached by a CDN carries one visitor's choice to another.
 * In the browser the cookie is read once the app is mounted; the choice it holds counts at
 * once, and is dropped (the banner asks again) when the server's version of the texts is
 * newer, a category is new, or the choice is too old.
 */
import {
  consentCookieString, decodeConsent, encodeConsent, grantedIn, isCurrent, newConsentId, readConsentCookie, consentDate,
  type ConsentChoice, type ConsentCookie,
} from '../core/cookie'
import type { ConsentCategory, ConsentTexts } from '../core/texts'

/** What `GET /api/content/_consent/config` answers. */
export interface ConsentConfig {
  version: number
  cookieDays: number
  locale: string | null
  texts: ConsentTexts
  categories: ConsentCategory[]
}

export interface ConsentState {
  /** The choice is read (in the browser, after the app is mounted, and the texts' version is known). */
  ready: boolean
  /** A choice that holds, or null (not asked yet, or asked again). */
  choice: ConsentChoice | null
  /** The consent id of that choice. */
  id: string | null
  config: ConsentConfig | null
  /** The settings dialog is open. */
  settingsOpen: boolean
  saving: boolean
}

export const initialConsentState = (): ConsentState => ({ ready: false, choice: null, id: null, config: null, settingsOpen: false, saving: false })

export type ConsentListener = (choice: ConsentChoice | null) => void

export interface ConsentEnv {
  /** Reads `document.cookie`. */
  readCookie: () => string
  /** Writes one `document.cookie` string (when the server could not be reached). */
  writeCookie: (cookie: string) => void
  /** GET the config for a language. */
  loadConfig: (locale: string) => Promise<ConsentConfig>
  /** POST the choice; the server writes the log and sets the cookie. */
  sendChoice: (body: { id: string | null; choice: ConsentChoice; version: number }) => Promise<{ id: string; cookie: string }>
  secure: boolean
  now?: () => Date
}

/** The categories the visitor chooses (necessary left out). */
export const choosable = (config: ConsentConfig | null): string[] => (config?.categories ?? []).filter((c) => !c.required).map((c) => c.key)

export function createConsentRuntime(state: ConsentState, env: ConsentEnv) {
  const listeners = new Set<ConsentListener>()
  const emit = () => {
    for (const cb of [...listeners]) {
      try { cb(state.choice) }
      catch (err) { console.error('[cms] consent: an onChange listener failed', err) }
    }
  }
  let cookie: ConsentCookie | null = null
  let loadedLocale: string | null = null
  let loading: Promise<void> | null = null

  /** Reads the cookie, then the config of the page's language; the choice counts once both are in. */
  async function start(locale: string): Promise<void> {
    cookie = decodeConsent(readConsentCookie(env.readCookie()))
    // The cookie's choice counts at once (the visitor gave it); it is checked against the version below.
    state.choice = cookie?.choice ?? null
    state.id = cookie?.id ?? null
    await load(locale)
  }

  /** The texts in a language (again when the page's language changed). */
  function load(locale: string): Promise<void> {
    if (loading && loadedLocale === locale) return loading
    loadedLocale = locale
    loading = env.loadConfig(locale).then((config) => {
      state.config = config
      const before = state.choice
      if (!isCurrent(cookie, { version: config.version, categories: choosable(config), days: config.cookieDays, now: env.now?.() })) {
        state.choice = null
      }
      const first = !state.ready
      state.ready = true
      if (first || before !== state.choice) emit()
    }).catch((err) => {
      // Without the config nothing is asked: the cookie's choice holds as it is.
      console.error('[cms] consent: the settings could not be loaded', err)
      const first = !state.ready
      state.ready = true
      if (first) emit()
    })
    return loading
  }

  /** Saves a choice: the server logs it and sets the cookie; without the server, the browser keeps it. */
  async function save(choice: ConsentChoice): Promise<void> {
    const config = state.config
    const keys = choosable(config)
    const full: ConsentChoice = {}
    for (const k of keys) full[k] = choice[k] === true
    const version = config?.version ?? 1
    state.choice = full
    state.settingsOpen = false
    state.saving = true
    emit()
    try {
      const res = await env.sendChoice({ id: state.id, choice: full, version })
      cookie = decodeConsent(res.cookie)
      state.id = res.id
    }
    catch (err) {
      // The visitor's choice holds on this device even when it could not be logged.
      console.error('[cms] consent: the choice could not be saved', err)
      const id = state.id ?? newConsentId()
      cookie = { id, version, date: consentDate(env.now?.() ?? new Date()), choice: full }
      state.id = id
      env.writeCookie(consentCookieString(encodeConsent(cookie), { days: config?.cookieDays ?? 365, secure: env.secure }))
    }
    finally {
      state.saving = false
    }
  }

  const all = (value: boolean): ConsentChoice => Object.fromEntries(choosable(state.config).map((k) => [k, value]))

  return {
    state,
    start,
    load,
    save,
    acceptAll: () => save(all(true)),
    rejectAll: () => save(all(false)),
    granted: (category: string) => grantedIn(state.choice, category),
    open: () => { state.settingsOpen = true },
    close: () => { state.settingsOpen = false },
    /** Runs `cb` once the choice is known after the page loads, and whenever it changes. Returns a function that stops it. */
    onChange(cb: ConsentListener): () => void {
      listeners.add(cb)
      // Registered after the choice was read: told what it is, once, right after.
      if (state.ready) queueMicrotask(() => { if (listeners.has(cb)) cb(state.choice) })
      return () => { listeners.delete(cb) }
    },
  }
}

export type ConsentRuntime = ReturnType<typeof createConsentRuntime>

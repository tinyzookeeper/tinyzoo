import type { MaybeRefOrGetter } from 'vue'

/** How the visits read: Simple (in words, one warm line) or Detailed (the usual numbers and tables). */
export type TrafficView = 'simple' | 'detailed'

const isView = (v: unknown): v is TrafficView => v === 'simple' || v === 'detailed'

/**
 * The visits view someone picked, remembered in a cookie (a year), so the server renders the
 * same one and nothing flashes. Until they pick: Detailed for a workspace's owners and admins,
 * Simple for everyone else (members, guests, an unknown role). Shared by every Traffic view on
 * the page.
 */
export function useTrafficView(detailedByDefault: MaybeRefOrGetter<boolean>) {
  const cookie = useCookie<TrafficView | null>('keeper-traffic-view', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', default: () => null })
  const picked = useState<TrafficView | null>('keeper-traffic-view', () => (isView(cookie.value) ? cookie.value : null))
  return computed<TrafficView>({
    get: () => picked.value ?? (toValue(detailedByDefault) ? 'detailed' : 'simple'),
    set: (v) => {
      picked.value = v
      cookie.value = v
    },
  })
}

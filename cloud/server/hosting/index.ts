import { localDriver } from './local'
import { pushbaseDriver } from './pushbase'
import { sharedDriver } from './shared'
import type { HostingDriver } from './types'

export * from './types'

const drivers: Record<string, () => HostingDriver> = { local: localDriver, shared: sharedDriver, pushbase: pushbaseDriver }
const made = new Map<string, HostingDriver>()

/** NUXT_HOSTING_DRIVER=none: no website is made here. The app is the account service alone. */
export const NO_HOSTING = 'none'

/** The driver new websites are made with: NUXT_HOSTING_DRIVER (local by default), or `none`. */
export function hostingDriverName(): string {
  const name = String((useRuntimeConfig().hosting as any)?.driver || 'local')
  return name === NO_HOSTING || name in drivers ? name : 'local'
}

/** Whether websites are made here at all. */
export function makesSites(): boolean {
  return hostingDriverName() !== NO_HOSTING
}

/** A driver by name: a website is always run and removed by the driver that made it. */
export function useHosting(name: string = hostingDriverName()): HostingDriver {
  let driver = made.get(name)
  if (!driver) {
    const make = drivers[name]
    if (!make) throw new Error(`[cloud] unknown hosting driver: ${name}`)
    driver = make()
    made.set(name, driver)
  }
  return driver
}

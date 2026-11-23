import { localDriver } from './local'
import { pushbaseDriver } from './pushbase'
import { sharedDriver } from './shared'
import type { HostingDriver } from './types'

export * from './types'

const drivers: Record<string, () => HostingDriver> = { local: localDriver, shared: sharedDriver, pushbase: pushbaseDriver }
const made = new Map<string, HostingDriver>()

/** The driver new websites are made with: NUXT_HOSTING_DRIVER (local by default). */
export function hostingDriverName(): string {
  const name = String((useRuntimeConfig().hosting as any)?.driver || 'local')
  return name in drivers ? name : 'local'
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

import { DEFAULT_MODEL_LIMITS, type ModelLimits } from 'tinyzoo'
import { customTypesEnabled, customTypesLimits } from './cmsModelPlan'

/**
 * A site's own content types (experimental; docs/custom-types-plan.md).
 *
 * Off unless NUXT_CMS_CUSTOM_TYPES=on: in multi-tenant mode, or for the one site of a single-site
 * app, whose work is then counted (cmsSiteCounted in cmsSite.ts). A multi-tenant site's row
 * may switch them off for that site (`config.customTypes.enabled: false`) and set its own
 * limits (`config.customTypes.types`, `fields`, `options`: whole numbers from 0 to 200; any
 * other value keeps the default). With the switch off nothing of the feature runs: no query,
 * no table, no route, no timer.
 */

/** Is the switch of the process on (the environment, not the build)? */
export function cmsCustomTypesSwitch(): boolean {
  return typeof process !== 'undefined' && process.env?.NUXT_CMS_CUSTOM_TYPES === 'on'
}

/**
 * The feature for the current site: on only for a counted site, with the process's switch on,
 * when the site's row does not switch it off and its design leaves the custom prefix free. The
 * one site of single mode has no row: its limits are the defaults.
 */
export function cmsCustomTypes(): { on: boolean; limits: ModelLimits } {
  if (!cmsSiteCounted() || !cmsCustomTypesSwitch()) return { on: false, limits: DEFAULT_MODEL_LIMITS }
  const raw = useCmsSite('the custom types').config?.customTypes
  return { on: customTypesEnabled(raw) && !cmsDesignUsesCustomPrefix(), limits: customTypesLimits(raw) }
}

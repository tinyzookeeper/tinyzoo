import { DEFAULT_MODEL_LIMITS, type ModelLimits } from 'tinyzoo'
import { customTypesEnabled, customTypesLimits } from './cmsModelPlan'

/**
 * A site's own content types (experimental; docs/custom-types-plan.md).
 *
 * Off unless the process is in multi-tenant mode and NUXT_CMS_CUSTOM_TYPES=on. A site's row
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
 * The feature for the current site: on only in multi-tenant mode, with the process's switch on,
 * when the site's row does not switch it off and its design leaves the custom prefix free.
 */
export function cmsCustomTypes(): { on: boolean; limits: ModelLimits } {
  if (!cmsIsMultiTenant() || !cmsCustomTypesSwitch()) return { on: false, limits: DEFAULT_MODEL_LIMITS }
  const raw = useCmsSite('the custom types').config?.customTypes
  return { on: customTypesEnabled(raw) && !cmsDesignUsesCustomPrefix(), limits: customTypesLimits(raw) }
}

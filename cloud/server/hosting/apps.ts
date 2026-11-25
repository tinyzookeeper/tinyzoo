import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customTypesSetting } from '../../shared/sharedHosting'
import { appOf, type AppDef, type TemplateDef } from '../../shared/templates'
import { HostingError } from './types'

// What the two drivers (shared.ts, local.ts) both need to know about the app that serves a
// template: where its build is, and whether the template is in that build. The one app for the
// hosted templates can be built with only some of its designs (`templates:build photographer`);
// the build then says which in `tinyzoo-designs.json` beside its entry.

/**
 * CLOUD_CUSTOM_TYPES=on: the one app's sites may make content types of their own (experimental).
 * Read from the environment each time, as the other CLOUD_* settings are (runtime config holds
 * NUXT_* names only). Off: what the drivers start and write is as it always was.
 */
export const cloudCustomTypes = (): boolean => customTypesSetting(process.env.CLOUD_CUSTOM_TYPES)

/** The app's server entry. It need not exist. */
export const entryOf = (root: string, app: AppDef): string => join(root, app.sourceDir, '.output', 'server', 'index.mjs')

/** The designs the app was built with, or null when the build does not say (every design) or the app carries one model only. */
export function builtDesigns(root: string, app: AppDef): string[] | null {
  if (!app.models) return null
  try {
    const list = JSON.parse(readFileSync(join(root, app.sourceDir, '.output', 'tinyzoo-designs.json'), 'utf8'))?.designs
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : null
  }
  catch {
    return null
  }
}

/** The app that serves a template and its server entry, or a clear word that it is not built (or not with this template). */
export function builtAppOf(root: string, template: TemplateDef): { app: AppDef; entry: string } {
  const app = appOf(template)
  if (!app) throw new HostingError('template_not_built', `template "${template.id}" has no app that serves it`)
  const entry = entryOf(root, app)
  if (!existsSync(entry)) {
    throw new HostingError('template_not_built', `${entry} is missing. Build the template first: pnpm --filter tinyzoo-cloud templates:build`)
  }
  const designs = builtDesigns(root, app)
  if (designs && !designs.includes(template.id)) {
    throw new HostingError('template_not_built', `${template.id} is not in this build of the one app (it was built with: ${designs.join(', ')}). Build it: pnpm --filter tinyzoo-cloud templates:build`)
  }
  return { app, entry }
}

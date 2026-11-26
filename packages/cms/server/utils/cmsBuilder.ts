/**
 * The editor in the preview (experimental): off unless NUXT_CMS_BUILDER=on. With it on, the admin
 * lets an editor select, move, duplicate, delete and add a page's blocks in the preview beside
 * the form. Read from the environment each time (not a module option, not runtime config), as
 * NUXT_CMS_CUSTOM_TYPES is. With the switch off nothing of it runs.
 */
export function cmsBuilderSwitch(): boolean {
  return typeof process !== 'undefined' && process.env?.NUXT_CMS_BUILDER === 'on'
}

// The baseline's starter (tinyzoo 0.1) still imports the form helpers from "tinyzoo".
// 0.4 removed them there; a site does what the changelog says by hand before upgrading.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export default {
  description: '0.4.0 "Upgrade" (remove-old-form-helpers): import defineForm and defineFormSettings from "tinyzoo/forms" and register formsPlugin()',

  async beforeUpgrade(ctx) {
    const file = join(ctx.dirs.site, 'cms.config.ts')
    let src = readFileSync(file, 'utf8')
    const before = src
    // Take the two helpers out of the import from "tinyzoo"…
    src = src.replace(/import\s*\{([^}]*)\}\s*from\s*['"]tinyzoo['"]/, (whole, names) => {
      const kept = names.split(',').map((n) => n.trim()).filter((n) => n && n !== 'defineForm' && n !== 'defineFormSettings')
      return `import { ${kept.join(', ')} } from 'tinyzoo'\nimport { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'`
    })
    // …and register the plugin, as the changeset says.
    if (!/export const plugins\s*=/.test(src)) src += '\nexport const plugins = [formsPlugin()]\n'
    if (src === before) throw new Error('cms.config.ts has no import of the form helpers from "tinyzoo" to move')
    writeFileSync(file, src)
    ctx.note('moved defineForm/defineFormSettings to "tinyzoo/forms" and registered formsPlugin()')
  },
}

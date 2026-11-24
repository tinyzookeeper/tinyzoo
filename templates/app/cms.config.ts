// The content models of the one app: each template's own cms.config.ts and migrations, under
// the template's id. A site's row in the site directory names its model, and the site is drawn
// in the design of the same name (designs.ts lists the same ids). The app has no model of its
// own, so it runs in multi-tenant mode only.
import { defineModels } from 'tinyzoo'

export const models = defineModels({
})

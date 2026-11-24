// The content models of the one app: each template's own cms.config.ts and migrations, under
// the template's id. A site's row in the site directory names its model, and the site is drawn
// in the design of the same name (designs.ts lists the same ids). The app has no model of its
// own, so it runs in multi-tenant mode only.
import { defineModels } from 'tinyzoo'
import * as photographer from '../photographer/cms.config'
import * as wedding from '../wedding/cms.config'

export const models = defineModels({
  photographer: { config: photographer, migrations: '../photographer/server/db/migrations' },
  wedding: { config: wedding, migrations: '../wedding/server/db/migrations' },
})

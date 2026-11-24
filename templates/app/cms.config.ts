// The content models of the one app: each template's own cms.config.ts and migrations, under
// the template's id. A site's row in the site directory names its model, and the site is drawn
// in the design of the same name (designs.ts lists the same ids). The app has no model of its
// own, so it runs in multi-tenant mode only.
import { defineModels } from 'tinyzoo'
import * as individual from '../individual/cms.config'
import * as photographer from '../photographer/cms.config'
import * as wedding from '../wedding/cms.config'
import * as blog from '../blog/cms.config'
import * as trades from '../trades/cms.config'
import * as carService from '../car-service/cms.config'
import * as salon from '../salon/cms.config'
import * as medical from '../medical/cms.config'
import * as office from '../office/cms.config'
import * as restaurant from '../restaurant/cms.config'
import * as accommodation from '../accommodation/cms.config'
import * as sportsClub from '../sports-club/cms.config'
import * as studio from '../studio/cms.config'
import * as event from '../event/cms.config'
import * as association from '../association/cms.config'
import * as realty from '../realty/cms.config'
import * as development from '../development/cms.config'

export const models = defineModels({
  individual: { config: individual, migrations: '../individual/server/db/migrations' },
  photographer: { config: photographer, migrations: '../photographer/server/db/migrations' },
  wedding: { config: wedding, migrations: '../wedding/server/db/migrations' },
  blog: { config: blog, migrations: '../blog/server/db/migrations' },
  trades: { config: trades, migrations: '../trades/server/db/migrations' },
  'car-service': { config: carService, migrations: '../car-service/server/db/migrations' },
  salon: { config: salon, migrations: '../salon/server/db/migrations' },
  medical: { config: medical, migrations: '../medical/server/db/migrations' },
  office: { config: office, migrations: '../office/server/db/migrations' },
  restaurant: { config: restaurant, migrations: '../restaurant/server/db/migrations' },
  accommodation: { config: accommodation, migrations: '../accommodation/server/db/migrations' },
  'sports-club': { config: sportsClub, migrations: '../sports-club/server/db/migrations' },
  studio: { config: studio, migrations: '../studio/server/db/migrations' },
  event: { config: event, migrations: '../event/server/db/migrations' },
  association: { config: association, migrations: '../association/server/db/migrations' },
  realty: { config: realty, migrations: '../realty/server/db/migrations' },
  development: { config: development, migrations: '../development/server/db/migrations' },
})

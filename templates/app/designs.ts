// The designs this app carries, in the order of cloud/scripts/lib.mjs: a template's id and its
// typefaces (templates/<id>/fonts.ts). cms.config.ts lists the same ids as content models.
import type { DesignFonts } from 'tinyzoo-template-kit/fonts'
import individual from '../individual/fonts'
import photographer from '../photographer/fonts'
import wedding from '../wedding/fonts'
import blog from '../blog/fonts'
import trades from '../trades/fonts'
import carService from '../car-service/fonts'
import salon from '../salon/fonts'
import medical from '../medical/fonts'
import office from '../office/fonts'
import restaurant from '../restaurant/fonts'
import accommodation from '../accommodation/fonts'
import sportsClub from '../sports-club/fonts'
import studio from '../studio/fonts'
import event from '../event/fonts'

export const DESIGNS: Record<string, DesignFonts> = {
  individual,
  photographer,
  wedding,
  blog,
  trades,
  'car-service': carService,
  salon,
  medical,
  office,
  restaurant,
  accommodation,
  'sports-club': sportsClub,
  studio,
  event,
}

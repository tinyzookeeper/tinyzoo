// The designs this app carries, in the order of cloud/scripts/lib.mjs: a template's id and its
// typefaces (templates/<id>/fonts.ts). cms.config.ts lists the same ids as content models.
import type { DesignFonts } from 'tinyzoo-template-kit/fonts'
import individual from '../individual/fonts'
import photographer from '../photographer/fonts'
import wedding from '../wedding/fonts'
import blog from '../blog/fonts'
import restaurant from '../restaurant/fonts'

export const DESIGNS: Record<string, DesignFonts> = {
  individual,
  photographer,
  wedding,
  blog,
  restaurant,
}

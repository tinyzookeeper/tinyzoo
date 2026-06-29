import { f } from './fields'

/**
 * Reusable SEO/metadata fields. Spread into an entity (or singleton):
 *   fields: { ...seo(), title: f.text({ required: true }), … }
 * Produces metaTitle / metaDescription / ogImage columns — plain queryable fields,
 * delivered like any other through the content API.
 */
export function seo() {
  return {
    metaTitle: f.text().optional().label('Meta title').help('Overrides the page <title> and social title (~60 chars).'),
    metaDescription: f.text().optional().label('Meta description').help('Search & social snippet (~155 chars).'),
    ogImage: f.media({ accept: 'image/*' }).optional().label('Social image').help('Shown when the page is shared (Open Graph / Twitter card).'),
  }
}

import { f } from './fields'

/**
 * Reusable SEO/metadata fields. Spread into an entity (or singleton):
 *   fields: { ...seo(), title: f.text({ required: true }), … }
 * Produces metaTitle / metaDescription / ogImage columns — plain queryable fields,
 * delivered like any other through the content API.
 */
export function seo() {
  return {
    metaTitle: f.text().optional()
      .label({ en: 'Search title', cs: 'Titulek pro vyhledávače' })
      .help({ en: 'Shown in Google results and browser tabs instead of the title. Around 60 characters.', cs: 'Zobrazí se ve výsledcích Googlu a v záložce prohlížeče místo názvu. Zhruba 60 znaků.' }),
    metaDescription: f.text().optional()
      .label({ en: 'Search description', cs: 'Popis pro vyhledávače' })
      .help({ en: 'The short text under the title in Google results and when shared. Around 155 characters.', cs: 'Krátký text pod titulkem ve výsledcích Googlu a při sdílení. Zhruba 155 znaků.' }),
    ogImage: f.media({ accept: 'image/*' }).optional()
      .label({ en: 'Sharing image', cs: 'Obrázek pro sdílení' })
      .help({ en: 'Shown when the page is shared on social networks and in messages.', cs: 'Zobrazí se při sdílení stránky na sociálních sítích a ve zprávách.' }),
  }
}

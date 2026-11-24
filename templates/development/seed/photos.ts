// The demo photographs (seed/media): visualisations of the fictional building, photographs of
// its construction site and of the neighbourhood, a portrait of the salesperson and a finished
// building of the developer (seed/media/shots.txt is the list they were made from, with a
// description of each). The alt texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  street: { file: 'dum-ulice.jpg', alt: alt.street },
  garden: { file: 'dum-zahrada.jpg', alt: alt.garden },
  detail: { file: 'dum-detail.jpg', alt: alt.detail },
  livingRoom: { file: 'interier-obyvak.jpg', alt: alt.livingRoom },
  bathroom: { file: 'interier-koupelna.jpg', alt: alt.bathroom },
  terrace: { file: 'terasa.jpg', alt: alt.terrace },
  crane: { file: 'stavba-jerab.jpg', alt: alt.crane },
  windows: { file: 'stavba-okna.jpg', alt: alt.windows },
  tram: { file: 'okoli-tramvaj.jpg', alt: alt.tram },
  park: { file: 'okoli-park.jpg', alt: alt.park },
  // (the portrait is cropped to a tall frame in Blueprint and Floors and to a circle in By the Sun: the face stays near the top)
  seller: { file: 'prodejce.jpg', alt: alt.seller, focal: { x: 50, y: 25 } },
  reference: { file: 'reference-dum.jpg', alt: alt.reference },
} satisfies Record<string, SeedPhoto>

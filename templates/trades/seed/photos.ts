// The demo photographs (seed/media): a plumber's November in a small town (seed/media/shots.txt
// is the list they were made from, with a description of each). The alt texts are in the
// template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  // (Reflex shows it across the page, its caption over the man's feet: the focus stays low)
  hero: { file: 'hero.jpg', alt: alt.hero, focal: { x: 50, y: 60 } },
  portrait: { file: 'portrait.jpg', alt: alt.portrait, focal: { x: 50, y: 20 } },
  boilerBefore: { file: 'boiler-before.jpg', alt: alt.boilerBefore },
  boilerAfter: { file: 'boiler-after.jpg', alt: alt.boilerAfter },
  bathBefore: { file: 'bath-before.jpg', alt: alt.bathBefore },
  bathAfter: { file: 'bath-after.jpg', alt: alt.bathAfter },
  floorHeating: { file: 'floor-heating.jpg', alt: alt.floorHeating },
  radiator: { file: 'radiator.jpg', alt: alt.radiator },
  attic: { file: 'attic.jpg', alt: alt.attic },
  van: { file: 'van.jpg', alt: alt.van },
  crew: { file: 'crew.jpg', alt: alt.crew },
  workshop: { file: 'workshop.jpg', alt: alt.workshop },
} satisfies Record<string, SeedPhoto>

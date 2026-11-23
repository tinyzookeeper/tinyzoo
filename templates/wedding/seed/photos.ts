// The demo photographs (seed/media): an engagement afternoon of a fictional couple on the
// meadow where they marry, and the place itself (seed/media/shots.txt is the list they were
// made from, with a description of each). The alt texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  hero: { file: 'hero.jpg', alt: alt.hero, focal: { x: 50, y: 80 } },
  coupleClose: { file: 'couple-close.jpg', alt: alt.coupleClose },
  coupleBlanket: { file: 'couple-blanket.jpg', alt: alt.coupleBlanket },
  coupleRocks: { file: 'couple-rocks.jpg', alt: alt.coupleRocks },
  coupleAlley: { file: 'couple-alley.jpg', alt: alt.coupleAlley },
  coupleBarn: { file: 'couple-barn.jpg', alt: alt.coupleBarn, focal: { x: 50, y: 22 } },
  coupleDance: { file: 'couple-dance.jpg', alt: alt.coupleDance },
  coupleEvening: { file: 'couple-evening.jpg', alt: alt.coupleEvening, focal: { x: 50, y: 100 } },
  venue: { file: 'venue.jpg', alt: alt.venue },
  barn: { file: 'barn.jpg', alt: alt.barn, focal: { x: 50, y: 62 } },
  linden: { file: 'linden.jpg', alt: alt.linden },
  flowers: { file: 'flowers.jpg', alt: alt.flowers },
  landscape: { file: 'landscape.jpg', alt: alt.landscape, focal: { x: 50, y: 60 } },
  table: { file: 'table.jpg', alt: alt.table },
} satisfies Record<string, SeedPhoto>

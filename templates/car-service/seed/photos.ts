// The demo photographs (seed/media): a late-autumn day in an invented workshop in Jičín
// (seed/media/shots.txt is the list they were made from, with a description of each). The alt
// texts are in the template's texts. The designs crop some of them to a point of their own
// (`object-position`); the looks' components say so, so no focal point is stored here.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  hero: { file: 'hero.jpg', alt: alt.hero },
  yard: { file: 'yard.jpg', alt: alt.yard },
  lift: { file: 'lift.jpg', alt: alt.lift },
  tyres: { file: 'tyres.jpg', alt: alt.tyres },
  bonnet: { file: 'bonnet.jpg', alt: alt.bonnet },
  petr: { file: 'petr.jpg', alt: alt.petr },
  tomas: { file: 'tomas.jpg', alt: alt.tomas },
  marek: { file: 'marek.jpg', alt: alt.marek },
  parts: { file: 'parts.jpg', alt: alt.parts },
  wheel: { file: 'wheel.jpg', alt: alt.wheel },
  loaner: { file: 'loaner.jpg', alt: alt.loaner },
  dusk: { file: 'dusk.jpg', alt: alt.dusk },
} satisfies Record<string, SeedPhoto>

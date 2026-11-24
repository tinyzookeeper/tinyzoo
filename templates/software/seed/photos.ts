// The demo photographs (seed/media): customers of the fictional product at work, the team at one
// table, and four portraits (seed/media/shots.txt is the list they were made from, with a
// description of each). The alt texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  kavarna: { file: 'kavarna.jpg', alt: alt.kavarna },
  malir: { file: 'malir.jpg', alt: alt.malir },
  salon: { file: 'salon.jpg', alt: alt.salon },
  obchod: { file: 'obchod.jpg', alt: alt.obchod },
  portretJitka: { file: 'portret-jitka.jpg', alt: alt.portretJitka },
  portretKoubek: { file: 'portret-koubek.jpg', alt: alt.portretKoubek },
  portretVankova: { file: 'portret-vankova.jpg', alt: alt.portretVankova },
  tym: { file: 'tym.jpg', alt: alt.tym },
} satisfies Record<string, SeedPhoto>

export type PhotoKey = keyof typeof PHOTOS

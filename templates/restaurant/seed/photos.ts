// The demo photographs (seed/media): the bistro's room, its bar, its food and its people, all
// on one autumn day (seed/media/shots.txt is the list they were made from, with a description of
// each). The alt texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  hero: { file: 'hero.jpg', alt: alt.hero },
  bar: { file: 'bar.jpg', alt: alt.bar },
  lokal: { file: 'lokal.jpg', alt: alt.lokal },
  svickova: { file: 'svickova.jpg', alt: alt.svickova },
  polevka: { file: 'polevka.jpg', alt: alt.polevka },
  pstruh: { file: 'pstruh.jpg', alt: alt.pstruh },
  buchticky: { file: 'buchticky.jpg', alt: alt.buchticky },
  tatarak: { file: 'tatarak.jpg', alt: alt.tatarak },
  kachna: { file: 'kachna.jpg', alt: alt.kachna },
  kava: { file: 'kava.jpg', alt: alt.kava },
  pivo: { file: 'pivo.jpg', alt: alt.pivo },
  kuchar: { file: 'kuchar.jpg', alt: alt.kuchar },
  suroviny: { file: 'suroviny.jpg', alt: alt.suroviny },
  dum: { file: 'dum.jpg', alt: alt.dum },
} satisfies Record<string, SeedPhoto>

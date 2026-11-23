// The demo photographs (seed/media): the waiting room, the people and the house of a fictional
// practice (seed/media/shots.txt is the list they were made from, with a description of each).
// The alt texts are in the template's texts. Three of them (the consulting room, the door, the
// reception) are not in the designs' pages and stay unused.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  cekarna: { file: 'cekarna.jpg', alt: alt.cekarna },
  // (the wide photograph of the consultation is cropped from the middle, a little low)
  rozhovor: { file: 'rozhovor.jpg', alt: alt.rozhovor, focal: { x: 50, y: 60 } },
  tlak: { file: 'tlak.jpg', alt: alt.tlak },
  detail: { file: 'detail.jpg', alt: alt.detail },
  dum: { file: 'dum.jpg', alt: alt.dum },
  dvorakova: { file: 'dvorakova.jpg', alt: alt.dvorakova },
  beran: { file: 'beran.jpg', alt: alt.beran },
  markova: { file: 'markova.jpg', alt: alt.markova },
  sulcova: { file: 'sulcova.jpg', alt: alt.sulcova },
} satisfies Record<string, SeedPhoto>

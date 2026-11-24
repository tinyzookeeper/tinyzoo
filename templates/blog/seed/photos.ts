// The demo photographs (seed/media): the magazine's own pictures of a November in the
// Czech-Moravian Highlands, and its three authors (seed/media/shots.txt is the list they were
// made from, with a description of each). The alt texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  pastevec: { file: 'pastevec.jpg', alt: alt.pastevec },
  prehrada: { file: 'prehrada.jpg', alt: alt.prehrada },
  // (Obálka crops the square to a landscape, Čtvrthodinka to a portrait: the pot stays in view in both)
  polevka: { file: 'polevka.jpg', alt: alt.polevka, focal: { x: 50, y: 72 } },
  sindel: { file: 'sindel.jpg', alt: alt.sindel },
  zidka: { file: 'zidka.jpg', alt: alt.zidka },
  studanka: { file: 'studanka.jpg', alt: alt.studanka },
  vcelar: { file: 'vcelar.jpg', alt: alt.vcelar },
  krizaly: { file: 'krizaly.jpg', alt: alt.krizaly },
  samota: { file: 'samota.jpg', alt: alt.samota },
  autorMarketa: { file: 'autor-marketa.jpg', alt: alt.autorMarketa },
  autorTomas: { file: 'autor-tomas.jpg', alt: alt.autorTomas },
  autorBara: { file: 'autor-bara.jpg', alt: alt.autorBara },
} satisfies Record<string, SeedPhoto>

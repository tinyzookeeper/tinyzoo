// The demo photographs (seed/media): a small salon on an overcast morning (seed/media/shots.txt
// is the list they were made from, with a description of each). The alt texts are in the
// template's texts. The portraits keep their faces in view when a look crops them to a square.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  hero: { file: 'hero.jpg', alt: alt.hero },
  bob: { file: 'vysledek-bob.jpg', alt: alt.bob },
  radka: { file: 'tym-radka.jpg', alt: alt.radka, focal: { x: 50, y: 20 } },
  simona: { file: 'tym-simona.jpg', alt: alt.simona, focal: { x: 50, y: 20 } },
  tomas: { file: 'tym-tomas.jpg', alt: alt.tomas, focal: { x: 50, y: 20 } },
  eliska: { file: 'tym-eliska.jpg', alt: alt.eliska, focal: { x: 50, y: 20 } },
  balayage: { file: 'vysledek-balayage.jpg', alt: alt.balayage },
  fade: { file: 'vysledek-fade.jpg', alt: alt.fade },
  drdol: { file: 'vysledek-drdol.jpg', alt: alt.drdol },
  kudrny: { file: 'vysledek-kudrny.jpg', alt: alt.kudrny },
  detail: { file: 'detail.jpg', alt: alt.detail },
  dum: { file: 'dum.jpg', alt: alt.dum },
} satisfies Record<string, SeedPhoto>

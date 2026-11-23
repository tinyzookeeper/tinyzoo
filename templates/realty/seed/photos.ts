// The demo photographs (seed/media): properties of a South Bohemian town, the town itself and
// the three agents (seed/media/shots.txt is the list they were made from, with a description of
// each). The alt texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  town: { file: 'mesto.jpg', alt: alt.town },
  houseDusk: { file: 'dum-vecer.jpg', alt: alt.houseDusk },
  houseLiving: { file: 'dum-obyvak.jpg', alt: alt.houseLiving },
  houseKitchen: { file: 'dum-kuchyne.jpg', alt: alt.houseKitchen },
  houseTerrace: { file: 'dum-terasa.jpg', alt: alt.houseTerrace },
  flatPanel: { file: 'byt-panel.jpg', alt: alt.flatPanel },
  flatBrick: { file: 'byt-cihla.jpg', alt: alt.flatBrick },
  flatNewbuild: { file: 'byt-novostavba.jpg', alt: alt.flatNewbuild },
  cottage: { file: 'chalupa.jpg', alt: alt.cottage },
  terraced: { file: 'radovy-dum.jpg', alt: alt.terraced },
  plot: { file: 'pozemek.jpg', alt: alt.plot },
  martina: { file: 'makler-martina.jpg', alt: alt.martina },
  tomas: { file: 'makler-tomas.jpg', alt: alt.tomas },
  lenka: { file: 'makler-lenka.jpg', alt: alt.lenka },
} satisfies Record<string, SeedPhoto>

// The demo photographs (seed/media): a small accounting office in an old town house, all by one
// photographer in the same November daylight (seed/media/shots.txt is the list they were made
// from, with a description of each). The alt texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  kancelar: { file: 'kancelar.jpg', alt: alt.kancelar },
  schuzka: { file: 'schuzka.jpg', alt: alt.schuzka },
  zasedacka: { file: 'zasedacka.jpg', alt: alt.zasedacka },
  dum: { file: 'dum.jpg', alt: alt.dum },
  porada: { file: 'porada.jpg', alt: alt.porada },
  sanony: { file: 'sanony.jpg', alt: alt.sanony },
  stul: { file: 'stul.jpg', alt: alt.stul },
  radek: { file: 'radek.jpg', alt: alt.radek },
  hana: { file: 'hana.jpg', alt: alt.hana },
  jitka: { file: 'jitka.jpg', alt: alt.jitka },
  petra: { file: 'petra.jpg', alt: alt.petra },
  martin: { file: 'martin.jpg', alt: alt.martin },
} satisfies Record<string, SeedPhoto>

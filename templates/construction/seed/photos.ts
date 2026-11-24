// The demo photographs (seed/media): one May on the Vysočina highlands, houses of a fictional
// builder photographed on the same bright overcast days, and the three people who run it
// (seed/media/shots.txt is the list they were made from, with a description of each). The alt
// texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  zdirec: { file: 'dum-zdirec.jpg', alt: alt.zdirec },
  libice: { file: 'dum-libice.jpg', alt: alt.libice },
  libiceInterior: { file: 'dum-libice-interier.jpg', alt: alt.libiceInterior },
  krov: { file: 'krov.jpg', alt: alt.krov },
  krucemburk: { file: 'drevostavba-krucemburk.jpg', alt: alt.krucemburk },
  sobinov: { file: 'chalupa-sobinov.jpg', alt: alt.sobinov },
  pribyslav: { file: 'strecha-pribyslav.jpg', alt: alt.pribyslav },
  brod: { file: 'pristavba-brod.jpg', alt: alt.brod },
  stavba: { file: 'stavba.jpg', alt: alt.stavba },
  pavel: { file: 'pavel.jpg', alt: alt.pavel },
  martin: { file: 'martin.jpg', alt: alt.martin },
  lucie: { file: 'lucie.jpg', alt: alt.lucie },
} satisfies Record<string, SeedPhoto>

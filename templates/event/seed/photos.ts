// The demo photographs (seed/media): one race day of a small village trail race in the Žďárské
// vrchy highlands, made by one photographer (seed/media/shots.txt is the list they were made
// from, with a description of each). The alt texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  rano: { file: 'rano.jpg', alt: alt.rano, focal: { x: 62, y: 68 } },
  krajina: { file: 'krajina.jpg', alt: alt.krajina, focal: { x: 70, y: 50 } },
  mlha: { file: 'mlha.jpg', alt: alt.mlha, focal: { x: 70, y: 50 } },
  start: { file: 'start.jpg', alt: alt.start },
  cil: { file: 'cil.jpg', alt: alt.cil },
  hreben: { file: 'hreben.jpg', alt: alt.hreben },
  rozhledna: { file: 'rozhledna.jpg', alt: alt.rozhledna },
  les: { file: 'les.jpg', alt: alt.les },
  sestup: { file: 'sestup.jpg', alt: alt.sestup },
  deti: { file: 'deti.jpg', alt: alt.deti },
  medaile: { file: 'medaile.jpg', alt: alt.medaile },
  gulas: { file: 'gulas.jpg', alt: alt.gulas },
  obcerstveni: { file: 'obcerstveni.jpg', alt: alt.obcerstveni, focal: { x: 72, y: 50 } },
  ves: { file: 'ves.jpg', alt: alt.ves },
} satisfies Record<string, SeedPhoto>

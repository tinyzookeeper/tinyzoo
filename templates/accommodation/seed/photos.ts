// The demo photographs (seed/media): the guesthouse, its rooms, the countryside around it
// (seed/media/shots.txt is the list they were made from, with a description of each). The alt
// texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  dum: { file: 'dum.jpg', alt: alt.dum },
  dumDalka: { file: 'dum-dalka.jpg', alt: alt.dumDalka },
  zahrada: { file: 'zahrada.jpg', alt: alt.zahrada },
  hreben: { file: 'hreben.jpg', alt: alt.hreben },
  jidelna: { file: 'jidelna.jpg', alt: alt.jidelna },
  most: { file: 'most.jpg', alt: alt.most },
  rozhledna: { file: 'rozhledna.jpg', alt: alt.rozhledna },
  sauna: { file: 'sauna.jpg', alt: alt.sauna },
  snidane: { file: 'snidane.jpg', alt: alt.snidane },
  hostitele: { file: 'hostitele.jpg', alt: alt.hostitele },
  pokojJerabina: { file: 'pokoj-jerabina.jpg', alt: alt.pokojJerabina },
  pokojBoruvka: { file: 'pokoj-boruvka.jpg', alt: alt.pokojBoruvka },
  apartmanArnika: { file: 'apartman-arnika.jpg', alt: alt.apartmanArnika },
  apartmanMech: { file: 'apartman-mech.jpg', alt: alt.apartmanMech },
} satisfies Record<string, SeedPhoto>

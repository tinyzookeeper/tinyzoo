// The demo photographs (seed/media): the fictional copywriter Magda Šubrtová at work, her
// clients' places and the articles' pictures (seed/media/shots.txt is the list they were made
// from, with a description of each). The alt texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  portrait: { file: 'portrait.jpg', alt: alt.portrait, focal: { x: 50, y: 20 } },
  desk: { file: 'desk.jpg', alt: alt.desk, focal: { x: 60, y: 40 } },
  walk: { file: 'walk.jpg', alt: alt.walk, focal: { x: 50, y: 60 } },
  interview: { file: 'interview.jpg', alt: alt.interview },
  workshop: { file: 'workshop.jpg', alt: alt.workshop },
  truhlarstvi: { file: 'project-truhlarstvi.jpg', alt: alt.truhlarstvi },
  vinarstvi: { file: 'project-vinarstvi.jpg', alt: alt.vinarstvi },
  ucetni: { file: 'project-ucetni.jpg', alt: alt.ucetni },
  penzion: { file: 'project-penzion.jpg', alt: alt.penzion },
  ceny: { file: 'article-ceny.jpg', alt: alt.ceny },
  onas: { file: 'article-onas.jpg', alt: alt.onas },
  slova: { file: 'article-slova.jpg', alt: alt.slova },
} satisfies Record<string, SeedPhoto>

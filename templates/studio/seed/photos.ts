// The demo photographs (seed/media): a movement studio in a former mill, its two rooms, its
// classes and its four instructors (seed/media/shots.txt is the list they were made from, with a
// description of each). The alt texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  room: { file: 'room.jpg', alt: alt.room },
  hero: { file: 'hero.jpg', alt: alt.hero },
  yoga: { file: 'yoga.jpg', alt: alt.yoga },
  pilates: { file: 'pilates.jpg', alt: alt.pilates },
  dance: { file: 'dance.jpg', alt: alt.dance },
  ballet: { file: 'ballet.jpg', alt: alt.ballet, focal: { x: 50, y: 34 } },
  kids: { file: 'kids.jpg', alt: alt.kids },
  marta: { file: 'lektor-marta.jpg', alt: alt.marta },
  klara: { file: 'lektor-klara.jpg', alt: alt.klara },
  ondrej: { file: 'lektor-ondrej.jpg', alt: alt.ondrej },
  tereza: { file: 'lektor-tereza.jpg', alt: alt.tereza },
  lobby: { file: 'lobby.jpg', alt: alt.lobby },
  detail: { file: 'detail.jpg', alt: alt.detail },
  exterior: { file: 'exterior.jpg', alt: alt.exterior },
} satisfies Record<string, SeedPhoto>

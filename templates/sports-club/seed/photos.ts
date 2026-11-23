// The demo photographs (seed/media): an autumn afternoon at the ground of a small-town football
// club (seed/media/shots.txt is the list they were made from, with a description of each). The
// alt texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  // (Hřiště crops this one wide, so it keeps the players in view)
  heroMatch: { file: 'hero-match.jpg', alt: alt.heroMatch, focal: { x: 50, y: 56 } },
  ground: { file: 'ground.jpg', alt: alt.ground },
  youthTraining: { file: 'youth-training.jpg', alt: alt.youthTraining, focal: { x: 50, y: 42 } },
  youthMatch: { file: 'youth-match.jpg', alt: alt.youthMatch },
  celebration: { file: 'celebration.jpg', alt: alt.celebration },
  lineMarking: { file: 'line-marking.jpg', alt: alt.lineMarking },
  ball: { file: 'ball.jpg', alt: alt.ball },
  net: { file: 'net.jpg', alt: alt.net },
  // The portraits are cropped from the top in every look.
  playerCaptain: { file: 'player-captain.jpg', alt: alt.playerCaptain, focal: { x: 50, y: 0 } },
  playerKeeper: { file: 'player-keeper.jpg', alt: alt.playerKeeper, focal: { x: 50, y: 0 } },
  playerStriker: { file: 'player-striker.jpg', alt: alt.playerStriker, focal: { x: 50, y: 0 } },
  playerYoung: { file: 'player-young.jpg', alt: alt.playerYoung, focal: { x: 50, y: 0 } },
} satisfies Record<string, SeedPhoto>

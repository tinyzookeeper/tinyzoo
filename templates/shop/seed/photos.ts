// The demo photographs (seed/media): the shop on its street, the inside, the counter, the two
// people, six departments and three photographs of three things in a row, from which the
// products are cut (seed/media/shots.txt is the list they were made from, with a description
// of each). The alt texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  front: { file: 'front.jpg', alt: alt.front },
  interior: { file: 'interior.jpg', alt: alt.interior },
  counter: { file: 'counter.jpg', alt: alt.counter },
  owner: { file: 'owner.jpg', alt: alt.owner },
  assistant: { file: 'assistant.jpg', alt: alt.assistant },
  rangeKitchen: { file: 'range-kitchen.jpg', alt: alt.rangeKitchen },
  rangeCleaning: { file: 'range-cleaning.jpg', alt: alt.rangeCleaning },
  rangeTools: { file: 'range-tools.jpg', alt: alt.rangeTools },
  rangeFasteners: { file: 'range-fasteners.jpg', alt: alt.rangeFasteners },
  rangeGarden: { file: 'range-garden.jpg', alt: alt.rangeGarden },
  rangePreserving: { file: 'range-preserving.jpg', alt: alt.rangePreserving },
  picksKitchen: { file: 'picks-kitchen.jpg', alt: alt.picksKitchen },
  picksYard: { file: 'picks-yard.jpg', alt: alt.picksYard },
  picksGift: { file: 'picks-gift.jpg', alt: alt.picksGift },
} satisfies Record<string, SeedPhoto>

// The demo photographs (seed/media): one fictional photographer's work, all taken "by the same
// hand" (seed/media/shots.txt is the list they were made from, with a description of each).
// The alt texts are those descriptions, short and in the website's language.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'

export const PHOTOS = {
  weddingMeadow: { file: 'wedding-meadow.jpg', alt: 'Nevěsta a ženich jdou za západu slunce loukou', focal: { x: 18, y: 95 } },
  weddingCeremony: { file: 'wedding-ceremony.jpg', alt: 'Nevěsta a ženich stojí pod lípou před sedícími hosty' },
  weddingGettingReady: { file: 'wedding-getting-ready.jpg', alt: 'Nevěsta s kyticí u otevřeného okna' },
  weddingDance: { file: 'wedding-dance.jpg', alt: 'Nevěsta a ženich tančí ve stodole pod šňůrami světel', focal: { x: 50, y: 40 } },
  weddingTable: { file: 'wedding-table.jpg', alt: 'Dlouhý stůl prostřený v sadu a ozdobený lučními květinami' },
  weddingCouple: { file: 'wedding-couple.jpg', alt: 'Nevěsta a ženich v objetí pod stromy v sadu' },
  weddingRings: { file: 'wedding-rings.jpg', alt: 'Ruce novomanželů se zlatými prsteny' },
  portraitWoman: { file: 'portrait-woman.jpg', alt: 'Žena v pleteném svetru se u okna dívá do objektivu' },
  portraitMan: { file: 'portrait-man.jpg', alt: 'Truhlář v zástěře se opírá o pracovní stůl v dílně' },
  portraitGirl: { file: 'portrait-girl.jpg', alt: 'Mladá žena se zrzavými vlasy na podzimním poli' },
  familyWalk: { file: 'family-walk.jpg', alt: 'Rodiče vedou dvě děti za ruce po lesní cestě v podzimním listí' },
  familyHome: { file: 'family-home.jpg', alt: 'Maminka sedí na posteli a chová smějící se batole' },
  familyNewborn: { file: 'family-newborn.jpg', alt: 'Spící novorozenec v proutěném košíku' },
  businessPortrait: { file: 'business-portrait.jpg', alt: 'Architektka v tmavém saku se opírá o stůl v ateliéru' },
  businessCraft: { file: 'business-craft.jpg', alt: 'Keramička ukládá misku na polici v dílně' },
  about: { file: 'about.jpg', alt: 'Johana se usmívá na zahradě s fotoaparátem na popruhu' },
} satisfies Record<string, SeedPhoto>

// The demo photographs (seed/media): one fictional photographer's work, all taken "by the same
// hand" (seed/media/shots.txt is the list they were made from, with a description of each).
// The alt texts are those descriptions, short and in the website's language.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'

export const PHOTOS = {
  weddingMeadow: { file: 'wedding-meadow.jpg', alt: 'Nevěsta a ženich jdou ruku v ruce loukou při západu slunce', focal: { x: 18, y: 95 } },
  weddingCeremony: { file: 'wedding-ceremony.jpg', alt: 'Svatební obřad pod lípou ve starém sadu, hosté na dřevěných židlích' },
  weddingGettingReady: { file: 'wedding-getting-ready.jpg', alt: 'Nevěsta s kyticí lučních květin stojí u okna před obřadem' },
  weddingDance: { file: 'wedding-dance.jpg', alt: 'První tanec ve stodole pod řetězy žárovek', focal: { x: 50, y: 40 } },
  weddingTable: { file: 'wedding-table.jpg', alt: 'Prostřená svatební tabule v sadu s lučními květinami' },
  weddingCouple: { file: 'wedding-couple.jpg', alt: 'Smějící se nevěsta a ženich mezi jabloněmi' },
  weddingRings: { file: 'wedding-rings.jpg', alt: 'Ruce novomanželů se zlatými prsteny na lněném ubrusu' },
  portraitWoman: { file: 'portrait-woman.jpg', alt: 'Portrét ženy v pleteném svetru u okna' },
  portraitMan: { file: 'portrait-man.jpg', alt: 'Portrét truhláře v zástěře v jeho dílně' },
  portraitGirl: { file: 'portrait-girl.jpg', alt: 'Portrét mladé ženy s pihami na podzimním poli' },
  familyWalk: { file: 'family-walk.jpg', alt: 'Čtyřčlenná rodina na podzimní procházce bukovým lesem' },
  familyHome: { file: 'family-home.jpg', alt: 'Maminka s batoletem v náručí na posteli u okna' },
  familyNewborn: { file: 'family-newborn.jpg', alt: 'Spící novorozenec v proutěném košíku' },
  businessPortrait: { file: 'business-portrait.jpg', alt: 'Architektka stojí u stolu ve svém ateliéru' },
  businessCraft: { file: 'business-craft.jpg', alt: 'Keramička ukládá hrnek na polici v dílně' },
  about: { file: 'about.jpg', alt: 'Fotografka s fotoaparátem přes rameno na zahradě' },
} satisfies Record<string, SeedPhoto>

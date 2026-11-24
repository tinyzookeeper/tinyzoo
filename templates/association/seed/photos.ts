// The demo photographs (seed/media): a year in the orchards of a fictional association, taken
// by one of its members (seed/media/shots.txt is the list they were made from, with a description
// of each), and four one-page sample PDFs for the documents. The alt texts are in the template's texts.
import type { SeedPhoto } from 'tinyzoo-template-kit/seed'
import { demo } from '../texts/cs'

const alt = demo.photos

export const PHOTOS = {
  hero: { file: 'hero.jpg', alt: alt.hero },
  sad: { file: 'sad.jpg', alt: alt.sad },
  // (the design crops the spring's picture to its upper part, the tools' to the lower)
  studanka: { file: 'studanka.jpg', alt: alt.studanka, focal: { x: 50, y: 35 } },
  louka: { file: 'louka.jpg', alt: alt.louka },
  mostovani: { file: 'mostovani.jpg', alt: alt.mostovani },
  alej: { file: 'alej.jpg', alt: alt.alej },
  naradi: { file: 'naradi.jpg', alt: alt.naradi, focal: { x: 50, y: 60 } },
  ohen: { file: 'ohen.jpg', alt: alt.ohen },
  bedynky: { file: 'bedynky.jpg', alt: alt.bedynky },
  vychazka: { file: 'vychazka.jpg', alt: alt.vychazka },
  susarna: { file: 'susarna.jpg', alt: alt.susarna },
  marie: { file: 'portrait-marie.jpg', alt: alt.marie },
  petr: { file: 'portrait-petr.jpg', alt: alt.petr },
  tereza: { file: 'portrait-tereza.jpg', alt: alt.tereza },
} satisfies Record<string, SeedPhoto>

/** The sample documents: one file stands for every year's report. */
export const FILES = {
  zprava: { file: 'zprava.pdf', alt: 'Ukázková výroční zpráva' },
  zaverka: { file: 'zaverka.pdf', alt: 'Ukázková účetní závěrka' },
  stanovy: { file: 'stanovy.pdf', alt: 'Ukázkové stanovy spolku' },
  zapis: { file: 'zapis.pdf', alt: 'Ukázkový zápis ze schůze' },
} satisfies Record<string, SeedPhoto>

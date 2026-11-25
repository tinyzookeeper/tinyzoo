// The three looks of the Sports club template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults. The designs'
// `--muted` is `--quiet` here ("muted" is a name of Nuxt UI's, which the admin uses) and the
// designs' `--accent` (the club's second colour) is `--second`.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // The club bulletin: warm white paper, hairlines, a Clarendon headline face, framed photographs with captions.
    id: 'zpravodaj',
    name: { cs: 'Zpravodaj', en: 'Bulletin' },
    own: { against: ['--brand-ink', '--paper'], fixed: ['#1c1a18'] },
    presets: [
      { id: 'cervenobili', name: { cs: 'Červenobílí', en: 'Red and white' }, vars: { '--brand': '#a51d27', '--brand-ink': '#ffffff', '--second': '#ffffff', '--paper': '#fbfaf7', '--tint': '#f2eee7', '--line': '#ded8cc' } },
      { id: 'zelenobili', name: { cs: 'Zelenobílí', en: 'Green and white' }, vars: { '--brand': '#1c6540', '--brand-ink': '#ffffff', '--second': '#ffffff', '--paper': '#fafaf6', '--tint': '#edf0e6', '--line': '#d6dbcb' } },
      { id: 'modrozluti', name: { cs: 'Modrožlutí', en: 'Blue and yellow' }, vars: { '--brand': '#173d7a', '--brand-ink': '#ffffff', '--second': '#f3c234', '--paper': '#fafaf8', '--tint': '#eceff3', '--line': '#d3d8df' } },
    ],
  },
  {
    // The page wears the kit: blocks of the club colour with shirt stripes, very wide capitals, huge numbers.
    id: 'dres',
    name: { cs: 'Dres', en: 'Jersey' },
    own: { against: ['--brand-ink'] },
    presets: [
      { id: 'rudi', name: { cs: 'Rudí', en: 'Reds' }, vars: { '--brand': '#d6201c', '--brand-ink': '#ffffff', '--brand-lite': '#ff6a5c', '--paper': '#f3f1ec', '--stone': '#e4e1d9', '--ink': '#121214' } },
      { id: 'zlutocerni', name: { cs: 'Žlutočerní', en: 'Yellow and black' }, vars: { '--brand': '#f6c500', '--brand-ink': '#121214', '--brand-lite': '#f6c500', '--paper': '#f4f2ea', '--stone': '#e5e2d6', '--ink': '#121214' } },
      { id: 'modrobili', name: { cs: 'Modrobílí', en: 'Blue and white' }, vars: { '--brand': '#1846d2', '--brand-ink': '#ffffff', '--brand-lite': '#8cabff', '--paper': '#f1f2f5', '--stone': '#dfe2e8', '--ink': '#0f1320' } },
    ],
  },
  {
    // A Saturday afternoon: a white page, big colour photographs with soft corners, headings that lean forward, match data like a scoreboard.
    id: 'hriste',
    name: { cs: 'Hřiště', en: 'Pitch' },
    own: { against: ['--brand-ink'], fixed: ['#ffffff'] },
    presets: [
      { id: 'cervena', name: { cs: 'Červenobílí', en: 'Red and white' }, vars: { '--brand': '#cf2330', '--brand-ink': '#ffffff', '--pitch': '#12261d', '--ink': '#16211c', '--quiet': '#56645b', '--tint': '#f3f6f1', '--line': '#e0e6de' } },
      { id: 'modra', name: { cs: 'Modrobílí', en: 'Blue and white' }, vars: { '--brand': '#1d5bd8', '--brand-ink': '#ffffff', '--pitch': '#101c36', '--ink': '#141b2b', '--quiet': '#566074', '--tint': '#f2f5fa', '--line': '#dee5ef' } },
      { id: 'zelena', name: { cs: 'Zelenobílí', en: 'Green and white' }, vars: { '--brand': '#0f7a45', '--brand-ink': '#ffffff', '--pitch': '#16231d', '--ink': '#17211c', '--quiet': '#59635d', '--tint': '#f4f5f1', '--line': '#e1e5dc' } },
    ],
  },
])

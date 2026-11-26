// The two looks of the Medical template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults. The design's
// `--text` is `--body` here and its `--muted` is `--quiet` (Nuxt UI's own names are taken).
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // The waiting room in daylight: a white page with a lot of air, large calm type, rounded photographs, today's hours in one soft band.
    id: 'cekarna',
    button: 'btn btn-brand',
    heading: 'text-[2.5rem] sm:text-[3rem] lg:text-[3.5rem] mb-8 lg:mb-10',
    name: { cs: 'Čekárna', en: 'Waiting Room' },
    own: { against: ['--body', '--brand-ink', '--brand-tint', '--tint'], fixed: ['#fdf4de', '#ffffff'] },
    presets: [
      { id: 'inkoust', name: { cs: 'Inkoust', en: 'Ink' }, swatch: ['#27416e', '#e3eaf6', '#141c2b'], vars: { '--brand': '#27416e', '--brand-ink': '#ffffff', '--brand-tint': '#e3eaf6', '--tint': '#f3f5f8', '--line': '#e1e6ee', '--ink': '#141c2b', '--body': '#3b4558', '--quiet': '#5e687b' } },
      { id: 'jedle', name: { cs: 'Jedle', en: 'Fir' }, swatch: ['#1f5c49', '#e2efe8', '#15221c'], vars: { '--brand': '#1f5c49', '--brand-ink': '#ffffff', '--brand-tint': '#e2efe8', '--tint': '#f3f6f2', '--line': '#e2e8e2', '--ink': '#15221c', '--body': '#3c4943', '--quiet': '#5f6d66' } },
      { id: 'svestka', name: { cs: 'Švestka', en: 'Plum' }, swatch: ['#70304c', '#f3e4ea', '#24171c'], vars: { '--brand': '#70304c', '--brand-ink': '#ffffff', '--brand-tint': '#f3e4ea', '--tint': '#f7f4f4', '--line': '#ebe3e5', '--ink': '#24171c', '--body': '#4b3d42', '--quiet': '#6f6065' } },
    ],
  },
  {
    // The waiting-room clock: every day is a dial, coloured where the practice is open, and the colour says for whom.
    id: 'cifernik',
    button: 'btn btn-brand',
    heading: 'text-[2.5rem] sm:text-[3.2rem] lg:text-[3.6rem] mb-8 lg:mb-10',
    name: { cs: 'Ciferník', en: 'Clock Face' },
    own: { against: ['--body', '--brand-ink', '--card', '--paper', '--soft', '--track'] },
    presets: [
      { id: 'tyrkys', name: { cs: 'Tyrkys', en: 'Teal' }, swatch: ['#0b7d70', '#1d3f5e', '#f4bd4a'], vars: { '--brand': '#0b7d70', '--brand-ink': '#ffffff', '--soft': '#d8eee9', '--second': '#1d3f5e', '--sun': '#f4bd4a', '--paper': '#f3f7f6', '--card': '#ffffff', '--track': '#dee8e6', '--ink': '#12303a', '--body': '#38505a', '--quiet': '#586d76' } },
      { id: 'chrpa', name: { cs: 'Chrpa', en: 'Cornflower' }, swatch: ['#2a5fd0', '#1b2b57', '#f4bd4a'], vars: { '--brand': '#2a5fd0', '--brand-ink': '#ffffff', '--soft': '#dde7fb', '--second': '#1b2b57', '--sun': '#f4bd4a', '--paper': '#f4f6fa', '--card': '#ffffff', '--track': '#dfe4ee', '--ink': '#172240', '--body': '#3b4560', '--quiet': '#5a647e' } },
      { id: 'lipa', name: { cs: 'Lípa', en: 'Linden' }, swatch: ['#2b7a45', '#173a52', '#f4bd4a'], vars: { '--brand': '#2b7a45', '--brand-ink': '#ffffff', '--soft': '#dbeede', '--second': '#173a52', '--sun': '#f4bd4a', '--paper': '#f4f7f3', '--card': '#ffffff', '--track': '#dfe7dd', '--ink': '#16281f', '--body': '#3a4a40', '--quiet': '#5a695f' } },
    ],
  },
])

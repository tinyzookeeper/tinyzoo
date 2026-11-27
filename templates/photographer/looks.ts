// The three looks of the Photographer template, and each look's colours. The first look and
// each look's first colours are the defaults. Shown by: cms.config.ts (the two choices in
// Site settings), the website (app/layouts/default.vue) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; what a look derives from them (greys mixed from
// text and background, say) is in its stylesheet, app/assets/css/<look>.css.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // A quiet gallery wall: white paper, hairlines, a thin serif.
    id: 'atelier',
    name: { cs: 'Ateliér', en: 'Atelier' },
    own: { against: ['--brand-ink', '--paper', '--tint'] },
    presets: [
      { id: 'bronz', name: { cs: 'Bronz', en: 'Bronze' }, vars: { '--brand': '#7a5a3a', '--brand-ink': '#ffffff', '--paper': '#faf8f4', '--tint': '#f1ece3', '--line': '#dfd8cc' } },
      { id: 'oliva', name: { cs: 'Oliva', en: 'Olive' }, vars: { '--brand': '#4e5b3a', '--brand-ink': '#ffffff', '--paper': '#f9f9f3', '--tint': '#eceee1', '--line': '#d8dbc9' } },
      { id: 'bridlice', name: { cs: 'Břidlice', en: 'Slate' }, vars: { '--brand': '#3b4d60', '--brand-ink': '#ffffff', '--paper': '#f8f8f7', '--tint': '#e9edf0', '--line': '#d3d9de' } },
    ],
  },
  {
    // A contact sheet turned poster: black, edge-to-edge photographs, condensed capitals.
    id: 'negativ',
    name: { cs: 'Negativ', en: 'Negative' },
    own: { against: ['--bg', '--brand-ink'] },
    presets: [
      { id: 'mosaz', name: { cs: 'Mosaz', en: 'Brass' }, vars: { '--brand': '#d4b57e', '--brand-ink': '#100f0d', '--bg': '#0e0e0d', '--fg': '#efece6' } },
      { id: 'salvej', name: { cs: 'Šalvěj', en: 'Sage' }, vars: { '--brand': '#a9bd9b', '--brand-ink': '#0e100d', '--bg': '#0d0e0d', '--fg': '#edede8' } },
      { id: 'bordo', name: { cs: 'Bordó', en: 'Burgundy' }, vars: { '--brand': '#6e1f2b', '--brand-ink': '#ffffff', '--bg': '#efeeea', '--fg': '#141312' } },
    ],
  },
  {
    // The photographer's own album: prints with white borders, tape, handwritten notes.
    id: 'zapisnik',
    name: { cs: 'Zápisník', en: 'Notebook' },
    own: { against: ['--brand-ink', '--paper', '--tint'], fixed: ['#ffffff'] },
    presets: [
      { id: 'inkoust', name: { cs: 'Inkoust', en: 'Ink' }, vars: { '--brand': '#2c4270', '--brand-ink': '#ffffff', '--paper': '#f5f6f8', '--tint': '#e1e7f0', '--ink': '#181d2a' } },
      { id: 'jedle', name: { cs: 'Jedle', en: 'Fir' }, vars: { '--brand': '#34604e', '--brand-ink': '#ffffff', '--paper': '#f6f6f3', '--tint': '#e2e9e3', '--ink': '#19211d' } },
      { id: 'svestka', name: { cs: 'Švestka', en: 'Plum' }, vars: { '--brand': '#753a57', '--brand-ink': '#ffffff', '--paper': '#f7f5f5', '--tint': '#ece3e8', '--ink': '#231a20' } },
    ],
  },
])

export type LookId = typeof looks.ids[number]

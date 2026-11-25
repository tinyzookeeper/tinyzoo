// The three looks of the Software template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // The page as a well-made instruction manual: numbered figures, green callout pins, ruled tables.
    id: 'navod',
    name: { cs: 'Návod', en: 'Manual' },
    own: { against: ['--am', '--brand-ink', '--ground', '--pm', '--tint'], fixed: ['#2e3536', '#ffffff'] },
    presets: [
      { id: 'zelena', name: { cs: 'Zelená', en: 'Green' }, vars: { '--brand': '#0d7a55', '--brand-ink': '#ffffff', '--tint': '#dcebe3', '--ground': '#eceeeb', '--ink': '#121617', '--am': '#fae7a2', '--pm': '#cbdfee' } },
      { id: 'modra', name: { cs: 'Modrá', en: 'Blue' }, vars: { '--brand': '#2348c9', '--brand-ink': '#ffffff', '--tint': '#dde4f6', '--ground': '#ecedf0', '--ink': '#12151c', '--am': '#fae7a2', '--pm': '#d3d9f3' } },
      { id: 'cihlova', name: { cs: 'Cihlová', en: 'Brick' }, vars: { '--brand': '#b33d16', '--brand-ink': '#ffffff', '--tint': '#f3e0d6', '--ground': '#efedea', '--ink': '#1a1614', '--am': '#f6e3a4', '--pm': '#d6e2e4' } },
    ],
  },
  {
    // The rota board from the back room: the product's afternoon orange, headlines set as shift bars on a week grid.
    id: 'magnety',
    name: { cs: 'Magnety', en: 'Magnets' },
    own: { calm: true, against: ['--ink'] },
    presets: [
      { id: 'odpoledne', name: { cs: 'Odpoledne', en: 'Afternoon' }, swatch: ['#f4691e', '#fff1dc', '#bcdff6'], vars: { '--brand': '#f4691e', '--ink': '#1b130d', '--cream': '#fff1dc', '--sky': '#bcdff6', '--board': '#fffaf2' } },
      { id: 'rano', name: { cs: 'Ráno', en: 'Morning' }, swatch: ['#5fcb9b', '#f5f6e8', '#ffcfd9'], vars: { '--brand': '#5fcb9b', '--ink': '#0e2018', '--cream': '#f5f6e8', '--sky': '#ffcfd9', '--board': '#fcfdf5' } },
      { id: 'vecer', name: { cs: 'Večer', en: 'Evening' }, swatch: ['#7fb2f7', '#f6f1e6', '#ffd88a'], vars: { '--brand': '#7fb2f7', '--ink': '#0f1830', '--cream': '#f6f1e6', '--sky': '#ffd88a', '--board': '#fdfaf3' } },
    ],
  },
  {
    // One working day: a time rail down the left edge, the background going from dawn to night.
    id: 'jeden-den',
    name: { cs: 'Jeden den', en: 'One Day' },
    own: { against: ['--afternoon', '--am', '--dawn', '--ink', '--lamp', '--late', '--morning', '--noon', '--pm'], fixed: ['#fbf1dc', '#fffdf8', '#ffffff'] },
    presets: [
      { id: 'podzim', name: { cs: 'Podzim', en: 'Autumn' }, swatch: ['#bb3f17', '#fbf1dc', '#2f4a5c'], vars: { '--dawn': '#f8dcc6', '--morning': '#fbf1dc', '--noon': '#fffaf0', '--afternoon': '#f7d8a2', '--late': '#f0bd8c', '--dusk': '#2f4a5c', '--evening': '#223649', '--night': '#141e2f', '--brand': '#bb3f17', '--ink': '#2b1d12', '--am': '#fbe2a0', '--pm': '#f3bb8f', '--lamp': '#f8d98b' } },
      { id: 'zima', name: { cs: 'Zima', en: 'Winter' }, swatch: ['#9d2f2b', '#f2f0ea', '#3b4d68'], vars: { '--dawn': '#efdcdc', '--morning': '#f2f0ea', '--noon': '#fcfbf8', '--afternoon': '#eadbb6', '--late': '#dcc2a6', '--dusk': '#3b4d68', '--evening': '#293751', '--night': '#151c30', '--brand': '#9d2f2b', '--ink': '#211d22', '--am': '#f2e2a6', '--pm': '#e8c1ab', '--lamp': '#f1dca0' } },
      { id: 'leto', name: { cs: 'Léto', en: 'Summer' }, swatch: ['#b9430f', '#fff3d2', '#1f5757'], vars: { '--dawn': '#ffe2bd', '--morning': '#fff3d2', '--noon': '#fffdf2', '--afternoon': '#ffd47e', '--late': '#f6b56e', '--dusk': '#1f5757', '--evening': '#174545', '--night': '#0e2a2c', '--brand': '#b9430f', '--ink': '#2a1a0c', '--am': '#ffe08c', '--pm': '#f7b47e', '--lamp': '#ffd97a' } },
    ],
  },
])

export type LookId = typeof looks.ids[number]

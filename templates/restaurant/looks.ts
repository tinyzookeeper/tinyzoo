// The three looks of the Restaurant template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // A first-republic dining room: a dark page the colour of the wainscoting, brass hairlines, menus on cream cards.
    id: 'salon',
    name: { cs: 'Salon', en: 'Dining Room' },
    own: { against: ['--bg', '--brand-ink', '--panel'] },
    presets: [
      { id: 'lahvova', name: { cs: 'Lahvová', en: 'Bottle green' }, vars: { '--bg': '#15281f', '--panel': '#1c3328', '--line': '#3a5143', '--text': '#efe8d6', '--quiet': '#b3bba8', '--brand': '#c8a45c', '--brand-ink': '#15281f', '--paper': '#f3ecda' } },
      { id: 'burgundska', name: { cs: 'Burgundská', en: 'Burgundy' }, vars: { '--bg': '#2a1317', '--panel': '#371b20', '--line': '#5b3a3f', '--text': '#f2e8dc', '--quiet': '#c7b3ae', '--brand': '#d9ae74', '--brand-ink': '#2a1317', '--paper': '#f5ecdf' } },
      { id: 'pulnocni', name: { cs: 'Půlnoční', en: 'Midnight' }, vars: { '--bg': '#131c2c', '--panel': '#1b273b', '--line': '#37455e', '--text': '#ece9e0', '--quiet': '#aeb7c6', '--brand': '#d2be92', '--brand-ink': '#131c2c', '--paper': '#f1ede2' } },
    ],
  },
  {
    // A poster: one loud colour, a headline as wide as the page, 2 px tables, food from above cut into plates.
    id: 'talir',
    name: { cs: 'Talíř', en: 'Plate' },
    own: { against: ['--brand-ink', '--paper'] },
    presets: [
      { id: 'horcice', name: { cs: 'Hořčice', en: 'Mustard' }, vars: { '--brand': '#f6c519', '--brand-ink': '#151412', '--pop': '#f6c519', '--paper': '#f5f2e9', '--ink': '#151412' } },
      { id: 'rajce', name: { cs: 'Rajče', en: 'Tomato' }, vars: { '--brand': '#cc3219', '--brand-ink': '#fff5ea', '--pop': '#ff7253', '--paper': '#f6f1e8', '--ink': '#1b1210' } },
      { id: 'kobalt', name: { cs: 'Kobalt', en: 'Cobalt' }, vars: { '--brand': '#2340c8', '--brand-ink': '#f6f4ec', '--pop': '#9fb0ff', '--paper': '#f2f1ea', '--ink': '#11131d' } },
    ],
  },
  {
    // The pub's own paperwork: forms printed in ink and filled in on a typewriter, a red stamp, the waiter's pencil.
    id: 'paragon',
    name: { cs: 'Paragon', en: 'Receipt' },
    own: { against: ['--brand-ink', '--paper', '--sheet', '--tint'] },
    presets: [
      { id: 'inkoust', name: { cs: 'Inkoust', en: 'Ink' }, vars: { '--paper': '#e9e3d3', '--sheet': '#fbf9f2', '--tint': '#f2d9d0', '--ink': '#1d2b57', '--type': '#25242b', '--brand': '#b82e1b', '--brand-ink': '#fff8f0' } },
      { id: 'vycep', name: { cs: 'Výčep', en: 'Taproom' }, vars: { '--paper': '#e4e2cf', '--sheet': '#fafaf0', '--tint': '#f0dfa6', '--ink': '#1c3a2c', '--type': '#262722', '--brand': '#a44414', '--brand-ink': '#fff8ec' } },
      { id: 'tuha', name: { cs: 'Tuha', en: 'Graphite' }, vars: { '--paper': '#e6e4df', '--sheet': '#fbfaf7', '--tint': '#d5e1ea', '--ink': '#262422', '--type': '#262422', '--brand': '#1f4fa8', '--brand-ink': '#ffffff' } },
    ],
  },
])

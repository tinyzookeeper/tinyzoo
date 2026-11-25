// The three looks of the Studio template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // The room in daylight: a pale green-grey page, a bookish serif, soft rounded photographs and white cards.
    id: 'sal',
    name: { cs: 'Sál', en: 'Hall' },
    own: { against: ['--body', '--brand-ink', '--card', '--paper', '--tint'] },
    presets: [
      { id: 'borovice', name: { cs: 'Borovice', en: 'Pine' }, vars: { '--brand': '#2f5d50', '--brand-ink': '#ffffff', '--paper': '#f5f4ee', '--card': '#ffffff', '--tint': '#e6ebe1', '--line': '#d6dacd', '--ink': '#1b2a25', '--body': '#3d4843', '--quiet': '#5d6862', '--warm': '#a8481f' } },
      { id: 'jil', name: { cs: 'Jíl', en: 'Clay' }, vars: { '--brand': '#99472a', '--brand-ink': '#ffffff', '--paper': '#f8f4ed', '--card': '#ffffff', '--tint': '#f0e5d8', '--line': '#e0d5c6', '--ink': '#2a1f1a', '--body': '#3d4843', '--quiet': '#5d6862', '--warm': '#2f6a58' } },
      { id: 'indigo', name: { cs: 'Indigo', en: 'Indigo' }, vars: { '--brand': '#34477a', '--brand-ink': '#ffffff', '--paper': '#f4f5f6', '--card': '#ffffff', '--tint': '#e4e8f0', '--line': '#d3d8e2', '--ink': '#1a2033', '--body': '#3d4843', '--quiet': '#5d6862', '--warm': '#a8481f' } },
    ],
  },
  {
    // A departures board: the whole page in the studio's colour, wide capitals, mono numerals, square edges, today's classes in the opening.
    id: 'tabule',
    name: { cs: 'Tabule', en: 'Board' },
    own: { against: ['--accent', '--brand-ink', '--ink', '--paper'], fixed: ['#ffffff'] },
    presets: [
      { id: 'kobalt', name: { cs: 'Kobalt', en: 'Cobalt' }, vars: { '--brand': '#1d32d8', '--brand-ink': '#ffffff', '--accent': '#ffd84a', '--accent-ink': '#0c0f24', '--ink': '#0c0f24', '--paper': '#f1efe9' } },
      { id: 'rumelka', name: { cs: 'Rumělka', en: 'Vermilion' }, vars: { '--brand': '#c22d14', '--brand-ink': '#ffffff', '--accent': '#fbe9a4', '--accent-ink': '#1d100c', '--ink': '#1d100c', '--paper': '#f5f1ea' } },
      { id: 'smaragd', name: { cs: 'Smaragd', en: 'Emerald' }, vars: { '--brand': '#0a6a4b', '--brand-ink': '#ffffff', '--accent': '#ffcdbb', '--accent-ink': '#08160f', '--ink': '#08160f', '--paper': '#eff1ea' } },
    ],
  },
  {
    // The striped wool blanket from the shelf: every kind of class has a thread colour, and the week's timetable is woven from them.
    id: 'deka',
    name: { cs: 'Deka', en: 'Blanket' },
    own: { against: ['--brand-ink', '--card', '--paper'] },
    presets: [
      { id: 'slunce', name: { cs: 'Slunce', en: 'Sun' }, swatch: ['#f8c950', '#9ccbec', '#f49980'], vars: { '--paper': '#ffffff', '--card': '#f3f5f8', '--ink': '#1e2638', '--brand': '#f8c950', '--brand-ink': '#1e2638', '--k1': '#f8d678', '--k2': '#9ccbec', '--k3': '#f49980', '--k4': '#f8bec5', '--k5': '#a2d8b0' } },
      { id: 'mata', name: { cs: 'Máta', en: 'Mint' }, swatch: ['#9dd4a7', '#f6d97e', '#f49f81'], vars: { '--paper': '#ffffff', '--card': '#f3f6f4', '--ink': '#152920', '--brand': '#9dd4a7', '--brand-ink': '#152920', '--k1': '#a7dbb1', '--k2': '#f6d97e', '--k3': '#f49f81', '--k4': '#aed7e9', '--k5': '#f8c0c7' } },
      { id: 'pivonka', name: { cs: 'Pivoňka', en: 'Peony' }, swatch: ['#f4a9b6', '#c0baec', '#ee908d'], vars: { '--paper': '#ffffff', '--card': '#f6f4f7', '--ink': '#2e1d32', '--brand': '#f4a9b6', '--brand-ink': '#2e1d32', '--k1': '#f5bac6', '--k2': '#c0baec', '--k3': '#ee908d', '--k4': '#f3de90', '--k5': '#a3ddc2' } },
    ],
  },
])

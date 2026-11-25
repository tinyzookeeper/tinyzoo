// The three looks of the Wedding template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // A letterpress announcement: one Caslon family, centred names, hairlines, matted photographs.
    id: 'oznameni',
    name: { cs: 'Oznámení', en: 'Announcement' },
    own: { against: ['--brand-ink', '--paper'] },
    presets: [
      { id: 'salvej', name: { cs: 'Šalvěj', en: 'Sage' }, vars: { '--brand': '#55654c', '--brand-ink': '#ffffff', '--paper': '#f6f3ea', '--card': '#fdfbf5', '--tint': '#e8ebdd', '--line': '#d6d4c2', '--ink': '#262a24', '--body': '#484d44', '--quiet': '#666b5f' } },
      { id: 'ruze', name: { cs: 'Pudrová růže', en: 'Dusty rose' }, vars: { '--brand': '#8a4a54', '--brand-ink': '#ffffff', '--paper': '#f9f2ee', '--card': '#fffaf7', '--tint': '#f1dfdb', '--line': '#e3d2cb', '--ink': '#33211f', '--body': '#59433f', '--quiet': '#775f5b' } },
      { id: 'holubi', name: { cs: 'Holubí modř', en: 'Dove blue' }, vars: { '--brand': '#44607f', '--brand-ink': '#ffffff', '--paper': '#f3f4f3', '--card': '#fcfcfb', '--tint': '#e1e8ee', '--line': '#d0d7dd', '--ink': '#1f2a36', '--body': '#424f5e', '--quiet': '#5d6978' } },
    ],
  },
  {
    // The evening of the wedding: a dark page under strings of lights, champagne hairlines, one ivory reply card.
    id: 'vecer',
    name: { cs: 'Večer', en: 'Evening' },
    own: { against: ['--brand-ink', '--night', '--panel'] },
    presets: [
      { id: 'les', name: { cs: 'Les', en: 'Forest' }, swatch: ['#111b17', '#d3b784', '#f3ecdd'], vars: { '--night': '#111b17', '--panel': '#18251f', '--line': '#32423a', '--ink': '#f4eddd', '--body': '#d5cebc', '--quiet': '#a7a08e', '--brand': '#d3b784', '--brand-ink': '#141d18', '--card': '#f3ecdd', '--card-ink': '#17211c', '--card-body': '#454a40', '--card-line': '#cdc3ac' } },
      { id: 'pulnoc', name: { cs: 'Půlnoc', en: 'Midnight' }, swatch: ['#10151e', '#d9c5a2', '#f2eee5'], vars: { '--night': '#10151e', '--panel': '#171e2a', '--line': '#313a4a', '--ink': '#f2ede3', '--body': '#d1cdc4', '--quiet': '#a2a3a6', '--brand': '#d9c5a2', '--brand-ink': '#121722', '--card': '#f2eee5', '--card-ink': '#141a25', '--card-body': '#444852', '--card-line': '#c9c6bd' } },
      { id: 'svestka', name: { cs: 'Švestka', en: 'Plum' }, swatch: ['#1c1319', '#debba3', '#f5ede6'], vars: { '--night': '#1c1319', '--panel': '#271a22', '--line': '#47353e', '--ink': '#f6ece5', '--body': '#dacdc6', '--quiet': '#ad9da1', '--brand': '#debba3', '--brand-ink': '#20151b', '--card': '#f5ede6', '--card-ink': '#23161d', '--card-body': '#51444a', '--card-line': '#d3c5bd' } },
    ],
  },
  {
    // A spread in a wedding magazine: a white page, a Didone set large, photographs given whole columns.
    id: 'magazin',
    name: { cs: 'Magazín', en: 'Magazine' },
    own: { against: ['--brand-ink'], fixed: ['#ffffff'] },
    presets: [
      { id: 'pisek', name: { cs: 'Písek', en: 'Sand' }, swatch: ['#7d6752', '#f4f1ec', '#262320'], vars: { '--brand': '#7d6752', '--brand-ink': '#ffffff', '--tint': '#f4f1ec', '--line': '#e1ddd5', '--ink': '#1b1a18', '--body': '#46433e', '--quiet': '#6d6962', '--deep': '#262320' } },
      { id: 'oliva', name: { cs: 'Oliva', en: 'Olive' }, swatch: ['#5e6a4c', '#f1f2ec', '#22271f'], vars: { '--brand': '#5e6a4c', '--brand-ink': '#ffffff', '--tint': '#f1f2ec', '--line': '#dcdfd3', '--ink': '#1a1c18', '--body': '#42463e', '--quiet': '#676b61', '--deep': '#22271f' } },
      { id: 'bridlice', name: { cs: 'Břidlice', en: 'Slate' }, swatch: ['#55667c', '#eff1f4', '#1e242d'], vars: { '--brand': '#55667c', '--brand-ink': '#ffffff', '--tint': '#eff1f4', '--line': '#d9dde3', '--ink': '#181b20', '--body': '#3f444c', '--quiet': '#636973', '--deep': '#1e242d' } },
    ],
  },
])

export type LookId = typeof looks.ids[number]

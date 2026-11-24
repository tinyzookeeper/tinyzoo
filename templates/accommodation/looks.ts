// The two looks of the Accommodation template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults. What a look
// derives from them (its lines, its quiet text) follows the preset by itself.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // A quiet dark lodge page: one full-bleed photograph, and the year as a ribbon of twelve months coloured by season.
    id: 'cely-rok',
    name: { cs: 'Celý rok', en: 'All Year' },
    presets: [
      { id: 'vres', name: { cs: 'Vřes', en: 'Heather' }, swatch: ['#e8afca', '#121e19', '#f1eadc'], vars: { '--bg': '#121e19', '--surface': '#1a2923', '--raised': '#23362e', '--text': '#f1eadc', '--brand': '#e8afca', '--brand-ink': '#2b1421' } },
      { id: 'jerabina', name: { cs: 'Jeřabina', en: 'Rowan' }, swatch: ['#f29268', '#1c1614', '#f3eadb'], vars: { '--bg': '#1c1614', '--surface': '#28201d', '--raised': '#342a26', '--text': '#f3eadb', '--brand': '#f29268', '--brand-ink': '#2a1107' } },
      { id: 'jinovatka', name: { cs: 'Jinovatka', en: 'Hoarfrost' }, swatch: ['#a9cdf2', '#121926', '#eef0ee'], vars: { '--bg': '#121926', '--surface': '#1a2334', '--raised': '#243045', '--text': '#eef0ee', '--brand': '#a9cdf2', '--brand-ink': '#0f1c2e' } },
    ],
  },
  {
    // A light, airy page that lets the photographs and rooms lead; everything is measured from the door.
    id: 'ode-dveri',
    name: { cs: 'Ode dveří', en: 'From the Door' },
    presets: [
      { id: 'bridlice', name: { cs: 'Břidlice', en: 'Slate' }, swatch: ['#35596b', '#f2f5f7', '#161f24'], vars: { '--brand': '#35596b', '--brand-ink': '#ffffff', '--soft': '#f2f5f7', '--ink': '#161f24' } },
      { id: 'les', name: { cs: 'Les', en: 'Forest' }, swatch: ['#2f5f4e', '#f3f6f3', '#17211e'], vars: { '--brand': '#2f5f4e', '--brand-ink': '#ffffff', '--soft': '#f3f6f3', '--ink': '#17211e' } },
      { id: 'vresova', name: { cs: 'Vřes', en: 'Heather' }, swatch: ['#75486a', '#f6f3f5', '#201a1f'], vars: { '--brand': '#75486a', '--brand-ink': '#ffffff', '--soft': '#f6f3f5', '--ink': '#201a1f' } },
    ],
  },
])

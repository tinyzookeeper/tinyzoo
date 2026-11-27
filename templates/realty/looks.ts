// The three looks of the Realty template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // The calm office of a careful agent: paper white, hairlines, a book serif, listings set like land-register records.
    id: 'katastr',
    heading: 'text-[2.1rem] md:text-[2.75rem] leading-[1.1] mb-8',
    name: { cs: 'Katastr', en: 'Land Register' },
    own: { against: ['--brand-ink', '--paper', '--tint'], fixed: ['#ffffff'] },
    presets: [
      { id: 'petrol', name: { cs: 'Petrol', en: 'Petrol' }, vars: { '--brand': '#1c4a52', '--brand-ink': '#ffffff', '--accent': '#b4473a', '--paper': '#f6f5f0', '--tint': '#ebe9e0', '--line': '#d5d3c8' } },
      { id: 'vinova', name: { cs: 'Vínová', en: 'Wine' }, vars: { '--brand': '#6b2233', '--brand-ink': '#ffffff', '--accent': '#8a6a1f', '--paper': '#f8f5f0', '--tint': '#eee8df', '--line': '#dcd4c7' } },
      { id: 'grafit', name: { cs: 'Grafit', en: 'Graphite' }, vars: { '--brand': '#2c3036', '--brand-ink': '#ffffff', '--accent': '#b5521f', '--paper': '#f5f5f3', '--tint': '#e9e9e5', '--line': '#d3d3cd' } },
    ],
  },
  {
    // The banner an agent hangs on a balcony: one loud colour, very heavy type, 2 px black rules, listings as one ruled sheet.
    id: 'cedule',
    heading: 'text-[3.2rem] md:text-[5rem] tracking-[-0.05em] leading-[0.9] mb-8',
    name: { cs: 'Cedule', en: 'Banner' },
    own: { calm: true, against: ['--brand-ink'] },
    presets: [
      { id: 'zluta', name: { cs: 'Žlutá', en: 'Yellow' }, swatch: ['#ffd60a', '#ffffff', '#111110'], vars: { '--brand': '#ffd60a', '--brand-ink': '#111110', '--brand-on-dark': '#ffd60a', '--tint': '#f1f0ea' } },
      { id: 'mentol', name: { cs: 'Mentol', en: 'Mint' }, swatch: ['#3fe0a4', '#ffffff', '#111110'], vars: { '--brand': '#3fe0a4', '--brand-ink': '#111110', '--brand-on-dark': '#3fe0a4', '--tint': '#eef1ee' } },
      { id: 'kobalt', name: { cs: 'Kobalt', en: 'Cobalt' }, swatch: ['#2740f0', '#ffffff', '#111110'], vars: { '--brand': '#2740f0', '--brand-ink': '#ffffff', '--brand-on-dark': '#9aa8ff', '--tint': '#eef0f5' } },
    ],
  },
  {
    // A street in the evening with the lights on: a warm dark page, lamp-coloured accents, window-shaped photographs.
    id: 'rozsviceno',
    heading: 'text-[2.3rem] md:text-[3.2rem] mb-8',
    name: { cs: 'Rozsvíceno', en: 'Lights On' },
    own: { main: '--accent', against: ['--accent-ink', '--bg', '--surface', '--surface-2'], fixed: ['#f3ebdd'] },
    presets: [
      { id: 'soumrak', name: { cs: 'Soumrak', en: 'Dusk' }, swatch: ['#f4c463', '#1f1b24', '#2b2632'], vars: { '--bg': '#1f1b24', '--surface': '#2b2632', '--surface-2': '#393240', '--muted': '#bfb5b3', '--accent': '#f4c463', '--accent-ink': '#26190a' } },
      { id: 'mech', name: { cs: 'Mech', en: 'Moss' }, swatch: ['#f0a37a', '#1a211c', '#252e27'], vars: { '--bg': '#1a211c', '--surface': '#252e27', '--surface-2': '#323c34', '--muted': '#b4bbb0', '--accent': '#f0a37a', '--accent-ink': '#2a140a' } },
      { id: 'pulnoc', name: { cs: 'Půlnoc', en: 'Midnight' }, swatch: ['#f7e08e', '#141d28', '#1e2a37'], vars: { '--bg': '#141d28', '--surface': '#1e2a37', '--surface-2': '#2a3847', '--muted': '#aeb8c2', '--accent': '#f7e08e', '--accent-ink': '#1d1a08' } },
    ],
  },
])

export type LookId = typeof looks.ids[number]

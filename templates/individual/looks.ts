// The three looks of the Freelancer and consultant template, and each look's colours. The first
// look and each look's first colours are the defaults. Shown by: cms.config.ts (the two choices
// in Site settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // A well-printed business card grown into a page: one solid panel of colour beside a portrait, a price list.
    id: 'vizitka',
    name: { cs: 'Vizitka', en: 'Business Card' },
    presets: [
      { id: 'petrol', name: { cs: 'Petrol', en: 'Petrol' }, vars: { '--brand': '#1f4f58', '--brand-ink': '#f7f4ec', '--paper': '#fbfaf7', '--tint': '#f0efe9', '--line': '#d9d7ce', '--ink': '#172022' } },
      { id: 'bordo', name: { cs: 'Bordó', en: 'Burgundy' }, vars: { '--brand': '#6c2433', '--brand-ink': '#f9f1ea', '--paper': '#fcfaf7', '--tint': '#f3ede7', '--line': '#e0d7cd', '--ink': '#231a1b' } },
      { id: 'mech', name: { cs: 'Mech', en: 'Moss' }, vars: { '--brand': '#434f2a', '--brand-ink': '#f6f4e6', '--paper': '#fbfbf6', '--tint': '#eeefe3', '--line': '#d8dac8', '--ink': '#1d2017' } },
    ],
  },
  {
    // A headline writer's poster: a field of marker colour, enormous type, black on white with the marker on the words that matter.
    id: 'zvyraznovac',
    name: { cs: 'Zvýrazňovač', en: 'Highlighter' },
    presets: [
      { id: 'zluta', name: { cs: 'Žlutá', en: 'Yellow' }, vars: { '--brand': '#ffdd1f', '--brand-ink': '#121211', '--paper': '#faf8f1' } },
      { id: 'ruzova', name: { cs: 'Růžová', en: 'Pink' }, vars: { '--brand': '#ff9fc0', '--brand-ink': '#121211', '--paper': '#faf6f4' } },
      { id: 'zelena', name: { cs: 'Zelená', en: 'Green' }, vars: { '--brand': '#7fe8a4', '--brand-ink': '#121211', '--paper': '#f6f8f3' } },
    ],
  },
  {
    // The page as a conversation: each section opens with the visitor's question in a speech bubble; soft, rounded, warm.
    id: 'rozhovor',
    name: { cs: 'Rozhovor', en: 'Conversation' },
    presets: [
      { id: 'rajce', name: { cs: 'Rajče', en: 'Tomato' }, vars: { '--brand': '#b83a22', '--brand-ink': '#fff6ee', '--paper': '#f6e9df', '--tint': '#eed7c9', '--card': '#fffaf4', '--ink': '#22312a', '--body': '#3a4840', '--quiet': '#566058' } },
      { id: 'svestka', name: { cs: 'Švestka', en: 'Plum' }, vars: { '--brand': '#6d2f5e', '--brand-ink': '#fdf3f8', '--paper': '#f3e8ec', '--tint': '#e6d4dd', '--card': '#fffafb', '--ink': '#2a1f2d', '--body': '#463b49', '--quiet': '#625668' } },
      { id: 'oliva', name: { cs: 'Oliva', en: 'Olive' }, vars: { '--brand': '#55622a', '--brand-ink': '#fbf9e9', '--paper': '#f3eedb', '--tint': '#e4dfc1', '--card': '#fffdf3', '--ink': '#26281a', '--body': '#40432f', '--quiet': '#5c5f48' } },
    ],
  },
])

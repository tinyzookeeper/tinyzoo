// The three looks of the Salon template, and each look's colours. The first look and each
// look's first colours are the defaults. Shown by: cms.config.ts (the two choices in Site
// settings), the website (the kit's layout) and the cloud's template registry
// (cloud/shared/templates.ts lists the same ids: a unit spec keeps them equal).
//
// A preset sets the look's own CSS variables; the look's stylesheet
// (app/assets/css/<look>.css) holds the first preset's values as its defaults.
import { defineLooks } from 'tinyzoo-template-kit/looks'

export const looks = defineLooks([
  {
    // The salon mirror in daylight: cool paper, photographs in oval mirrors, services timed on small clock faces.
    id: 'zrcadlo',
    button: 'btn btn-brand',
    name: { cs: 'Zrcadlo', en: 'Mirror' },
    own: { against: ['--accent', '--body', '--brand-ink', '--paper', '--surface'] },
    presets: [
      { id: 'mlha', name: { cs: 'Mlha', en: 'Mist' }, vars: { '--paper': '#e6edf2', '--surface': '#f8fafc', '--ink': '#15233d', '--body': '#33405a', '--quiet': '#56627a', '--brand': '#24417d', '--brand-ink': '#ffffff', '--accent': '#f2b79c', '--line': '#c9d4de' } },
      { id: 'pudr', name: { cs: 'Pudr', en: 'Powder' }, vars: { '--paper': '#f3e3de', '--surface': '#fdf7f4', '--ink': '#3b1826', '--body': '#553340', '--quiet': '#75505c', '--brand': '#7c2b46', '--brand-ink': '#ffffff', '--accent': '#e8c27a', '--line': '#e0c5bd' } },
      { id: 'salvej', name: { cs: 'Šalvěj', en: 'Sage' }, vars: { '--paper': '#e4eadf', '--surface': '#f7f9f4', '--ink': '#1b2b22', '--body': '#38473e', '--quiet': '#56655b', '--brand': '#2c5a45', '--brand-ink': '#ffffff', '--accent': '#eebfa3', '--line': '#c7d2c2' } },
    ],
  },
  {
    // The black-and-white tiled salon floor: one loud colour, very wide lowercase type, square tiles.
    id: 'sachovnice',
    button: 'btn btn-ink',
    name: { cs: 'Šachovnice', en: 'Chessboard' },
    own: { calm: true, against: ['--brand-ink', '--ink', '--paper'], fixed: ['#ffffff'] },
    presets: [
      { id: 'malina', name: { cs: 'Malina', en: 'Raspberry' }, vars: { '--brand': '#ff6a98', '--brand-ink': '#141214', '--paper': '#fff5ea', '--ink': '#141214', '--soft': '#5a5357' } },
      { id: 'pistacie', name: { cs: 'Pistácie', en: 'Pistachio' }, vars: { '--brand': '#b9e27a', '--brand-ink': '#132016', '--paper': '#fbf8ea', '--ink': '#132016', '--soft': '#4d5a4f' } },
      { id: 'mandarinka', name: { cs: 'Mandarinka', en: 'Tangerine' }, vars: { '--brand': '#ff8a3c', '--brand-ink': '#1a130f', '--paper': '#fff6e6', '--ink': '#1a130f', '--soft': '#5c5049' } },
    ],
  },
  {
    // Lettering painted on the shop window: a dark green page, cream and brass sign-painter's type, enamel plates.
    id: 'vyloha',
    button: 'plate btn btn-cream',
    name: { cs: 'Výloha', en: 'Shop Window' },
    own: { main: '--glass', calm: true, against: ['--brass', '--cream'], fixed: ['#8a1c1c'] },
    presets: [
      { id: 'lahvova', name: { cs: 'Lahvová', en: 'Bottle green' }, vars: { '--glass': '#0f2b22', '--pane': '#17392d', '--cream': '#f3e9d2', '--brass': '#d3ab60', '--shade': '#06150f' } },
      { id: 'bordo', name: { cs: 'Bordó', en: 'Burgundy' }, vars: { '--glass': '#3b1118', '--pane': '#4b1921', '--cream': '#f6e8d6', '--brass': '#e0b06a', '--shade': '#1c0509' } },
      { id: 'inkoust', name: { cs: 'Inkoust', en: 'Ink' }, vars: { '--glass': '#131d35', '--pane': '#1c2946', '--cream': '#efe7d8', '--brass': '#d6b072', '--shade': '#070c19' } },
    ],
  },
])

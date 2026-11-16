// Draws the starter's demo pictures (packages/cms/starter/seed/media): flat shapes in a
// warm palette, generated here, so they carry no licence and no client data. Small on
// purpose (the whole folder is well under 150 kB). Run it only to change them:
//
//   node scripts/make-starter-media.mjs
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const sharp = createRequire(join(root, 'packages/cms/package.json'))('sharp')
const out = join(root, 'packages/cms/starter/seed/media')
mkdirSync(out, { recursive: true })

const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)
const jpg = (name, w, h, body) => sharp(svg(w, h, body)).jpeg({ quality: 72, mozjpeg: true }).toFile(join(out, name))
const sky = (id, a, b) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`

// A warm landscape: sun and three hills (the home page).
await jpg('hero.jpg', 1600, 900, `${sky('s', '#f6d9b8', '#fbefe0')}
<rect width="1600" height="900" fill="url(#s)"/>
<circle cx="1130" cy="330" r="150" fill="#f2a65a"/>
<path d="M0 640 C260 520 520 560 800 620 S1340 700 1600 600 V900 H0Z" fill="#d9a066"/>
<path d="M0 720 C300 640 600 700 900 740 S1400 780 1600 710 V900 H0Z" fill="#b97a4a"/>
<path d="M0 810 C320 760 700 800 1000 830 S1450 850 1600 810 V900 H0Z" fill="#8a5233"/>`)

// Arched windows and round loaves (the about page).
await jpg('about.jpg', 1200, 800, `<rect width="1200" height="800" fill="#f3e3cf"/>
<rect x="195" y="120" width="230" height="440" rx="115" fill="#7fa7a0"/>
<rect x="485" y="120" width="230" height="440" rx="115" fill="#e7b98a"/>
<rect x="775" y="120" width="230" height="440" rx="115" fill="#c9805a"/>
<rect x="0" y="560" width="1200" height="240" fill="#8a5233"/>
<circle cx="345" cy="640" r="70" fill="#e6b676"/><circle cx="555" cy="660" r="56" fill="#d9a066"/>
<circle cx="785" cy="645" r="66" fill="#f0c88d"/><circle cx="1015" cy="660" r="54" fill="#d9a066"/>`)

// Stripes like the scoring on a loaf (a news item).
await jpg('news-bread.jpg', 1200, 800, `<rect width="1200" height="800" fill="#f6ead9"/>
<ellipse cx="600" cy="430" rx="430" ry="250" fill="#c98f55"/>
<ellipse cx="600" cy="400" rx="400" ry="215" fill="#dfa76a"/>
<g stroke="#f6ead9" stroke-width="22" stroke-linecap="round"><path d="M360 330 L440 460"/><path d="M500 300 L580 450"/><path d="M640 300 L720 450"/><path d="M780 330 L860 460"/></g>`)

// A sunrise over water (a second news item).
await jpg('news-morning.jpg', 1200, 800, `${sky('m', '#9fc5c0', '#f3e3cf')}
<rect width="1200" height="800" fill="url(#m)"/>
<circle cx="600" cy="470" r="190" fill="#f2a65a"/>
<rect x="0" y="470" width="1200" height="330" fill="#6e9690"/>
<g fill="#f6d9b8"><rect x="430" y="520" width="340" height="14" rx="7"/><rect x="480" y="570" width="240" height="14" rx="7"/><rect x="530" y="620" width="140" height="14" rx="7"/></g>`)

// The mark in the header (a PNG: the library does not take SVG, which can carry scripts).
await sharp(svg(192, 192, `<circle cx="96" cy="96" r="92" fill="#8a5233"/><path d="M52 150 V92 a44 44 0 0 1 88 0 V150Z" fill="#f6d9b8"/><circle cx="96" cy="112" r="20" fill="#f2a65a"/>`))
  .png({ compressionLevel: 9 }).toFile(join(out, 'logo.png'))
console.log('✓ pictures drawn in', out)

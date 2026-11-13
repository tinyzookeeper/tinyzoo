# tinyzoo brand guide

**Status:** working draft v0.1, 2026-11-13. Built together round by round. Sections marked **Open** aren't decided yet.

| Round | Topic | State |
|---|---|---|
| 1 | Foundations: what tinyzoo is, audience, personality, name | Drafted, waiting for feedback |
| 1 | Logo | Decided |
| 2 | Visual system: colour, type, characters | Open (working values below) |
| 3 | Voice and applications: website, admin, docs | Open |

---

## 1. What tinyzoo is

**One line (draft):** *A tiny CMS that lives inside your Nuxt app.*

Alternatives under consideration:
- *Content, without another server.*
- *A small CMS for Nuxt, with room for a whole zoo.*

**Description:** tinyzoo is a code-first CMS for Nuxt. Developers describe their content once in TypeScript, and tinyzoo generates a friendly admin where clients look after it. There's no extra server, no second deploy and no separate database: it installs as one package and runs inside the app it serves.

**What makes it different**
- **It lives in your app.** It shares the app's database, login and deploy. Directus or Strapi run as a separate service you have to host and keep in sync.
- **Your content model is code.** Entities are declared once in `cms.config.ts`. They're typed, in git, and reviewed like the rest of the project.
- **Clients get a calm, simple admin.** It's generated from that model, so there's nothing to build and nothing extra to learn.

**Product facts the brand relies on**
- It ships as one npm package that is both a Nuxt Layer and a Nuxt Module. A host app adds it with `extends: [...]`.
- Stack: Nuxt 4, Tailwind 4, Nuxt UI v4, Zod, Drizzle. It runs on Node.
- Distribution: internal (used on our own client projects) for now; commercial later if it succeeds.

## 2. Who it's for

| Audience | Role | What they care about |
|---|---|---|
| **Developers** | Choose it, install it, define the content | Type safety, simplicity, no extra infrastructure |
| **Marketers and editors** | Write and publish content in the admin | Clarity, speed, not breaking anything |
| **Small business owners** | Run their own site's content | Calm, obvious, nothing technical in sight |

**The first touchpoint is the marketing website.** It speaks to developers first, with their clients as the reason it matters (e.g. "…and your clients will actually enjoy editing"). *Open: confirm, or lead with agencies and small businesses instead.*

## 3. Personality: playful, calm, simple

The product is calm, and the animals bring the play.

| Trait | What it means | Where it shows | What it isn't |
|---|---|---|---|
| **Playful** | Warm and a bit witty, never silly | The animals; small moments such as empty states, success messages and the occasional wordplay | Jokes in error messages, cartoon overload |
| **Calm** | Quiet confidence, no hype | Interfaces, colour (charcoal and cream), plain language | Corporate, cold, "enterprise-grade" talk |
| **Simple** | Small, light, obvious | Short sentences, few elements, generous space | Dumbed down or vague |

## 4. Name

- Always **tinyzoo**: one word, all lowercase, including at the start of a sentence. Where possible, rephrase so a sentence doesn't start with it.
- Never "TinyZoo", "Tiny Zoo", "Tinyzoo" or "TINYZOO".
- The npm package name matches the brand name.

## 5. Logo (decided)

The logo is the mascot next to the "tinyzoo" wordmark. **There's no tile or rounded square.**

**Construction**
| Rule | Value |
|---|---|
| Mascot height | Full text height, from the top of "t" to the bottom of "y" (1.71 × the lowercase letter height) |
| Mascot position | Base sits 6% of the text height **below** the text baseline (optical correction) |
| Gap, mascot to text | 0.55 × the lowercase letter height |
| Mascot direction | Pupils look up and to the right, toward the name |

**Versions**
| File | Use |
|---|---|
| `logo/logo-primary.svg` | Default, on light backgrounds |
| `logo/logo-primary-reversed.svg` | On dark backgrounds: cream mascot and text, charcoal eyes, cream pupils |
| `logo/mascot.svg` | The mascot alone (avatars, favicon, small spaces) |
| `logo/wordmark.svg` | The text alone, where the mascot is already present nearby |

**Colours in the logo:** the mascot is charcoal `#2E3035` and the text near-black `#131313`. The difference is intentional.

**Square formats** (favicon, social avatar, app stores): use the mascot centred on a cream or charcoal background and let the platform apply its own shape. Don't add a tile to the logo.

*Open:* minimum clear space, minimum size, a stacked version (mascot above text) for square spaces, and misuse examples.

### Mascot geometry
The mascot is built from exact shapes. Units are relative to an eye radius of 90.

| Part | Geometry |
|---|---|
| Head | 580 wide; a slightly squared dome (Bezier handles 0.59) on a short straight base, bottom corners r 88 |
| Ears | Circles r 84, centres (±148.5, −216), merged with the head |
| Eyes | Circles r 90, centres (±102, −48.5) |
| Pupils | Circles r 30, offset (+42, −33.5) from each eye centre |
| Overall | 580 × 404 |

## 6. Colour (Open: round 2)

Working values only. The whole palette will be revisited once the full brand is visible.

| Role | Value | Note |
|---|---|---|
| Mascot / brand charcoal | `#2E3035` | Placeholder, chosen "for now" |
| Ink (text) | `#131313` | |
| Cream (backgrounds, eye whites) | `#F9F5EF` | |
| Former brand purple | `#49499F` | Dropped from the logo; may return as an accent |

Proposed direction to test: **a neutral core (charcoal, ink, cream), with the animals bringing all the colour.**

The characters exist in two colour sets:
- **Bright:** bunny `#FE9B76`, bird `#FEBD3B`, fox `#FD6D61`, frog `#73C573`, octopus `#66CCC6`, elephant `#67B1F9`
- **Muted:** 26 softer tones, one per character (see the SVGs)

*Open:* which set leads, colour roles (accent, UI states), and contrast rules.

## 7. Typography (Open: round 2)

- **Working choice:** **Manrope**. It's the closest free match to the wordmark: flat-topped "t", straight "y", round "o". It's free on Google Fonts.
- Wordmark setting: Manrope ExtraBold, tracking −15.
- For labels and UI: Manrope SemiBold (600), or Figtree 600 as an alternative.

*Open:* the type scale, the body text face, and a code/monospace face for the developer docs.

## 8. Characters

There are 32 animal characters in two sets. They're redrawn as clean vectors at a shared scale.
- **Bright (6):** bunny, bird, fox, frog, octopus, elephant
- **Muted (26):** bee, bird, butterfly, chick, cow, deer, duck, elephant, fox, hedgehog, koala, ladybug, lion, mouse, octopus, owl, panda, penguin, pig, poodle, raccoon, seal, sheep, snail, turtle, whale

**Shared rules (every character)**
- One flat body colour, cream eye whites and pupils in the body colour. No outlines, gradients or shading.
- The same eyes on every character, so the family reads as one:
  - eye radius = 60 units
  - eye centres 2.16 × eye radius apart, level with each other
  - pupils 0.30 × eye radius, offset (+0.44, −0.405) × eye radius: everyone looks up and to the right
- Characters drawn symmetrically are exactly symmetric. Elephant, whale, duck, hedgehog and chick are asymmetric by design.

*Open:* what the animals mean in the product (decide later), how they're used on the website and in the admin, and rules for drawing new animals.

## 9. Assets (`tinyzoo-svg.zip`)

```
logo/
  logo-primary.svg            mascot + wordmark, light backgrounds
  logo-primary-reversed.svg   mascot + wordmark, dark backgrounds
  mascot.svg                  mascot alone
  wordmark.svg                "tinyzoo" text alone
characters/
  bright/   6 SVGs
  muted/    26 SVGs
tinyzoo-brand-guide.md        this document
```

## 10. Next steps

1. **Round 1 feedback:** one-liner, who the website leads with, personality table.
2. **Round 2:** colour palette and roles, type scale, how characters are used, logo clear space and minimum size.
3. **Round 3:** voice and tone with examples, and how the brand looks on the marketing website, in the admin and in the docs.

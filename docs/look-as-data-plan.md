# Colours and type as data: the detailed design of step 4

**Status (2026-11-25):** the design, and since then the build of its first part: an owner's own main colour is built on the branch `feat/look-as-data`, local only, not released (section 13). Typefaces are designed here and not built. It is step 4 of `docs/one-app-plan.md` (part 1 point 7, and 2.11 level 2) and builds on steps 1 to 3. Every number here was counted on this branch (`feat/look-as-data`, cut from `main` with step 3 in); section 3 says how. The points marked **(owner)** are decisions that are the owner's; each has my pick, an example and the other choices. The design below is as it was written before the build, corrected where the build showed otherwise.

**Words.** A *look* is one of a template's designs (`atelier`). A *preset* is one of a look's colour palettes (`bronz`): a list of CSS variables and their colours. The *main colour* is the one variable of a look's presets that carries the site's identity: `--brand` in 45 looks. A colour *follows* the main colour when its hue changes with it. A *type set* is two typefaces that go together, one for headings and one for text.

---

## 1. The short read

1. **An owner gives one colour, their own main colour, and the look makes a palette from it.** They start from one of the look's three presets, as today, and add their colour. That works in all 52 looks, without changing one line of a look's stylesheet.
2. **The colour is the owner's, the light and dark are the look's.** The main colour keeps the owner's hue and saturation (in the 13 looks where it fills much of the screen, only as much saturation as the look's own presets have). Some of the other colours follow it (a tinted background, a dark text with a hint of the brand), some stay (a second accent, the seasons of the Association look). Which ones follow is read from the look's own three presets, not written by hand.
3. **What was readable stays readable.** If the owner's colour is too light for the white text of a button, it is shown a little darker, in the same hue. An ordinary company colour is shown as given, or with a change the eye barely sees, in 56 % of the presets, and in 63 % when the owner picks the best of the look's three presets. In the other cases it is lighter, darker or calmer, never another hue. Over 156 presets and 43 test colours, no pair of colours that the look puts together stopped being readable; on the real pages of all 52 looks, no text fell under the mark for large text.
4. **A site that sets nothing renders as before,** to the pixel. The pictures of all 52 looks prove it (section 13).
5. **It is ordinary content,** one optional field in Site settings (`ownColor`), beside `look` and `colors`. The live preview beside the form shows the change before it is saved, as it does for the look today. No new table, no new way of loading, nothing in the site's memory.
6. **Typefaces come second, as a small set of type sets,** and only for looks that take them. The 89 families of the build cannot be offered: each is in the build only in the weights its own look needs (section 8).
7. **Corners and spacing are not part of step 4.** No look has a variable for either (295 corner declarations with 48 different values, none through a variable). Making them data means editing every look, and section spacing belongs to step 5 (section 9).
8. **It is for hosted websites.** Looks exist only in the template kit, and the kit is not in the npm package. `packages/cms` does not change.

**What differs from the plan.**

| The plan said | What holds |
|---|---|
| "An owner changes colours, typefaces, corners and spacing" (2.11, level 2) | Colours in every look. Typefaces in some looks, from a small set. Corners and spacing in none without rewriting the looks; spacing belongs to step 5 |
| "A look's colour presets are already close to data" (2.11) | True, and more useful than it sounds: the three presets of a look are also the only evidence of how its colours belong together. The rules of an own palette are read from them |
| The build has 89 typefaces (2.3, 2.17), so a typeface can be chosen at run time | 54 of the 89 are in the build as one to five fixed weights, and the looks ask for weights from 300 to 900. A look's typeface is not a choice for another look. A type set is a new, small list of families with every weight |
| The looks share tokens (2.11; corrected by step 2) | Still none. Counted again: no variable is in all 52 stylesheets, and no preset variable is in all 52 looks |

## 2. Who this is for

The owner of a hosted website. They have a logo and a company colour, and the three presets of their look are close but not theirs. Today they need a developer, and a developer cannot help either: the presets are code in a shared app.

Not for a developer's own site. Such a site has no looks; its styles are the developer's own, and a colour field (`f.color()`) in its settings already does there what this step does here.

## 3. What was counted

Counted over the 20 hosted templates on this branch with three small scripts (they read `templates/*/looks.ts`, the looks' stylesheets and components; nothing is built or run).

**Looks and presets.** 52 looks in 20 templates. Every look has exactly 3 presets. In every look the three presets set the same variables, and every preset variable is declared in the look's stylesheet. All 156 presets hold only plain colours (`#rrggbb`).

**No shared variable.** A preset sets 3 to 13 variables (most often 5 or 6). 95 different names are used. By the number of looks whose presets set them: `--brand` 45, `--brand-ink` 42, `--ink` 34, `--paper` 28, `--tint` 22, `--line` 19, `--quiet` 15; 62 names are in one look only (`--wood-hi`, `--dawn`, `--k3`). In the stylesheets, 132 different variables are declared and none is in all 52: `--font-sans` 50, `--brand` 45, `--ink` 45, `--brand-ink` 44, `--font-display` 43, `--paper` 35, `--line` 25.

**Colours outside the presets.** A look declares 5 to 16 colour variables with a plain value (8 on average); on average 1.3 of them are in no preset, so they are the same in all three (Ateliér's `--ink`, `--body`, `--quiet`). 14 looks derive further colours from the others (`color-mix`); those follow by themselves. 263 colours are written as plain values outside any variable (4 per look in the middle; 9 looks have none), and 19 looks use 151 fixed utility classes (`text-white`, `bg-black`). An owner's colour never reaches those. They are shadows, error red, text on photographs: not the palette.

**The main colour.** 45 looks have `--brand`. The other seven carry their identity in another variable: `--accent` (Rozsvíceno), `--led` (Časomíra), `--c1` (Soutisk), `--rail` (Regál), and three looks where it is the colour of the whole page: `--paper` (Modrotisk), `--glass` (Výloha), `--wood` (Portál).

**Typefaces.** 89 families. 35 are asked from Google as a range of weights, mostly a narrow one (400 to 700); 54 as one to five fixed weights. 16 families are in more than one template. A look has two font variables (40 looks), three (10), one (1) or four (1). 9 looks have no `--font-display` and 2 have no `--font-sans`. The looks' stylesheets set a weight 551 times (600, 700, 500, 800 most often; 300 and 900 too) and the components 1 709 times. 5 looks set the width of a face (`font-stretch`, 62 % to 150 %). The looks hold 723 font sizes and 243 letter spacings in their stylesheets, and 5 381 sizes, spacings and line heights written by hand in their components. A look is tuned to its typefaces.

**Corners.** 295 `border-radius` declarations in the stylesheets, 48 different values, not one through a variable. The most frequent are pills and circles (`999px` 72 times, `50%` 18, `99px` 12), then `6px` 23, `0` 22, `4px` 18. 32 looks use 710 `rounded-…` classes in their components; 20 looks use none.

**Spacing.** No look has a spacing variable.

## 4. What is data and what stays code

| | Data (the owner's) | Code (the look's) |
|---|---|---|
| Which look, which preset | as today (`look`, `colors`) | the looks and presets themselves |
| The main colour | `ownColor`, one colour | which variable it is; its allowed lightness |
| The other colours | nothing | whether each follows or stays; what must stay readable |
| Typefaces | `typeSet`, one id from a list (second part) | the list; which looks take it; which variable is headings and which is text |
| Corners, spacing, sizes, layout | nothing | everything |

The owner does not choose each colour of the palette. A look has 3 to 13 of them, with names such as `--wood-hi` and `--brand-3`; thirteen pickers are where a site becomes ugly, and a list of colours that differs with every look cannot be explained to an owner **(owner, decision 1)**.

## 5. Colours: the rules

The rules are one file without imports, `templates/kit/palette.ts`, so the server, the browser and the tests run the same code.

**5.1 The main colour.** A look names its main variable (`own.main` in `looks.ts`); left out, it is `--brand`, else `--accent`. Seven looks name theirs (section 3).

**5.2 Which colours follow: read from the presets.** For every other variable of a look, the question is asked of the look's own presets: from preset A to preset B, did this colour's hue turn as the main colour's hue turned, or did it stay? Both guesses are made (with B's lightness and saturation, so only the hue is asked about) and compared with what the designer chose in B. A colour *follows* when "turned" comes at least twice as near as "stayed", over the six ordered pairs of presets. A colour that is the same in all three presets stays. So does a grey, and a colour the presets are unclear about.

Example, Photographer's Zápisník. Its presets are Ink (blue), Fir (green) and Plum. The text colour `--ink` is `#181d2a` with Ink and `#19211d` with Fir: a near black with a hint of the brand. It follows. `--brand-ink` is white in all three. It stays.

Example, Association's Čtvero dob. `--zima`, `--jaro`, `--léto`, `--podzim` are the four seasons and the same in all presets. They stay, whatever the owner's colour.

Counted: of 298 variables besides the main one, 106 follow, 38 are the same in all three presets, and 154 stay. Colours that stay include every second accent (`--accent` beside `--brand` in Katastr and Zrcadlo, `--sun`, `--pop`, `--signal`, `--brass`). A unit spec holds the list for all 52 looks, so a change of a preset that changes it is seen.

How good the guess is: starting from preset A with preset B's main colour, the derived colours were compared with the designer's own B (1 788 values). The middle distance is 1.7 (on a scale where about 2 is just visible), against 2.2 when nothing but the main colour changes.

A look can overrule what was read (`own.follows`). None does today.

**5.3 What a colour that follows does.** It turns its hue by as much as the main colour turned, and keeps its own lightness and saturation. When the owner's colour is a grey or black, the colours that follow lose their colour too (a black brand gets neutral backgrounds, not brown ones).

**5.4 What stays readable.** Two colours are *put together* when the look writes one on the other. A script reads that from the look's own stylesheet and components (`templates/kit/scripts/look-pairs.mjs`):

- a colour written on the main colour (`background: var(--brand); color: var(--brand-ink)`, or `bg-brand text-brand-ink` on one element);
- the page's own text colour, where something is filled with the main colour and sets no text colour of its own (it shows the text it inherits);
- a background directly under text in the main colour;
- the page's own background, when the look uses the main colour for text anywhere, and with it every background of the look that is nearly as light (or as dark) as the page: a tinted section, a card. A dark footer on a light page is not one of them;
- and where the main colour *is* the page's background (5.5), every text that has no background of its own.

The result is kept in `looks.ts` (`own.against`: the preset variables; `own.fixed`: colours of the stylesheet that are in no preset, such as a white page). A unit spec runs the script and fails when `looks.ts` no longer says what the code says.

The script reads one rule and one element at a time. It does not see a text whose background is set on an element around it (unless that background is one of the page's surfaces), a colour set through a bound style, or classes chosen in script. A second script asks the browser instead (`templates/app/scripts/own-contrast.mjs`): it opens each look's home page from a built server, measures every text against the background the page really draws behind it, with the preset and with an own colour, and lists the texts that crossed a mark, by the names of the preset's variables. What it finds and the first script cannot see, a look lists by hand (`own.also`). Three looks do: Lhůty (two light texts inside a brand-coloured band), Šanony (the brand as text on the dark footer) and Po slunci (the sun-coloured label on the brand).

For each such pair the rule is: a pair that had the contrast of body text (4.5 to 1, as WCAG counts) keeps 4.5; a pair that had the contrast of large text and buttons (3 to 1) keeps 3. When the owner's colour does not keep them, it is shown at the nearest lightness that does, with the same hue and saturation. When no lightness does (rare: a colour between two texts), the one that comes closest.

Example. Ateliér with the preset Bronze has white text on brand-coloured buttons. The owner gives `#f59e0b`, a light amber. White on it has a contrast of 2.1, so it is shown as a darker amber, `#965f00`, where white has 4.5 and the amber itself has 4.5 on the tinted sections. On Negativ with the preset Brass, a black page with a light brand, the same amber is shown exactly as given.

The colours that follow get the same care against every colour they were readable against.

**Counted.** 16 ordinary company colours (dark and middle tones of every hue, two light ones, black) on all 156 presets, 2 496 palettes: shown exactly as given in 42 %, with a change the eye barely sees in 14 %, clearly lighter, darker or calmer in 44 %. With the best of a look's three presets: 52 %, 11 % and 37 %. The clear changes are light colours on light looks and dark colours on dark looks, where the look writes text on the main colour or the main colour as text, and loud colours on the 13 calm looks (5.5).

How strict the rule is was counted in three steps **(owner, decision 2)**:

| The main colour is kept readable against | Shown exactly | With the best preset |
|---|---|---|
| only the text written on it, and the page | 58 % | 64 % |
| also the page's tinted surfaces and inherited text (built) | 46 % | 57 % |
| every background the look has (a prototype) | about 40 % | about 52 % |

(The first two rows are before the calm looks and the three hand-written lists, which take about 5 points more: 42 % and 52 % as built.) The first row left texts in the main colour on tinted sections just under the mark on the real pages. The last one changes a plain blue on 84 of 156 presets, mostly to protect pairs nobody ever sees.

43 hard test colours (twelve hues, each dark, light and greyish, black, white, grey and the four loudest screen colours) on all 156 presets, 6 708 palettes: no pair that the look puts together is under its mark, and the hue of a main colour that was changed moved by 2° at most.

On the real pages (52 looks, each look's home page, four colours: a green, a light amber, a blue and near black; 52 896 texts measured): 189 of 208 pages have no text across a mark. On 19 pages, in 8 looks, 60 texts crossed the mark for body text and stayed above the mark for large text (the lowest is 3.1). All of them are texts that the look itself shows faded on the main colour (`opacity-80` on a brand-coloured band): the pair keeps 4.5, the faded text had more room in the preset than it has now. Room for them was counted and left out: keeping 5.5 for every such pair shows a company colour exactly in 30 % of the presets, not 46 %.

**5.5 Where the main colour fills the screen.** Measured on the first screen of every look's home page: in 13 looks the main colour fills a tenth of it or more (the whole page in Modrotisk, Výloha and Portál; a hero panel or a band in Cedule, Talíř, Tabule, Zvýrazňovač, Šachovnice, Reflex, Magnety, Vizitka, Dres and Regál). In 33 looks it fills under 3 %: buttons, links, small marks. A loud colour on a button is the owner's colour. A loud colour on half the screen is another look. So in those 13 looks the main colour takes no more saturation than the look's own presets have (`own.calm`); the hue is the owner's. Where the presets are loud themselves (Cedule, Šachovnice), that changes nothing. Where they are quiet (Vizitka, Výloha), a loud blue is shown as a quiet blue.

**5.6 The same input, the same palette.** A site stores the owner's colour, not the palette. The palette is worked out when a page is drawn (a few hundred small sums; section 6). A preset with its own main colour gives the preset back, value for value: checked for all 156. A change of these rules would change the colours of live sites, so a unit spec holds the palettes of every preset for a set of colours, and a change must be made on purpose.

## 6. Where it is stored and how it reaches the page

**How a preset reaches the page today.** One path, and it is the seam:

1. Site settings hold `look` and `colors` (two choice fields of the design's part of the model, in each template's `cms.config.ts`).
2. The website reads the settings once per page (`useSite()`, `/api/content/_global/siteSettings`). In the admin's preview the editor's unsaved values are laid over them (`?preview`).
3. `looks.resolve(look, colors)` (`templates/kit/looks.ts`) answers with the look, the preset and the preset as one inline style.
4. `useLookHead()` writes them onto the page: `<html data-design data-look data-colors style="--brand:#7a5a3a;…">`, and links the look's stylesheet.

Nothing else reads a preset. No stylesheet has a rule for `data-colors`.

**With an own colour.** The same path with one more value:

1. Site settings get `ownColor`, an optional colour (`f.color().optional()`, which the engine has).
2. `useSite()` hands it to `looks.resolve(look, colors, { color })`.
3. `resolve` gives the preset's variables to `ownPalette()` and writes the result as the inline style. With no colour it does not call it, and the style is the same string as today.
4. `useLookHead()` is unchanged, but for one attribute: `data-own` on `<html>` when an own colour is shown (its value is the colour as shown), so a test and a support person can see it.

The server draws the page with the palette in the first answer; there is no flash of the preset.

**Why ordinary content, and not the care of the model (step 2).** A site's model is held in the site's memory and a change retires it, because code and tables depend on its shape. Nothing depends on the shape of a colour. It is read with the settings that are read for every page anyway, it has versions and an undo like every content, the preview's unsaved values work for it without a line of new code, and a mistake costs one more save. So: a field, not a document.

**The cost.** One optional column in `site_settings` of each of the 20 templates: 20 small migrations, the first second migration the templates get. The templates take the field's label and help from the kit (`OWN_COLOR_FIELD` in `looks.ts`), so the text is written once.

**Speed.** The palette is worked out once per page view on the server and once in the browser. Measured: under a tenth of a millisecond.

**A site made before.** The column comes with a migration (`0001_own_color`). The cloud's drivers start the app with `NUXT_CMS_MIGRATIONS_ON_START=true`, so a site's database gets the column when the new build starts, before a visitor comes; a site the start has not reached yet gets it at its first request, and pages wait for that. Tried with two sites made by the build before: both got the column at the start and kept every row.

## 7. The admin's screen

Site settings, section *Name and look*, in this order: Look, Colours, **Own colour**, as one more row. The control is the engine's colour field: a swatch that opens the system's colour picker, the code beside it, and a cross to remove the colour. Like every optional field that is empty, it waits behind a small "+ Own colour" until the owner wants it. Nothing new to learn, and it works at 390 pixels, light and dark.

- Label: *Own colour* / *Vlastní barva*. (A template's own texts are in Czech and English, as its other fields are; the engine's admin texts are in three languages.)
- Help: *Give your own main colour. The other colours of the palette follow it. A colour that would make texts hard to read, or that is too loud for a large area, is shown a little lighter, darker or calmer.*
- The home page beside the form shows the site in the new colour while the owner types or drags the picker.
- When the colour is shown visibly other than given, the preview says so in one line at the bottom of the window, for the editor only: *Your colour #f59e0b is shown as #965f00 on this look, so that the page stays readable and calm.* A change the eye does not see gets no line. A published page never carries it, and neither does an address a visitor adds `?preview` to.
- The cross brings the preset back.

A change of look or preset keeps the colour: it is the owner's, not the preset's.

Later, not now: the palette as dots beside the field, and colours taken from the logo as suggestions. Both need a field editor of the kit's own, which the engine can only give by field type today.

## 8. Typefaces: the second part

**What cannot work.** Offering the 89 families. A family is in the build in the weights its own look needs: Jost as 400 and 500, Young Serif as 400. Another look asks for 700 and gets a faked bold. And many looks are built on a face with a special width or character (Archivo at 62 % of its width, Saira Extra Condensed, Doto, Courier Prime, Caveat; 5 looks set a face's width themselves): their sizes and line lengths hold only for that face.

**What works: type sets.** A small list in the kit (`templates/kit/type.ts`), about six sets. A set is two families from Google that have every weight in one file (a variable face, 100 or 200 to 900, with italics for a serif), so any weight a look asks for is real. The build downloads them with the others, into the same kept folder. Each set is a stylesheet of its own with its `@font-face` rules, linked only on the pages of a site that chose it, as a look's stylesheet is. A visitor downloads the faces of one set, and the look's own faces only where the look still uses them.

A look says which of its font variables is the heading and which is the text (`own.type: { heading: '--font-display', text: '--font-sans' }`; these two are the default). The page then carries `--font-display` and `--font-sans` inline, as it carries the colours. A look's third face (the handwriting of Zápisník, the mono of Negativ) stays.

**Which looks take it.** A look takes type sets only after its pictures with every set were looked at, and an automatic check found no text wider than its box and no page wider than the screen. The list starts empty and grows look by look. For the looks built on a special face it stays empty, and the admin shows no typeface choice there. So "typefaces as data" is true for some looks, and the design says which **(owner, decision 3)**.

**Data.** One more optional choice in Site settings, `typeSet`, shown only for looks that take it.

## 9. Corners and spacing: not in this step

**Corners.** There is nothing to hold on to: 295 declarations, 48 values, no variable. The way to make them data is a factor: every corner becomes `calc(<its value> * var(--tz-round, 1))`, pills and circles left alone, and the owner chooses sharp, as designed or rounder. That is a mechanical edit of 49 stylesheets and of the arbitrary values in 32 looks' components, and a new run of all pictures to prove nothing moved: about 2 to 3 days. It gives little: 20 looks are sharp by design and would show a choice that changes nothing. My pick is to leave it out **(owner, decision 4)**.

**Spacing.** No look has a token, and the space between sections is part of each section's layout. Step 5 gives sections their own spacing (2.11, level 3). Doing it here would grow step 4 into step 5.

**The generic blocks of step 2** read `--custom-radius`, `--custom-line` and `--custom-gap`, which no look sets, and take their colours from the page. They follow an own colour like everything else, with no change.

## 10. What an owner cannot break

- **Texts stay readable** (5.4). This is a rule of the palette, not a warning: there is no way to save around it.
- **Light stays light.** A look with a white page keeps a white page; only its tint may turn. An owner who wants a dark site chooses a dark preset or a dark look.
- **Only a colour gets onto the page.** The field takes `#rrggbb` and nothing else, the server checks it on every save, and the rules write only plain colours. No text of the owner's reaches a `style` attribute.
- **No layout moves.** A colour changes no size.
- **One click back.** The cross removes the colour and the preset is as before. The settings keep their versions.
- **Nothing is shared.** The colour is in the site's own database, like its other settings.

What an owner still can do: choose a colour that is not beautiful. A brown on a look made for a cool blue is readable and calm, and it is their brown.

## 11. For hosted websites only, and without a setting

**Hosted only (owner, decision 5).** Looks, presets and the kit exist only for the hosted templates. A developer's own site has none of them.

**No experimental setting (owner, decision 6).** The other experimental things of the one-app plan are off unless an environment setting switches them on, because they change a site's structure at run time. This does not: it is one optional field, and a site that leaves it empty is drawn exactly as before, which the pictures prove. A setting would also need something the engine does not have: a way to leave a field out of the admin's form. With the setting off, the owner would see a field that does nothing. Adding that way is an addition to the engine's public surface, for a risk the proof already covers.

What a setting would have guarded is 5.6: once live sites store a colour, the rules are a promise. No hosted site exists outside development machines, so the rules can still change until the pilot starts.

## 12. What is tested, and how

| What | How |
|---|---|
| The colour sums | Unit spec: known colours to OKLCH and back, contrast against known values, a colour no screen can show |
| A preset with its own main colour is the preset | Unit spec over all 156 presets |
| Nothing readable becomes unreadable | Unit spec: 156 presets × 43 colours, every pair above its mark |
| The rules do not change by accident | Unit spec: the palettes of every preset for a set of colours, held as a file |
| Which colours follow, in every look | Unit spec: the list for 52 looks, held as a file |
| `looks.ts` says what the code says | Unit spec: runs `look-pairs.mjs` and compares with `own.against` and `own.fixed` of every look |
| A site that sets nothing is as before | Unit spec: `resolve` with no colour returns the same style string as before, for all 156 presets. Pictures: all 376 of `shots.mjs` from this branch against `main`, compared with `compare-shots.mjs` (same seed day, fixed clock, one font folder, as 2.17 of the one-app plan says) |
| An own colour is drawn | `e2e:shared` gets a site with an own colour: `<html>` carries the palette and `data-own`, the look's stylesheet is unchanged. For the eye: `own-gallery.mjs` puts every look's first screen with its preset and with some own colours side by side on one page; `shots.mjs --own <colour>` takes all of a look's pictures with an own colour |
| Texts stay readable on the real pages | `own-contrast.mjs`: every text of every look's home page, measured in the browser with the preset and with own colours; it lists the texts that crossed a mark |
| What is not a colour is refused | `e2e:shared`: `red`, a short code and a code with CSS after it each get 422, and the saved colour stays |
| The admin | By hand in a real browser, light and dark, 1440 and 390 pixels |
| Migrations | A site made before this step gets its new column when the app starts with the new build, and keeps its content |

## 13. The order of work, and what is built

1. **The rules.** `palette.ts` and its specs; `look-pairs`; `own` in the 52 looks. *Built.*
2. **The path.** `resolve` with an own colour, `useSite`, `useLookHead`, the preview's line. *Built.*
3. **The field.** `ownColor` in the 20 templates' Site settings, 20 migrations, the generated clients. *Built.*
4. **The cloud.** Nothing to set. `e2e:shared` has a site with an own colour. *Built.*
5. **The pictures.** All looks against `main`; all looks with an own colour. *Taken; the numbers are below.*
6. **Typefaces,** after the owner's word on decision 3: the list of sets, the build, the path, the first looks. *Not built.*

**What is built** (branch `feat/look-as-data`, local commits, nothing pushed, released or deployed; `packages/cms` is unchanged):

- `templates/kit/palette.ts`: the colour sums and the rules of sections 5.1 to 5.6. No imports.
- `templates/kit/looks.ts`: a look's `own` (its main variable, what it puts together with it, `calm`), `looks.resolve(look, preset, { color })`, `looks.paletteRule(look)`, and the field's texts (`OWN_COLOR_FIELD`).
- `templates/kit/look-pairs.ts` and `templates/kit/scripts/look-pairs.mjs`: what each look puts together with its main colour, read from its stylesheet and components. `--write` puts it into the templates' `looks.ts`, `--check` fails when they differ, `--why` says where each pair was found.
- `own` in all 52 looks. Seven name their main variable, 13 are `calm`, three list pairs by hand (`also`).
- The website: `useSite()` hands the settings' `ownColor` to `resolve`; `useLookHead()` writes `data-own`; `SiteOwnNote.vue` is the preview's line, shown only where the server answered as to a signed-in editor.
- `ownColor` in the Site settings of all 20 templates, after Colours, with the migration `0001_own_color` (one `ADD COLUMN`), the schema and the generated client.
- `templates/app/scripts/own-contrast.mjs` (texts on the real pages), `own-gallery.mjs` (every look with its preset and own colours on one page) and `shots.mjs --own '#2f6f4f'` (all of a look's pictures with an own colour).

**Checks run** (a Postgres 16 of its own, one build at a time):

- Unit specs: `template-palette.spec.ts` (the sums; all 156 presets give themselves back; no colour gives the preset's own style string; 6 708 palettes with nothing readable lost; the hue; which colours follow and the palettes of four colours held as files; `looks.ts` against the code; the scan on a made-up template) and the kit's, the designs', the cloud's templates' and module state's specs.
- The type check of all 20 designs.
- `e2e:shared`: 126 checks, six of them new (no `data-own` and the preset's own style without a colour; the palette and `data-own` with one, the look's stylesheet unchanged; what is not a colour is refused; clearing it brings the preset back). With `CLOUD_CUSTOM_TYPES=on`: 142. `e2e` with Photographer, Salon and Wedding: 98.

**The pictures.** All 376 pictures of `shots.mjs` (every look of the 20 templates: the home page at 1440 and 390 pixels, its two other presets, its entry pages, its 404 page, its forms) were taken from the one app built from `main` (67e8fad8) and from this branch, with the same seed day, the browser's clock at one moment and one font folder, and compared with `compare-shots.mjs`. Twice, at two commits of the branch: 371 and 372 pictures identical to the pixel, the other 5 and 4 with 2 or 3 pixels differing inside a photograph (within the tolerance; which pictures show it changes from run to run, as 2.17 of the one-app plan found), none failing. The commits after the second run changed only the looks' `own` lines (read only when a site has an own colour) and the wording of the two texts an editor reads; the unit spec holds that a site without an own colour gets the preset's own style string.

With an own colour: `own-gallery.mjs` took the first screen of all 52 looks with the preset and with a green, a light amber and a blue (208 pictures on one page), and `own-contrast.mjs` measured the texts of all 52 home pages with four colours (5.4).

**Left open.**

- Typefaces (section 8) and the decisions of section 14.
- The owner sees that their colour is shown lighter or darker only in the preview beside the form, not in the form itself. A field editor of the kit's own would show the palette as dots and say it there; the engine gives a field editor by field type only.
- A text that a look shows faded on the main colour (8 looks) can fall under the mark for body text and stays above the mark for large text (5.4).
- `own-contrast.mjs` measures each look's home page. Entry pages and the other presets are not measured (`--presets all` measures the presets; it was not run).
- A new look, or a change to a look, needs `look-pairs.mjs --write` (a unit spec says so) and a run of `own-contrast.mjs` (nothing says so but this line).
- A fresh checkout's `templates:build` fails until each template has its `.nuxt` folder (`nuxt prepare` in each). Not part of this step; found on the way.

## 14. Decisions

Each is the owner's.

**Decided on 2026-11-25:** step 4 is merged as built. That is one own main colour (1), the readability rule as built (2), hosted only (5) and no setting (6). Typefaces (3), corners (4) and spacing are not built for the 52 looks: they wait for the website without a template (`docs/builder-plan.md`, 3.6), where they are data from the first line. Section 8 stays as the record of what was counted about typefaces.

1. **What an owner may change.** My pick: one main colour now; a type set from a small list next; corners and spacing not in this step.
2. **How strict the readability rule is.** My pick, as built: the colours a look really puts together, the page's tinted surfaces included, and a calm main colour where it fills the screen (42 % of company colours shown exactly, 56 % exactly or nearly). The other choices are in the table of 5.4: looser (58 %, and texts on tinted sections fall just under the mark) or stricter (about 40 % before the calm looks).
3. **Typefaces.** My pick: type sets, look by look, each look after its pictures were seen. The other choice: no typefaces in step 4.
4. **Corners.** My pick: leave out. The other choice: the factor, 2 to 3 days.
5. **Hosted only.** My pick: yes.
6. **A setting.** My pick: none (section 11). The other choice: a setting, with a small addition to the engine so that a field can be left out of the form.

## 15. Not explored

- Colours taken from the logo or a photograph as suggestions.
- A second colour of the owner's (an accent beside the brand).
- A dark and a light version of one site.
- What a type set does to the weight of a page (the files are known, their sizes on a real page are not measured).

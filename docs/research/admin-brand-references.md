# Admin brand references (Mobbin research)

Research date: 2026-11-13. Source: Mobbin (web). The earlier rounds ([admin-ux-references.md](admin-ux-references.md), [admin-ux-calm.md](admin-ux-calm.md)) settled **structure** in a neutral look. This round is about **brand personality**: how calm products for non-technical people feel friendly without clutter, and how warm neutrals behave in dark mode.

Already decided: charcoal `#2E3035` primary (likely cream in dark mode), animals only at moments (sign-in, home welcome, empty states, success, errors) and never as chrome, Manrope for titles and Inter for UI, light and dark both matter. Still open: how much cream shows.

All references are saved in the private Mobbin collection **"tinyzoo — brand-led admin"** ([open collection](https://mobbin.com/collections/0eac0a4e-10f0-4323-8126-660643cbdd04/mobile/screens?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp); switch to the *Web* tab). It holds 22 screens and 3 Ghost flows. Only you and your teammates can open it.

Hex values below were sampled from Mobbin's preview images, so treat them as ±3 per channel.

**Finding in one line:** the calm brands use three things: one warm canvas colour, one display typeface for greetings and moments, and a character that appears small and alone when something happens. Everything else stays neutral.

**Gap:** Mobbin has no dark-mode screens for Claude, Notion or Craft, and nothing from Things, Raycast or Arc on web. Ghost has a dark-mode toggle, but only its light screens are captured. The dark-mode section uses Tines, hilos, Substack, Voicenotes and Rive instead.

---

## 1. Sign-in

### References

- [Tines: sign in, light](https://mobbin.com/screens/f75f3937-f550-40b3-a741-69178046f729?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) and [dark](https://mobbin.com/screens/f5153942-5b46-45e5-9264-1d441dad1743?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). The canvas is cream `#FBF6F3` with a faint 1px grid. One small illustration (about 50×80px) sits centred above a display-serif heading, "Welcome back to Tines", and the form below is about 215px wide. There's no card. The dark version keeps the same layout and the same illustration on `#222126`, and a sun/moon toggle sits in the top-right corner. *Informs: sign-in, dark mode.*
- [Headspace: log in](https://mobbin.com/screens/bc611d45-2449-46b2-8bff-9bb263d4fbcf?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). A white form card sits on warm off-white `#F9F5F4`. The brand character (a sleeping sun) is placed **behind the card** at the bottom-left, about 40% hidden, so it reads as peeking out rather than decorating. [The error state](https://mobbin.com/screens/4c4b8e67-52f5-4143-adca-5b924acb13d0?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) uses one red line: "Either your email or password was incorrect. Please try again." *Informs: sign-in, errors.*
- [Mailchimp: log in](https://mobbin.com/screens/0bcc3065-02fb-477c-8ea9-809699c652cf?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). This is the restrained version. A warm-grey `#F6F6F4` canvas holds a white card with a hairline border and a serif "Log in" heading. The logo is only a ~24px mascot head in the top-left corner, plus a 4px brand-yellow strip down the left edge. The brand comes from type and one stripe, with no illustration at all. *Informs: sign-in (the fallback for a white-labelled client sign-in).*
- [hilos: sign in](https://mobbin.com/screens/4506805f-a978-493e-afba-ee6416f38cc4?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). **Counter-example.** A full-bleed wall of hundreds of animal characters fills the space behind a small card. It proves a family of characters reads as a brand instantly, but it's loud. It would suit a marketing page, not a tool someone opens every week. *Informs: sign-in (what to avoid).*

### Do

- Use a cream canvas with no card, or a very quiet one. Show **one** animal, either 96–120px tall above the heading (Tines) or peeking from behind the form's edge (Headspace).
- Keep the heading short and in Manrope ("Welcome back"). When the screen is white-labelled, the client's site name leads, the animal stays and "Powered by tinyzoo" sits small in the footer.
- Use the same layout and the same animal in dark mode, and only swap the canvas. Follow the system theme by default.
- Write plain-language errors in one line above the button.

### Don't

- Don't use a crowd of animals, a pattern background or a split screen with a big illustration panel (Gusto, Vanta, Remote). They all compete with a two-field form.

---

## 2. Home

### References

- [Claude: home](https://mobbin.com/screens/e8c0af18-6e3a-4273-93c1-935e958ff8b3?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). The whole canvas is cream `#FAF9F5`, and the sidebar is the same tone (`#F9F8F3`), separated only by a hairline. The **only white surface is the input card**. The greeting ("Welcome, Sam", or "Good morning, Sam" on other screens) is set in a display serif at about 32px, with the ~20px brand mark to its left. This is the clearest answer to "how much cream". *Informs: home, cream amount.*
- [Mailchimp: home](https://mobbin.com/screens/dd150d11-9cb3-4cc0-8bd3-f3ebbf9c7b6e?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). The welcome is one line: "**Welcome, Sam Lee!** Let's dive into your personalized setup guide.", with the name bold and the rest regular. Under it, a setup card holds accordion steps and a "1/3" progress ring. The illustration appears **only inside the open step**, on a mustard panel about a third of the card wide. The canvas is `#F6F6F4` and the cards are white. *Informs: home.*
- [Squarespace: home](https://mobbin.com/screens/3bfb5ae5-87d1-48fe-b4f6-d231c9b8a9bc?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). "Welcome, Alex" sits above "Get started" checklist groups with small progress bars ("2/7"). The right column holds a card with a screenshot of the user's own website, its URL and "Publish your site". **The client's site is the hero image**, not a brand illustration. *Informs: home.*

### Do

- Greet with a modest Manrope heading ("Welcome back, Jana"). Put the brand next to it as a small mark (≤ 24px), or show a larger welcome animal only on first sign-in or until setup is done.
- Add one "Your website" card with the site name, URL and "View website". A screenshot is optional.
- Show a setup checklist only while setup is unfinished, and put any illustration inside the active step, never across the page.

---

## 3. Collection list

### References

- [Etsy Pattern: blog posts](https://mobbin.com/screens/10b2de5c-5478-4b28-9d07-a2bca74f4591?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). A small "Blog" eyebrow sits above a friendly sentence title: "Share your wit, ideas and talent with the world". The canvas is cream `#FAF9F5`, and the table is one white card with a hairline border. "Draft" is a small grey pill after the title, and an unpublished post reads "Unpublished" in the date column instead of an empty cell. The row menu has "Preview post" and "Delete post". *Informs: list, cream amount.*
- [Mailchimp: all campaigns](https://mobbin.com/screens/f7c4ff31-404f-43c1-8e2c-63922f8de2c3?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). Each row ends in a **contextual verb**: "Finish setup" for an incomplete draft, "Edit" for a draft and "View report" for a sent campaign. The meta line is a sentence: "Last edited Tue, 16 July 2024 12:11 pm by Sam Lee". Status pills are soft tints (green Published, grey Draft, blue Active). *Informs: list.*
- [Ghost: adding a new post (flow)](https://mobbin.com/flows/01e07c88-8db4-46f8-8e9c-0a41a6acd594?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). In the posts list, rows read as sentences: the title, then "By Sam in News – a few seconds ago", then the status word "Published" in colour. Filters are plain-text dropdowns with no boxes ("All posts · All access · All authors · All tags · Newest first"), next to one dark "New post" button. *Informs: list.*

### Do

- Make the page title the collection name in Manrope. If the developer gives the collection a description in config, show it as one friendly sentence under the title (Etsy).
- Write row metadata as a short sentence ("Edited 2 h ago by Jana") and give each row one text action that fits its state ("Continue editing", "Edit").
- Keep the brand out of the list itself. It appears only when the list is empty (§5).

---

## 4. Editor and publishing

### References

- [Ghost: post editor](https://mobbin.com/screens/f7c6a46b-be2e-48a7-9ea3-c5332c5281f5?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). The top bar is text only. On the left: "‹ Posts" and a muted "Draft – Saved". On the right: "Preview" and "Publish" as text buttons, with Publish in the brand colour. Settings sit behind one sidebar icon, and a muted word count sits bottom-right. *Informs: editor.*
- [Ghost: publishing a post (flow)](https://mobbin.com/flows/e157643a-1be7-42a2-b91f-2e84ea4e503e?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). Publish opens a **full-page step, not a modal**. The heading is two lines at ~28px: "Ready, set, publish." in the brand colour, then "Share it with the world." in ink. The options are sentence rows ("Publish", "Right now") that expand into pill choices, "Set it live now" or "Schedule for later", and there's one button, "Continue, final review →". Once the post is live, the top bar reads "Published ↗ · Update · Unpublish". *Informs: editor, success.*
- [Ghost: writing a new post (flow)](https://mobbin.com/flows/e64486a5-d468-4167-9193-76ab7c5b90bf?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). Save state is text ("Saving…") next to the back link. After a save, the Save button turns green with "✓ Saved" for a moment and a small dark "Saved" toast appears. The empty posts list in the same flow has a line-drawn pencil, "Start creating content." and one button, "Write a new post". *Informs: editor, empty state.*
- [Substack: post editor](https://mobbin.com/screens/f7979122-bc8d-4237-a0ce-c5dc7e2a0adf?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). A "● Saved" pill sits top-left next to the back arrow. Top-right are "Preview" (grey) and **"Continue"** (brand orange) rather than "Publish", so the last step is always a review page. "⚙ Settings" is a **labelled** button bottom-right, with a history icon bottom-left. *Informs: editor.*
- [Mailchimp: campaign builder](https://mobbin.com/screens/f29427af-f13a-479b-925d-ccca3a8389ac?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). The header reads "Let's get started. [Draft] Edited on July 17th 4:51 am", with a "Finish later" link and a disabled "Start Sending". The body is a checklist of sections (Schedule, To, Content), each with a status icon and a verb button: "Edit Schedule", "Resolve", "Add Content". Problems are explained, not just flagged: "We couldn't find any mailing addresses for this audience. Here are a few common causes:". *Informs: editor (checks before publishing).*

### Do

- Use words for actions: "Preview", "Publish", "Settings", "Finish later". Keep icon-only buttons for secondary tools (history, collapse).
- Show save state as words next to the back link ("Saving…", "Saved", "Unsaved changes").
- Treat publishing as a brief moment with brand voice: one Manrope heading, a choice between now and later, then a success line (§5). Write any blocking problem as a plain sentence plus a fix button.

---

## 5. Empty, success and error moments

### References

- [Typeform: no brand kits yet](https://mobbin.com/screens/648d4700-8592-4be4-8b65-5931ac44fd17?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). One line-drawn dog, about 80px, is centred above "No brand kits here yet" and one playful sentence: "Create a new brand kit to liven the place up a little (and give this doggo something to sniff at)." Below it is one dark button, and the page header with "New brand kit" stays visible above. **This is the closest match to tinyzoo.** *Informs: empty state.*
- [Tally: no forms yet](https://mobbin.com/screens/0f2523c5-d61e-4384-a934-c169dbb1eaeb?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). A ~100px line illustration, "No forms yet", "Roll up your sleeves and let's get started. It's as simple as one-two-three." and one button. *Informs: empty state.*
- [Reddit: mod queue clean](https://mobbin.com/screens/5d488f32-5ac1-4848-ab01-6239e0041b80?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). "Queue is clean. Kitteh is pleased." The mascot (~90px) treats an empty list as **good news**, and the tabs stay above it. *Informs: empty state (the "all done" variant).*
- [Airtasker: listing published](https://mobbin.com/screens/a9593a57-06f0-4bac-8b5a-ff098f1aef91?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). A small paper-plane drawing (~50px), "Your listing has been published!", then "Woohoo! You are ready to start receiving bookings." A primary "View my listings" and a soft secondary "Create another listing" follow. There's no confetti and no modal. *Informs: success.*
- [Headspace: 404](https://mobbin.com/screens/f8e16f35-df5d-4f58-bdd2-cb93ce432ada?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). A ~60px character, "We all get lost sometimes", one sentence and one "Go back" button on a plain page. *Informs: errors.*
- [Rive: something went wrong (dark)](https://mobbin.com/screens/7c9797be-c1fc-432b-a251-d74b0e0f3728?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). A character lying flat, about a third of the screen wide, sits on `#282828` with the text on the left: "Oops, something went wrong!", plus Refresh and Report Issue. A saturated flat character reads very well on charcoal. *Informs: errors, dark mode.*

### Do

- Build each moment as one animal, a Manrope title, one sentence and at most two actions. Keep the page toolbar visible above empty states.
- Allow one playful sentence per moment (Typeform, Tally, Airtasker), and keep the title itself plain ("No news yet").
- Give a list where nothing is left to do its own variant ("Nothing waiting. The owl approves.").

### Don't

- Don't show an illustration for "no search results". Plain text with "Clear filters" is enough.
- Don't use confetti, full-screen celebration modals (GoDaddy, Zillow) or jokes in errors where the user may have lost work.

---

## 6. Warm dark mode

### References

- [hilos: docs in dark mode](https://mobbin.com/screens/bcddefee-b741-4ca9-b4fa-33d52ff02cf6?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). The darks are olive-tinted near-blacks: the sidebar is `#1E1E16` and the document area `#0C0D08`, with off-white text. This is the same brand that uses animals on its sign-in. Tinting every dark neutral toward one hue makes the theme feel warm without adding colour. *Informs: dark mode.*
- [Substack: home in dark mode](https://mobbin.com/screens/f719cb92-6fd5-4df6-8fa0-c70e0c7582d8?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). The page is `#17181A`, cards are `#1C1D1F` with hairline borders and completed steps are dimmed. The secondary "Continue setup" button is the brand orange at low opacity (fill ≈ `#462E22`, orange text) rather than solid, which keeps the brand present without glare. *Informs: dark mode, home.*
- [Voicenotes: notes in dark mode](https://mobbin.com/screens/5e5227fc-114a-42f8-a5a9-f263990c3bb8?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). On a `#1B1D1C` page, the one main action ("Record") is a **light pill with dark text**: the primary inverts in dark mode. *Informs: dark mode (cream primary).*
- Also: Tines dark sign-in (§1) for keeping illustrations unchanged on `#222126`, and Rive (§5) for coloured characters on `#282828`.

### What the numbers say

| Product | Light canvas | Dark page | Dark surface |
|---|---|---|---|
| Claude | `#FAF9F5` | (not on Mobbin) | |
| Etsy Pattern | `#FAF9F5` | | |
| Tines | `#FBF6F3` | `#222126` | |
| Headspace | `#F9F5F4` | | |
| komoot | `#F6F3EC` | | |
| Mailchimp | `#F6F6F4` (grey) | | |
| Substack | | `#17181A` | `#1C1D1F` |
| Rive | | `#282828` | |
| hilos | | `#0C0D08` | `#1E1E16` |
| **tinyzoo** | **`#F9F5EF`** | **≈ `#1E1F23` (proposed)** | **`#2E3035`** |

- Our cream `#F9F5EF` is warmer and more yellow than Claude's `#FAF9F5` and close to komoot's `#F6F3EC`. As a canvas behind white cards it will read clearly as cream, not off-white.
- Our charcoal `#2E3035` is **lighter than every dark page background here** (`#17181A`–`#282828`). It works as the raised surface (cards, sidebar, inputs), with a darker charcoal of the same blue-grey hue as the page.
- The charcoal mascot disappears on a charcoal surface. In dark mode, use the reversed (cream) mascot or a coloured animal.

---

## How much cream: three models

| Model | Seen in | Effect |
|---|---|---|
| **A.** Cream canvas and sidebar, white only for content surfaces | Claude, Etsy Pattern, Tines | Warm and branded everywhere, quiet because it's one tone |
| **B.** Grey canvas, white cards, brand only in type | Mailchimp | Neutral; the brand depends entirely on typography |
| **C.** White app, cream only at moments | Ghost, Typeform | Most neutral; the brand appears only when something happens |

**Recommendation: A.** Cream for the page and sidebar (one tone, hairline between them), and white for cards, tables, inputs and the editor's writing area, so photos and colours are judged against true white. This is also the most direct mirror of the dark theme: dark page, charcoal surfaces.

---

## What this means for tinyzoo

1. **Cream is the canvas, white is the work.** The page and sidebar are `#F9F5EF` (same tone, hairline separation). Cards, tables, inputs and the editor body are white. There is no third background colour.
2. **Dark mode mirrors light mode.** The page is ≈ `#1E1F23`, surfaces are `#2E3035` and text is cream `#F9F5EF`. Never use pure black or pure white, and tint every grey toward the charcoal's blue-grey hue.
3. **The primary flips.** In light mode it's a charcoal button with cream text; in dark mode it's a cream button with charcoal text. There's one solid primary per screen. Secondary emphasis uses a low-opacity tint, not a second solid colour.
4. **One animal per moment, alone, never in chrome.** Sizes: sign-in 96–120px, empty state 80–96px, success 64–80px, full-page error 64px, the mark next to the home greeting ≤ 24px. No crowds, patterns or confetti.
5. **Animals look the same in both themes,** except the charcoal mascot. On dark surfaces use the reversed cream mascot or a coloured animal.
6. **Brand voice lives in headings and one sentence.** Greetings ("Welcome back, Jana"), empty states, the publish step and success lines can be warm, with at most one playful sentence per screen. Labels, field help, errors and destructive confirmations stay plain.
7. **Manrope marks the moments.** Use it for page titles, the greeting, sign-in, and empty, success and publish headings. Inter covers everything operational: nav, labels, tables, buttons, meta text.
8. **Use words, not icons, for the actions that matter.** "Preview", "Publish", "Settings", "Finish later", and per-row verbs ("Continue editing"). Icon-only buttons are for secondary tools such as history or collapse.
9. **Save state is a sentence by the back link:** "Saving…", "Saved", "Unsaved changes". Confirm a manual save briefly in place (Ghost), not with a modal.
10. **Publishing is a short, friendly step.** "Publish" opens a calm confirmation with one Manrope line ("Ready to go live?") and a choice of "Now" or "Schedule". It ends on a success line with an animal plus "View on website" and "Back to news". Any blocking problem is explained in one sentence with a fix button (Mailchimp).
11. **Empty states teach.** Each has an animal, a plain title, one sentence from the collection's config description and one button, and the toolbar stays visible. There's a separate "all done" variant, and none at all for "no search results".
12. **Errors are honest first, friendly second.** The title says what happened, the next sentence says why in plain words, and there's one action. The animal appears only on full-page errors (404, server error), never next to field validation.

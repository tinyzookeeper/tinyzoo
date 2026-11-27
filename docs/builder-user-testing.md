# Testing the builder and own content types with users

Scenarios for a round of user testing of two experimental features: a site's own content types (`NUXT_CMS_CUSTOM_TYPES`) and the editor in the preview (`NUXT_CMS_BUILDER=on`). The design is in [the builder plan](builder-plan.md) and [the custom types plan](custom-types-plan.md).

The round answers three questions:

1. Can an owner who has never seen the editor reach each goal without help?
2. Where do they stop, guess or go the wrong way?
3. Does the result look right on every template, on a phone and on a wide screen?

It does not answer whether owners like the editor. That needs people who own a real website.

## 1. Rules of a session

- **A goal, not steps.** The tester gets the goal in an owner's words, as written under "Told to the tester". They do not get the names of buttons, this document's checks, the plans or the code. A tester who knows the designed path walks it and finds nothing.
- **One site per tester.** Each session starts on a fresh site made from a template, so sessions do not change each other's pages.
- **Think aloud.** Before each action the tester writes one line: what they expect to find and where. A wrong expectation is a finding even when the next click works.
- **No help.** A tester who is stuck for five actions in a row stops the scenario and records where. They do not read the documentation unless the scenario says so.
- **The check is not the tester's.** Whether a scenario succeeded is decided by the check written here (the public page, the saved content), not by the tester saying it worked.
- **Nothing is fixed during the round.** Findings are collected, then sorted. A fix changes what the next tester sees.

## 2. The sites and their content

Test on at least six templates, chosen to differ: one with large headings, one with narrow columns, one dark look, one with many sections of its own, one with few, one shop or listing. Each template in two of its looks when it has more.

Every test site gets the same sample type before the session, so results compare:

- **Courses** (pages under `/kurzy`): picture, short description (long text), date, price (number), place (text), level (choice), sign-up (link).
- **Five published entries:** three complete, one without a picture, one with a title only. One title is long (60 characters or more), one description is long (400 characters or more).

Scenarios in group A start without this type, on a site of their own.

## 3. Who tests

Each scenario is run by at least two of these:

| Tester | Knows | Device |
|---|---|---|
| **First-timer** | Has edited text in a word processor. Has never seen this admin. | Wide screen, 1440 px |
| **Returning owner** | Has used the admin's forms. Has not seen the editor in the preview. | Wide screen, 1440 px |
| **On the phone** | As the first-timer. | 390 px, touch |

Light and dark admin are both used across the round; which one is recorded.

## 4. Scenarios

Each scenario has what the tester is told, where it starts, and the check. "Public page" means the page as a visitor sees it, signed out, at 1440 px and at 390 px.

### A. Own content types

**A1. Make a type.**
- Told to the tester: "You run courses. You want to keep a list of them on your website: each has a name, a photo, a date, a price and a link to sign up."
- Starts: a fresh site, no own types.
- Check: one type exists with fields of the right kinds (picture, date, number, link). Note which kinds the tester chose for the date and the price, and whether they looked for the type in the right place first.

**A2. Add entries.**
- Told: "Add three of your courses. One has no photo yet."
- Starts: after A1.
- Check: three published entries; the one without a photo saves without a warning that stops the tester.

**A3. Give entries their own pages.**
- Told: "Each course should have its own page that you can send somebody a link to."
- Starts: after A2.
- Check: an entry's address answers on the public site and shows its values.

**A4. Change the type later.**
- Told: "You forgot the place where a course happens. Add it, and fill it in for one course."
- Check: the field exists, one entry has a value, the other entries still open and save.

**A5. Remove a field that is in use.**
- Told: "You no longer want to show prices anywhere. Remove the price from your courses."
- Starts: the sample type, with a list on the home page whose card shows the price (the state after C3).
- Check: the removal is refused and the message names where the price is used. Note whether the tester understands what to do next, and whether they do it.

**A6. Remove a type.**
- Told: "You stopped running courses. Take them off the website."
- Check: record what the tester does (removes the section, the entries, the type), in what order, and what the public page shows after each step. No public page shows an error.

### B. The editor in the preview

**B1. Change a text where you see it.**
- Told: "The headline on your home page is wrong. Change it to 'Otevřeno i v sobotu'."
- Check: the public home page has the new headline after publishing. Note whether the tester typed in the page or looked for a form.

**B2. Add a section.**
- Told: "Add a part with a photo on one side and a few sentences about you on the other, under the first part of the page."
- Check: a section with a picture and a text is second on the public page. Note how the tester found the place to add (the "+" in the page or the list at the side) and whether the picker's names were enough.

**B3. Move, copy and remove.**
- Told: "Move that new part to the end of the page. Make a copy of it. Then delete the copy."
- Check: one such section, last on the page.

**B4. Undo.**
- Told: "You deleted the wrong part. Get it back."
- Starts: the tester is first asked to delete a named section.
- Check: the section is back with its content. Note which way the tester tried first (the keyboard, the toast, the top bar).

**B5. Arrange blocks.**
- Told: "Put a heading, a short text and a button next to each other in one line. On a phone they should be under each other."
- Check: a row group with the three blocks; at 390 px they stack and nothing is wider than the screen.

**B6. Change how a section looks.**
- Told: "Make that part narrower, so the text is easier to read, and give it more room above and below. Then try to make it stand out with a background."
- Check: the section's width and space settings changed. A tinted background exists only on a list with the owner's own card; note where the tester looked for it elsewhere, whether they looked for free colours or sizes, and what they said about the limits.

**B7. Leave without saving.**
- Told: "You changed something by mistake. Leave the page so that nothing changes on the website."
- Check: the public page is unchanged. Note whether the admin warned, and whether the warning was understood.

### C. A list with a card of the owner's own

**C1. Show the courses on a page.**
- Told: "Show your courses on the home page."
- Starts: the sample type and its five entries.
- Check: the public home page lists the courses, each card with at least a picture and a title, the title-only entry without empty frames. Note which choice in the picker the tester took and how long the picker held them.

**C2. Add a value to the card.**
- Told: "Every course should also show its price and its date."
- Check: both values on every card that has them; the entry without them shows no empty line or label.

**C3. Rebind a block.**
- Told: "The cards show the short description. You would rather show the place there."
- Check: the text block of the card is bound to the place. Note whether the tester changed the binding or deleted the block and added another.

**C4. A button on the card.**
- Told: "Each card needs a button that takes people to sign up. For courses without a sign-up link, people should get to the course's own page."
- Check: record what the tester builds. One button bound to the sign-up link is left out where the link is empty; a second bound to the entry's page shows everywhere. Note whether the tester expected one button to do both.

**C5. Arrange the card.**
- Told: "Put the date and the price side by side under the name."
- Check: a row group in the card with the two blocks, on every card.

**C6. How many and in what order.**
- Told: "Show only the next three courses, the soonest first."
- Check: the limit is 3 and the order is by date. Note whether the tester looked for a filter ("only upcoming") or for picking entries by hand, neither of which exists.

**C7. Rows, not cards.**
- Told: "Show the courses as a simple list under each other, not as boxes."
- Check: the arrangement is rows; texts line up for the entry without a picture.

**C8. Fix an entry from the page.**
- Told: "One course has the wrong price. Correct it."
- Starts: the home page open in the editor, the list on it.
- Check: the entry's price changed, and the tester did not think they were changing every card. Note what they expected a typed value to change.

**C9. A block without a value.**
- Told: "Add one more line of text to the card. Decide later what it shows."
- Check: the block is saved unbound, drawn as a placeholder in the editor and not at all on the public page. Note whether the tester understood the notice.

**C10. Another type.**
- Told: "You also have references from customers. Show them the same way under the courses."
- Starts: a second type, References (name, text, picture), with three entries.
- Check: a second list bound to References with a card that fits its fields.

**C11. Switch the type of a list.**
- Told: "That list should show references, not courses."
- Starts: one list bound to Courses with a designed card.
- Check: the list shows references; record which blocks kept a value, which lost it, and whether the tester understood why.

**C12. No entries yet.**
- Told: "Prepare the list for your workshops. You have not written any yet."
- Starts: a type with no entries.
- Check: the tester can design the card on sample values, and the public page draws nothing for the empty list.

### D. On a phone-sized admin

Run B1, B2, C1, C2 and C8 at 390 px with touch. For each, also record:

- whether the tester found how to open the preview,
- whether the sheet at the bottom covered what they were working on,
- every tap that did nothing or hit the wrong thing,
- whether typing with the on-screen keyboard left the text in view.

### E. The result for a visitor

After C1 to C7 on every template and look in the round, with no tester:

- **E1.** The public page at 1440 px and 390 px: nothing wider than the screen, no overlapping text, no empty frames, pictures not stretched.
- **E2.** The long title and the long description: they wrap inside the card and neighbours keep their height.
- **E3.** Every button on a card leads somewhere that answers.
- **E4.** With both settings off, the same site's pages and admin are as they were before the features (compare pictures of the pages).

## 5. What to record

One record per scenario and tester, in the same shape every time:

| Field | Value |
|---|---|
| `scenario` | A1 … E4 |
| `template`, `look` | as named in the app |
| `tester` | first-timer, returning owner, on the phone |
| `screen`, `theme` | 1440 or 390; light or dark |
| `result` | done, done with a detour, gave up, wrong result believed right |
| `actions` | the number of clicks, taps and typed fields until the end |
| `wrongTurns` | each place the tester went that did not help, with what they expected there |
| `stuckAt` | where the scenario stopped, with the words on the screen at that moment |
| `words` | every label or message the tester misread, quoted exactly |
| `errors` | messages in the browser's console and failed requests |
| `pictures` | the screen at the start, at each wrong turn and at the end |
| `check` | the scenario's check, passed or failed, decided apart from the tester |

The result "wrong result believed right" matters most: the tester was satisfied and the website was not what they were asked for.

## 6. Sorting the findings

Each finding is reproduced once more on a fresh site before it is counted. Then it gets one of four grades:

1. **Stops the goal:** the tester could not finish, or the public page is broken.
2. **Wrong result:** finished, but not what was asked, and the tester did not notice.
3. **Detour:** finished after wrong turns or a misread label.
4. **Rough:** finished directly; something looked or felt off.

A finding seen with one tester on one template is reported as such. A finding seen on three or more templates, or with every tester, is reported first.

## 7. The report

- The conclusion first: which goals every tester reached, which none did.
- A table of scenarios against testers with the result of each.
- The findings by grade, each with the scenario, the template, a picture and the exact words on the screen.
- What was not tested.

# Admin UX: making the screens calm

Research date: 2026-11-13. Source: Mobbin (web). The visual direction stays as it is: true greys, black primary, Geist, flat white surfaces, hairline borders, no shadows. This document covers **structure and hierarchy only**, because the screens feel chaotic for those reasons, not because of colour.

All 12 references below are saved in the Mobbin collection **"my-cms — admin references"**.

**Diagnosis in one line:** every element currently has the same visual weight, appears in more than one place, and has its own box. The calm references fix this the same way. They have one obvious primary thing per screen, metadata is pushed into a quieter secondary zone, and they remove boxes, icons and repeated labels rather than styling them.

---

## 1. Entry editor: content vs. metadata

### References

- [Linear: issue view](https://mobbin.com/screens/f00cc4fb-4083-43fc-a0fb-703a6c4ef771?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). The title *is* the H1 and can be edited in place. The description sits directly beneath it with no label. On the right, a narrow "Properties" panel holds status, priority, assignee and estimate as one-line `icon + value` rows with **no field labels**, and empty values read as "Set priority" / "Assign" in muted text. The top bar carries only a breadcrumb and small icon actions.
- [Linear: project overview with properties](https://mobbin.com/screens/e2106805-ecc7-40a4-a35c-e2c315b24954?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). The right panel uses a two-column `label | value` list (Status, Priority, Lead, Dates, Labels) in small grey labels. The date range is one row ("Mar 30th → Apr 15th"). The main column is title, one-line summary, then the body.
- [Attio: record page](https://mobbin.com/screens/b4729369-cc37-4b1d-b51e-75954a6ff5c7?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). "Record details" is a dense `icon · label · value` list. Empty values are inline placeholders ("Set Description…", "Set a value…") instead of empty input boxes. "View all values" collapses the rarely used ones.
- Also worth a look: [Notion: page with title as content](https://mobbin.com/screens/eb0b0242-8e97-41c0-b2b0-f7446a6f7b3c?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). There is no page heading above the document, only a quiet "Edited 1d ago" plus Share in the top bar.

### Do

- **Two zones.** The main column (max-w ~720px) holds the editorial content in reading order: Title, then Hero image, then Rich text. The right aside (`w-72`, hairline `border-l`, no card) holds everything about publishing: Status, Publish date, URL slug, Author, Tags, and SEO collapsed at the bottom. On narrow screens the aside becomes a `USlideover` opened from a "Details" button.
- **The title is the H1.** Render it as a borderless input (`UInput variant="none"` or a `contenteditable` H1, `text-3xl font-semibold`) with the placeholder "Untitled". No "Title" label and no box.
- **Aside rows are `label | value` pairs.** Use a 2-column grid (`grid-cols-[96px_1fr]`), labels in `text-sm text-muted`, and values as `UButton variant="ghost" size="sm"` that open a `UPopover` / `USelectMenu` / calendar on click. An empty value shows a muted placeholder ("Add author", "Add tags", "Not scheduled").
- **Status lives in the action, not in three places.** Put one split button in the header: a primary "Publish" (or "Update" when already published) with a `UDropdownMenu` for "Schedule…", "Unpublish" and "Revert to draft". Status itself is the first aside row, shown as a small dot plus a word.
- **Combine date and timezone in one value:** "Nov 14, 2026 · 09:00 CET". The timezone goes in the same muted string, not as a separate label.
- **The slug is derived and quiet.** Show it as `/blog/my-post` in mono `text-sm text-muted` with a pencil on hover. Edit it in a popover, and put the help text inside the popover, not on the page.
- **SEO is collapsed by default.** Use `UCollapsible` with the trigger "Search appearance". When collapsed, show a one-line preview of the meta title. Fall back to title and excerpt so editors rarely need to open it.
- **Show save state as text, not a button that is always present.** Show "Saved · 2 min ago" / "Unsaved changes" in muted text next to the primary action. Preview is an icon button (`i-lucide-eye`, ghost) with a tooltip.

### Don't

- Don't repeat the title as a page heading **and** as a field. Delete the page H1 and the "Title" label.
- Don't show a status badge **and** a status segmented control **and** an Unpublish button. Keep one source of truth (the aside row) and one action (the split button).
- Don't give every field its own box, label and help text at equal weight. Metadata should not look like content.
- Don't show raw storage details (UUID filenames) anywhere an editor reads.
- Don't put more than one solid (black) button on the screen.

---

## 2. Collection list

### References

- [Resend: Emails list](https://mobbin.com/screens/d07d0212-56ee-444d-b2e1-011736dd8119?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). The page has a title, small segmented tabs, then **one toolbar row** (search input that grows, followed by compact filter selects), all without a card. The table has small grey headers, only 4 columns, a relative time right-aligned in muted text, and a single `…` menu at the row end.
- [Linear: issue list](https://mobbin.com/screens/d4e0a8da-a387-49c7-8940-b64521bd3809?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). There are no column headers at all. The title is bold on the left and metadata (avatar, date) sits right-aligned and muted. The group header ("Todo 5") carries the count. Rows are ~36px. Filter and display controls are icon buttons in the top-right.
- [Flodesk: My emails](https://mobbin.com/screens/2d75e0ef-fc12-4600-90b6-973bcab18141?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). Search, Sort and Status sit as text buttons on the title row. A tiny thumbnail is **merged into the name cell**. Status is a quiet outline pill with a date inside it ("Draft last edited 5 days ago"). Each row has one `…`. "1–3 of 3 total" sits at the bottom.
- Also: [Vercel: deployments filter row](https://mobbin.com/screens/d1dee152-f0ee-4fde-95b2-ff5dacc05125?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) and [Attio: count in table footer](https://mobbin.com/screens/5fc7fb8b-bc6c-4c92-bfd9-e9f2ce4dd812?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp).

### Do

- **Header row:** the title on the left with the count as muted inline text ("Posts **24**", where 24 is `text-muted`). The "New post" primary button sits on the right. Drop the description, or show it only on the empty state.
- **Toolbar row with no card:** `UInput` (search icon, `size="sm"`, `class="w-64"`) followed by a status filter (`USelect` with "All statuses", `size="sm"`, variant `outline` or `ghost`). Sort goes in the table header.
- **Merge the thumbnail into the title cell:** a 32×32 rounded image followed by the title (font-medium) with the slug or excerpt beneath it in `text-xs text-muted`. That removes a column.
- **Columns:** Title · Status · Author · Updated (relative, right-aligned, muted). Four at most. Author can become an avatar plus first name.
- **Status as a dot plus a word** (`size-1.5 rounded-full` + `text-sm`), and colour only the dot. Use a `UBadge` only for the exceptional state (Scheduled).
- **The whole row is the link** to the editor (`cursor-pointer`, `hover:bg-elevated/50`). One trailing `UDropdownMenu` (`i-lucide-ellipsis`, ghost, xs) holds "Duplicate", "Unpublish" and "Delete" (Delete red, last, behind a separator).
- **Density:** row height ~44px, `text-sm`, headers `text-xs font-medium text-muted` with no uppercase, a hairline only between rows, no outer card border (or one hairline border around the table only).
- **Pagination / count** in the footer: "1–20 of 24", muted.

### Don't

- Don't wrap the search in a card. Don't put the table in a second card. One surface is enough.
- Don't show pencil **and** trash icons on hover. Pencil duplicates the row click, and trash is a destructive action exposed at one click.
- Don't give the thumbnail its own column, and don't show a broken-image box for rows without one. Show nothing, or a neutral 32px placeholder.
- Don't use absolute timestamps with full dates in the default view. Use relative time with the full date in a tooltip.

---

## 3. Home / dashboard

### References

- [Plane: home](https://mobbin.com/screens/e918626d-1fd2-472a-a5fd-197da26e55f2?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). A centred greeting with the date beneath it, then one "Recents" list: doc icon · title · "about 11 hours ago" muted · avatar on the far right. Single column, generous whitespace, no cards around the list.
- [Snowflake: home](https://mobbin.com/screens/99e544b2-ecc6-46d9-9147-c742c694b1e4?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). Search, then **one row of 4 quick-action tiles** (icon, title, one-line description), then a "Recent" table with tabs by type. This is the structure to copy.
- [Airtable: home](https://mobbin.com/screens/480cc1d5-ec9c-413d-a871-d7ce22565022?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). Recents grouped by time ("Today", "Past 7 days") under a single "Opened anytime" filter, with nothing else on the page.

### Do

- **Three blocks at most, in this order:** (1) a greeting as a modest `text-xl` heading, with no subtitle or a muted date at most; (2) **"Continue editing"**: the 5 most recent entries as a plain list (title · collection name muted · "2h ago" right-aligned), where each row links to the editor; (3) **"Create"**: one row of compact tiles or ghost buttons, one per collection ("New post", "New page"…), with the count in muted text.
- Put "Continue editing" **first**. It is the most likely next action for a returning editor.
- Use one container width (`max-w-3xl`, centred), hairline separators between blocks, and no cards.

### Don't

- Don't duplicate the sidebar. The "Your content" and "Settings" lists repeat navigation that is already visible on the left. Delete the Settings list outright, and turn "Your content" into the compact "Create" row (or delete it if the sidebar already shows the counts).
- Don't use an icon plus name plus description plus count for every collection. Descriptions belong on the collection page's empty state.
- Don't add stats, charts or "getting started" cards unless an editor actually acts on them.

---

## 4. Calm form fields

### References

- [Plain: profile settings](https://mobbin.com/screens/88c63447-0078-4e58-b308-02b68b744358?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). The label is bold-small, with one short muted description line **between label and input**. The image field is a thumbnail with "Upload" and "Delete" ghost buttons beside it and size/format hints as one muted sentence. There are no boxes around groups.
- [Gumloop: profile](https://mobbin.com/screens/440207ae-e3bd-4e74-bb07-b127f9a09cdb?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). A horizontal layout with label and help on the left and the control on the right, with hairline row dividers. The image row is a thumbnail, "PNGs, JPEGs under 10MB", and Upload/Remove. The read-only ID is shown as a muted, copyable field.
- [Unify: profile form](https://mobbin.com/screens/a948a9a5-f239-4374-a57c-b52736269570?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). Labels above the input, short related fields paired in a 2-column grid (First / Last name, Title / Job function), and a single Save/Cancel pair for the whole section.

### Do

- **`UFormField` anatomy:** use `label` (`text-sm font-medium`). Use `description` only when needed (one line, muted, between label and input). Use `hint="Optional"` on the right of the label for optional fields. **Required is the default and gets no asterisk.** Put errors in the `error` slot only.
- **Help text is the exception.** If more than ~1 in 4 fields need help, the field names are wrong. Rename them ("URL" → "Page address") before adding text.
- **Pair short fields:** Author and Tags, or Date and Time, go in a `grid grid-cols-2 gap-4`.
- **Image field:** an 80×80 (or 16:9, 160px wide) rounded thumbnail on the left. On the right go the alt-text `UInput` (placeholder "Describe the image for screen readers") with "Replace" / "Remove" ghost `xs` buttons under it. The filename shows only in a tooltip or in the media library, never a UUID. When empty, show a dashed-border drop zone with "Add image" at the same size.
- **Group with headings and space, not boxes:** a small heading (`text-sm font-semibold`) and `space-y-6` between groups, with `USeparator` between major sections at most.
- Keep inputs `size="md"` everywhere, with one input height and one radius.

### Don't

- Don't use asterisks plus "(optional)" plus help text on every field.
- Don't put help text below **and** a description above the same field.
- Don't wrap the image field in its own card with a header.
- Don't show helper text that explains the obvious ("Enter the title of the entry").

---

## Top 10 changes (prioritised)

1. **Editor: split into a main column and an aside.** Main: Title, then Hero image, then Rich text. Aside (`w-72`, `border-l`, no card): Status, Publish date, URL, Author, Tags, plus SEO collapsed. This alone removes most of the "one long column of equal fields" chaos.
2. **Editor: remove the page H1 and make the title field the H1** (a borderless `text-3xl` input, placeholder "Untitled", no label).
3. **Editor: one status mechanism.** Drop the status badge and the segmented control from the main column. Status becomes the first aside row (dot plus word). The header gets a single split primary button: "Publish" / "Update" with ▾ for Schedule… / Unpublish / Revert to draft. Preview becomes a ghost icon button, and "Saved · 2 min ago" sits as muted text beside it.
4. **List: merge the thumbnail into the Title cell** (32px image, title, muted slug beneath). Columns become Title · Status · Author · Updated (relative, right-aligned).
5. **List: replace the pencil and trash icons with a click-anywhere row plus one `…` menu** (Duplicate / Unpublish / separator / Delete in red).
6. **List: remove the search card.** A bare toolbar row holds the search input and a status `USelect`. The count moves inline next to the title ("Posts 24", count muted) and to the footer ("1–20 of 24"). The description is removed.
7. **Home: delete the "Settings" list and reduce "Your content" to a compact "Create" row.** Both duplicate the sidebar.
8. **Home: lead with "Continue editing"** (5 recent entries: title · collection · relative time). The greeting shrinks to a modest heading, and the content sits in a single `max-w-3xl` column with no cards.
9. **Forms: adopt one `UFormField` convention.** Required gets no marker, optional gets `hint="Optional"`, help goes only in `description` and only where needed. Move the slug help, the timezone label and the SEO hints into popovers or the collapsed section, and make date and timezone one value ("Nov 14 · 09:00 CET").
10. **Image field: thumbnail plus alt text plus Replace/Remove, with no UUID filename and no wrapper card.** Use the same component in the editor and anywhere else media appears.

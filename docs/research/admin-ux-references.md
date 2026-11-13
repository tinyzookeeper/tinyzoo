# Admin UX references (Mobbin research)

Research for turning the my-cms admin from a scaffold into a client-facing product. Audience: non-technical editors at small/medium (mostly Czech/European, multilingual) businesses. Stack: Nuxt 4 layer, Nuxt UI v4, Tailwind 4.

All references live in the private Mobbin collection **"my-cms — admin references"** ([open collection](https://mobbin.com/collections/138adff5-c925-4645-b591-096ea2f2e6a2/mobile/screens?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp); switch to the *Web* tab). Platform: web. Researched 2026-11-13.

Note: Mobbin has few true headless-CMS screens (no Sanity/Payload/Storyblok/Strapi/Directus/Contentful in results). The closest analogues are the content areas of Shopify, Webflow, Framer, Wix, Squarespace, Ghost-like tools (beehiiv, Substack, Podia) and doc tools for history. That is fine: those are the tools our client editors already know.

---

## 1. Dashboard (home after login)

References
- [PandaDoc: Home](https://mobbin.com/screens/08462a15-46a6-4543-96af-0213eb1de0a3?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): tabbed "Drafts / Action required / Waiting for others" strip over a recent-documents table, with a "Get started" checklist and an activity timeline on the right.
- [Squarespace: Welcome home](https://mobbin.com/screens/88be69ce-bdd6-472a-bede-3dc1d9c5dd5c?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): "Welcome, Alex" heading, primary "Edit site" action top-right, calm cards, "Learn the basics" row.
- [Hashnode: Blog overview](https://mobbin.com/screens/37befa5d-c370-45e5-b7d0-0582324a60fe?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): quick-action cards (icon, title, one-line description) and an empty "No recent articles" panel with a "Start writing" CTA.

Takeaways
- Replace "N fields" collection cards with **work-oriented** content: (a) "Continue editing" = the user's 5 most recent drafts, (b) "Scheduled next" list, (c) a recent activity feed (who changed what, relative time). PandaDoc's segmented counters (Drafts 3 · Scheduled 1 · Needs translation 2) sit above the list and filter it. Build them with `UTabs` or a row of clickable count cards.
- Put a personal greeting and **one primary action** in the page header ("Welcome back, Jana" plus a `UButton` "New ..." dropdown listing the collections). Squarespace and Hashnode both keep the header to a heading and one or two buttons.
- Show quick-action cards for the most common collections. Each card has an icon, a verb-led title ("Write a blog post", "Edit homepage") and one line of helper text. Developers should be able to configure which ones appear (e.g. `dashboard.quickActions` in the CMS config).
- Use a two-column layout at ≥ lg: the main column holds lists, a 320px right rail holds the checklist, activity and a "View site" link. Collapse to one column on mobile.
- Avoid analytics charts with no data (Squarespace shows "0" charts, which reads as broken). A headless CMS has no traffic data, so leave charts out.

## 2. Collection list

References
- [Circle: Posts](https://mobbin.com/screens/e6471326-4a9f-4c62-8dca-5c5962e69b0d?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): status tabs with counts (All 1 · Drafts 1 · Scheduled 0), "+ Title / + Author / + Spaces" filter chips, "Bulk actions" dropdown, status badge column.
- [Wix: Blog posts](https://mobbin.com/screens/b4b4bd64-1898-471f-b97d-5be5e569bcbe?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): Published / Drafts / Pending Review / Scheduled / Trash tabs, thumbnail rows, "Select all", inline search, row "…" menu.
- [Webflow: CMS collection, bulk change](https://mobbin.com/screens/c5300942-26fe-47a0-a0af-a5c8237e5e21?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): "2 Projects selected" replaces the header and offers Export / Delete / Update items, then a plain confirm dialog ("change the status of these 2 items to draft?").
- [Pipedrive: Bulk edit panel](https://mobbin.com/screens/1c70f25d-7816-4204-a257-c5c4309dcb0c?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): "2 selected ×" pill, and a right panel where every field defaults to "Keep current value".

Takeaways
- Put **status tabs with counts** above the table: All · Draft · Scheduled · Published · (Changed since publish). Status is the first thing editors filter by, so it gets tabs. All other filters go into "+ Filter" chips (author, locale, date, relation). Nuxt UI: `UTabs` (variant `link`) plus `UButton` chips that open `UPopover` with a `USelectMenu`.
- When rows are selected, **replace the toolbar** with a "3 selected ×" pill and contextual actions (Publish, Unpublish, Schedule…, Delete). Delete is red and goes last. Every bulk action opens a `UModal` confirm that states the count and the effect in plain words ("Unpublish 3 pages? They will disappear from the website.").
- Each row shows a 40px thumbnail when the collection has an image field, the title as the primary text, and secondary text "Updated 2 h ago · Jana". Add a status `UBadge` (neutral = Draft, info = Scheduled + date, success = Published, warning = "Unpublished changes"). Add a locale coverage column when i18n is on (see §7).
- Keep the whole row clickable (already done). The "…" menu holds Duplicate, View on site, Delete, so destructive actions need two steps.
- Show search and sort at the top right of the table card. Persist the active tab, filters and sort in the URL query so the Back button and shared links work.
- Avoid dense spreadsheet grids (Supabase/Braintrust style) and over 6 visible columns. Developers should choose list columns in the collection config.

## 3. Entry editor layout

References
- [Shopify: Add blog post](https://mobbin.com/screens/c93c6814-ae2d-4d60-a0cd-4b446f396bcb?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): main column of white cards (Title, Content, Excerpt) plus a right column (Visibility, Image, Organization). A global top bar reads "Unsaved changes · Discard · Save".
- [Podia: Edit post SEO tab](https://mobbin.com/screens/6677b01e-f0a2-4772-b18f-f294e6d4595c?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): the right card has a SEO tab with SEO title, description ("Recommended 120–160 characters"), social image and a "Show in search results" toggle. Labels have tooltip explanations. The header holds Save + Schedule.
- [beehiiv: Post settings](https://mobbin.com/screens/be301e5a-4eff-4ff0-933a-9cfded029c8a?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): "Draft · Synced" indicator and word count in the header, a tabbed settings sidebar (Post / Email / Website / SEO), and a footer with Preview / Schedule.
- [Framer: CMS item editor](https://mobbin.com/screens/4e37b985-ce25-463f-8a18-bcf226d40c5e?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): Status dropdown as the first field, "Saved Draft" text next to a primary "Publish" button.

Takeaways
- Use a **two-column editor** at ≥ lg. The left column (about 2/3) holds content fields grouped in `UCard`s. The right column (320–360px, sticky) holds **Status & publishing** (status badge, last published, Publish/Schedule), then **SEO** (meta title/description with character counters and a Google-style preview), then **Details** (slug, author, relations, dates). Developers mark fields with `admin.position: 'sidebar'`.
- Use a **sticky header** with: breadcrumb (Collection › Title), save state text ("Saving…" / "Saved 2 min ago" / "Unsaved changes"), locale switcher, a secondary "Preview" button and a primary split button "Publish ▾" whose menu holds Schedule…, Unpublish and Revert to published. Shopify's dark "Unsaved changes – Discard / Save" bar is a strong pattern for dirty state.
- The title is the largest field (big input or contenteditable heading at the top of the main column). The slug sits under it in small text with an edit pencil.
- Give every non-obvious field help text under the label (Nuxt UI `UFormField` `description`/`help`). Add character counters for SEO fields. Use plain language ("Shown in Google results").
- Guard against leaving with unsaved changes (route-leave confirm) and add Cmd/Ctrl+S to save.
- Avoid putting Publish only at the bottom of a long form, which is the current state. Avoid a status dropdown that mixes workflow and visibility. Publish and unpublish should be actions, and status should be read-only.

## 4. Page builder / blocks

References
- [Shopify: Theme editor block picker](https://mobbin.com/screens/ff2e9ae9-8acb-4e1f-83f1-0dba0ff24319?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): section tree with indented "+ Add block" rows. The picker popover has search, grouped categories (Basic / Decorative / Layout) and a live preview pane.
- [Maze: Block list](https://mobbin.com/screens/bc823c11-309c-4382-89ab-1d54a4345b74?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): vertical cards, each with a coloured type icon, title, type subtitle and "…" menu. "+ Add block" sits at the end, and the selected block is edited in a separate pane.
- [Squarespace: Collapsible form blocks](https://mobbin.com/screens/7e32a46f-0676-4807-80ee-eec9f11ce239?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): chevron-collapsible rows with drag handle, icon, label, toggle and "…". Thin "+" inserters sit **between** items.
- [Later: Block library](https://mobbin.com/screens/199b6880-96db-4c1f-8a63-07ed470be29b?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): "My blocks" plus "Add more blocks" grid of cards (icon, name, one-line description, Add button).

Takeaways
- Render blocks as **collapsible cards** in the main form column. The header row has: drag handle, block-type icon + colour, block label, a **summary** of the content when collapsed (first heading/text, e.g. "Hero — Vítejte v naší pekárně"), and a "…" menu (Move up/down, Duplicate, Hide, Delete). Use `UCollapsible` per block. "Collapse all / Expand all" goes on the field header.
- Put **insertion points between blocks** (a hover "+" line, as in Squarespace) as well as an "Add block" button at the end. Editors usually want to insert in a specific place, not append.
- The **block picker** is a `UModal` or `UPopover` with search, categories defined by developers, and per block an icon, a human name and a one-line description. Developers can add a thumbnail preview image (as in Shopify). Recently used blocks go first.
- Reorder by drag (handle only, not the whole card) and also by keyboard/menu (Move up/down) for accessibility and touch.
- Show a validation error **on the collapsed header** (red dot plus "1 error") so errors inside collapsed blocks are not hidden.
- Avoid a full WYSIWYG canvas for v1. Stay form-based (Payload/Storyblok-style "blocks field") and add an optional side-by-side preview later.

## 5. Media library

References
- [Shopify: Asset details](https://mobbin.com/screens/723a5658-3c31-428c-8822-5b4985149bef?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): large preview, focal-point picker ("Click or drag to change focal point"), info card with Name, **Alt text**, Details (JPG · 3024×4032 · 1.61 MB · Added …) and **"Used in"**.
- [Webflow: Asset details popover](https://mobbin.com/screens/8344b8cb-187d-4737-b595-807b49426080?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): alt text with a **Descriptive / Decorative** toggle and helper copy explaining what alt text is for.
- [Wix: Choose images modal](https://mobbin.com/screens/13e7a87e-c6f5-4284-a7c9-ca9f9c39cb23?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): picker with left nav (Site files, Trash), "+ Upload Media", folders, gallery/list toggle, storage meter, disabled "Add to Page" until something is selected.
- [Mailchimp: My files](https://mobbin.com/screens/1080d4ea-52b4-478e-941f-9e021a06f695?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): search, Filter + Folder dropdowns, sort, grid/list toggle, rows with thumbnail, date, dimensions and size, plus pagination.

Takeaways
- Use **one component for both the library page and the picker modal** (Wix pattern): toolbar (search, type filter, folder, sort, grid/list toggle), a responsive thumbnail grid (`grid-cols-[repeat(auto-fill,minmax(160px,1fr))]`), and selection checkboxes on hover. In picker mode, add a sticky footer "Insert (1)".
- **Drop files anywhere** on the page. Show a full-page overlay while dragging and per-file upload progress tiles at the top of the grid. Show a toast when finished.
- The detail panel is a `USlideover` or right panel with: preview, filename, **alt text** (multi-line, per locale when i18n is on, with a "Decorative image" checkbox), title/caption, focal point, read-only facts (type, dimensions, size, uploaded by/at), **"Used in" list** linking to entries, and Replace file / Download / Delete.
- **Nudge for alt text**: show a small warning badge on grid tiles without alt text and a "Missing alt text" filter. Accessibility matters to EU clients (EAA 2025).
- Block or warn on deleting an asset that is "Used in" N entries.
- Avoid folder trees in v1. Flat folders or tags plus search covers SMB needs.

## 6. Version history / restore

References
- [Plane: Page version history](https://mobbin.com/screens/afc55a5a-4236-4f12-859d-9d38a55bd06d?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): right panel of timestamps + author, "Current version" pinned at the top. The viewed version is "View only", and the header has "Compare versions" plus a primary "Restore this version". There is a "Highlight changes" checkbox.
- [WRITER: Version history](https://mobbin.com/screens/d6e6654e-119a-456a-acef-fcb72d9ec330?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): grouped "Last 30 days" timeline, plus a bottom banner "Viewing January 9, 9:57 PM — If you restore this version, you'll overwrite your current doc" with a Restore button.
- [Manus: Version history list](https://mobbin.com/screens/4142fbf7-14e2-4841-aad7-70e51ddf2dfe?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): each version shows relative time, a change summary, a "Published" marker, and Preview / Rollback / Publish actions.
- [Sana: Inline diff](https://mobbin.com/screens/e4f25c59-b045-49ac-9505-86d6f2e8ed3d?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): strikethrough removed text and highlighted added text, with a "Highlight changes" toggle.

Takeaways
- Open history from the editor header (clock icon / "History") as a **right `USlideover`** listing versions grouped by day (Today / Yesterday / date). Each item shows time, author avatar + name, and badges: **Published**, **Current**, **Autosave**, **Scheduled**.
- Selecting a version shows a **read-only render of the form** with a "Show changes" toggle that highlights changed fields: a field-level diff (changed fields outlined, old → new for scalars, inline strike/insert for rich text). Field-level diff is more useful than a raw JSON diff for non-technical users.
- Restore is always explicit, with consequence copy: "Restore this version? Your current draft will be replaced. Nothing is published until you click Publish." Restoring creates a new draft version and is undoable.
- Mark which version is live on the website, so "Revert to published" is an easy, separate action.
- Avoid side-by-side two-pane JSON comparison as the default. Keep it as an advanced view for developers.

## 7. Localization

References
- [Framer: Localization table](https://mobbin.com/screens/a2248603-8b0d-45e1-8284-c9658a380771?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): locale list with flag + completion % on the left. The table shows source vs target side by side, grouped by page, with a "NEW" status badge per string and an "All ▾" status filter.
- [Etsy: Listing translation](https://mobbin.com/screens/45b8c2f0-6841-44f5-ac11-caa22aceabed?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): per-language tab. Each field shows the **original text in grey on the left** and the translation input on the right, with an "Edit original (English)" link.
- [Customer.io: Localize](https://mobbin.com/screens/4a9501e1-3c81-4119-b520-b344a0e7c267?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): locale dropdown with a **"Missing content"** badge, a per-locale "Live" toggle, and "Add translation" placeholders per row.
- [Shopify: Translate & Adapt](https://mobbin.com/screens/ee6ae86b-da7d-4307-810b-2bc066ea3e3f?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): per-locale "Unpublished" status ("Translations aren't visible to customers until the language is published"), plus an auto-translate confirm with "Translate" vs "Translate and publish".

Takeaways
- Put a **locale switcher in the editor header** (`USelectMenu` with flag/code + label). Each option shows status: ✓ complete, ◐ "3 missing", ○ "Not translated". Switching keeps the scroll position. The default locale is labelled "(default)".
- In a non-default locale, show the **default-locale value as reference** under or beside each translatable field (Etsy pattern, small muted text or a "Show original" popover). Untranslated fields show a "Missing" `UBadge` and fall back to the default value in the placeholder. Mark non-translatable (shared) fields with a globe-off icon and "Same in all languages" so editors know why they cannot edit them.
- Add a **"Copy from Czech"** action per field and per entry. AI auto-translate can be a later add-on, using Shopify's "Translate" vs "Translate and publish" split.
- In lists, add a compact **locale coverage column** (e.g. `CS ✓ EN ◐ DE ○` chips) and a "Missing translation in…" filter.
- Publishing state is per locale only if the developer config enables it. Otherwise, say clearly "Publishing applies to all languages".
- Gap: Mobbin had no strong example of an in-entry locale switcher (Sanity/Storyblok/Contentful style). The pattern above comes from CMS conventions and should be validated with users.

## 8. Publish & scheduled publishing

References
- [Salesforce: Publish article dialog](https://mobbin.com/screens/6713da09-509f-4e90-9a4d-14abae558b59?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): "This action will apply to 1 article", radio **Publish now / Schedule publication on** with date + time, and a translation question "Do your changes affect existing translations? Flag as out of date".
- [Confluence: Publish page](https://mobbin.com/screens/ee2ef0f5-a07e-474f-9d8a-74935f9fcd47?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): publish modal with location, access, **version comment**, "Schedule publish: Immediately ▾" opening a calendar + time + timezone.
- [Wix: Schedule post](https://mobbin.com/screens/54eb2e89-bb6f-4fba-90eb-16f1b5735103?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): "When do you want to publish your post?" calendar plus time field with the timezone shown underneath.
- [Buffer: Schedule split button](https://mobbin.com/screens/836bdf4a-1e76-4a08-996f-91ea6e740058?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): footer date chip "Jun 23, 5:00 PM" next to the "Schedule Post" primary button. The time list has a typed-time field and timezone label.

Takeaways
- Use a **split primary button**: "Publish" publishes now (with a toast and "View on site" link). The ▾ menu holds "Schedule…", "Unpublish", "Schedule unpublish…". Once scheduled, the button reads "Scheduled · 12. 12. 9:00" with Edit / Cancel schedule.
- The schedule `UModal` uses a question title ("When should this go live?"), a `UCalendar` plus a time input, a **visible timezone** (site timezone from config, e.g. Europe/Prague), quick presets (Tomorrow 8:00, Monday 8:00), and an optional "Unpublish on" date for campaigns and events.
- Add an optional **"What changed?" note** to the publish confirm (Confluence). It feeds the version history labels.
- With i18n, the dialog lists locales with checkboxes and their completeness ("EN – 2 fields missing") so editors can publish only ready locales, if per-locale publishing is enabled.
- Use locale-aware date formats (`12. 12. 2026 9:00` for cs, 24h). Never show raw ISO strings.

## 9. Team members, invites & roles

References
- [Searchable: Invite teammates (flow)](https://mobbin.com/flows/92365a5f-7639-4187-9b21-8ecaa0762f8e?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): email input with "+ Add" → staged invite rows with role + scope selectors → "Send invite". All / **Pending (2)** tabs, and the members table shows Role, Last active, Status (Active / Pending).
- [Lyssna: Manage your team](https://mobbin.com/screens/249efdbd-e4f4-4fc7-a442-97f80c2c9a68?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): inline invite row, "Invited" section with **Resend invitation**, role dropdown whose options **describe each role** (Admin = full access incl. team…, Editor…, Viewer…) and a red Delete.
- [beehiiv: Invite member slideover](https://mobbin.com/screens/08d14944-4ca3-4dee-a021-18722d5d2abe?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): email plus **radio cards** for permission levels, each with a one-sentence explanation. "Pending Invites" and "Expired Invites" sections sit behind it.
- [Customer.io: Invite team member (flow)](https://mobbin.com/flows/b9a3df57-713b-49a4-8a48-ff447a311cdd?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): full invite form, then the members list with an "Invite sent" badge and toast.

Takeaways
- Users page: a header "Team" with an "Invite people" button, plus All / Pending tabs. The table has avatar + name + email, a role `UBadge`, Last active, Status, and a "…" menu (Change role, Resend invite, Revoke / Remove).
- The invite `UModal`/`USlideover` takes one or more emails (chips) and a role chosen via **radio cards with plain-language descriptions** ("Editor — can create and publish content", "Contributor — can write drafts, cannot publish", "Admin — also manages users and settings"). Role names and descriptions come from config so developers can define roles.
- Pending invites show "Invited 2 days ago · expires in 5 days", plus a Resend action and a "Copy invite link" fallback (Attio/Cohere), useful when emails land in spam.
- The invitee's accept page is a single screen: name and password (or magic link). It welcomes them with the inviter's name and the site name.
- Guardrails: you cannot remove or downgrade yourself or the last admin. Destructive confirm copy names the person.

## 10. Sign in & password reset

References
- [Relume: Log in](https://mobbin.com/screens/8993959c-edfd-493b-bbbe-716010895cc8?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): small centred card on a warm neutral background, logo above, "Forgot password?" aligned right on the password label row, full-width dark primary button.
- [Webflow: Log in with inline error](https://mobbin.com/screens/6dedeb12-e86d-476a-a140-7537ef28c98f?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): password show/hide eye and an inline field-level validation message.
- [Klaviyo: Reset password (flow)](https://mobbin.com/flows/c3c06f23-8c8a-4f0a-a3e2-d37dffbc44a7?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): error alert on login → "Email Sent. If this account exists, you will receive…" (no account enumeration, spam-folder hint, "try sending again") → "Your password is updated" + Log in.
- [Semrush: Reset password (flow)](https://mobbin.com/flows/695c023e-51a2-421c-b135-bb3099eea065?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): "Reset your password" with "Send me reset link" and a secondary "Go back to login", then a "Reset link sent" check confirmation.

Takeaways
- Use a centred `UCard` (max-w-sm) on a softly tinted background. Show the **client's site logo/name** above it (white-label from config, e.g. "Pekárna Novák — správa obsahu"), with "Powered by my-cms" small in the footer.
- Fields: Email, Password (with show/hide), "Forgot password?" on the password label row, and a full-width primary button. Errors appear as a single `UAlert` above the button ("Wrong email or password"), never revealing which part was wrong.
- The reset flow has 3 screens: request (email → "Send reset link", "Back to sign in"), neutral confirmation ("If an account exists for x@y.cz, we've sent a link. Check spam."), and set new password (with requirements shown upfront), then auto sign-in or a success screen.
- Skip social login and sign-up links. This is an invite-only admin.

## 11. Empty states & onboarding

References
- [Navattic: Empty list](https://mobbin.com/screens/7e20ec0c-148b-48dd-82f7-4f4b14b0cb47?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): toolbar (search, filters, Create) stays visible. The empty panel has an illustration, "No product demos", a one-line hint and a primary CTA. Below it is a dismissable "Get started" inspiration card.
- [Copilot: Helpdesk empty state](https://mobbin.com/screens/bf4b8506-2424-470f-9620-c286480f53dd?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): left-aligned icon, "No articles have been created yet", **two sentences explaining what this content type is for**, "Learn more", "+ New article".
- [Substack: Getting started checklist](https://mobbin.com/screens/73b297c2-e58e-4b05-b64b-48001a69e072?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): dismissable card with a progress bar, open steps first, completed steps struck/greyed, and "Continue setup".
- [Searchable: Getting started](https://mobbin.com/screens/b3079404-1529-49f4-b72b-e83535cbe016?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): "2 of 6 completed" with progress, expandable steps each with an action button, and a compact progress widget mirrored in the sidebar.

Takeaways
- Use **one reusable `<CmsEmptyState>`** with icon, title, description and actions, and three variants: *first use* ("No blog posts yet" + description from the collection config + "Create your first post"), *no results* ("No posts match 'pekárna'" + "Clear filters"), and *error* (with Retry). Keep the toolbar visible in all of them.
- Let developers set a `description` per collection/global. Show it in empty states and as a subtitle in the list header. It teaches clients what each collection is for.
- Add a **dashboard setup checklist** for a fresh install (dismissable, persisted per user): "Fill in site settings", "Upload your logo", "Create your first page", "Invite a colleague", "Add a second language". Each step deep-links and auto-completes from real data. Show a small progress ring in the sidebar footer until it is dismissed.
- Empty block field: "This page has no content yet" with "Add your first block" opening the picker. Empty media library: a large dropzone ("Drag images here or browse").

---

## Design direction

**Target feel: "calm editorial workspace".** The admin should sit closer to Shopify admin / Squarespace / beehiiv than to Linear / Supabase. It should be friendly and spacious enough for a café owner editing a menu once a month, while staying crisp enough that agencies are proud to hand it over.

Recommendations, with the references behind them:
- **Surfaces:** a light neutral page background (`neutral-50`, a slightly warm grey works best) with white `UCard`s for content groups and 1px borders + very subtle shadow. Shopify's editor and Podia/Etsy forms show that cards on a tinted background make long forms scannable. The current one-column form has no grouping.
- **Density:** comfortable, not compact. Table rows ~52–56px with a thumbnail and two-line text (Wix, Podia, Circle). Form fields `size="md"`, 24px gaps between cards, max content width ~1100px for the editor (main ~720px + sidebar 340px). The dense 32px rows of Linear/Supabase/Braintrust suit developers and would overwhelm editors.
- **Type:** one sans family (Inter or Geist via Nuxt UI) with a clear scale. 24–28px semibold page titles (Squarespace "Welcome, Alex", Shopify "Add blog post"), 14px body, muted 13px meta text. Field labels in sentence case, never ALL CAPS.
- **Colour:** neutral UI with **one brand primary** used only for primary actions and the active nav. Use colour semantically for status (Draft neutral, Scheduled blue/info, Published green, Changed amber, Error red). Make the primary themeable per client agency via `app.config.ts` `ui.colors.primary`.
- **Navigation:** a left sidebar grouped by meaning, not by implementation. Use "Content" (collections with icons from config), "Pages"/"Settings" (globals), "Media", then "Team" and "Settings" at the bottom. Rename the "Collections"/"Globals" labels, which are developer vocabulary (Wix, Substack, Hashnode use task-based groups). Pin a "View website ↗" link at the top or bottom of the sidebar.
- **Feedback:** every save, publish and bulk action gets a `UToast` with an undo or "View" action where possible (Circle "Draft saved", Wix "Writer added", Customer.io "Invite sent"). Show save state in the editor header at all times.
- **Copy:** verbs on buttons ("Publish page", "Invite people"), consequences in confirms, no jargon ("slug" → "URL address", "global" → "settings", "entry" → the collection's singular label). All of it goes through i18n with Czech as a first-class locale, since the clients are Czech. Watch for longer Czech/German strings in buttons and tabs.
- **Dark mode:** support it through Nuxt UI tokens, but default to light. Client editors overwhelmingly expect light, document-like UIs (every CMS reference above is light).

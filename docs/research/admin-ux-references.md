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

---

## 0.6: roles, per-field permissions, per-language publishing (researched 2026-11-17)

An audit of the screens Wave 4 added, against Mobbin references (web). The screens were built on the existing admin language but had not been checked against references before.

### References
- Roles in an invitation: [Deel: Select access level](https://mobbin.com/screens/15fb662e-c13b-4a92-96c6-4e7b6a0eadf5) (radio cards, one sentence of what each level can do, "View" for the detail), [Braintrust: Invite members](https://mobbin.com/screens/8dcc5502-c679-491b-b9be-ed05142b3a66) (each group says what it can and cannot do), [Stripe: Invite team members](https://mobbin.com/screens/ff4ca78e-bf55-4da3-aecc-0de33734fb3d) (a "Role description" panel next to the picker), [Whop: Add team member](https://mobbin.com/screens/f9f7c91a-1c02-4eb1-938e-4d376917be46) (a role on the left, the areas it reaches on the right, each with one line).
- Roles overview: [Ditto: Permission groups](https://mobbin.com/screens/1ce613fa-cc7a-465b-b7ab-1963d02fd398) (a small table: role, what it reaches, level, number of people).
- Fields someone cannot change: [Workable: Edit](https://mobbin.com/screens/37176881-d027-402b-8f1a-2e3fc965020c) (the reason in one sentence above the greyed fields), [Hers: Change account details](https://mobbin.com/screens/015cd00e-9165-4758-b631-afa678cb0f32) (greyed fields plus who to ask), [Revolut Business: Unable to edit](https://mobbin.com/screens/dd1bd214-13a7-4d8f-b08f-3fb2195e6072) (why, and the way out).
- Translating: [Framer: Localization](https://mobbin.com/screens/cab90995-61cb-40c7-be45-0a5ba01dee45) (the source text and the translation side by side, row by row), [Arcade: Translations](https://mobbin.com/screens/35876cc2-3566-486f-b26a-98877bfc3d19) (source column next to the language column), [ElevenLabs: Dubbing](https://mobbin.com/screens/a9a9128a-7790-4f2c-8e38-9dd63d3cce9d) (original → translation per block).
- A language's state: [Shopify: Localized content](https://mobbin.com/screens/9c2f3c90-c11a-4366-b32a-22fefc86a863) (a side card: "Unpublished — translations aren't visible to customers until the language is published"), [Better Stack: Translations](https://mobbin.com/screens/fc282a1b-ebdd-4d88-a535-4024d3bc0e69) (each language: "Published ↗" or nothing, "Original translation" under the source), [Webflow: CMS bulk](https://mobbin.com/screens/dd515b44-e526-45f0-9150-cf4bd2a411e6) (states in words: "Staged for publish", "Not published"), [Wix: Multilingual](https://mobbin.com/screens/900d1216-8419-4f42-aa51-7792675243e1) (the main language explained in one sentence).

### What holds up
- The invitation already follows Deel/Braintrust: radio cards, each role with one sentence. The removed-role screen and the Team warning say what happened and what to do (Revolut's pattern). The closed media library explains itself.

### What to change
1. **Custom roles say nothing about themselves.** A role without a `description` reads "Jako Editor, s úpravami" ("like Editor, with changes"). Write the sentence from the definition instead (Whop, Braintrust): what it edits, what it only reads, whether it publishes, which files. Show it in the invitation, the role menu and in a "What can each role do?" overview on Team (Ditto).
2. **A locked field looks editable.** Fields under `.access({ edit })` are only dimmed to 85 %. Make them read as locked (muted fill, a lock in the field) and say why and who can change it, once, next to the group (Workable, Hers): "Only Editor and Administrator can change this."
3. **Translating is blind.** An empty translated field is blank, and the note "Empty — the default language shows" sits under the editor. Show the default language's text in the empty field, greyed, with "Shown in Czech until you translate it", and keep the copy action next to it (Framer, Arcade). Long texts: a "Show Czech next to it" view on wide screens.
4. **Whose state is it?** The top bar says "Koncept" on an English page while Czech is live. Name the language: "English · Draft"; under a draft default: "English · waiting for Czech". One word for each state everywhere (the list says "Na webu", the language menu "Zveřejněno").
5. **The review step for a translation.** It says an empty field means "visitors see the page without it", but they see the Czech text. Title it "Publish the English version", and when the default is a draft say it goes live together with Czech (Shopify's side card).
6. **Icons alone in the list.** The language column shows EN ●/○/⏳ with no words: give each a tooltip and an accessible name in words, and show it on phones too (the card list drops it).
7. **An address that isn't live yet** (/en/blog/summer-camp ↗) looks like a link to the live page. Say "not on the website yet" and point to the preview instead.
8. **Phones**: the language switcher is not in the editor's top bar at phone width; it must be reachable.

---

## 0.7: the client's logo and colour in the admin (researched 2026-11-18)

How admins let a customer put their own logo and colour on screens other people use, for 0.7 (admin theming). Web, Mobbin.

### References
- Brand settings: [Stripe: Branding](https://mobbin.com/screens/bb1a2f30-5b95-4ad8-9366-57f255cae3de) (an **Icon** and a **Logo**, "Prefer logo over icon", a brand colour and an accent colour; one preview per surface: email receipts, checkout, customer portal, invoice), [Stripe: Customer portal](https://mobbin.com/screens/cfd50149-0fe1-44c6-b7ee-6784c5519677) (the same two colours reach every surface), [Shopify: Brand, logos](https://mobbin.com/screens/069d7eeb-28bb-4323-8f1c-699864c37bba) (a **Default** logo, "512 px wide minimum", and a **Square** logo, "512×512, may be cropped into a circle"), [Shopify: Brand, small logo warning](https://mobbin.com/screens/fc31e4d8-0782-4107-a896-07561e84c320) ("less than 512 px … may not be used by some apps and channels", said under the picture, not as an error), [Shopify: Brand, colours](https://mobbin.com/screens/679f840d-adfc-4996-bb96-1d4102d6acee) (a **Primary colour** and its **Contrasting colour**, the text on it, filled in for you).
- White-label settings: [Searchable: White-labelling](https://mobbin.com/screens/ac13f794-e37f-4ff0-a2b8-6b9017c516ac) (**Full logo** "shown in the header", **Icon / favicon** "for compact branding and browser icons"), [Hex: Workspace styling](https://mobbin.com/screens/05334f76-c5e6-4cdb-9ecd-2639cdf51774) (the logo "replaces the Hex logo in the top left corner", "Use logo as favicon", a preview in light and dark), [Okta: Brand theme](https://mobbin.com/screens/8737c147-e992-4323-9a11-bfd5cf02bd41) (logo "landscape, transparent background, min 420×120", favicon "512×512, 1:1", one **Primary colour** "for primary actions, buttons, text links"; the same theme for the sign-in page and the emails), [Langdock: Customizations](https://mobbin.com/screens/45b742c2-0164-4431-994f-d5f90d9c6a2e) (one custom colour, "main color for buttons and highlights"), [Bonsai: Brand](https://mobbin.com/screens/5b0ded3b-6d7e-491f-a1b4-04f78f4f830e) (brand colour "for client-facing buttons and links. Dark color recommended"; three levels of the provider's own branding: show, show both, remove).
- Contrast: [Canny: Brand colour](https://mobbin.com/screens/c79654e5-2bbe-430e-8383-94cc6d2f0813) (a brand colour with a contrast check in light and dark: the ratio, pass or fail for small and large text).
- Sign-in: [HoneyBook: Customize portal](https://mobbin.com/screens/dd6c5fb0-3929-4a3d-b7e2-2fce4760983d) (a sign-in card with the client's logo, "Logo shape: Square / Full"), [Employment Hero: Login logo](https://mobbin.com/screens/22efc406-50b1-4922-a7e0-3517c3e2b9e8) ("horizontal PNG or JPG, 400×60, transparent background", previewed on the sign-in page).
- Emails: [Shopify: Email templates](https://mobbin.com/screens/b510efcc-7336-4456-aa9b-79f45f7d5275) (a logo with a size slider and one accent colour for the buttons), [PandaDoc: Branding and emails](https://mobbin.com/screens/95bddda6-07dd-45c1-ac36-a082c66ce437) (company logo, button colour, button text colour, a small email preview).

### What holds up
- **Two logos is the norm.** A wide one for headers and sign-in, a square one where there is little room (Stripe's icon, Shopify's square, Searchable's icon / favicon). The favicon comes from the square one (Hex, Searchable), not as a third upload.
- **One colour, used for actions.** Okta and Langdock say it plainly: buttons, highlights, links. Nobody asks for shades. Shopify fills in the contrasting text colour itself.
- **Contrast is checked, not trusted.** Canny shows the ratio in light and dark. Bonsai's hint ("dark colour recommended") is the cheap version of the same thing.
- **Size guidance is a sentence, not an error** (Shopify, Okta, Employment Hero): what the logo should be, and a warning when it is too small.
- **The emails follow the brand** (Shopify, PandaDoc, Okta): the logo at the top, the button in the brand colour, the text on it readable.

### What this means for tinyzoo 0.7
1. **A logo set, not one picture.** A full logo (sign-in, the open sidebar, emails) and a square mark (the folded sidebar, the phone's top bar, the tab icon, the phone's home-screen icon). Each may have a dark version. Without a mark, the initials tile stays.
2. **One brand colour, any hex.** tinyzoo derives the shades, a dark-mode version and the text colour on it, and uses them only where the accent is today: main buttons, the active menu item, focus rings, links. Status colours, the greys, cream and the animals stay.
3. **A contrast guard** in place of Canny's checker: in a code-first admin nobody picks the colour on a screen, so tinyzoo adjusts an unreadable colour to the nearest readable one (WCAG AA, 4.5:1 for text and links, 3:1 for focus rings) and tells the developer in development what it changed and why.
4. **Emails carry the brand** the way Shopify's do: the full logo as a PNG (Gmail and Outlook do not show SVG), the button in the brand colour with its derived text colour.
5. **Guidance in the docs, warnings in development**: the sizes and formats each logo should have, and a warning when a file is missing or the mark is not square.
6. **Previews come later.** Stripe and Okta preview each surface because people change their brand in the browser. A code-first site changes it in `app.config.ts` and sees the admin. A hosted tinyzoo would need the preview, so the theme is one serialisable object resolved at runtime: stored settings could fill it later with no change to the config API. Inside tinyzoo that would still take work: the server would read each site's settings per request (`cmsAdminTheme(event)`), and the admin's fallback that resolves `app.config` in the browser could not be relied on.

# tinyzoo cloud

The hosted way into tinyzoo: someone makes an account, picks a template, names their site, and gets a running tinyzoo site with an admin of their own.

This is the first working version. It runs **locally**: every website is a process on this machine. Nothing here deploys anything.

## Run it

```sh
pnpm install
pnpm --filter tinyzoo-cloud templates:build   # once: builds the templates the sites run from
pnpm --filter tinyzoo-cloud dev               # http://localhost:3200
```

It needs Postgres. `cloud/.env` points at it (`cp cloud/.env.example cloud/.env`); the default is the repository's own (`postgres://cms:cms@localhost:5434/tz_cloud_dev`). The database is migrated when the app starts. With the local driver the same server holds each site's database, so the user must be allowed to create databases.

Use Chrome, Edge or Firefox locally. A site's address is `http://<slug>.localhost:<port>`, and tinyzoo's sign-in cookie is marked `Secure`; these browsers accept that on `localhost` names. (`NUXT_HOSTING_LOCAL_PUBLIC_URL` gives the sites another address; see the local driver below.)

## What a person can do

| | |
|---|---|
| **Start** (`/`) | What the product is, and *Create your website*. Signed in, it leads to *My websites*. |
| **Create a website** (`/new`) | Up to four steps on one route: a template (a gallery with a field filter; every card shows the template's real first screen, with small pictures of its other looks to glance at), its look (only for a template with several: tall pictures of real sites, side by side), the site's name and address (checked as you type; the chosen look is shown beside the form with the typed name where the look writes it), an account (skipped when signed in). A reload keeps the step and what was typed, never the password. |
| **Watch it being made** (`/sites/:id`) | The four real steps with their real state: database, starting the site, demo content, your account. A failure says what failed in plain words, and *Try again* goes on from that step. |
| **The site's page** (`/sites/:id`) | Its address with a live picture of the home page, the way into its admin, its template and the look it shows now, when it was made, and *Delete this website* (the address typed out). |
| **My websites** (`/sites`) | A card per site with its state, and *Create another*. The limit per account is explained when it is reached. |
| **Account** (`/account`, `/login`, `/forgot`) | Sign in and out, name, language, password, forgotten password, and confirming the e-mail address. |

Czech is the default language, English the other. The switch is in the top bar; the choice is kept in a cookie and on the account. Every text is in `app/i18n/cs.ts` and `app/i18n/en.ts`.

### Into the admin

tinyzoo has no single sign-on, so the hand-off is an **invitation**. When a site is made, the cloud invites its owner as an administrator and keeps the link. The site's page shows *Set your password for the admin*; the owner opens the link, chooses a password and is signed in. From then on the page says *Open the admin*. A link works for 7 days; *Make a new link* makes another one (the old one stops working).

### E-mail

With `NUXT_MAIL_TRANSPORT=log` (the default) e-mails are printed to the server log. In development the pages then show the links themselves (confirm your e-mail, a new password), as Keeper does with invitations. In production they never do.

`NUXT_REQUIRE_VERIFIED_EMAIL=true` makes a site only after its owner confirmed their e-mail: the wizard's answers are saved as a site that waits, and it starts being made when the link is opened.

## Settings

| Variable | |
|---|---|
| `NUXT_DATABASE_URL` | Postgres for the cloud's own data (or `DATABASE_URL`) |
| `NUXT_APP_SECRET` | seals the sign-in cookie, 32+ characters |
| `NUXT_CLOUD_SECRET` | encrypts what is kept about each site (its secrets, the invitation link), 32+ characters. Changing it makes them unreadable |
| `NUXT_PUBLIC_URL` | the cloud's own address, for links in e-mails |
| `NUXT_MAX_SITES_PER_USER` | how many websites one account may have (default 3) |
| `NUXT_REQUIRE_VERIFIED_EMAIL` | `true`: a site is made only after the e-mail is confirmed. Default: `false` in development, `true` in production |
| `NUXT_PUBLIC_SHOW_PLANNED` | `true` shows the planned templates (those not built yet) in the gallery as they were designed, marked *Not available yet* and not selectable. Without it a customer never sees them |
| `NUXT_HOSTING_DRIVER` | `local` (default) or `pushbase` |
| `NUXT_HOSTING_LOCAL_PORT_FROM`, `_TO` | the local driver's ports, one per site (default 4300–4399) |
| `NUXT_HOSTING_LOCAL_DATA_DIR` | where the sites' folders live (default `cloud/.data/sites`) |
| `NUXT_HOSTING_LOCAL_DATABASE_PREFIX` | what the sites' databases are called before the slug (default `tzc_`) |
| `NUXT_HOSTING_LOCAL_PUBLIC_URL` | the pattern of the sites' public addresses (default `http://{slug}.localhost:{port}`). With another one, such as `https://{slug}.pushbase.app`, something in front of the sites must lead those names to their ports |
| `NUXT_HOSTING_LOCAL_ROOT` | the repository's root, where templates are found (default: found from the working directory) |
| `NUXT_HOSTING_PUSHBASE_TEMPLATES_DIR`, `_DATABASE`, `_TEAM` | the Pushbase driver: a folder of standalone template projects, the shared Postgres to link, the team for new projects |
| `NUXT_SERVICE_EMAIL` | the account the cloud keeps on every site (default `cloud@tinyzoo.invalid`) |
| `NUXT_MAIL_TRANSPORT`, `NUXT_MAIL_FROM`, `NUXT_MAIL_SMTP_*` | e-mail, as in Keeper: `log` prints, `smtp` sends |
| `NUXT_DEV_MAIL_LINKS` | `false` hides the development notes that show an e-mail's link on the page (the walkthrough sets it) |
| `CLOUD_DEV_HOSTS` | more names the dev server answers to (`.pushbase.app`), for a proxy in front of it |

The sign-in cookie is called `tinyzoo-cloud`, not nuxt-auth-utils' default: on `localhost` cookies are shared across ports, and the sites use the default name.

## How a site gets made

A site is made in four steps, kept in the database (`sites.steps`, the state machine in `shared/steps.ts`):

1. **database** and 2. **start**: the hosting driver's part. Infrastructure only, until the site answers `GET /api/health/ready`.
3. **content**: the cloud runs the template's seed (`pnpm seed` in the template's source folder) against the running site. On a fresh site the seed makes the first account with the setup code: the service account "tinyzoo", with a random password. Then it fills the demo content.
4. **account**: the cloud signs in as the service account, writes the site's name into its settings (and, for a template with looks, the chosen look and its default colours), and invites the owner as an administrator.

Steps 3 and 4 are the same for every driver (`server/utils/provision.ts`). They run in the background, never inside a request. Each step is written down before and after, so:

- a failure shows where it was, and *Try again* goes on from there;
- a restart of the server picks up the sites that were mid-way (`server/plugins/1.resume.ts`), and starts the ready ones that are not running;
- two runs never work on the same site (a Postgres advisory lock per site).

What the cloud keeps about a site is encrypted at rest with `NUXT_CLOUD_SECRET` (AES-256-GCM, as Keeper does): the site's app secret, its setup code, its status token, the service account's password, and the invitation link. None of it is ever sent to the browser, except the invitation link, to the owner, until they have used it.

### Hosting drivers

`server/hosting/types.ts` is the interface the rest of the app talks to:

```ts
interface HostingDriver {
  provision(spec, onStep): Promise<{ publicUrl, internalUrl, state }>  // resolves when the site answers
  ensureRunning(site): Promise<void>                                    // after a restart of the cloud app
  remove(site): Promise<void>
  describe(site): Promise<{ running: boolean, memoryBytes?: number }>
}
```

**`local`** (`server/hosting/local.ts`) is the one that works. The template is built once; one build serves any number of sites, since everything per site comes from the environment. Per site:

- a database `tzc_<slug>` on the cloud's own Postgres server;
- a port from the range, written down before the next one is picked;
- a folder `cloud/.data/sites/<slug>/` with its uploads, its log (`site.log`) and `site.json` (port and pid);
- a detached process: `node <template>/.output/server/index.mjs --site-dir=<folder>`, with a clean environment.

Its address is `http://<slug>.localhost:<port>`, so each site keeps its own cookies; the cloud itself talks to `http://127.0.0.1:<port>`. `NUXT_HOSTING_LOCAL_PUBLIC_URL` changes the address people see and the one the site itself is told (its links, its invitation), not where it runs: with `https://{slug}.pushbase.app` every page and e-mail says that, and whatever stands in front must lead the name to the site's port. The recorded walkthrough does that for its own browser (below); ordinary development needs nothing. Before the driver stops a process it checks that the process's command line names the site's folder (the `--site-dir` argument). A pid alone is never trusted. *Delete* stops the process, drops the database and removes the folder.

After `templates:build` runs again, restart the sites (stop the app, stop their processes, start the app): a running site keeps loading pieces of the build it was started from.

**`pushbase`** (`server/hosting/pushbase.ts`) is **written, not exercised**. It goes through the published CLI only (`npx -y pushbase@0.3.0 … --json`): a project named by the slug, the workspace's shared Postgres linked, storage created and linked, the environment set over stdin, the template folder deployed, then a wait until `https://<slug>.pushbase.app` answers. No command that creates or changes anything has been run from it. Known gaps, also listed in the file: the CLI (0.3.0) cannot delete a project, so `remove` says so; a template must be a standalone project there (the starter inside this repository depends on the workspace); every site is built on the platform again.

### Templates

`shared/templates.ts` is the registry: twenty-one entries, each with its name, one sentence and three or four points in both languages, its field for the filter, its animal, and its looks (id, name and one sentence in both languages): 52 looks in all. Every template is ready: **Basic website** (`basic`, from `packages/cms/starter`) and the twenty hosted ones from `templates/<id>` (`hosted(…)`; Photographer is the pilot). A template that is not built yet is `planned(…)`: the gallery shows it only with `NUXT_PUBLIC_SHOW_PLANNED=true`, marked as not available, and the server refuses to make a site from it whatever the flag says.

A template may come in several **looks**: one content model, one set of demo content and one build, drawn in different designs. Photographer has three (Ateliér, Negativ, Zápisník). The registry lists a template's looks (id, name and one sentence in both languages, and for a ready template the look's default colours); the wizard shows them as its second step; the choice is kept in `sites.look`, written into the site's settings (`look`, `colors`) when the site is made, and its owner changes it afterwards in the site's admin (*Site settings*). The cloud follows that change: the site's page asks the site which look it shows and keeps the answer. How a template implements looks: [`templates/README.md`](../templates/README.md).

**The pictures** (`public/templates/<template>/<look>-<kind>.webp`) are made by a script, never by hand:

```sh
pnpm --filter tinyzoo-cloud pictures          # the planned templates, from the designs folder (template-designs/)
pnpm --filter tinyzoo-cloud pictures --real   # the built templates, from real sites the script makes (about ten seconds a look)
pnpm --filter tinyzoo-cloud pictures --real --only wedding   # only these built templates
```

The built templates' sites are pictured with the browser's clock at a weekday morning (the first Wednesday from the day of the run, 9.40), so what a template works out from "now" (open or closed, today's lessons) looks the same whenever the script runs.

From the designs (a planned template), a look is alive when `template-designs/<slug>/<a|b|c>.html` exists; its name is the `## A · Name` heading of the folder's `notes.md`, its picture `shots/<letter>-top.jpg`. Each look gets a `card` (800 × 500) and a `thumb` (240 × 150). A built template's looks get, from a real site with the demo content, also `top` (the first screen with the site's name left out) and `tall` (the top of the home page, for the look step), and the script measures where and how the site writes its name and copies that typeface's files to `public/templates/fonts/`: that is how the wizard writes the typed name into the look. What the script found is in `shared/template-pictures.json`; a unit spec keeps the registry's looks equal to it. The designs folder is not in the repository: the script looks for it beside the repository (or beside the main checkout of a worktree), or takes `--designs <folder>`.

Adding a real template: make its entry `hosted(…)` with each look's default colours, add it to `BUILT_TEMPLATES` in `scripts/lib.mjs` (what its demo content is called, where it writes the site's name) and its checks to `scripts/e2e-templates.mjs`, then run `templates:build <id>`, `pictures --real --only <id>` and `e2e --templates <id>`. The steps for the template itself: [`templates/README.md`](../templates/README.md).

A look that writes the site's name large on its first screen (a wedding's names) is measured there instead of in the header (`wordmark` in `BUILT_TEMPLATES`): the wizard sets a long name smaller until it fits (`fit`), in italics where the look does.

## Checks

```sh
pnpm --filter tinyzoo-cloud typecheck
pnpm vitest run --project unit test/unit/cloud-*.spec.ts   # slugs, the step machine, ports, the registry and the texts
pnpm --filter tinyzoo-cloud e2e                            # the whole flow in a browser, then every hosted template in every look and palette
pnpm --filter tinyzoo-cloud e2e --templates wedding        # only these hosted templates' part (about half a minute each)
pnpm --filter tinyzoo-cloud walkthrough                    # films the walkthrough and takes the screenshots into cloud/.preview/, about 40 minutes
pnpm --filter tinyzoo-cloud walkthrough --quick            # the two films small and fast, to try things out, about 10 minutes
```

A second checkout on the same machine (a git worktree) runs these beside the first with `CLOUD_RUN_TAG=tpl CLOUD_PORT_SHIFT=200`: databases and ports of its own (`e2e` and `pictures`; see `scripts/lib.mjs`).

`e2e`, `walkthrough` and `pictures --real` start a cloud app of their own beside yours (database `tz_cloud_e2e` / `tz_cloud_walk` / `tz_cloud_pics`, sites under `.data/e2e` / `.data/walk` / `.data/pics`, their own ports and database prefix) and remove what they made. `--keep` leaves it. `walkthrough --url http://localhost:3200` records against a running app instead, with that app's addresses, and leaves its main site there.

### The walkthrough

`scripts/walkthrough.mjs` tells the product's story in Czech and makes, in `cloud/.preview/`: `walkthrough-desktop.mp4` (the master, 2880 × 1620 at 60 frames a second), `walkthrough-desktop-1080p.mp4` (a copy for sharing), `walkthrough-phone.mp4` (1170 × 2532 at 60 frames a second), `screens/*.png`, `looks/*.jpg` and `index.html`. `--only desktop|phone|screens|index` makes one part.

- **The films are not screen recordings.** The pages run slowed down (timers, animation frames and CSS animations alike) and a picture is taken at device resolution for every frame, which ffmpeg encodes (`scripts/film.mjs`). So the text is sharp, the pace even, and nothing is dropped; the log says how many frames had to be repeated. A pointer is drawn (a touch point on the phone), moved and clicked like a hand.
- **Real-looking addresses.** Everything a person sees says `https://<slug>.pushbase.app` and `https://tinyzoo.pushbase.app`: the local driver gets that pattern, and the script starts a small https proxy with a certificate made on the spot, which the recording browser alone is sent to (`--host-resolver-rules`). That browser knows no other name, the script proves it before it opens anything (with a name that exists nowhere), and stops if the proof fails. Nothing talks to the real pushbase.app, and nothing on the machine is changed. `--domain example.cz` (or `SHOWCASE_DOMAIN`) uses another domain, `--domain none` plain local addresses.
- **No wording.** Things are found by data attributes, field names and addresses, and the admin's two buttons by their keys in the admin's dictionary: the script survives a change of the texts. What it types (the people's names, the new heading) is at its top.

## Not built

- Payments and plans.
- Custom domains.
- Real e-mail delivery set up (the SMTP transport is there, as in Keeper; nothing is configured).
- Deploying: the cloud app itself has no deployment, and the Pushbase driver has not been run.
- Single sign-on from the cloud account into a site's admin (today: the invitation).
- The site's own logo in its admin (its name is there: `cms.admin.nameFrom`).
- Deleting an account, changing its e-mail address, and anything for the people who run the service (a list of all sites, stopping one).
- Stopping idle sites. A running site holds about 360 MB of memory, whether anyone visits it or not.

## Schema

`server/db/schema.ts`: `users`, `email_tokens` (the links sent by e-mail, stored as SHA-256), `sites` (with the template and the look each was made from). After a change run `pnpm --filter tinyzoo-cloud db:generate` and commit the migration.

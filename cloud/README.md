# tinyzoo cloud

The hosted way into tinyzoo: someone makes an account, picks a template, names their site, and gets a running tinyzoo site with an admin of their own.

This is the first working version. It runs **locally**: the websites are processes on this machine, one per website or, with the shared driver, one per app (one for the twenty hosted templates, one for the Basic website). Nothing here deploys anything.

## Run it

```sh
pnpm install
pnpm --filter tinyzoo-cloud templates:build   # once: builds the two apps the sites run from (about 50 s, 6.5 GB of memory at its peak)
pnpm --filter tinyzoo-cloud dev               # http://localhost:3200
```

It needs Postgres. `cloud/.env` points at it (`cp cloud/.env.example cloud/.env`); the default is the repository's own (`postgres://cms:cms@localhost:5434/tz_cloud_dev`). The database is migrated when the app starts. With the local driver the same server holds each site's database, so the user must be allowed to create databases; with the shared driver each site also gets a database user of its own, so the user must be allowed to create those too.

Use Chrome, Edge or Firefox locally. A site's address is `http://<slug>.localhost:<port>`, and tinyzoo's sign-in cookie is marked `Secure`; these browsers accept that on `localhost` names. (`NUXT_HOSTING_LOCAL_PUBLIC_URL` gives the sites another address; see the local driver below.)

## What a person can do

| | |
|---|---|
| **Start** (`/`) | What the product is, and *Create your website*. Signed in, it leads to *My websites*. |
| **Create a website** (`/new`) | Up to four steps on one route: a template (a gallery with a field filter; every card shows the template's real first screen, with small pictures of its other looks to glance at), its look (only for a template with several: tall pictures of real sites, side by side), the site's name and address (checked as you type; the chosen look is shown beside the form with the typed name where the look writes it), an account (skipped when signed in). A reload keeps the step and what was typed, never the password. |
| **Watch it being made** (`/sites/:id`) | The four real steps with their real state: database, starting the site, demo content, your account. A failure says what failed in plain words, and *Try again* goes on from that step. |
| **The site's page** (`/sites/:id`) | Its address with a live picture of the home page, *Open the admin* (through the account, below), its template and the look it shows now, when it was made, and *Delete this website* (the address typed out). With the shared driver also: how much of its plan's storage it uses, *Your own domain* (add a domain, see what its DNS must say, make it the main address) and, in a quiet place, *Move this website* (its archive to download, and where it lives now). A website that moved away shows its new address and *Delete the data here*. |
| **My websites** (`/sites`) | A card per site made here with its state and *Open the admin*, and *Create another*; the limit per account is explained when it is reached. Below them, apart: the websites the person **connected** (name, address, *Open the admin*), and the websites of **other owners** the person signed in to through their account, with their role there and *Open the admin* only. |
| **Move a website here** (`/sites/import`) | With the shared driver: the archive of a tinyzoo website that ran elsewhere and an address for it. It becomes a new website of the same template with its content, users and files; the page shows the steps as for a new one. |
| **Connect a website** (`/sites/connect`) | For a tinyzoo site that was not made here, such as a custom site on its own server: its name and address in, three environment lines for that website out. The secret is on screen once. Connected websites are listed with *New secret* (the old one stops working) and *Disconnect*. They do not count against the limit of websites. |
| **Account** (`/account`, `/login`, `/signup`, `/forgot`) | Sign in and out, name, language, password, forgotten password, and confirming the e-mail address. `/signup` makes an account without a website, for somebody who was invited to another person's site and came from its sign-in. |

Czech is the default language, English the other. The switch is in the top bar; the choice is kept in a cookie and on the account. Every text is in `app/i18n/cs.ts` and `app/i18n/en.ts`.

### Into the admin

The way in is the **account**. Every site made here is a client of the cloud's account service (below). *Open the admin*, on the site's page and on its card, leads to `<site>/api/cms/_auth/account/start?next=/admin`: the site sends the browser to the cloud, the cloud knows the person and sends it straight back, and the site opens its own session. There is no second password to choose.

The site still needs a user of its own for its owner, so the cloud still invites the owner as an administrator when the site is made. The site accepts that invitation the first time the owner arrives through the account, by the account's **confirmed** e-mail: also when the owner comes back after more than a week, because the proof is the confirmed e-mail and not the invitation's link. The link stays on the site's page as a quiet second way (*Or set a password for this website's admin only*) until the owner has been in. A link works for 7 days; *Make a new link* makes another one (the old one stops working).

The cloud learns that the owner has been in from the site itself: the site tells the account service that it lets the owner in (`membership`, right after the sign-in), and the site's page then drops the invitation link. For an owner who went in with the link and a password, the cloud asks the site whether anybody still waits on an invitation, as before.

A person whose e-mail is not confirmed cannot be let in through the account: a site links a person by a confirmed e-mail only. Their site's page says so in place of *Open the admin*, with the way to send the confirmation again; the invitation link works meanwhile. If they press the account button on the site's own sign-in page anyway, the site says the same: confirm the account's e-mail first.

What the site does with all this (`cms.auth.account`, its `/api/cms/_auth/account/*` routes, the switcher in its admin) is tinyzoo's own part of the contract, in `packages/cms`.

### The account service

The cloud app is the **issuer** of sign-in for websites: a person has one account here, and a website asks it who the person is. The contract between the two is `docs/multi-tenant-plan.md`, section 2.15; this is the issuer's side of it. Authorization code with PKCE (S256), and nothing else.

| | |
|---|---|
| `GET /oauth/authorize` | A website sends the person's browser here. A signed-in person is sent back at once with a one-time code (no question is asked: the clients are the person's own websites). Nobody signed in: the sign-in page, which comes back to the same address afterwards, also after making an account; with `prompt=none`, back to the website with `error=login_required`. An unknown or revoked client, or a `redirect_uri` that is not exactly the client's address + `/api/cms/_auth/account/callback`, gets an error page and never a redirect. |
| `POST /oauth/token` | The website's server exchanges the code (JSON, with its client secret and the PKCE verifier) for `{ user: { sub, email, email_verified, name, locale } }`. A code works once and for 60 seconds. The person becomes a member of the client. |
| `POST /oauth/sites` | The website's server asks for a person's other websites (its switcher). Only clients **of the same owner** as the asking one that the person is a member of, or owns. |
| `POST /oauth/membership` | The website's server says which role the person has there, or that it no longer lets them in. Rights stay on the website; the cloud keeps this only to show it. |
| `GET /.well-known/tinyzoo-account` | Where the four endpoints are. |

A **client** is one website: a site made here (the client is made before the site starts, and revoked when the site is deleted), or a website somebody connected (`/sites/connect`). It belongs to one account, its owner. A sign-in can only come back to the client's own address. Client secrets and codes are stored as SHA-256; a cloud-made site's secret is also kept, encrypted, with the site's other secrets, so that a retry or a restart hands the same one over.

A **member** is a person who signed in to a client. The issuer does not know what the website then did with them (a website that finds nobody of that e-mail turns the person away), so a member is listed, in *My websites* and in the switcher of the owner's other websites, only once the website has said that it lets them in (`membership` with a role, which a website sends right after it opens its session and before it sends the browser on), and until it says that it no longer does. A website can only speak about people who signed in to it (404 otherwise). A report that leaves the role out, or sends one that is not a short plain text, changes whether the person is let in and keeps the role: that is what a website sends about somebody it turned away (`{ sub, role: "", active: false }`), who is then listed nowhere. `sites` answers `role: null` for a website that has not said the role yet; a switcher lists it by its name alone.

A site gets its client as three settings, `NUXT_CMS_AUTH_ACCOUNT_ISSUER` (the cloud's own address, `NUXT_PUBLIC_URL`), `NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID` and `NUXT_CMS_AUTH_ACCOUNT_CLIENT_SECRET`: in its environment with the local driver, and in its row of the site directory (`config.auth.account`) with the shared one.

The three routes a website's server calls are outside `/api/**` and so outside the cookie API's cross-site guard (`server/middleware/csrf.ts`): they never read the cloud's session and prove themselves with the client secret. Failed tries are limited in memory, as the app's other limits are: fifty from one address within ten minutes, and thirty bad codes sent with a client's right secret. A wrong secret does not count against the client it names (the client id is public, and anybody could lock a website's sign-in out with it).

`/login?next=…` and `/signup?next=…` come back to `next` only when it is a path of this app (`shared/account.ts`, `returnPath`); anything else leads to *My websites*.

### E-mail

With `NUXT_MAIL_TRANSPORT=log` (the default) e-mails are printed to the server log. In development the pages then show the links themselves (confirm your e-mail, a new password), as Keeper does with invitations. In production they never do.

`NUXT_REQUIRE_VERIFIED_EMAIL=true` makes a site only after its owner confirmed their e-mail: the wizard's answers are saved as a site that waits, and it starts being made when the link is opened.

## Settings

| Variable | |
|---|---|
| `NUXT_DATABASE_URL` | Postgres for the cloud's own data (or `DATABASE_URL`) |
| `NUXT_APP_SECRET` | seals the sign-in cookie, 32+ characters |
| `NUXT_CLOUD_SECRET` | encrypts what is kept about each site (its secrets, the invitation link), 32+ characters. Changing it makes them unreadable |
| `NUXT_PUBLIC_URL` | the cloud's own address: for links in e-mails, and the issuer address every site is told for sign-in through the account. The sites' servers must be able to reach it |
| `NUXT_REDIRECT_HOSTS` | host names the app used to be reached at, separated by commas: a page asked for on one of them is redirected (301) to `NUXT_PUBLIC_URL`. The API, `/oauth` and `/.well-known` still answer there |
| `NUXT_ACCOUNT_CODE_TTL_SECONDS` | how long a one-time code of a sign-in works. 60, and never more; `e2e:account` sets 3 so that it need not wait for a code to grow old |
| `NUXT_MAX_SITES_PER_USER` | how many websites one account may have (default 3) |
| `NUXT_REQUIRE_VERIFIED_EMAIL` | `true`: a site is made only after the e-mail is confirmed. Default: `false` in development, `true` in production |
| `NUXT_PUBLIC_SHOW_PLANNED` | `true` shows the planned templates (those not built yet) in the gallery as they were designed, marked *Not available yet* and not selectable. Without it a customer never sees them |
| `NUXT_HOSTING_DRIVER` | `local` (default), `shared` or `pushbase`; `none` makes no website: the app is the account service alone (*Deploying the account service*, below) |
| `NUXT_HOSTING_LOCAL_PORT_FROM`, `_TO` | the local driver's ports, one per site (default 4300–4399) |
| `NUXT_HOSTING_LOCAL_DATA_DIR` | where the sites' folders live (default `cloud/.data/sites`) |
| `NUXT_HOSTING_LOCAL_DATABASE_PREFIX` | what the sites' databases are called before the slug (default `tzc_`) |
| `NUXT_HOSTING_LOCAL_PUBLIC_URL` | the pattern of the sites' public addresses (default `http://{slug}.localhost:{port}`). With another one, such as `https://{slug}.pushbase.app`, something in front of the sites must lead those names to their ports |
| `NUXT_HOSTING_LOCAL_ROOT` | the repository's root, where the apps and templates are found (default: found from the working directory) |
| `NUXT_HOSTING_SHARED_PORT_FROM`, `_TO` | the shared driver's ports, one per app (default 4400–4419) |
| `NUXT_HOSTING_SHARED_DATA_DIR` | where the apps' folders live: the site directory, the sites' uploads (default `cloud/.data/shared`) |
| `NUXT_HOSTING_SHARED_DATABASE_PREFIX` | what the sites' databases and database users are called before the site's id (default `tzs`) |
| `NUXT_HOSTING_SHARED_ROOT` | the repository's root, where the apps and templates are found (default: found from the working directory) |
| `NUXT_HOSTING_SHARED_SESSION_COOKIE` | another name for the sites' session cookie, such as `__Host-tinyzoo` (default: empty, tinyzoo's own name). An app's process gets it as `NUXT_SESSION_NAME` the next time the driver starts it |
| `NUXT_HOSTING_SHARED_DIRECTORY` | where the shared driver keeps the site directory: `file` (default: `sites.json` in each app's folder) or `postgres` (the table `tenant_sites` in the cloud's own database) |
| `NUXT_HOSTING_SHARED_DIRECTORY_KEY` | encrypts every secret in the site directory, 32+ characters. Required for `postgres`; with `file` it is optional, and without it the file holds the secrets in plain text. Keep it: the process of each app is given it, and a new one makes the stored rows unreadable until they are written again |
| `NUXT_HOSTING_DOMAIN_TARGET` | where a customer's own domain must lead before it is used: a host name (the target of a CNAME) and/or IP addresses, separated by commas. Without it no domain is ever verified in production |
| `NUXT_HOSTING_IMPORT_MAX_MB` | the largest archive of a website that is taken in (default 2048) |
| `TINYZOO_PG_DUMP`, `TINYZOO_PG_RESTORE`, `TINYZOO_PSQL` | the Postgres tools `tinyzoo backup` and `restore` use when a website is moved; handed on to tinyzoo's command line as they are. Unset: the tools on the `PATH`. `scripts/pg-tools` has wrappers that run them inside a Postgres container (`TINYZOO_PG_CONTAINER`) |
| `NUXT_HOSTING_PUSHBASE_TEMPLATES_DIR`, `_DATABASE`, `_TEAM` | the Pushbase driver: a folder of standalone template projects, the shared Postgres to link, the team for new projects |
| `NUXT_SERVICE_EMAIL` | the account the cloud keeps on every site (default `cloud@tinyzoo.invalid`) |
| `NUXT_MAIL_TRANSPORT`, `NUXT_MAIL_FROM`, `NUXT_MAIL_SMTP_*` | e-mail, as in Keeper: `log` prints, `smtp` sends |
| `NUXT_DEV_MAIL_LINKS` | `false` hides the development notes that show an e-mail's link on the page (the walkthrough sets it) |
| `CLOUD_DEV_HOSTS` | more names the dev server answers to (`.pushbase.app`), for a proxy in front of it |
| `CLOUD_CUSTOM_TYPES` | `on` lets the sites of the twenty hosted templates make content types of their own (experimental; *A site's own content types*, below). Anything else, or unset, is off, and then nothing the cloud starts or writes changes. Read from the environment, not from `NUXT_*` settings. An app's process gets it the next time the driver starts it |

The sign-in cookie is called `tinyzoo-cloud`, not nuxt-auth-utils' default: on `localhost` cookies are shared across ports, and the sites use the default name.

## Deploying the account service

With `NUXT_HOSTING_DRIVER=none` the app makes no website. It keeps the accounts, signs people in to the websites connected to it (*Connect a website*), and lists each person's websites. The start page and the wizard lead to the sign-in page, nothing offers a new website, and `POST /api/sites` answers 409. It needs Postgres and nothing on disk.

`cloud/Dockerfile` builds that: the app alone, with `none` as the image's default. On Pushbase:

```sh
node scripts/deploy-site.mjs <project> --dockerfile cloud/Dockerfile --without templates
```

Its environment: `DATABASE_URL` (a database of its own; the app migrates it when it starts), `NUXT_APP_SECRET`, `NUXT_CLOUD_SECRET`, `NUXT_PUBLIC_URL` (its public address, which every connected website stores as the issuer: choose it once), and the `NUXT_MAIL_*` settings. A person is let in to a website only with a confirmed e-mail, so without `NUXT_MAIL_TRANSPORT=smtp` the confirmation link of each new account has to be read from the server log.

A website that runs by itself is connected in three steps: its owner signs in here, adds it under *Connect a website* (its name and address), and sets the three lines shown there in the website's environment (`NUXT_CMS_AUTH_ACCOUNT_ISSUER`, `_CLIENT_ID`, `_CLIENT_SECRET`; tinyzoo 1.12 or newer). The website's users are matched to accounts by their confirmed e-mail.

## How a site gets made

A site is made in four steps, kept in the database (`sites.steps`, the state machine in `shared/steps.ts`):

1. **database** and 2. **start**: the hosting driver's part. Infrastructure only, until the site answers `GET /api/health/ready`.
3. **content**: the cloud runs the template's seed (`pnpm seed` in the template's source folder) against the running site. On a fresh site the seed makes the first account with the setup code: the service account "tinyzoo", with a random password. Then it fills the demo content.
4. **account**: the cloud signs in as the service account, writes the site's name into its settings (and, for a template with looks, the chosen look and its default colours), and invites the owner as an administrator.

Before step 1 the site gets its client at the account service (`server/utils/account.ts`, `ensureSiteClient`); once the driver has given the site its address, the client learns it.

Steps 3 and 4 are the same for every driver (`server/utils/provision.ts`). They run in the background, never inside a request. Each step is written down before and after, so:

- a failure shows where it was, and *Try again* goes on from there;
- a restart of the server picks up the sites that were mid-way (`server/plugins/1.resume.ts`), and starts the ready ones that are not running;
- two runs never work on the same site (a Postgres advisory lock per site).

What the cloud keeps about a site is encrypted at rest with `NUXT_CLOUD_SECRET` (AES-256-GCM, as Keeper does): the site's app secret, its setup code, its status token, the service account's password, the id and secret of its client at the account service, and the invitation link. None of it is ever sent to the browser, except the invitation link, to the owner, until they have been in the admin.

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

**The apps.** A site runs on the build of the **app** that serves its template (`APPS` in `shared/templates.ts`). There are two:

| App | Folder | Serves |
|---|---|---|
| `templates` | `templates/app` (the one app) | the twenty hosted templates. Each is a design of this app and a content model of its own (`defineModels`); the app has no model of its own, so it runs in tinyzoo's multi-tenant mode only. A site's row in its site directory names its template as `model`, and the site is drawn in the design of the same name |
| `basic` | `packages/cms/starter` | the Basic website, which is not built on the template kit and ships in the npm package. Its row names no model: the app has one of its own |

`templates:build` builds both, one after the other. Both drivers below run every site in multi-tenant mode, from a site directory: the shared driver with one directory per app, the local driver with one per site.

**`local`** (`server/hosting/local.ts`) is the default: a process per site. Each app is built once; one build serves any number of sites. Per site:

- a database `tzc_<slug>` on the cloud's own Postgres server;
- a port from the range, written down before the next one is picked;
- a folder `cloud/.data/sites/<slug>/` with its uploads, its log (`site.log`), `site.json` (port and pid) and `sites.json`: a site directory with this one site (its address, its database, its secrets, its model), readable by its owner only and written again before every start;
- a detached process: `node <app>/.output/server/index.mjs --site-dir=<folder>`, with a clean environment: multi-tenant mode, the directory file, the site's app secret (it also seals the site's sessions) and what is the same for every site (the mail transport, migrations at start).

Its address is `http://<slug>.localhost:<port>`, so each site keeps its own cookies; the cloud itself talks to `http://127.0.0.1:<port>`, which the site's row lists as a host name it is also served at. `NUXT_HOSTING_LOCAL_PUBLIC_URL` changes the address people see and the one the site itself is told (its links, its invitation), not where it runs: with `https://{slug}.pushbase.app` every page and e-mail says that, and whatever stands in front must lead the name to the site's port. The recorded walkthrough does that for its own browser (below); ordinary development needs nothing. Before the driver stops a process it checks that the process's command line names the site's folder (the `--site-dir` argument). A pid alone is never trusted. *Delete* stops the process, drops the database and removes the folder.

After `templates:build` runs again, restart the sites (stop the app, stop their processes, start the app): a running site keeps loading pieces of the build it was started from. A site of a template that is not in the current build of the one app (built with `templates:build <ids>`, see *Templates*) is refused with the command that builds it.

**`shared`** (`server/hosting/shared.ts`) runs **one process per app**: one process serves every site of the twenty hosted templates, and one more every Basic website (tinyzoo's multi-tenant mode: the process picks the site by the host name of each request, and draws it with its row's model). A new site is a database, a folder and a row in a file. Nothing is built and no process is started for it: a Photographer site with its demo content is made in a few seconds, and adds no process of its own.

```sh
pnpm --filter tinyzoo-cloud templates:build
NUXT_HOSTING_DRIVER=shared pnpm --filter tinyzoo-cloud dev
```

Per app, in `cloud/.data/shared/<app id>/` (`templates`, `basic`), made the first time a site of the app is made or must run:

- `sites.json`, the **site directory**: one row per site with its host names, its database address, its secrets, its upload folder, its state, the limits of its plan and, in the one app, its model (the template's id). The process reads it again when it changes, so a new row is a new site within half a second, and a row that leaves is a site that stops answering. With `NUXT_HOSTING_SHARED_DIRECTORY=postgres` there is no such file: the rows are in a table of the cloud's database (*The site directory*, below);
- `app.json`: the process's port (from the driver's own range, written down before the next one is picked), its pid, when it started, its own app secret, made once, and, encrypted, the token of its own status route and the password of the role it reads the directory table with;
- `server.log`: what the process prints;
- a detached process: `node <app>/.output/server/index.mjs --app-dir=<folder>`, with a clean environment. What is the same for every site is in that environment (the mail transport, migrations at start); what belongs to one site is in its row.

Per site:

- a Postgres user and an empty database owned by it, both named `tzs_<the site's id>`: by the id, never by the address, because every user of a Postgres server can list the names of all databases and users. Nobody else may connect to the database, and the user may create neither databases nor users. The site's own app migrates the database, as that user, the first time the site is asked for;
- a folder `cloud/.data/shared/<app id>/sites/<site id>/` with its uploads;
- its row in the site directory: the site's app secret, setup code, status token and its client at the account service (`config.auth.account`) are the ones the cloud keeps for it.

Its address is `http://<slug>.localhost:<the app's port>`, its **service address**: for the cloud always, and for people until the site has a main domain of its own (*Custom domains*, below). The host name is what picks the site, so the cloud cannot talk to `127.0.0.1` here. Node resolves `*.localhost` to this machine, as browsers do. The seed, the hand-over and the cloud's later questions to a site all go to the service address.

The cloud's Postgres user makes the sites' users and databases, so it must be allowed to create users and databases and to hand a database to another user (the repository's own Postgres user is a superuser, which covers it). The first time the driver makes a site it also closes the cloud's own database to everybody but its owner (`REVOKE CONNECT … FROM PUBLIC`): a new user may otherwise connect to any database of the server, even where it can read nothing.

**Where the database password is kept.** In the site's row of the site directory, and, encrypted with `NUXT_CLOUD_SECRET`, in the site's `driver_state`. Without a directory key the file `sites.json` holds it in plain text, readable by its owner only (mode 0600), as is `app.json`; with `NUXT_HOSTING_SHARED_DIRECTORY_KEY` set, neither the file nor the table holds a password or a secret in plain text. When the directory is lost (the file is gone, the table holds nothing of the app), the driver writes the rows of every site of the app, of all its templates, again from what the cloud keeps, the next time it sees to one of them (when the cloud app starts, at the latest). When `app.json` is lost, the app comes back on the port the cloud remembers for its sites, with a new app secret: people signed in to its sites sign in again after the process next starts.

Before the driver trusts a pid it checks that the process's command line names the app's folder (the `--app-dir` argument). The driver never stops an app's process: it serves the other sites. *Delete* takes the site's row out of the directory, waits until the process no longer serves the site, drops the database and the user, and removes the site's folder. After `templates:build` runs again, or after `NUXT_HOSTING_SHARED_DIRECTORY` or its key was changed, stop the app's process yourself (its pid is in `app.json`); the cloud app starts it again when it starts, or when a site is next seen to. A process that still reads the other kind of directory is not used: the cloud says so (*"the app's process (pid …) reads its site directory from the …"*) until it is stopped.

Sites made with the shared driver before it ran one process per app (folders `cloud/.data/shared/<template id>/`, rows of `tenant_sites` under a template's id) are not carried over: on a development machine remove them and make them again.

What the shared driver does not do yet:

- another service address: a site's address at the service is always `http://<slug>.localhost:<port>` (`NUXT_HOSTING_LOCAL_PUBLIC_URL` is the local driver's setting and is not read here);
- a figure of memory per site: the site's page shows the memory of the whole app's process;
- stopping an app's process, on a new build or when its last site is deleted;
- several instances of one app, a pooler in front of Postgres.

#### The site directory

`NUXT_HOSTING_SHARED_DIRECTORY` says where the rows of the sites are kept. The rest of the driver talks to one small interface (`server/hosting/directory.ts`: is it there, read the rows, change them in one turn, prepare it for a process) and does not care which of the two it is.

- **`file`** (default): `sites.json` in the app's folder, as above.
- **`postgres`**: the table `tenant_sites (id, template, row, updated_at)` in the cloud's own database, made and kept current by the cloud's migrations. One row per site; the column `template` holds the id of the site's **app** (`templates` or `basic`), and the process of an app is told to read its rows with `NUXT_CMS_TENANCY_TEMPLATE=<app id>`; the site's template is its row's `model`. `updated_at` is set from the wall clock on every write, which is how a process notices a change. An app's process looks at the table every second, so a change in the cloud (a new site, a removed one, another state, a domain) reaches it within about a second.

**Encryption.** With `NUXT_HOSTING_SHARED_DIRECTORY_KEY` every secret of a row is stored encrypted: the database address (it holds the password), the site's secret, its setup code, its status token and the secret of its client at the account service. The format is the one tinyzoo reads (`packages/cms/server/utils/cmsSite.ts`): `enc:v1:` + base64url(iv 12 | tag 16 | ciphertext), AES-256-GCM, the key being the SHA-256 of the key text. `shared/directorySecret.ts` writes it; `test/unit/cloud-directory.spec.ts` holds one fixed vector and reads it back with a few lines of `node:crypto`. The table is never written without a key. A row that did not change keeps what is stored for it, so writing a site again changes nothing.

**The reader.** An app's process reads the table as a Postgres role of its own, `<prefix>_reader_<app id>`, which the driver makes once: it may sign in, connect to the cloud's database and `SELECT` from `tenant_sites`, and nothing else. It cannot write the table, read another table of the cloud, or connect to a site's database. The right is on the whole table: a reader could read the rows of the other app too (the secrets in them are encrypted), and its process asks only for its own app's. Its password is random and kept, encrypted with `NUXT_CLOUD_SECRET`, in the app's `app.json`.

**What an app's process is given.** Its environment and command line hold no secret of any site: those are in the rows. Three things in its environment are the process's own secrets, and are passed there on purpose: the directory key (`NUXT_CMS_TENANCY_KEY`), with `postgres` the reader's address with its password (`NUXT_CMS_TENANCY_DATABASE_URL`, beside `NUXT_CMS_TENANCY_TEMPLATE`), and the token of its own status route (`NUXT_CMS_TENANCY_OPERATOR_TOKEN`: the driver asks `GET /api/health/sites` what the process serves, to know when a change is in effect). With `file` it gets `NUXT_CMS_TENANCY_FILE` instead of the reader's address. Whoever can read that process's environment can read every row of its app.

#### Custom domains

A site's owner adds a domain of their own on the site's page (`/api/sites/:id/domains`).

- **The name** is kept lower-cased, without a port or a path; a name in another script is kept as its punycode. It must look public (two labels or more, no IP address, no `.local`, `.test` and the like) and must not be a name of the service's own. Outside production a `*.localhost` name with two labels or more before `localhost` may be added, so the flow can be tried on one machine. A name belongs to one website at a time (a unique index), and a website has five at most (`shared/domains.ts`).
- **Verification.** Before a name is used the cloud looks at its DNS: its CNAME chain must name the target's host, or every address it resolves to must be an address of the target (`NUXT_HOSTING_DOMAIN_TARGET`: a host name and/or IP addresses). Outside production a `*.localhost` name counts as verified. A name that is not verified is listed as waiting, with what to set in its DNS and *Check again*; nothing about the website changes until it is verified.
- **In use.** A verified name goes into the site's row (the hosting driver's `refresh`) and redirects to the site's address. One verified name can be made the **main address**: the row then has `hosts: [<the domain>, …the site's other verified names]` (those redirect to the domain), `publicUrl: https://<the domain>` (a `*.localhost` domain: `http://<the domain>:<the app's port>`), and `alsoHosts: [<slug>.localhost]`, so the cloud keeps reaching the site at its service address without being redirected. The site's links (its sitemap, its invitations) use the domain. In the same step the site's address at the account service becomes the domain (`setSiteClientAddress`), because a sign-in comes back to that address and no other. Removing the main domain, or *Go back to …*, restores the service address everywhere.
- **`GET /api/domains/ask?domain=<host>`** is for the platform's certificate issuer: *may I issue a certificate for this name?* 200 when the name is a verified domain of a ready website, or a ready website's service address (a moved website's too: it redirects); 404 otherwise. No session, no body, limited per asking address.

**What the platform in front must do** (a requirement, nothing here builds or calls it): send every service address and every verified domain to the process of the site's app with the `Host` it was asked for; hold a wildcard certificate for the service's own domain; issue certificates for customers' domains on demand, asking `GET <the cloud>/api/domains/ask?domain=<host>` first and issuing only on 200; and be reachable at the name or the addresses of `NUXT_HOSTING_DOMAIN_TARGET`.

#### Plans

`shared/plans.ts` is a small table of plans in code: one today (`basic`: 20 MB an upload, 1 GB in all; 12 content types of the site's own with 30 fields each). A site's plan is `sites.plan`; its numbers go into the site's row as `config.storage.maxSizeMb` and `config.storage.maxBytes` (and, with `CLOUD_CUSTOM_TYPES=on`, `config.customTypes.types` and `.fields`), and the site itself refuses what goes over them. The site's page shows how much is used against the total, as the site reports it (`GET /api/health/status` with the site's status token: `media.bytes`, `media.limitBytes`). A later paid plan is another row of that table.

#### A site's own content types

Experimental, and off unless the cloud runs with `CLOUD_CUSTOM_TYPES=on`. With it on, both drivers start the one app (`templates/app`) with `NUXT_CMS_CUSTOM_TYPES=on`, and each of its sites' rows gets `config.customTypes = { types, fields }` from the site's plan. An administrator of such a site then makes types of their own in its admin (*Settings › Content types*): "Courses", say, with the fields they need, each type a real table in the site's own database. The two blocks *Entries* and *Chosen entries* show them on any page, and a type with pages gives each entry its own address, in the sitemap and the site search. How it works: [`docs/custom-types-plan.md`](../docs/custom-types-plan.md).

The Basic website's app (`packages/cms/starter`) is not built on the template kit and its pages have no such blocks: its process is started without the switch, and its rows say nothing of it. The local driver keeps no plan per site and gives each site the default plan's numbers.

A move out of shared hosting keeps such a site's types: it is `tinyzoo backup` of the whole database. `tinyzoo export` and `import` refuse a site with types of its own.

#### Moving a website out, and in

For the owner of a site on the shared driver (`server/utils/transfer.ts`).

**Out** (`POST /api/sites/:id/export`). Three steps, written down like the steps of making a site (`sites.move_out`, `shared/transfer.ts`): a failure says where it was, asking again goes on from there, and a restart of the server picks an unfinished export up.

1. **readonly**: the site's row becomes `read-only`: reads work, writes are refused by the site itself.
2. **backup**: `tinyzoo backup` for exactly that site, with the site's own database address and its own upload folder in the child's environment. The archive stays in the site's own folder (`…/sites/<site id>/exports/`, beside its uploads and never among them, mode 0600; one archive per site, a new one replaces it), and `site.json` is put into it.
3. **reopen**: the site is served as before. Whatever fails, the site does not stay read-only.

`GET /api/sites/:id/export/download` streams the archive to its owner; anybody else gets the same 404 as for a website that does not exist. It has no public address.

**The archive holds password hashes and secrets**: the database dump (accounts with their password hashes, form messages), every uploaded file, and `site.json` with the site's secret and status token in plain text. Keep it as private as the database.

`site.json` is what the new home needs besides the data: the site's secret, its status token, its address and its other host names, its template and look, the tinyzoo version it ran on, its plan, and the id of its client at the account service. Not the client's secret: at the new home the website is connected again (*Connect a website*) and gets a new one. `tinyzoo restore` ignores the file.

**It lives elsewhere now** (`POST /api/sites/:id/moved` with the new address, once an archive was made): the row becomes `moved` with `movedTo`, and every request to the address here is redirected to the same path there. The site's own domains are released (they lead to the new home now) and its client at the account service is revoked. Then the cloud offers *Delete the data here* (`POST /api/sites/:id/moved-data`): the database, its user and the folder go, archive included; the address keeps redirecting until the website itself is deleted.

**In** (`POST /api/sites/import?slug=<address>&name=<name>`, the archive as the request's body, `application/x-tar`). Not a form: that type cannot be sent by another website's page, which is why the cross-site guard lets it through on this one route. The body is streamed into a file in the cloud's own folder (`<data>/_imports/`, mode 0600, nothing is served from there), cut off at `NUXT_HOSTING_IMPORT_MAX_MB`, and removed again when it is refused or restored. Then a new site of the archive's template is made, owned by whoever brought it, through the usual four steps: *database* and *start* make the database, the user, the folder and the row in state `paused`; *content* runs `tinyzoo restore` into them and then lets the site be served (its own app applies newer migrations); *account* puts the cloud's service account on the site (made when the archive has none, given the cloud's password when it has) and lets the new owner in. The site keeps its content, users and media, the secret from `site.json` and its status token. Refused in plain words: a file that is not such an archive, a template that is unknown or not built here, an archive of a newer tinyzoo than the template's build, an address that is taken.

**What must be carried for a moved website** to its own server (the proof is part 6 of `e2e:ops`):

- *Content, people, files*: the archive, put back with `tinyzoo restore`. People sign in with the passwords they had.
- *Monitoring and tools*: `NUXT_CMS_STATUS_TOKEN` = `statusToken` of `site.json`; personal access tokens and connected tools are rows of the database and come with it.
- *Links*: the same host name pointed at the new server, and `NUXT_CMS_PUBLIC_URL` set to it. Until then *It lives elsewhere now* redirects the old address.
- *Sign-in through the account*: connect the website again; it gets a new client id and secret (`NUXT_CMS_AUTH_ACCOUNT_*`). The links between accounts and the site's users are in its database and stay.
- *Sessions*: they do **not** survive a move out of shared hosting by what the archive carries. A session cookie is sealed with the app secret of the **app's process** (one secret for every site of the app, in `app.json`), and bound to the site by a proof made with the site's own secret. The site's own secret is in `site.json`; the process's secret is not, and must not be handed to one site's owner. With the site's secret as `NUXT_APP_SECRET` the old cookie is refused and people sign in once more. Only whoever runs the service could carry a session over, by giving the new server the process's secret as `NUXT_APP_SECRET`, the same cookie name and the restored database; `e2e:ops` shows both.
- A move **into** shared hosting never keeps sessions either: the cookies were sealed with the old server's own secret.

**Postgres tools.** `tinyzoo backup` and `restore` need `pg_dump`, `pg_restore` and `psql`. The cloud hands `TINYZOO_PG_DUMP`, `TINYZOO_PG_RESTORE` and `TINYZOO_PSQL` from its own environment on to the command line. For a machine that has Postgres only in a container, `scripts/pg-tools/` holds three wrappers that run the tools inside it ([its README](scripts/pg-tools/README.md)).

#### Closing the Postgres server

A new Postgres role may connect to every database of its server, even where it can read nothing. The shared driver closes each site's database, and the cloud's own, when it makes them. The rest is once per server:

```sh
pnpm --filter tinyzoo-cloud postgres:close --url postgres://<a superuser>@<host>:<port>/postgres          # lists every database and what it would run
pnpm --filter tinyzoo-cloud postgres:close --url postgres://<a superuser>@<host>:<port>/postgres --yes    # runs it
```

`REVOKE CONNECT ON DATABASE … FROM PUBLIC` for **every** database of the server, `postgres` and `template1` included. Afterwards a site's user opens its own database and no other; owners of a database and superusers connect as before. It changes access to databases that are not the cloud's, so it never guesses the server, prints what it will do, and does nothing without `--yes`. Any other role that reached a database through `PUBLIC`'s right needs `GRANT CONNECT ON DATABASE <database> TO <role>` afterwards. A database made later by hand is open again until the script is run once more.

**`pushbase`** (`server/hosting/pushbase.ts`) is **written, not exercised**. It goes through the published CLI only (`npx -y pushbase@0.3.0 … --json`): a project named by the slug, the workspace's shared Postgres linked, storage created and linked, the environment set over stdin, the template folder deployed, then a wait until `https://<slug>.pushbase.app` answers. No command that creates or changes anything has been run from it. Known gaps, also listed in the file: the CLI (0.3.0) cannot delete a project, so `remove` says so; a template must be a standalone project there (the starter inside this repository depends on the workspace); every site is built on the platform again.

### Templates

`shared/templates.ts` is the registry: twenty-one entries, each with its name, one sentence and three or four points in both languages, its field for the filter, its animal, and its looks (id, name and one sentence in both languages): 52 looks in all. Every template is ready: **Basic website** (`basic`, from `packages/cms/starter`) and the twenty hosted ones from `templates/<id>` (`hosted(…)`; Photographer is the pilot). A template that is not built yet is `planned(…)`: the gallery shows it only with `NUXT_PUBLIC_SHOW_PLANNED=true`, marked as not available, and the server refuses to make a site from it whatever the flag says.

A template may come in several **looks**: one content model and one set of demo content, drawn in different designs. Photographer has three (Ateliér, Negativ, Zápisník). The registry lists a template's looks (id, name and one sentence in both languages, and for a ready template the look's default colours); the wizard shows them as its second step; the choice is kept in `sites.look`, written into the site's settings (`look`, `colors`) when the site is made, and its owner changes it afterwards in the site's admin (*Site settings*). The cloud follows that change: the site's page asks the site which look it shows and keeps the answer. How a template implements looks: [`templates/README.md`](../templates/README.md).

**The build.** A hosted template is not built on its own for the cloud: it is a design of the one app (`templates/app`), and the Basic website is the starter. `templates:build` builds the two apps, one after the other:

```sh
pnpm --filter tinyzoo-cloud templates:build                       # both apps, every design: about 50 s, 6.5 GB of memory at its peak
pnpm --filter tinyzoo-cloud templates:build photographer,wedding  # the one app with only these designs (and not the starter): a quicker build to try something
pnpm --filter tinyzoo-cloud templates:build basic                 # the starter only
```

The one app's build writes which designs it holds into `templates/app/.output/tinyzoo-designs.json`. Both drivers refuse a site of a template that is not in it, with the command that builds it, and the scripts below say so before they start. The build prints 15 warnings about looks that lack some parts; they are expected (such a look does not draw that part).

**Fonts are kept between builds.** The designs' typefaces are downloaded from Google at build time by @nuxt/fonts, which keeps what it downloaded in `node_modules/.cache/nuxt/fonts/` of the app it builds. Google can answer the same request with other files at another time, so two builds of the same code could serve slightly different fonts. `templates:build` therefore makes that folder of both apps a link to **one** folder that stays between builds: `node_modules/.cache/tinyzoo-fonts` of the repository, or the folder named by `TZ_FONTS_CACHE`. Whatever was in an app's own folder before is copied into it first, without replacing a file that is already there. The font files in it never expire; Google's answers that name them are asked again after a week, and only a new file name downloads a new file. Locally nothing has to be done. **A build machine must keep that one folder from one build to the next** (a cache mount or a kept volume) and point `TZ_FONTS_CACHE` at it; a machine that starts without it downloads the fonts again, and may get other files.

**The pictures** (`public/templates/<template>/<look>-<kind>.webp`) are made by a script, never by hand:

```sh
pnpm --filter tinyzoo-cloud pictures          # the planned templates, from the designs folder (template-designs/)
pnpm --filter tinyzoo-cloud pictures --real   # the built templates, from real sites the script makes (about ten seconds a look)
pnpm --filter tinyzoo-cloud pictures --real --only wedding   # only these built templates
```

The built templates' sites are pictured with the browser's clock at a weekday morning (the first Wednesday from the day of the run, 9.40), so what a template works out from "now" (open or closed, today's lessons) looks the same whenever the script runs.

From the designs (a planned template), a look is alive when `template-designs/<slug>/<a|b|c>.html` exists; its name is the `## A · Name` heading of the folder's `notes.md`, its picture `shots/<letter>-top.jpg`. Each look gets a `card` (800 × 500) and a `thumb` (240 × 150). A built template's looks get, from a real site with the demo content, also `top` (the first screen with the site's name left out) and `tall` (the top of the home page, for the look step), and the script measures where and how the site writes its name and copies that typeface's files to `public/templates/fonts/`: that is how the wizard writes the typed name into the look. What the script found is in `shared/template-pictures.json`; a unit spec keeps the registry's looks equal to it. The designs folder is not in the repository: the script looks for it beside the repository (or beside the main checkout of a worktree), or takes `--designs <folder>`.

Adding a real template: make its entry `hosted(…)` with each look's default colours (its app is `templates`), add it to `BUILT_TEMPLATES` in `scripts/lib.mjs` (what its demo content is called, where it writes the site's name) and its checks as `scripts/e2e/<id>.mjs`, add it to the one app (`templates/app/designs.ts` and `cms.config.ts`, in the same order; a unit spec keeps the four lists equal), then run `templates:build <id>`, `pictures --real --only <id>` and `e2e --templates <id>`. The steps for the template itself: [`templates/README.md`](../templates/README.md).

A look that writes the site's name large on its first screen (a wedding's names) is measured there instead of in the header (`wordmark` in `BUILT_TEMPLATES`): the wizard sets a long name smaller until it fits (`fit`), in italics where the look does.

## Checks

```sh
pnpm --filter tinyzoo-cloud typecheck
pnpm vitest run --project unit test/unit/cloud-*.spec.ts   # slugs, the step machine, ports, the shared driver's names and rows, the directory's encryption, domains, moves, the account service's checks, the registry and the texts
pnpm --filter tinyzoo-cloud e2e                            # the whole flow in a browser, then every hosted template in every look and palette
pnpm --filter tinyzoo-cloud e2e --templates wedding        # only these hosted templates' part (about half a minute each)
pnpm --filter tinyzoo-cloud e2e:shared                     # the shared driver: sites of two templates from one process, a Basic website from another, about half a minute
pnpm --filter tinyzoo-cloud e2e:account                    # the account service: the protocol, then one real Photographer site, about half a minute
pnpm --filter tinyzoo-cloud e2e:signin                     # sign-in through the account for real: the cloud, real sites, a real browser, about a minute
pnpm --filter tinyzoo-cloud e2e:ops                        # the directory in Postgres, domains, limits, moving out and in, postgres:close, about a minute
pnpm --filter tinyzoo-cloud walkthrough                    # films the walkthrough and takes the screenshots into cloud/.preview/, about 40 minutes
pnpm --filter tinyzoo-cloud walkthrough --quick            # the two films small and fast, to try things out, about 10 minutes
```

A second checkout on the same machine (a git worktree) runs these beside the first with `CLOUD_RUN_TAG=tpl CLOUD_PORT_SHIFT=200`: databases, database prefixes, data folders and ports of its own, for every script (see `scripts/lib.mjs`). A script's cloud app stops at once when Nuxt started it on another port than the one asked for (another run took it a moment before).

Every script that makes sites checks first that the apps it needs are built, and with the designs it needs (`templates:build <ids>` builds the one app with only those): `e2e --templates wedding` needs only the one app with Wedding in it.

`e2e`, `e2e:shared`, `e2e:account`, `e2e:signin`, `e2e:ops`, `walkthrough` and `pictures --real` start a cloud app of their own beside yours (database `tz_cloud_e2e` / `tz_cloud_mt_e2e` / `tz_cloud_account_e2e` / `tz_cloud_signin_e2e` / `tz_cloud_ops_e2e` / `tz_cloud_walk` / `tz_cloud_pics`, sites under `.data/e2e` / `.data/mt-e2e` / `.data/account-e2e` / `.data/signin-e2e` / `.data/ops-e2e` / `.data/walk` / `.data/pics`, their own ports and database prefix) and remove what they made. `--keep` leaves it. All of them take the Postgres server from `CLOUD_PG_URL`. `e2e:shared`, `e2e:account`, `e2e:signin` and `e2e:ops` also take their names and ports from the environment, for a machine where the defaults are taken: `E2E_SHARED_DB`, `E2E_SHARED_SITE_PREFIX`, `E2E_SHARED_PORT`, `E2E_SHARED_SITE_PORTS`, `E2E_SHARED_DATA`, the same with `E2E_ACCOUNT_` and `E2E_OPS_`, and with `E2E_SIGNIN_` (plus `E2E_SIGNIN_OWN_PORTS`, two ports for the websites it runs itself).

`e2e:shared` (`scripts/e2e-shared.mjs`) goes through the sign-up app's API and the sites' own addresses, with no browser: one account and four sites made at the same moment, two Photographer sites in different looks, a Wedding site and a Basic website. It checks that one process serves the three sites of two templates (the same port, the same pid) and another process the Basic website; that each site's database holds only its own model's tables and migrations; that each page carries its own design (`data-design`) and exactly one look stylesheet, its own, after the main one; that a collection of one template answers 404 on a site of the other (content and admin routes, reading and writing), and Wedding's gift route (`POST /api/gift/:id/reserve`) 404 on a Photographer site and a Basic website; that the kit sites' rows name their model and the Basic website's none; that each has a database and a database user of its own, refused on the other's database and on the cloud's; that each shows its own name, look and content; that a session, a status token, an entry and an uploaded file of one site do not exist on the other; that an unknown host gets 404; that deleting one site removes its row, database, user and folder while the others keep answering from the same process, with their rows, content and sessions as they were. Then what the cloud does when things go wrong: a stopped process is started again on the same port; a failed step goes on with *Try again*, keeping the database of the first try; a lost `sites.json` or `app.json` is written again. It prints the memory of each app's process. `walkthrough --url http://localhost:3200` records against a running app instead, with that app's addresses, and leaves its main site there.

`e2e:account` (`scripts/e2e-account.mjs`) has no browser either. It plays the **website's** side of the protocol itself over HTTP: a stand-in client that sends a person's cookie jar to `/oauth/authorize` and exchanges the code server to server, for websites that exist nowhere but as connected addresses. It checks the discovery document; the whole round trip with PKCE; every refusal (an unknown client, a wrong or look-alike redirect address, a missing or wrong challenge or verifier, a code used twice, a code grown old, a wrong secret, a revoked client); `prompt=none` without a session; the sign-in page and the page that makes an account coming back to `authorize`, and never to another website; `sites` for the same owner only (two owners, three clients, a member of all three); `membership` changing the role and taking a website out of a person's list; a connected website's secret shown once and replaced; the limits; and that no secret and no code is in any answer to a browser, in the server log or in the database. Then, with the shared driver, it makes real Photographer sites and checks that a site's row carries `config.auth.account` with a secret the issuer accepts, what the site's page says about the way into the admin (also for an owner whose e-mail is not confirmed), and that deleting the site revokes its client. `--protocol-only` leaves the real sites out and needs no built template. The site's own account routes are not tested here.

`e2e:signin` (`scripts/e2e-signin.mjs`) is where the two halves meet: the cloud as the issuer, real tinyzoo sites as its clients, and a real browser (Chromium) for everything a person clicks. Rebuild first after any change under `packages/cms` or `templates/` (`templates:build`). It checks, with the databases of both sides read after each step: an owner who makes an account, confirms the e-mail, makes two Photographer sites and gets into the first with *Open the admin*, having typed no password for the site (the site's user turns from invited to active, the cloud's page shows the owner as in); the switcher between the two sites and the silent round trip, *All my websites*; a colleague invited on the site who has no account, makes one and is accepted as an editor, sees the site in *My websites* and does not see the owner's other site; a person with no invitation (the no-access notice, listed nowhere) and an owner whose e-mail is not confirmed; an invitation eight days old; a role changed and a person disabled on the site; **two websites somebody runs themselves** (the Basic website's build started twice as ordinary single-site processes, with the three lines of *Connect a website*, one of them told its address in capitals with a trailing slash), an administrator on one and an editor on the other; the account page of somebody without a password and the link that sets one; erasing a person; signing out of a site and of the cloud; the cloud app stopped (open sessions keep working, the site's sign-in page says the account service did not answer, a password still signs in); and the same once more with the sites' session cookie named `__Host-tinyzoo`, with what each installed browser does with it. Screenshots at desktop and phone width go to `.preview/signin/`.

`e2e:ops` (`scripts/e2e-ops.mjs`) runs the shared driver with the site directory in Postgres, with no browser, and prints each check. (1) Two Photographer sites made through the sign-up API are served by one process that reads them from the table, and a Basic website by another; the column `template` holds each site's app, and the kit sites' rows their model; the table holds no password or secret in plain text; the process's command line and environment hold no secret of a site and name no directory file; each app's reader can read the table, nothing else, and cannot write it. (2) A change of the table reaches the process within about a second: a paused row (written as the driver writes one: the cloud has no *pause* for an owner), which the cloud then puts right, and a site removed through the API. (3) A domain: refused names, a `*.localhost` name verified by the local rule, made the main address (the site answers there, the service address answers the cloud without a redirect, the site's other name redirects to the domain, the sitemap and an invitation link use the domain, sign-in through the account works at the domain), `ask`, a name taken by another site, a name that does not resolve staying waiting, and the service address restored when the domain goes. (4) The plan: an upload over its size refused by the site, the total reported on the site's page. (5) Out and in: the site is read-only while the backup runs, the archive is downloaded by its owner only, taken in as a new site under another address (same content, people, media; its own database, user and folder; the refusals), the original marked as moved (every request redirected) and its data deleted while the new site is untouched. (6) Out to a server of its own: the one app as a process of its own with a site directory of that one site (as the local driver runs a site), restored from the archive with the settings of `site.json`, and what a session needs to survive. (8) The setting changed to the file with the key kept: the cloud refuses the process that still reads the table until it is stopped, then writes every row again into an encrypted `sites.json`. (7) `postgres:close`, only when a Postgres of the run's own is named with `E2E_OPS_CLOSE_URL` (the script changes every database of that server), with the proof that a site's user is then refused everywhere but on its own database. On a machine without `pg_dump` name the Postgres container with `TINYZOO_PG_CONTAINER`; the run then uses `scripts/pg-tools`.

### The walkthrough

`scripts/walkthrough.mjs` tells the product's story in Czech and makes, in `cloud/.preview/`: `walkthrough-desktop.mp4` (the master, 2880 × 1620 at 60 frames a second), `walkthrough-desktop-1080p.mp4` (a copy for sharing), `walkthrough-phone.mp4` (1170 × 2532 at 60 frames a second), `screens/*.png`, `looks/*.jpg` and `index.html`. `--only desktop|phone|screens|index` makes one part.

- **The films are not screen recordings.** The pages run slowed down (timers, animation frames and CSS animations alike) and a picture is taken at device resolution for every frame, which ffmpeg encodes (`scripts/film.mjs`). So the text is sharp, the pace even, and nothing is dropped; the log says how many frames had to be repeated. A pointer is drawn (a touch point on the phone), moved and clicked like a hand.
- **Real-looking addresses.** Everything a person sees says `https://<slug>.pushbase.app` and `https://tinyzoo.pushbase.app`: the local driver gets that pattern, and the script starts a small https proxy with a certificate made on the spot, which the recording browser alone is sent to (`--host-resolver-rules`). That browser knows no other name, the script proves it before it opens anything (with a name that exists nowhere), and stops if the proof fails. Nothing talks to the real pushbase.app, and nothing on the machine is changed. `--domain example.cz` (or `SHOWCASE_DOMAIN`) uses another domain, `--domain none` plain local addresses.
- **No wording.** Things are found by data attributes, field names and addresses, and the admin's two buttons by their keys in the admin's dictionary: the script survives a change of the texts. What it types (the people's names, the new heading) is at its top.

## Not built

- Payments, and any plan but the one in `shared/plans.ts`. Changing a site's plan has no page.
- Of custom domains: everything outside this app. Nothing here sends a name to an app's process or issues a certificate; that is the platform's part (*Custom domains*, above). A waiting domain is looked at when it is added and on *Check again*, never by itself, and a verified one is not looked at again.
- Of moving: a move into shared hosting from a server whose archive has no `site.json` (a plain `tinyzoo backup`): write the file by hand (`shared/transfer.ts`, `SiteFile`). A site on the local driver cannot be moved or have a domain. Pausing a site has no page (the state exists in the directory).
- Real e-mail delivery set up (the SMTP transport is there, as in Keeper; nothing is configured).
- Deploying: the cloud app itself has no deployment, and the Pushbase driver has not been run.
- Of the account: a page of one owner's people across their websites (who has which role where), signing out of every website at once, a second factor, and coming back to the website after *Forgot your password?* (the new password signs the person in to the cloud; they open the website again). The limits of the account service are in memory, for one instance of the cloud app.
- The recorded walkthrough still tells the earlier story of the way into the admin (a password chosen by the invitation); it has not been filmed again.
- The site's own logo in its admin (its name is there: `cms.admin.nameFrom`).
- Deleting an account, changing its e-mail address, and anything for the people who run the service (a list of all sites, stopping one).
- Stopping idle sites. With the local driver a running site holds about 360 MB of memory, whether anyone visits it or not. With the shared driver the sites of all twenty hosted templates share one process, and the Basic websites another (the one app with one site of each of its 52 looks held about 1.4 GB after a warm-up; `docs/one-app-plan.md`, 2.17).

## Schema

`server/db/schema.ts`: `users`, `email_tokens` (the links sent by e-mail, stored as SHA-256), `sites` (with the template and the look each was made from), and the account service's three: `account_clients` (a website that may ask who a person is: its owner, its address, the SHA-256 of its secret, the cloud-made site it is for, when it was revoked), `account_codes` (one-time codes, stored as SHA-256, bound to the client, the address, the PKCE challenge and the person) and `account_members` (who signed in where, the role the website last reported, whether it still lets them in). For operating shared hosting: `sites` also holds the plan, what the site does with requests (`host_state`: served, paused, read-only, moved, and `moved_to`), when a moved site's data was deleted here, the steps of its export (`move_out`) and where it came from when it was moved in (`move_in`); `site_domains` (a website's own domains: the name, unique across all websites, whether its DNS was seen to lead here, whether it is the main address); `tenant_sites` (the site directory when it is kept in Postgres: one row per site, read by the apps' processes). After a change run `pnpm --filter tinyzoo-cloud db:generate` and commit the migration.

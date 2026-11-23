# PgBouncer in front of the test Postgres

For the multi-tenant suite (`test/api/tenants*.spec.ts`): the sites reach their databases through PgBouncer in **transaction mode**, each still as its own user to its own database. Nothing here is used by a normal test run.

Tried with PgBouncer 1.26.1 (`edoburu/pgbouncer:latest`, digest `sha256:8638aa56…444a6d`) and Postgres 16.11.

## Files

| File | What |
|---|---|
| `pgbouncer.ini` | The whole configuration: `pool_mode = transaction`, every database passed on by name (`* = host=tz-mt-pg`), users looked up in Postgres (`auth_query`), 2 real connections per site, closed after 5 s without use |
| `userlist.txt` | One line: PgBouncer's own login (`t5_pgbouncer`). No site's user is listed |
| `auth.sql` | What Postgres needs for the lookup: that login, one small database and one function |
| `up.sh` / `down.sh` | Start and remove the container, its network and (optionally) what `auth.sql` made |
| `burst.mjs` | The measurement: N sites used at the same moment, real connections with and without PgBouncer |

## Start and stop

```sh
sh test/pgbouncer/up.sh      # the lookup in Postgres, the network tz-mt-net, the container tz-mt-pgbouncer on localhost:55451
sh test/pgbouncer/down.sh    # removes the container, takes Postgres off the network, removes the network
DROP_AUTH=1 sh test/pgbouncer/down.sh   # also drops the login t5_pgbouncer and the database t5_pgbouncer_auth
```

`up.sh` expects the Postgres container `tz-mt-pg` with a superuser at `postgres://cms:cms@localhost:55440`; `PG_CONTAINER`, `PG_ADMIN_URL` and `PGB_PORT` change that (and the `host=` in `pgbouncer.ini` must then name the other container). It does not stop, restart or reconfigure Postgres: it connects the container to one more Docker network, so that PgBouncer reaches it as `tz-mt-pg:5432`.

By hand, the same three steps:

```sh
docker exec -i tz-mt-pg psql -v ON_ERROR_STOP=1 postgres://cms:cms@localhost:5432/postgres < test/pgbouncer/auth.sql
docker network create tz-mt-net && docker network connect tz-mt-net tz-mt-pg
docker run -d --name tz-mt-pgbouncer --network tz-mt-net -p 127.0.0.1:55451:6432 \
  -v "$PWD/test/pgbouncer/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:ro" \
  -v "$PWD/test/pgbouncer/userlist.txt:/etc/pgbouncer/userlist.txt:ro" \
  --entrypoint /usr/bin/pgbouncer edoburu/pgbouncer:latest /etc/pgbouncer/pgbouncer.ini
```

## Run the suites through it

```sh
TEST_DATABASE_URL=postgres://cms:cms@localhost:55440/t5_test \
TEST_SITES_VIA=postgres://localhost:55451 \
pnpm vitest run --project api test/api/tenants
```

`TEST_SITES_VIA` changes one thing: the database address the **server** is given for each site (host and port become PgBouncer's; user, password and database stay the site's own). The helpers' own work (roles, databases, migrations, `siteQuery`) still goes straight to Postgres with `TEST_DATABASE_URL`. Add `TEST_REDIS_URL=…` for the two-instance file as well.

The single-site API suite has a switch of its own, `TEST_SERVER_VIA=postgres://localhost:55451`: its one shared server then reaches the test database through PgBouncer, while the set-up migrates it directly. The user in `TEST_DATABASE_URL` must then be one the lookup hands out: not a superuser (see below), so not the `cms` user of the compose file.

## How the sites' users are authenticated

No user list per site. For a user that is not in `userlist.txt`, PgBouncer asks Postgres:

- `auth_user = t5_pgbouncer`: PgBouncer's own login, the only line of `userlist.txt` (in plain text there: PgBouncer signs in to Postgres with it, over SCRAM).
- `auth_dbname = t5_pgbouncer_auth`: the **one** database the lookup runs in. Without this setting PgBouncer runs the lookup in the database the client asked for, so every site's database would need the function and would have to let PgBouncer's login in. With it, the sites' databases are not touched, and PgBouncer's login may open no site's database (`REVOKE CONNECT … FROM PUBLIC` holds for it too).
- `auth_query = SELECT uname, phash FROM public.pgbouncer_user_lookup($1)`: a `SECURITY DEFINER` function owned by a superuser, which reads the user's stored secret from `pg_shadow`. Only PgBouncer's login may call it. It does not hand out superusers.
- `auth_type = scram-sha-256`: the secret that comes back is the SCRAM verifier Postgres stores (`password_encryption = scram-sha-256`). PgBouncer checks the client against it and uses what the client proved to sign in to Postgres as that same user (SCRAM pass-through). PgBouncer holds no site's password.

Checked by hand: a site's user with its password gets in and is that user in its own database; a wrong password is `SASL authentication failed`; an unknown user and the superuser are `no such user`; PgBouncer's login cannot open a site's database or read `pg_shadow` itself. What Postgres refuses, it still refuses through PgBouncer: a site's user on another site's database is `permission denied for database`.

## What was needed in the app and the tests

Nothing in the app's SQL. tinyzoo's locks are `pg_advisory_xact_lock` / `pg_try_advisory_xact_lock` inside a transaction, its settings are `set local` or `set_config(…, true)` inside a transaction, it has no `LISTEN`, no temporary table, no `search_path` change and no named prepared statement; the migrations of a site's first use run in one transaction (with `CREATE EXTENSION pg_trgm`).

In the tests, one thing: the server's real connections outlive the server. PgBouncer keeps them for `server_idle_timeout`, and Postgres refuses to copy a database that has a connection (`source database … is being accessed by other users`). The tenants helper ends them before it copies site A's database into site B's. The same holds for anybody who drops or copies a site's database behind a pooler: `DROP DATABASE … WITH (FORCE)`, or end its connections first.

## What it does to the number of connections

`burst.mjs` makes N empty site databases, starts one app in multi-tenant mode and asks every site for one API route at the same moment: once right after the start (every site is migrated at its first use), once more after every connection was closed. It counts the sites' connections in `pg_stat_activity` every 20 ms.

```sh
TEST_DATABASE_URL=postgres://cms:cms@localhost:55440/t5_test node test/pgbouncer/burst.mjs --sites 50
TEST_DATABASE_URL=postgres://cms:cms@localhost:55440/t5_test node test/pgbouncer/burst.mjs --sites 50 --via postgres://localhost:55451
```

Measured on 2026-11-23, 50 sites, one app with its cap of 30 connections (`NUXT_CMS_TENANCY_MAX_CONNECTIONS`), nothing failed in any run:

| Real Postgres connections at once (most) | straight | PgBouncer, 2 per site, 5 s | 1 per site, 5 s | 1 per site, 1 s |
|---|---|---|---|---|
| First use of all 50 sites at once | 30 | 86 | 50 | 50 |
| All 50 again, migrated, from no connection | 30 | 50 | 50 | 50 |
| One round of the every-minute tasks, no visitor | 29 | 84 | | |
| The app's own connections (to Postgres, or to PgBouncer) | 30 | 30 | 30 | 30 |

So behind PgBouncer **one app holds more real connections in a burst, not fewer.** A real connection belongs to one database and one user, so PgBouncer keeps a pool per site (`default_pool_size` each) and closes a connection only after `server_idle_timeout` without use. It has limits per database and per user (`max_db_connections`, `max_user_connections`) and none across databases: the peak is one to `default_pool_size` connections for every site used within the idle time. The app's cap counts the app's connections to PgBouncer; when the app closes a quiet site's pool to make room, the real connections of that site stay open at PgBouncer for its idle time.

What PgBouncer does give: the real connections no longer multiply with the number of app instances (two instances straight to Postgres may hold 2 × 30; behind PgBouncer a site has its `default_pool_size` whoever asks), connections of the app are cheap, and a site cannot take more than its pool. Postgres' `max_connections` must still cover *sites in use within `server_idle_timeout`* × `default_pool_size`.

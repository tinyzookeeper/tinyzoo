# Postgres tools from the database's own container

`tinyzoo backup` and `tinyzoo restore` need `pg_dump`, `pg_restore` and `psql`. A machine that has Postgres only in a Docker container has none of them. The three programs here stand in: each runs the real tool **inside the container**.

```sh
export TINYZOO_PG_DUMP=$PWD/cloud/scripts/pg-tools/pg_dump
export TINYZOO_PG_RESTORE=$PWD/cloud/scripts/pg-tools/pg_restore
export TINYZOO_PSQL=$PWD/cloud/scripts/pg-tools/psql
export TINYZOO_PG_CONTAINER=tz-mt-pg     # the container's name (this is the default)
```

The cloud app takes these variables from its own environment and hands them to tinyzoo's command line when it exports or restores a website (`server/utils/transfer.ts`). `e2e:ops` sets them by itself when the machine has no `pg_dump`.

How they fit `tinyzoo`'s command line (`packages/cms/cli/backup.ts`):

- **The connection** comes as `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` in the environment. The user, the password and the database go into the container as they are (`docker exec -e NAME` takes the value from the environment, so the password is on no command line). The host and the port are replaced: from this machine the server is `localhost:<published port>`, from inside the container it is `127.0.0.1:5432` (`TINYZOO_PG_CONTAINER_PORT` for another port).
- **Input and output** are files or pipes the command line opens itself and gives the tool as its stdin and stdout: `pg_dump --format=custom` writes the dump to stdout; `pg_restore --list` and `pg_restore -f -` read the dump from stdin; `psql -f -` reads the script from stdin. `docker exec -i` passes both through unchanged, and no file path is ever given to a tool, so nothing has to exist inside the container.
- **Versions**: the tools are the server's own, so `pg_dump` always matches the server.

They are for a Postgres in a container on this machine. Where the tools are installed (`brew install libpq`, `apt install postgresql-client`), set none of the variables.

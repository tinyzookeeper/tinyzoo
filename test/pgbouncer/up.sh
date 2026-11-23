#!/bin/sh
# Start PgBouncer (transaction mode) in front of the test Postgres. See README.md.
#   PG_CONTAINER   the Postgres container (default tz-mt-pg)
#   PG_ADMIN_URL   a superuser address of that Postgres, from this machine
#   PGB_PORT       the port PgBouncer listens on, on this machine (default 55451)
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
PG_CONTAINER="${PG_CONTAINER:-tz-mt-pg}"
PG_ADMIN_URL="${PG_ADMIN_URL:-postgres://cms:cms@localhost:55440/postgres}"
PGB_PORT="${PGB_PORT:-55451}"
IMAGE="${PGB_IMAGE:-edoburu/pgbouncer:latest}"

# 1. The login and the lookup function PgBouncer authenticates the sites' users with.
docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -q "$(echo "$PG_ADMIN_URL" | sed -E 's#@[^/]+/#@localhost:5432/#')" < "$here/auth.sql"

# 2. A network both containers are on, so PgBouncer reaches Postgres by its name.
docker network inspect tz-mt-net >/dev/null 2>&1 || docker network create tz-mt-net >/dev/null
docker network inspect tz-mt-net --format '{{range .Containers}}{{.Name}} {{end}}' | grep -qw "$PG_CONTAINER" \
  || docker network connect tz-mt-net "$PG_CONTAINER"

# 3. PgBouncer itself, with the two files of this folder.
docker rm -f tz-mt-pgbouncer >/dev/null 2>&1 || true
docker run -d --name tz-mt-pgbouncer --network tz-mt-net -p "127.0.0.1:${PGB_PORT}:6432" \
  -v "$here/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:ro" \
  -v "$here/userlist.txt:/etc/pgbouncer/userlist.txt:ro" \
  --entrypoint /usr/bin/pgbouncer "$IMAGE" /etc/pgbouncer/pgbouncer.ini >/dev/null
sleep 1
docker logs tz-mt-pgbouncer 2>&1 | tail -5
echo "PgBouncer listens on localhost:${PGB_PORT}; run the suite with TEST_SITES_VIA=postgres://localhost:${PGB_PORT}"

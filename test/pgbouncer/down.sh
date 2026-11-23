#!/bin/sh
# Remove PgBouncer, take Postgres off the network again and remove the network.
# The login and the lookup database stay unless DROP_AUTH=1.
set -eu
PG_CONTAINER="${PG_CONTAINER:-tz-mt-pg}"
PG_ADMIN_URL="${PG_ADMIN_URL:-postgres://cms:cms@localhost:55440/postgres}"
docker rm -f tz-mt-pgbouncer >/dev/null 2>&1 || true
docker network disconnect tz-mt-net "$PG_CONTAINER" >/dev/null 2>&1 || true
docker network rm tz-mt-net >/dev/null 2>&1 || true
if [ "${DROP_AUTH:-0}" = "1" ]; then
  url="$(echo "$PG_ADMIN_URL" | sed -E 's#@[^/]+/#@localhost:5432/#')"
  docker exec -i "$PG_CONTAINER" psql -q "$url" -c 'DROP DATABASE IF EXISTS t5_pgbouncer_auth WITH (FORCE)' -c 'DROP ROLE IF EXISTS t5_pgbouncer'
fi
echo "PgBouncer removed"

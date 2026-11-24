#!/bin/sh
# Shared by pg_dump, pg_restore and psql in this folder: run one Postgres tool inside the
# Postgres container instead of on this machine. See README.md.
#
#   _run.sh <tool> [arguments…]
#
# The connection arrives the way tinyzoo's command line hands it to the tools: PGHOST, PGPORT,
# PGUSER, PGPASSWORD and PGDATABASE in the environment, never as arguments. The user, the
# password and the database are passed on as they are (docker takes each value from this
# environment; none appears on a command line). The host and the port are the machine's way to
# the container (localhost and the published port), so inside the container they become the
# server's own: 127.0.0.1 and 5432.
#
# Input and output are the tool's own: whatever is on stdin goes in (a dump, an SQL script),
# whatever it writes to stdout comes out (a dump, a listing), byte for byte.
set -eu
tool="$1"
shift
case "$tool" in pg_dump | pg_restore | psql) ;; *) echo "pg-tools: not a tool of this folder: $tool" >&2; exit 2 ;; esac
container="${TINYZOO_PG_CONTAINER:-tz-mt-pg}"
exec docker exec -i \
  -e PGUSER -e PGPASSWORD -e PGDATABASE \
  -e PGHOST=127.0.0.1 -e PGPORT="${TINYZOO_PG_CONTAINER_PORT:-5432}" \
  "$container" "$tool" "$@"

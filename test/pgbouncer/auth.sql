-- What PgBouncer needs in Postgres to authenticate the sites' users without a user list
-- (auth_user + auth_query, see pgbouncer.ini). Run once per Postgres, as a superuser:
--
--   psql postgres://cms:cms@localhost:55440/postgres -f test/pgbouncer/auth.sql
--
-- Three things: a login for PgBouncer itself, ONE database that holds the lookup function
-- (auth_dbname: the sites' databases are not touched and PgBouncer's login may not open
-- them), and the function, which may read the stored password secrets (pg_shadow) on
-- PgBouncer's behalf and gives them to nobody else.

SELECT 'CREATE ROLE t5_pgbouncer LOGIN PASSWORD ''t5-pgbouncer-auth-password'' NOSUPERUSER NOCREATEDB NOCREATEROLE'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 't5_pgbouncer') \gexec

SELECT 'CREATE DATABASE t5_pgbouncer_auth'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 't5_pgbouncer_auth') \gexec

REVOKE CONNECT ON DATABASE t5_pgbouncer_auth FROM PUBLIC;
GRANT CONNECT ON DATABASE t5_pgbouncer_auth TO t5_pgbouncer;

\connect t5_pgbouncer_auth

-- SECURITY DEFINER: runs as its owner (a superuser), the only kind of role that may read
-- pg_shadow. Superusers themselves are not handed out: nobody signs in through the pooler
-- as one.
CREATE OR REPLACE FUNCTION public.pgbouncer_user_lookup(IN i_username text, OUT uname text, OUT phash text)
RETURNS record AS $$
BEGIN
  SELECT usename, passwd FROM pg_catalog.pg_shadow
  WHERE usename = i_username AND NOT usesuper
  INTO uname, phash;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog;

REVOKE ALL ON FUNCTION public.pgbouncer_user_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pgbouncer_user_lookup(text) TO t5_pgbouncer;

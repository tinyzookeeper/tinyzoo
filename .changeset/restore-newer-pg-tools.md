---
'tinyzoo': patch
---

`tinyzoo restore` now works when the PostgreSQL client tools are newer than the database server, as they usually are on a laptop or a CI runner. A backup made by `pg_dump` 17 or 18 starts with `SET transaction_timeout = 0;`, which a PostgreSQL 16 server rejects: the restore stopped there, after it had already emptied the database. The restore now turns the dump into SQL with `pg_restore -f -`, leaves out the session settings the server does not know (and prints which), and runs it through `psql`, with the dropping of the old schemas and the loading of the backup in one transaction. If anything fails, the database is exactly as it was before, instead of empty.

Before it changes anything, the restore now also checks that `psql` is installed (`TINYZOO_PSQL` points at another binary, like `TINYZOO_PG_DUMP` and `TINYZOO_PG_RESTORE`), and refuses a backup made by a newer `pg_dump` than the `pg_restore` it has, saying which version to install. `docs/deploying.md` ("Backups and restore") has the table of which tool version works with which server.

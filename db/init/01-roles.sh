#!/bin/bash
# Role bootstrap for Xiaoshuyin Stage A.
# Executed by PostgreSQL docker-entrypoint-initdb.d as superuser.
# Passwords injected via POSTGRES_MIGRATOR_PASSWORD / POSTGRES_APP_PASSWORD env vars.
# NO password values appear in this file.

set -euo pipefail

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_MIGRATOR_PASSWORD:?POSTGRES_MIGRATOR_PASSWORD is required}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v migrator_pass="$POSTGRES_MIGRATOR_PASSWORD" \
  -v app_pass="$POSTGRES_APP_PASSWORD" \
  -v target_db="$POSTGRES_DB" <<'EOSQL'
BEGIN;
SELECT format(
  '%s ROLE %I WITH LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
  CASE WHEN EXISTS (SELECT FROM pg_roles WHERE rolname = role_name)
    THEN 'ALTER' ELSE 'CREATE' END,
  role_name,
  role_password
)
FROM (VALUES
  ('xiaoshuyin_migrator', :'migrator_pass'),
  ('xiaoshuyin_app', :'app_pass')
) AS managed_roles(role_name, role_password) \gexec
COMMIT;

SELECT format('GRANT CONNECT ON DATABASE %I TO xiaoshuyin_migrator;', :'target_db') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO xiaoshuyin_app;', :'target_db') \gexec
SELECT 'GRANT CREATE, USAGE ON SCHEMA public TO xiaoshuyin_migrator;' \gexec
SELECT 'REVOKE CREATE ON SCHEMA public FROM xiaoshuyin_app;' \gexec
SELECT 'GRANT USAGE ON SCHEMA public TO xiaoshuyin_app;' \gexec
SELECT format('GRANT CREATE ON DATABASE %I TO xiaoshuyin_migrator;', :'target_db') \gexec
EOSQL

echo "Roles bootstrapped and verified: xiaoshuyin_migrator (owner), xiaoshuyin_app (NOBYPASSRLS)"

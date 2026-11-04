#!/bin/bash
# Role bootstrap for Xiaoshuyin Stage A.
# Executed by PostgreSQL docker-entrypoint-initdb.d as superuser.
# Passwords injected via POSTGRES_MIGRATOR_PASSWORD / POSTGRES_APP_PASSWORD env vars.
# NO password values appear in this file.

set -euo pipefail

: "${POSTGRES_MIGRATOR_PASSWORD:?POSTGRES_MIGRATOR_PASSWORD is required}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "CREATE ROLE xiaoshuyin_migrator LOGIN NOBYPASSRLS PASSWORD '${POSTGRES_MIGRATOR_PASSWORD}'" \
  -c "CREATE ROLE xiaoshuyin_app LOGIN NOBYPASSRLS PASSWORD '${POSTGRES_APP_PASSWORD}'" \
  -c "GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO xiaoshuyin_migrator" \
  -c "GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO xiaoshuyin_app" \
  -c "GRANT CREATE, USAGE ON SCHEMA public TO xiaoshuyin_migrator" \
  -c "GRANT USAGE ON SCHEMA public TO xiaoshuyin_app" \
  -c "GRANT CREATE ON DATABASE ${POSTGRES_DB} TO xiaoshuyin_migrator"

echo "Roles created: xiaoshuyin_migrator (owner), xiaoshuyin_app (NOBYPASSRLS)"

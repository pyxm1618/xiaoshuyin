#!/bin/bash
# Slice 19 — privileged Stage A pgvector bootstrap.
# Runs under PostgreSQL admin authority; never under xiaoshuyin_app.

set -euo pipefail

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

PSQL=(psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB")

server_version_num="$("${PSQL[@]}" -Atqc "SELECT current_setting('server_version_num')")"
server_version="$("${PSQL[@]}" -Atqc "SELECT current_setting('server_version')")"
major="$((server_version_num / 10000))"

if [[ "$major" != "18" ]]; then
  echo "pgvector bootstrap: BLOCKED POSTGRES_MAJOR_MISMATCH major=$major"
  exit 18
fi

available="$("${PSQL[@]}" -Atqc "SELECT count(*) FROM pg_available_extensions WHERE name = 'vector'")"
if [[ "$available" != "1" ]]; then
  echo "pgvector bootstrap: UNAVAILABLE PGVECTOR_NOT_AVAILABLE postgres_major=$major"
  exit 19
fi

"${PSQL[@]}" -c "CREATE EXTENSION IF NOT EXISTS vector" >/dev/null

read -r extversion owner < <("${PSQL[@]}" -AtF' ' -c   "SELECT e.extversion, r.rolname FROM pg_extension e JOIN pg_roles r ON r.oid = e.extowner WHERE e.extname = 'vector'")

if [[ -z "${extversion:-}" || -z "${owner:-}" ]]; then
  echo "pgvector bootstrap: BLOCKED PGVECTOR_ENABLE_FAILED"
  exit 20
fi

if [[ "$owner" == "xiaoshuyin_app" ]]; then
  echo "pgvector bootstrap: BLOCKED ROLE_OR_PERMISSION_INVALID extension_owner=xiaoshuyin_app"
  exit 21
fi

app_security="$("${PSQL[@]}" -AtF'|' -c   "SELECT rolsuper, rolbypassrls, has_schema_privilege('xiaoshuyin_app','public','CREATE') FROM pg_roles WHERE rolname='xiaoshuyin_app'")"
if [[ "$app_security" != "f|f|f" ]]; then
  echo "pgvector bootstrap: BLOCKED ROLE_OR_PERMISSION_INVALID runtime=xiaoshuyin_app"
  exit 22
fi

echo "pgvector bootstrap: PASS postgres_major=$major postgres_version=$server_version pgvector_extversion=$extversion extension_owner=$owner"

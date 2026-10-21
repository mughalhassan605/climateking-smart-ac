#!/usr/bin/env bash
# Applies the migrations to a scratch database on top of the first app version's tables, twice (they
# must be idempotent), then checks row level security. Needs a local PostgreSQL:
#   PGHOST=/var/run/postgresql PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
db="climateking_migration_test"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $db" -c "create database $db"
run() { psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$1" >/dev/null 2>&1 || psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$1"; }
run tests/supabase_stub.sql
run tests/legacy_schema.sql
for pass in 1 2; do
  for f in migrations/*.sql; do run "$f"; done
done
psql -v ON_ERROR_STOP=1 -q -d "$db" -f tests/rls_test.sql | grep -q "rls ok"
psql -q -d postgres -c "drop database $db"
echo "migrations ok"

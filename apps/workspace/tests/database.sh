#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="lutera-workspace-test-${RANDOM}"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --rm --name "$container" --tmpfs /var/lib/postgresql/data:rw,size=256m -e POSTGRES_HOST_AUTH_METHOD=trust -d postgres:17-alpine >/dev/null
for attempt in {1..40}; do
  # The image starts a temporary Unix-socket server during initdb. Wait for the
  # final TCP listener so tests cannot race that temporary server's shutdown.
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < tests/database-auth-stub.sql
for migration in supabase/migrations/*.sql; do
  docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < "$migration"
done
docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < tests/access.sql

docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < tests/account-access.sql

docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < tests/business-access.sql

docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < tests/completion-access.sql

docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < tests/suite-access.sql

docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < tests/multi-role-access.sql

# A full business-record round trip in a second, fresh database. Source data is
# synthetic; no production credentials, users or attachments enter this test.
restore_tmp="$(mktemp -d)"
python - "$restore_tmp" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=Path('tests/business-access.sql').read_text()
(p/'committed-fixture.sql').write_text(s.rsplit('rollback;',1)[0]+'commit;\n')
PY
docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < "$restore_tmp/committed-fixture.sql" > "$restore_tmp/fixture.log"
docker exec "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 -c 'delete from public.work_backup_runs' > /dev/null
docker exec "$container" psql -h 127.0.0.1 -U postgres -At -v ON_ERROR_STOP=1 -c "select private.work_backup_job(repeat('b',64),'{\"action\":\"begin\"}') -> 'snapshot'" > "$restore_tmp/snapshot.json"
npx tsx tests/recovery-fixture.ts "$restore_tmp/snapshot.json" "$restore_tmp/restore.sql"
docker exec "$container" createdb -h 127.0.0.1 -U postgres recovery
# Roles already exist cluster-wide; schemas and objects are isolated per DB.
tail -n +2 tests/database-auth-stub.sql | docker exec -i "$container" psql -h 127.0.0.1 -U postgres -d recovery -v ON_ERROR_STOP=1 > "$restore_tmp/target.log"
for migration in supabase/migrations/*.sql; do
  docker exec -i "$container" psql -h 127.0.0.1 -U postgres -d recovery -v ON_ERROR_STOP=1 < "$migration" >> "$restore_tmp/target.log"
done
docker exec -i "$container" psql -h 127.0.0.1 -U postgres -d recovery -v ON_ERROR_STOP=1 < "$restore_tmp/restore.sql" >> "$restore_tmp/target.log"
python - "$restore_tmp" <<'PY'
from pathlib import Path
import sys,shutil
p=Path(sys.argv[1])
assert p.name.startswith('tmp.')
shutil.rmtree(p)
PY
printf '%s\n' 'PASS: encrypted synthetic records restored into a fresh database; all foreign keys revalidated, counts/counters reconciled and restored access disabled.'

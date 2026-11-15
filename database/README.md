# PostgreSQL and pgvector

PostgreSQL is the runtime source of truth. `schema.sql` describes fresh database structure; `migrations/` contains ordered upgrades. The preferred initialization and upgrade command is:

```powershell
cd backend
.\.venv\Scripts\python -m app.db.migrate
```

The command reads `backend/.env`. Back up existing data and verify the target `DATABASE_URL` before running it. The migration role must be able to create the pgvector extension and alter the application schema. Application startup only checks readiness and never runs migrations.

Migrations run in one transaction under a PostgreSQL advisory lock. Completed versions are recorded in `flowforge_schema_versions`. Repeating the command skips applied versions. Conflicting legacy workflow, discussion, or comment identities cause the transaction to fail without deleting records; review those conflicts before retrying.

The upgrade removes global uniqueness on workflow run IDs, retains uniqueness within each user's repository, separates native status from conclusion, interprets old naive timestamps as UTC, normalizes legacy percentage confidence to a floating-point fraction, and adds attempt/job/cache identity fields and query indexes. Existing logs and discussions are retained. Legacy logs with no GitHub job identity remain stored; current logs are downloaded into identified records before new analysis.

## Disposable integration tests

From the repository root, with Docker running:

```powershell
docker compose -f docker/compose.test.yml up -d --wait
cd backend
$env:TEST_DATABASE_URL='postgresql://postgres:flowforge-test-only@127.0.0.1:55432/flowforge_audit'
.\.venv\Scripts\python -m unittest discover -s tests -v
Remove-Item Env:TEST_DATABASE_URL
cd ..
docker compose -f docker/compose.test.yml down
```

The supplied credentials are only for this local disposable database. Integration tests reject remote hosts and ordinary application database names. They cover repeatable initialization, legacy schema upgrades without data loss, concurrent workflow upserts, and vector distance operations. The legacy-schema fixture is deliberately an old schema, not the current initialization script.

Never point `TEST_DATABASE_URL` at Supabase or a database containing application data.

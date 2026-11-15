# Local test infrastructure

`compose.test.yml` runs an isolated PostgreSQL 17 database with pgvector on `127.0.0.1:55432`. It supports backend migration and concurrency tests; instructions are in `../database/README.md`.

This repository does not currently include production application images or a full application/Celery/Redis compose deployment.

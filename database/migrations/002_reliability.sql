ALTER TABLE repositories ADD COLUMN IF NOT EXISTS is_accessible BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS run_attempt INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS github_updated_at TIMESTAMPTZ;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS logs_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE failure_logs ADD COLUMN IF NOT EXISTS run_attempt INTEGER NOT NULL DEFAULT 1;
ALTER TABLE failure_logs ADD COLUMN IF NOT EXISTS github_job_id VARCHAR(100);
ALTER TABLE failure_logs ADD COLUMN IF NOT EXISTS analysis_cache_key VARCHAR(64);
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS github_payload TEXT;
ALTER TABLE discussion_comments ADD COLUMN IF NOT EXISTS github_payload TEXT;
ALTER TABLE repositories ALTER COLUMN is_accessible SET DEFAULT TRUE;
ALTER TABLE workflow_runs ALTER COLUMN run_attempt SET DEFAULT 1;
ALTER TABLE workflow_runs ALTER COLUMN logs_complete SET DEFAULT FALSE;
ALTER TABLE failure_logs ALTER COLUMN run_attempt SET DEFAULT 1;
ALTER TABLE failure_logs ALTER COLUMN ai_confidence TYPE DOUBLE PRECISION USING ai_confidence::double precision;
UPDATE failure_logs SET ai_confidence = ai_confidence / 100 WHERE ai_confidence > 1;

-- Interpret old, timezone-free application timestamps as UTC.
DO $$ DECLARE item RECORD; BEGIN
  FOR item IN SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND data_type = 'timestamp without time zone'
      AND table_name IN ('users','repositories','workflow_runs','run_steps','failure_logs','discussions','discussion_comments')
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', item.table_name, item.column_name, item.column_name);
  END LOOP;
END $$;

-- Refuse to discard conflicting data. The whole migration rolls back on error.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM workflow_runs GROUP BY repository_id, github_run_id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM discussions WHERE workflow_run_id IS NOT NULL GROUP BY repository_id, workflow_run_id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM discussion_comments WHERE github_comment_id IS NOT NULL GROUP BY discussion_id, github_comment_id HAVING count(*) > 1)
  THEN RAISE EXCEPTION 'Conflicting legacy records require review; no records have been deleted'; END IF;
END $$;

-- Retire only global uniqueness on github_run_id, retaining unrelated indexes.
DO $$ DECLARE item RECORD; BEGIN
  FOR item IN SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid = 'workflow_runs'::regclass AND c.contype = 'u'
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'github_run_id')]::smallint[]
  LOOP EXECUTE format('ALTER TABLE workflow_runs DROP CONSTRAINT %I', item.conname); END LOOP;
  FOR item IN SELECT i.indexrelid::regclass AS name FROM pg_index i
    WHERE i.indrelid = 'workflow_runs'::regclass AND i.indisunique AND i.indnkeyatts = 1
      AND i.indkey[0] = (SELECT attnum FROM pg_attribute WHERE attrelid = i.indrelid AND attname = 'github_run_id')
  LOOP EXECUTE format('DROP INDEX %s', item.name); END LOOP;
END $$;

UPDATE workflow_runs SET conclusion = COALESCE(conclusion, CASE status WHEN 'failed' THEN 'failure' ELSE status END), status = 'completed'
  WHERE status IN ('success','failed','failure','cancelled','timed_out','skipped','neutral','action_required');
UPDATE workflow_runs SET completed_at = COALESCE(completed_at, started_at + duration_seconds * interval '1 second')
  WHERE status = 'completed' AND duration_seconds > 0 AND started_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_run_repository_github_id ON workflow_runs(repository_id, github_run_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_repository_user_github_id ON repositories(user_id, github_repo_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_discussion_repository_issue ON discussions(repository_id, github_issue_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_discussion_repository_run ON discussions(repository_id, workflow_run_id) WHERE workflow_run_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_comment_discussion_github ON discussion_comments(discussion_id, github_comment_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_failure_run_attempt_job ON failure_logs(workflow_run_id, run_attempt, github_job_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_repo_started ON workflow_runs(repository_id, started_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_failure_logs_run ON failure_logs(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_discussions_repo_status ON discussions(repository_id, status);

CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS vector_documents (
  id TEXT PRIMARY KEY, collection_name TEXT NOT NULL, document TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, embedding vector(384) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS vector_documents_collection_idx ON vector_documents(collection_name);
CREATE INDEX IF NOT EXISTS vector_documents_repo_collection_idx ON vector_documents((metadata->>'repo_id'), collection_name);
CREATE INDEX IF NOT EXISTS vector_documents_embedding_idx ON vector_documents USING hnsw (embedding vector_cosine_ops);

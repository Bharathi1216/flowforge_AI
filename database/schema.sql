-- Fresh database schema. Existing databases: run python -m app.db.migrate.
CREATE EXTENSION IF NOT EXISTS vector;



CREATE TABLE IF NOT EXISTS users (
	id SERIAL NOT NULL,
	github_id VARCHAR(100) NOT NULL,
	username VARCHAR(100) NOT NULL,
	name VARCHAR(150),
	email VARCHAR(255),
	avatar_url TEXT,
	github_url TEXT,
	access_token TEXT,
	created_at TIMESTAMP WITH TIME ZONE,
	updated_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (id)
)

;

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_github_id ON users (github_id);

CREATE INDEX IF NOT EXISTS ix_users_id ON users (id);

CREATE INDEX IF NOT EXISTS ix_users_username ON users (username);


CREATE TABLE IF NOT EXISTS repositories (
	id SERIAL NOT NULL,
	user_id INTEGER,
	github_repo_id VARCHAR(100),
	name VARCHAR(255) NOT NULL,
	full_name VARCHAR(255) NOT NULL,
	owner VARCHAR(100) NOT NULL,
	description TEXT,
	language VARCHAR(100),
	is_private BOOLEAN,
	default_branch VARCHAR(100),
	webhook_id VARCHAR(100),
	is_accessible BOOLEAN DEFAULT true NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE,
	updated_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (id),
	CONSTRAINT uq_repository_user_github_id UNIQUE (user_id, github_repo_id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;

CREATE INDEX IF NOT EXISTS ix_repositories_full_name ON repositories (full_name);

CREATE INDEX IF NOT EXISTS ix_repositories_github_repo_id ON repositories (github_repo_id);

CREATE INDEX IF NOT EXISTS ix_repositories_id ON repositories (id);


CREATE TABLE IF NOT EXISTS workflow_runs (
	id SERIAL NOT NULL,
	repository_id INTEGER NOT NULL,
	github_run_id VARCHAR(100) NOT NULL,
	workflow_name VARCHAR(255) NOT NULL,
	run_number INTEGER NOT NULL,
	status VARCHAR(50) NOT NULL,
	conclusion VARCHAR(50),
	branch VARCHAR(150) NOT NULL,
	commit_sha VARCHAR(100),
	commit_message TEXT,
	author_username VARCHAR(100),
	author_avatar_url TEXT,
	duration_seconds INTEGER,
	started_at TIMESTAMP WITH TIME ZONE,
	completed_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE,
	run_attempt INTEGER DEFAULT 1 NOT NULL,
	github_updated_at TIMESTAMP WITH TIME ZONE,
	logs_complete BOOLEAN DEFAULT false NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_workflow_run_repository_github_id UNIQUE (repository_id, github_run_id),
	FOREIGN KEY(repository_id) REFERENCES repositories (id) ON DELETE CASCADE
)

;

CREATE INDEX IF NOT EXISTS ix_workflow_runs_github_run_id ON workflow_runs (github_run_id);

CREATE INDEX IF NOT EXISTS ix_workflow_runs_id ON workflow_runs (id);


CREATE TABLE IF NOT EXISTS discussions (
	id SERIAL NOT NULL,
	repository_id INTEGER NOT NULL,
	workflow_run_id INTEGER,
	user_id INTEGER,
	github_issue_number INTEGER,
	github_payload TEXT,
	title VARCHAR(255) NOT NULL,
	content TEXT,
	status VARCHAR(50),
	created_at TIMESTAMP WITH TIME ZONE,
	updated_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (id),
	CONSTRAINT uq_discussion_repository_issue UNIQUE (repository_id, github_issue_number),
	FOREIGN KEY(repository_id) REFERENCES repositories (id) ON DELETE CASCADE,
	FOREIGN KEY(workflow_run_id) REFERENCES workflow_runs (id) ON DELETE SET NULL,
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;

CREATE INDEX IF NOT EXISTS ix_discussions_id ON discussions (id);


CREATE TABLE IF NOT EXISTS failure_logs (
	id SERIAL NOT NULL,
	workflow_run_id INTEGER NOT NULL,
	github_job_id VARCHAR(100),
	run_attempt INTEGER DEFAULT 1 NOT NULL,
	analysis_cache_key VARCHAR(64),
	step_name VARCHAR(255),
	exit_code INTEGER,
	raw_logs TEXT,
	error_snippet TEXT,
	root_cause TEXT,
	suggested_fix TEXT,
	ai_confidence FLOAT,
	failure_fingerprint VARCHAR(255),
	structured_failure TEXT,
	important_log_blocks TEXT,
	evidence TEXT,
	analysis_status VARCHAR(50),
	model VARCHAR(100),
	prompt_version VARCHAR(50),
	analysis_result TEXT,
	provider_results TEXT,
	gemini_result TEXT,
	groq_result TEXT,
	created_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (id),
	CONSTRAINT uq_failure_run_attempt_job UNIQUE (workflow_run_id, run_attempt, github_job_id),
	FOREIGN KEY(workflow_run_id) REFERENCES workflow_runs (id) ON DELETE CASCADE
)

;

CREATE INDEX IF NOT EXISTS idx_failure_logs_run ON failure_logs (workflow_run_id);

CREATE INDEX IF NOT EXISTS ix_failure_logs_failure_fingerprint ON failure_logs (failure_fingerprint);

CREATE INDEX IF NOT EXISTS ix_failure_logs_id ON failure_logs (id);


CREATE TABLE IF NOT EXISTS run_steps (
	id SERIAL NOT NULL,
	workflow_run_id INTEGER NOT NULL,
	step_number INTEGER NOT NULL,
	name VARCHAR(255) NOT NULL,
	status VARCHAR(50) NOT NULL,
	conclusion VARCHAR(50),
	duration_seconds INTEGER,
	started_at TIMESTAMP WITH TIME ZONE,
	completed_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (id),
	FOREIGN KEY(workflow_run_id) REFERENCES workflow_runs (id) ON DELETE CASCADE
)

;

CREATE INDEX IF NOT EXISTS ix_run_steps_id ON run_steps (id);


CREATE TABLE IF NOT EXISTS discussion_comments (
	id SERIAL NOT NULL,
	discussion_id INTEGER NOT NULL,
	user_id INTEGER,
	github_comment_id VARCHAR(100),
	github_payload TEXT,
	content TEXT NOT NULL,
	log_excerpt TEXT,
	is_ai_generated BOOLEAN,
	created_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (id),
	CONSTRAINT uq_comment_discussion_github UNIQUE (discussion_id, github_comment_id),
	FOREIGN KEY(discussion_id) REFERENCES discussions (id) ON DELETE CASCADE,
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;

CREATE INDEX IF NOT EXISTS ix_discussion_comments_github_comment_id ON discussion_comments (github_comment_id);

CREATE INDEX IF NOT EXISTS ix_discussion_comments_id ON discussion_comments (id);


CREATE TABLE IF NOT EXISTS vector_documents (
  id TEXT PRIMARY KEY, collection_name TEXT NOT NULL, document TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, embedding vector(384) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS vector_documents_collection_idx ON vector_documents(collection_name);
CREATE INDEX IF NOT EXISTS vector_documents_repo_collection_idx ON vector_documents((metadata->>'repo_id'), collection_name);
CREATE INDEX IF NOT EXISTS vector_documents_embedding_idx ON vector_documents USING hnsw (embedding vector_cosine_ops);


CREATE UNIQUE INDEX IF NOT EXISTS uq_discussion_repository_run ON discussions(repository_id, workflow_run_id) WHERE workflow_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_repo_started ON workflow_runs(repository_id, started_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_discussions_repo_status ON discussions(repository_id, status);

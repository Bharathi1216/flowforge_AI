-- FlowForge AI - PostgreSQL Database Schema
-- Run this script to initialize the relational tables in PostgreSQL

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS vector_documents (
    id TEXT PRIMARY KEY,
    collection_name TEXT NOT NULL,
    document TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(384) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(collection_name, id)
);

CREATE INDEX IF NOT EXISTS vector_documents_collection_idx
    ON vector_documents(collection_name);

CREATE INDEX IF NOT EXISTS vector_documents_embedding_idx
    ON vector_documents
    USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    github_id VARCHAR(100) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    name VARCHAR(150),
    email VARCHAR(255),
    avatar_url TEXT,
    github_url TEXT,
    access_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS repositories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    github_repo_id VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    owner VARCHAR(100) NOT NULL,
    description TEXT,
    language VARCHAR(100),
    is_private BOOLEAN DEFAULT FALSE,
    default_branch VARCHAR(100) DEFAULT 'main',
    webhook_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, github_repo_id)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
    id SERIAL PRIMARY KEY,
    repository_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
    github_run_id VARCHAR(100) NOT NULL,
    workflow_name VARCHAR(255) NOT NULL,
    run_number INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL, -- queued, in_progress, completed, failed, success, cancelled
    conclusion VARCHAR(50),      -- success, failure, cancelled, timed_out
    branch VARCHAR(150) NOT NULL,
    commit_sha VARCHAR(100),
    commit_message TEXT,
    author_username VARCHAR(100),
    author_avatar_url TEXT,
    duration_seconds INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS run_steps (
    id SERIAL PRIMARY KEY,
    workflow_run_id INTEGER REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    conclusion VARCHAR(50),
    duration_seconds INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS failure_logs (
    id SERIAL PRIMARY KEY,
    workflow_run_id INTEGER REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_name VARCHAR(255),
    exit_code INTEGER DEFAULT 1,
    raw_logs TEXT,
    error_snippet TEXT,
    root_cause TEXT,
    suggested_fix TEXT,
    ai_confidence INTEGER DEFAULT 90,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discussions (
    id SERIAL PRIMARY KEY,
    repository_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
    workflow_run_id INTEGER REFERENCES workflow_runs(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    github_issue_number INTEGER,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    status VARCHAR(50) DEFAULT 'open', -- open, resolved
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discussion_comments (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER REFERENCES discussions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    github_comment_id VARCHAR(100),
    content TEXT NOT NULL,
    log_excerpt TEXT,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_repo ON workflow_runs(repository_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_failure_logs_run ON failure_logs(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_discussions_repo ON discussions(repository_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_discussion_repository_issue
    ON discussions(repository_id, github_issue_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_run_repository_github_id
    ON workflow_runs(repository_id, github_run_id);

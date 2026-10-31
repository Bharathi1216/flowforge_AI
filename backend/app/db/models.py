from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    github_id = Column(String(100), unique=True, index=True, nullable=False)
    username = Column(String(100), index=True, nullable=False)
    name = Column(String(150), nullable=True)
    email = Column(String(255), nullable=True)
    avatar_url = Column(Text, nullable=True)
    github_url = Column(Text, nullable=True)
    access_token = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repositories = relationship("Repository", back_populates="user", cascade="all, delete-orphan")
    discussions = relationship("Discussion", back_populates="author", cascade="all, delete-orphan")
    comments = relationship("DiscussionComment", back_populates="author", cascade="all, delete-orphan")


class Repository(Base):
    __tablename__ = "repositories"
    __table_args__ = (
        UniqueConstraint("user_id", "github_repo_id", name="uq_repository_user_github_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    github_repo_id = Column(String(100), index=True, nullable=True)
    name = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False, index=True)
    owner = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    language = Column(String(100), nullable=True)
    is_private = Column(Boolean, default=False)
    default_branch = Column(String(100), default="main")
    webhook_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="repositories")
    workflow_runs = relationship("WorkflowRun", back_populates="repository", cascade="all, delete-orphan")
    discussions = relationship("Discussion", back_populates="repository", cascade="all, delete-orphan")


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"
    __table_args__ = (
        UniqueConstraint("repository_id", "github_run_id", name="uq_workflow_run_repository_github_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    github_run_id = Column(String(100), index=True, nullable=False)
    workflow_name = Column(String(255), nullable=False)
    run_number = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False) # queued, in_progress, completed, failed, success, cancelled
    conclusion = Column(String(50), nullable=True) # success, failure, cancelled
    branch = Column(String(150), nullable=False)
    commit_sha = Column(String(100), nullable=True)
    commit_message = Column(Text, nullable=True)
    author_username = Column(String(100), nullable=True)
    author_avatar_url = Column(Text, nullable=True)
    duration_seconds = Column(Integer, default=0)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    repository = relationship("Repository", back_populates="workflow_runs")
    steps = relationship("RunStep", back_populates="workflow_run", cascade="all, delete-orphan")
    failure_logs = relationship("FailureLog", back_populates="workflow_run", cascade="all, delete-orphan")
    discussions = relationship("Discussion", back_populates="workflow_run")


class RunStep(Base):
    __tablename__ = "run_steps"

    id = Column(Integer, primary_key=True, index=True)
    workflow_run_id = Column(Integer, ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False)
    step_number = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False)
    conclusion = Column(String(50), nullable=True)
    duration_seconds = Column(Integer, default=0)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    workflow_run = relationship("WorkflowRun", back_populates="steps")


class FailureLog(Base):
    __tablename__ = "failure_logs"

    id = Column(Integer, primary_key=True, index=True)
    workflow_run_id = Column(Integer, ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False)
    step_name = Column(String(255), nullable=True)
    exit_code = Column(Integer, default=1)
    raw_logs = Column(Text, nullable=True)
    error_snippet = Column(Text, nullable=True)
    root_cause = Column(Text, nullable=True)
    suggested_fix = Column(Text, nullable=True)
    ai_confidence = Column(Float, nullable=True)
    failure_fingerprint = Column(String(255), nullable=True, index=True)
    structured_failure = Column(Text, nullable=True)
    important_log_blocks = Column(Text, nullable=True)
    evidence = Column(Text, nullable=True)
    analysis_status = Column(String(50), default="completed")
    model = Column(String(100), nullable=True)
    prompt_version = Column(String(50), default="rca-v1")
    analysis_result = Column(Text, nullable=True)
    provider_results = Column(Text, nullable=True)
    gemini_result = Column(Text, nullable=True)
    groq_result = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    workflow_run = relationship("WorkflowRun", back_populates="failure_logs")


class Discussion(Base):
    __tablename__ = "discussions"
    __table_args__ = (
        UniqueConstraint("repository_id", "github_issue_number", name="uq_discussion_repository_issue"),
    )

    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    workflow_run_id = Column(Integer, ForeignKey("workflow_runs.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    github_issue_number = Column(Integer, nullable=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    status = Column(String(50), default="open") # open, resolved
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repository = relationship("Repository", back_populates="discussions")
    workflow_run = relationship("WorkflowRun", back_populates="discussions")
    author = relationship("User", back_populates="discussions")
    comments = relationship("DiscussionComment", back_populates="discussion", cascade="all, delete-orphan")


class DiscussionComment(Base):
    __tablename__ = "discussion_comments"

    id = Column(Integer, primary_key=True, index=True)
    discussion_id = Column(Integer, ForeignKey("discussions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    github_comment_id = Column(String(100), nullable=True, index=True)
    content = Column(Text, nullable=False)
    log_excerpt = Column(Text, nullable=True)
    is_ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    discussion = relationship("Discussion", back_populates="comments")
    author = relationship("User", back_populates="comments")

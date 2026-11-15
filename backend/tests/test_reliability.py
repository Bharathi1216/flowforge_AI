import asyncio
import hashlib
import hmac
import json
import os
import unittest
from tests.support import configure_environment

configure_environment()
from datetime import datetime, timedelta, timezone
from threading import get_ident
from unittest.mock import AsyncMock, patch

import httpx
import jwt
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.db.database import Base, isolated_db
from app.db.models import WorkflowRun, DiscussionComment, FailureLog, Repository, User
from app.main import app
from app.routers.auth import _session_token
from app.routers.discussions import _sync_comments_to_db, _sync_discussion_to_db
from app.routers.repositories import _cached_repositories, _workflow_summary, _list_repositories
from app.routers.workflows import _decode_logs, _upsert_run
from app.services.embedding_model import LazyEmbeddingModel
from app.services.log_preprocessor import preprocess_logs
from app.services.rca_engine import _parse_and_validate_rca_json
from app.services.vector_store import VectorStoreService


def github_run(run_id=900, **changes):
    return {
        "id": run_id,
        "name": "CI",
        "run_number": 4,
        "run_attempt": 1,
        "status": "completed",
        "conclusion": "failure",
        "head_commit": None,
        "created_at": "2026-11-14T10:00:00Z",
        "run_started_at": "2026-11-14T10:00:00Z",
        "updated_at": "2026-11-14T10:01:00Z",
        **changes,
    }


def issue(number=8, **changes):
    return {
        "number": number,
        "title": "Build failure",
        "body": "Details",
        "state": "open",
        "user": {"id": 101, "login": "alice"},
        "comments": 0,
        "created_at": "2026-11-14T10:00:00Z",
        "updated_at": "2026-11-14T10:01:00Z",
        **changes,
    }


class ReliabilityTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
        )
        Base.metadata.create_all(self.engine)
        self.factory = sessionmaker(bind=self.engine, expire_on_commit=False, autoflush=False)
        self.db_patch = patch("app.db.database.SessionLocal", self.factory)
        self.db_patch.start()
        self.webhook_patch = patch("app.routers.webhooks.SessionLocal", self.factory)
        self.webhook_patch.start()
        self.http = httpx.Client(
            transport=httpx.MockTransport(self.dispatch), follow_redirects=True
        )
        self.http_patch = patch("app.services.github._client", self.http)
        self.http_patch.start()
        self.handler = None
        self.client = TestClient(app)
        with self.factory() as db:
            self.user = User(github_id="101", username="alice", access_token="test-only")
            db.add(self.user)
            db.flush()
            self.repo = Repository(
                user_id=self.user.id,
                github_repo_id="500",
                name="project",
                full_name="alice/project",
                owner="alice",
            )
            db.add(self.repo)
            db.commit()
        self.client.cookies.set("flowforge_session", _session_token(self.user.id))

    def dispatch(self, request):
        if self.handler:
            return self.handler(request)
        raise AssertionError(f"Unexpected network request: {request.method} {request.url.path}")

    def tearDown(self):
        self.client.close()
        self.http_patch.stop()
        self.http.close()
        self.db_patch.stop()
        self.webhook_patch.stop()
        self.engine.dispose()

    def test_login_redirect_does_not_create_a_database_session(self):
        with (
            patch.object(settings, "GITHUB_CLIENT_ID", "oauth-client-test"),
            patch.object(settings, "GITHUB_CLIENT_SECRET", "oauth-secret-test"),
            patch("app.db.database.SessionLocal", side_effect=AssertionError("Unexpected SQL")),
        ):
            response = self.client.get("/api/auth/github/login", follow_redirects=False)
        self.assertEqual(response.status_code, 307)
        self.assertTrue(
            response.headers["location"].startswith("https://github.com/login/oauth/authorize?")
        )
        self.assertIn("flowforge_oauth_state", response.cookies)
        self.assertIn("HttpOnly", response.headers["set-cookie"])

    def test_logout_clears_cookie_without_a_database_session(self):
        with patch("app.db.database.SessionLocal", side_effect=AssertionError("Unexpected SQL")):
            response = self.client.post("/api/auth/logout")
        self.assertEqual(response.status_code, 204)
        self.assertIn("Max-Age=0", response.headers["set-cookie"])

    def test_local_login_alias_redirects_before_setting_oauth_cookie(self):
        with (
            patch.object(settings, "FRONTEND_URL", "http://localhost:5173"),
            patch.object(
                settings, "GITHUB_REDIRECT_URI", "http://localhost:8001/api/auth/github/callback"
            ),
        ):
            response = self.client.get(
                "http://127.0.0.1:5173/api/auth/github/login", follow_redirects=False
            )
        self.assertEqual(response.status_code, 307)
        self.assertEqual(
            response.headers["location"], "http://localhost:5173/api/auth/github/login"
        )
        self.assertNotIn("set-cookie", response.headers)

    def test_proxied_canonical_login_does_not_redirect_to_itself(self):
        self.client.close()
        self.client = TestClient(app, client=("127.0.0.1", 40000))
        with (
            patch.object(settings, "GITHUB_CLIENT_ID", "oauth-client-test"),
            patch.object(settings, "GITHUB_CLIENT_SECRET", "oauth-secret-test"),
            patch.object(settings, "FRONTEND_URL", "http://localhost:5173"),
            patch.object(
                settings, "GITHUB_REDIRECT_URI", "http://localhost:8001/api/auth/github/callback"
            ),
        ):
            response = self.client.get(
                "http://127.0.0.1:8001/api/auth/github/login",
                headers={"X-Forwarded-Host": "localhost:5173"},
                follow_redirects=False,
            )
        self.assertEqual(response.status_code, 307)
        self.assertTrue(
            response.headers["location"].startswith("https://github.com/login/oauth/authorize?")
        )
        self.assertIn("flowforge_oauth_state", response.cookies)

    def test_unconfigured_login_returns_frontend_error_redirect(self):
        with patch.object(settings, "GITHUB_CLIENT_ID", ""):
            response = self.client.get("/api/auth/github/login", follow_redirects=False)
        self.assertEqual(response.status_code, 303)
        self.assertTrue(response.headers["location"].endswith("/?oauth_error=unavailable"))

    def test_database_wrapper_rejects_routes_without_db_parameter(self):
        def no_database_route():
            return None

        with self.assertRaisesRegex(TypeError, "requires a 'db' parameter"):
            isolated_db(no_database_route)

    def test_chat_returns_repository_facts_without_ai(self):
        with self.factory() as db:
            _upsert_run(db.get(Repository, self.repo.id), github_run(), db)
            db.commit()
        with patch("app.services.vector_store.vector_store.search_context", return_value=[]):
            for route in ("ai/chat", "chat"):
                with self.subTest(route=route):
                    response = self.client.post(
                        f"/api/repositories/500/{route}",
                        json={"messages": [{"role": "user", "content": "Why did CI fail?"}]},
                    )
                    self.assertEqual(response.status_code, 200, response.text)
                    self.assertEqual(response.json()["role"], "assistant")
                    self.assertIn("Run #4", response.json()["content"])
                    self.assertIn("Repository: alice/project", response.json()["sources"])

    def test_chat_awaits_ai_outside_the_asgi_thread(self):
        threads = {}

        async def generate_reply(prompt):
            threads["provider"] = get_ident()
            await asyncio.sleep(0)
            return "Inspect the failing test in alice/project."

        async def send_chat():
            threads["asgi"] = get_ident()
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://testserver",
                cookies={"flowforge_session": _session_token(self.user.id)},
            ) as client:
                return await client.post(
                    "/api/repositories/500/ai/chat",
                    json={"messages": [{"role": "user", "content": "Explain the CI failure"}]},
                )

        with (
            patch.object(settings, "GEMINI_API_KEY", "test-only"),
            patch("app.services.vector_store.vector_store.search_context", return_value=[]),
            patch(
                "app.routers.ai._generate_gemini_response",
                new=AsyncMock(side_effect=generate_reply),
            ) as generate,
        ):
            response = asyncio.run(send_chat())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["content"], "Inspect the failing test in alice/project.")
        generate.assert_awaited_once()
        self.assertNotEqual(threads["provider"], threads["asgi"])

    def test_chat_preserves_repository_access_checks(self):
        response = self.client.post(
            "/api/repositories/777/ai/chat",
            json={"messages": [{"role": "user", "content": "Explain the CI failure"}]},
        )
        self.assertEqual(response.status_code, 404, response.text)

    def test_expired_cookie_is_removed(self):
        token = jwt.encode(
            {
                "sub": str(self.user.id),
                "iat": datetime.now(timezone.utc) - timedelta(days=9),
                "exp": datetime.now(timezone.utc) - timedelta(days=2),
            },
            settings.SECRET_KEY,
            algorithm="HS256",
        )
        self.client.cookies.set("flowforge_session", token)
        response = self.client.get("/api/repositories")
        self.assertEqual(response.status_code, 401)
        self.assertIn("Max-Age=0", response.headers["set-cookie"])

    def test_sessions_without_expiration_are_rejected(self):
        self.client.cookies.set(
            "flowforge_session",
            jwt.encode({"sub": str(self.user.id)}, settings.SECRET_KEY, algorithm="HS256"),
        )
        self.assertEqual(self.client.get("/api/repositories").status_code, 401)

    def test_canonical_id_precedes_local_id(self):
        with self.factory() as db:
            other = Repository(
                user_id=self.user.id,
                github_repo_id=str(self.repo.id),
                name="other",
                full_name="alice/other",
                owner="alice",
            )
            db.add(other)
            db.commit()
        response = self.client.get(f"/api/repositories/{self.repo.id}")
        self.assertEqual(response.json()["name"], "other")

    def test_ambiguous_repository_names_return_conflict(self):
        with self.factory() as db:
            db.add(
                Repository(
                    user_id=self.user.id,
                    github_repo_id="501",
                    name="project",
                    full_name="org/project",
                    owner="org",
                )
            )
            db.commit()
        self.assertEqual(self.client.get("/api/repositories/project").status_code, 409)
        self.assertEqual(self.client.get("/api/repositories/500").status_code, 200)

    def test_other_users_repository_is_not_accessible(self):
        with self.factory() as db:
            user = User(github_id="102", username="bob", access_token="test")
            db.add(user)
            db.flush()
            db.add(
                Repository(
                    user_id=user.id,
                    github_repo_id="777",
                    name="private",
                    full_name="bob/private",
                    owner="bob",
                )
            )
            db.commit()
        self.assertEqual(self.client.get("/api/repositories/777").status_code, 404)

    def test_completion_duration_and_null_commit(self):
        with self.factory() as db:
            run = _upsert_run(db.get(Repository, self.repo.id), github_run(), db)
            self.assertEqual(run.status, "completed")
            self.assertIsNotNone(run.completed_at)
            self.assertEqual(run.duration_seconds, 60)

    def test_run_is_scoped_to_each_users_repository(self):
        with self.factory() as db:
            second = Repository(
                user_id=self.user.id,
                github_repo_id="501",
                name="second",
                full_name="alice/second",
                owner="alice",
            )
            db.add(second)
            db.flush()
            first = _upsert_run(db.get(Repository, self.repo.id), github_run(), db)
            other = _upsert_run(second, github_run(), db)
            self.assertNotEqual(first.id, other.id)
            self.assertEqual(other.repository_id, second.id)

    def test_old_event_cannot_overwrite_completed_run(self):
        with self.factory() as db:
            repo = db.get(Repository, self.repo.id)
            _upsert_run(repo, github_run(), db)
            run = _upsert_run(
                repo,
                github_run(
                    status="in_progress", conclusion=None, updated_at="2026-11-14T10:00:30Z"
                ),
                db,
            )
            self.assertEqual(run.status, "completed")

    def test_new_attempt_invalidates_log_completeness(self):
        with self.factory() as db:
            repo = db.get(Repository, self.repo.id)
            run = _upsert_run(repo, github_run(), db)
            run.logs_complete = True
            db.commit()
            run = _upsert_run(repo, github_run(run_attempt=2, status="queued", conclusion=None), db)
            self.assertEqual(run.run_attempt, 2)
            self.assertFalse(run.logs_complete)

    def test_summary_counts_completed_runs(self):
        status, failures, rate = _workflow_summary([github_run(conclusion="success"), github_run()])
        self.assertEqual((status, failures, rate), ("success", 1, 50.0))

    def test_repository_pagination_does_not_create_webhooks(self):
        calls = []

        def handler(request):
            calls.append(request.method)
            if request.url.path == "/user/repos":
                second = request.url.params.get("page") == "2"
                item = {
                    "id": 501 if second else 500,
                    "name": "second" if second else "project",
                    "full_name": "alice/second" if second else "alice/project",
                    "owner": {"login": "alice"},
                }
                return httpx.Response(
                    200,
                    json=[item],
                    headers={}
                    if second
                    else {"Link": '<https://api.github.com/user/repos?page=2>; rel="next"'},
                )
            return httpx.Response(200, json={"workflow_runs": []})

        self.handler = handler
        with self.factory() as db:
            self.assertEqual(len(_list_repositories(self.user, db)), 2)
        self.assertNotIn("POST", calls)

    def test_webhook_replay_is_idempotent(self):
        body = json.dumps(
            {"repository": {"id": 500, "full_name": "alice/project"}, "workflow_run": github_run()}
        ).encode()
        with patch.object(settings, "GITHUB_WEBHOOK_SECRET", "test-secret"):
            signature = "sha256=" + hmac.new(b"test-secret", body, hashlib.sha256).hexdigest()
            for _ in range(2):
                response = self.client.post(
                    "/api/webhooks/github",
                    content=body,
                    headers={"X-GitHub-Event": "workflow_run", "X-Hub-Signature-256": signature},
                )
                self.assertEqual(response.status_code, 202)
        with self.factory() as db:
            self.assertEqual(db.query(WorkflowRun).count(), 1)

    def test_discussion_sync_preserves_source_identity(self):
        with self.factory() as db:
            repo = db.get(Repository, self.repo.id)
            disc = _sync_discussion_to_db(issue(), repo, self.user, db)
            updated = _sync_discussion_to_db(issue(title="Updated title"), repo, self.user, db)
            self.assertEqual(disc.id, updated.id)
            self.assertEqual(updated.title, "Updated title")
            self.assertEqual(updated.user_id, self.user.id)

    def test_comment_sync_is_scoped_and_idempotent(self):
        with self.factory() as db:
            repo = db.get(Repository, self.repo.id)
            first = _sync_discussion_to_db(issue(8), repo, self.user, db)
            second = _sync_discussion_to_db(issue(9), repo, self.user, db)
            comment = {"id": 21, "body": "Second thread", "user": {"id": 101, "login": "alice"}}
            _sync_comments_to_db(second, [comment], self.user, db)
            _sync_comments_to_db(second, [{**comment, "body": "Edited"}], self.user, db)
            self.assertEqual(
                db.query(DiscussionComment).filter_by(discussion_id=first.id).count(), 0
            )
            self.assertEqual(db.query(DiscussionComment).count(), 1)
            self.assertEqual(db.query(DiscussionComment).one().content, "Edited")

    def test_blank_discussion_content_is_rejected(self):
        self.assertEqual(
            self.client.post(
                "/api/repositories/500/discussions", json={"title": "  ", "content": "x"}
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.patch(
                "/api/repositories/500/discussions/8", json={"status": "typo"}
            ).status_code,
            422,
        )

    def test_comment_post_is_mirrored_to_requested_issue(self):
        def handler(request):
            if request.method == "GET":
                return httpx.Response(200, json=issue(9))
            return httpx.Response(
                201, json={"id": 44, "body": "Reply", "user": {"id": 101, "login": "alice"}}
            )

        self.handler = handler
        with self.factory() as db:
            _sync_discussion_to_db(issue(8), db.get(Repository, self.repo.id), self.user, db)
            db.commit()
        response = self.client.post(
            "/api/repositories/500/discussions/9/comments", json={"content": "Reply"}
        )
        self.assertEqual(response.status_code, 201)
        with self.factory() as db:
            comment = db.query(DiscussionComment).one()
            self.assertEqual(comment.discussion.github_issue_number, 9)
            self.assertEqual(comment.github_comment_id, "44")

    def test_edit_preserves_run_marker(self):
        posted = []

        def handler(request):
            if request.method == "GET":
                return httpx.Response(200, json=issue(body="Old\n<!-- flowforge-run-id:900 -->"))
            posted.append(json.loads(request.content))
            return httpx.Response(200, json=issue(body=posted[-1]["body"]))

        self.handler = handler
        response = self.client.patch(
            "/api/repositories/500/discussions/8", json={"content": "Edited"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("flowforge-run-id:900", posted[0]["body"])

    def test_invalid_signed_webhook_json_is_422(self):
        body = b"{invalid"
        with patch.object(settings, "GITHUB_WEBHOOK_SECRET", "test-secret"):
            signature = "sha256=" + hmac.new(b"test-secret", body, hashlib.sha256).hexdigest()
            response = self.client.post(
                "/api/webhooks/github",
                content=body,
                headers={"X-GitHub-Event": "workflow_run", "X-Hub-Signature-256": signature},
            )
        self.assertEqual(response.status_code, 422)

    def test_workflow_definition_failure_is_propagated(self):
        self.handler = lambda request: httpx.Response(503)
        self.assertEqual(
            self.client.get("/api/repositories/500/workflows/definitions").status_code, 502
        )

    def test_partial_logs_are_retryable_and_preserve_downloaded_jobs(self):
        second_ready = False
        downloads = []

        def handler(request):
            path = request.url.path
            if path.endswith("/runs/900"):
                return httpx.Response(200, json=github_run())
            if path.endswith("/jobs"):
                return httpx.Response(
                    200,
                    json={
                        "jobs": [
                            {
                                "id": 1,
                                "name": "job 1",
                                "status": "completed",
                                "conclusion": "failure",
                            },
                            {
                                "id": 2,
                                "name": "job 2",
                                "status": "completed",
                                "conclusion": "failure",
                            },
                        ]
                    },
                )
            downloads.append(path)
            return (
                httpx.Response(200, text="Error: failed")
                if second_ready or "/jobs/1/" in path
                else httpx.Response(404)
            )

        self.handler = handler
        with self.factory() as db:
            _upsert_run(db.get(Repository, self.repo.id), github_run(), db)
            db.commit()
        self.assertEqual(
            self.client.get("/api/repositories/500/workflows/900/logs").status_code, 409
        )
        second_ready = True
        response = self.client.get("/api/repositories/500/workflows/900/logs")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([line["lineNumber"] for line in response.json()], [1, 2])
        self.assertEqual(sum("/jobs/1/" in path for path in downloads), 1)

    def test_analysis_is_cached_including_unavailable_provider(self):
        with self.factory() as db:
            run = _upsert_run(db.get(Repository, self.repo.id), github_run(), db)
            run.logs_complete = True
            db.add(
                FailureLog(
                    workflow_run_id=run.id,
                    github_job_id="1",
                    run_attempt=1,
                    step_name="tests",
                    raw_logs="ModuleNotFoundError: No module named widget",
                    exit_code=1,
                )
            )
            db.commit()
        result = {
            "root_cause": ["Missing widget"],
            "suggested_fix": "Install widget",
            "confidence": 0.8,
            "evidence": [],
            "log_analysis": [],
            "analysis_status": "completed",
            "model": "test",
        }
        primary, secondary = (
            AsyncMock(return_value=result),
            AsyncMock(return_value={**result, "analysis_status": "unavailable"}),
        )
        with (
            patch("app.services.rca_engine.run_rca", primary),
            patch("app.services.rca_engine.run_groq_rca", secondary),
            patch("app.services.vector_store.vector_store.find_similar_failures", return_value=[]),
            patch("app.services.vector_store.vector_store.index_failure"),
        ):
            one = self.client.post("/api/repositories/500/workflows/900/analysis")
            two = self.client.post("/api/repositories/500/workflows/900/analysis")
            self.assertEqual(one.status_code, 200, one.text)
            self.assertEqual(two.json(), one.json())
            self.assertEqual(primary.await_count, 1)
            self.assertEqual(secondary.await_count, 1)
            self.assertEqual(
                self.client.get("/api/repositories/500/workflows/900/analysis").status_code, 200
            )
            self.client.post("/api/repositories/500/workflows/900/analysis?reanalyze=true")
            self.assertEqual(primary.await_count, 2)

    def test_large_dense_log_fits_context_budget(self):
        blocks, _ = preprocess_logs(
            "\n".join(f"ERROR: issue {i} " + "x" * 100 for i in range(2000)), max_tokens=500
        )
        self.assertTrue(blocks)
        self.assertLessEqual(sum(len(block["text"]) for block in blocks), 1750)
        self.assertTrue(all(line["line_number"] > 0 for block in blocks for line in block["lines"]))

    def test_invalid_model_output_is_not_accepted(self):
        for payload in [
            [],
            {},
            {"root_cause": [], "suggested_fix": "x"},
            {"root_cause": ["x"], "suggested_fix": "x", "confidence": "NaN"},
            {"root_cause": ["x"], "suggested_fix": "x", "log_analysis": [{"error_logs": [[5, 1]]}]},
        ]:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                _parse_and_validate_rca_json(json.dumps(payload))

    def test_embedding_is_lazy_and_vector_ids_do_not_collide(self):
        with patch("app.services.embedding_model.EmbeddingModel") as model:
            lazy = LazyEmbeddingModel()
            model.assert_not_called()
            lazy.embed("example")
            model.assert_called_once()
        store = VectorStoreService()
        self.assertNotEqual(
            store._doc_id("1", "9", "x" * 40 + "one"), store._doc_id("1", "9", "x" * 40 + "two")
        )
        self.assertNotEqual(store._doc_id("1", "9", "test"), store._doc_id("2", "9", "test"))

    def test_oversized_log_download_is_rejected(self):
        with patch.object(settings, "MAX_LOG_BYTES", 1024), self.assertRaises(Exception) as error:
            _decode_logs(b"x" * 1025)
        self.assertEqual(error.exception.status_code, 413)

    def test_repository_summary_query_count_is_bounded(self):
        with self.factory() as db:
            for index in range(40):
                repo = Repository(
                    user_id=self.user.id,
                    github_repo_id=str(1000 + index),
                    name=str(index),
                    full_name=f"alice/{index}",
                    owner="alice",
                )
                db.add(repo)
                db.flush()
                _upsert_run(repo, github_run(10000 + index), db)
            db.commit()
            statements = []

            def record(*args):
                statements.append(args[2])

            event.listen(self.engine, "before_cursor_execute", record)
            try:
                payload = _cached_repositories(self.user, db)
            finally:
                event.remove(self.engine, "before_cursor_execute", record)
            self.assertEqual(len(payload), 41)
            self.assertLessEqual(len(statements), 4)


@unittest.skipUnless(
    os.getenv("TEST_DATABASE_URL"),
    "Set TEST_DATABASE_URL to a disposable local PostgreSQL database",
)
class PostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from sqlalchemy.engine import make_url

        url = make_url(os.environ["TEST_DATABASE_URL"])
        if (
            url.host not in {"localhost", "127.0.0.1"}
            or "test" not in url.database
            and "audit" not in url.database
        ):
            raise RuntimeError("Integration tests require a disposable local test/audit database")
        cls.engine = create_engine(url.set(drivername="postgresql+psycopg2"))
        from app.db.migrate import migrate

        migrate(cls.engine)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def test_fresh_migration_is_repeatable_and_pgvector_works(self):
        from app.db.migrate import migrate

        migrate(self.engine)
        migrate(self.engine)
        with self.engine.connect() as connection:
            self.assertEqual(
                connection.execute(text("SELECT count(*) FROM flowforge_schema_versions")).scalar(),
                2,
            )
            vector = "[" + ",".join(["1"] * 384) + "]"
            distance = connection.execute(
                text("SELECT CAST(:v AS vector) <=> CAST(:v AS vector)"), {"v": vector}
            ).scalar()
            self.assertAlmostEqual(distance, 0.0, places=6)

    def test_legacy_migration_preserves_data_and_removes_global_run_uniqueness(self):
        from pathlib import Path
        from uuid import uuid4
        from app.db.migrate import migrate

        schema = "audit_" + uuid4().hex
        with self.engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        legacy = create_engine(
            self.engine.url, connect_args={"options": f"-csearch_path={schema},public"}
        )
        try:
            with legacy.begin() as connection:
                connection.execute(
                    text(
                        (Path(__file__).parent / "fixtures/legacy_schema.sql").read_text(
                            encoding="utf-8"
                        )
                    )
                )
                connection.execute(
                    text(
                        "ALTER TABLE workflow_runs ADD CONSTRAINT legacy_global_run UNIQUE(github_run_id)"
                    )
                )
                connection.execute(
                    text("INSERT INTO users(id, github_id, username) VALUES (1,'legacy','alice')")
                )
                connection.execute(
                    text(
                        "INSERT INTO repositories(id,user_id,github_repo_id,name,full_name,owner) VALUES (1,1,'11','project','alice/project','alice')"
                    )
                )
                connection.execute(
                    text(
                        "INSERT INTO workflow_runs(id,repository_id,github_run_id,workflow_name,run_number,status,branch) VALUES (1,1,'42','CI',1,'success','main')"
                    )
                )
                connection.execute(
                    text(
                        "INSERT INTO failure_logs(workflow_run_id,raw_logs,ai_confidence) VALUES (1,'preserved logs',95)"
                    )
                )
            migrate(legacy)
            migrate(legacy)
            with legacy.begin() as connection:
                self.assertEqual(
                    connection.execute(text("SELECT status FROM workflow_runs")).scalar(),
                    "completed",
                )
                self.assertEqual(
                    connection.execute(text("SELECT raw_logs FROM failure_logs")).scalar(),
                    "preserved logs",
                )
                self.assertAlmostEqual(
                    connection.execute(text("SELECT ai_confidence FROM failure_logs")).scalar(),
                    0.95,
                )
                connection.execute(
                    text(
                        "INSERT INTO repositories(id,user_id,github_repo_id,name,full_name,owner) VALUES (2,1,'12','other','alice/other','alice')"
                    )
                )
                connection.execute(
                    text(
                        "INSERT INTO workflow_runs(id,repository_id,github_run_id,workflow_name,run_number,status,branch) VALUES (2,2,'42','CI',1,'completed','main')"
                    )
                )
                self.assertEqual(
                    connection.execute(text("SELECT count(*) FROM workflow_runs")).scalar(), 2
                )
        finally:
            legacy.dispose()
            with self.engine.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))

    def test_concurrent_upserts_create_one_workflow_record(self):
        from concurrent.futures import ThreadPoolExecutor
        from uuid import uuid4

        token = uuid4().hex
        factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        with factory() as db:
            user = User(github_id=token, username="audit", access_token="test")
            db.add(user)
            db.flush()
            repo = Repository(
                user_id=user.id,
                github_repo_id=token,
                name="audit",
                full_name="audit/test",
                owner="audit",
            )
            db.add(repo)
            db.commit()
            user_id, repo_id = user.id, repo.id
        try:

            def upsert(_):
                with factory() as db:
                    run = _upsert_run(db.get(Repository, repo_id), github_run(12345678), db)
                    db.commit()
                    return run.id

            with ThreadPoolExecutor(max_workers=5) as executor:
                ids = list(executor.map(upsert, range(5)))
            self.assertEqual(len(set(ids)), 1)
        finally:
            with factory() as db:
                db.delete(db.get(User, user_id))
                db.commit()

    def test_vector_knowledge_is_scoped_and_current_run_is_excluded(self):
        from uuid import uuid4

        token = uuid4().hex
        one, two = f"audit-{token}-one", f"audit-{token}-two"
        store = VectorStoreService()
        store.embedding_model = type(
            "TestEmbedding", (), {"embed": lambda self, value: [1.0] * 384}
        )()
        try:
            with patch("app.services.vector_store.engine", self.engine):
                first = store.index_failure(
                    one,
                    "9",
                    9,
                    "CI",
                    "test",
                    "missing widget",
                    "missing dependency",
                    "install widget",
                )
                second = store.index_failure(
                    two, "9", 9, "CI", "test", "missing widget", "different cause", "different fix"
                )
                self.assertNotEqual(first, second)
                self.assertEqual(store.get_knowledge_base(one)[0]["suggestedFix"], "install widget")
                self.assertEqual(store.get_knowledge_base(two)[0]["suggestedFix"], "different fix")
                self.assertEqual(
                    store.find_similar_failures(one, "missing widget", current_run_id="9"), []
                )
        finally:
            with self.engine.begin() as connection:
                connection.execute(
                    text("DELETE FROM vector_documents WHERE metadata->>'repo_id' IN (:one,:two)"),
                    {"one": one, "two": two},
                )


if __name__ == "__main__":
    unittest.main()

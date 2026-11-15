from contextlib import asynccontextmanager
import asyncio
import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.config import settings
from app.db.database import init_db, engine
from app.services.github import close_client
from app.routers import ai, auth, discussions, knowledge, repositories, webhooks, workflows


@asynccontextmanager
async def lifespan(app):
    try:
        await asyncio.to_thread(init_db)
        yield
    finally:
        await asyncio.to_thread(close_client)
        await asyncio.to_thread(engine.dispose)


app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def api_error(request: Request, exc: HTTPException):
    response = await http_exception_handler(request, exc)
    if exc.status_code == 401:
        response.delete_cookie(auth.SESSION_COOKIE)
    return response


@app.exception_handler(httpx.HTTPError)
async def upstream_error(request: Request, exc: httpx.HTTPError):
    code = 504 if isinstance(exc, httpx.TimeoutException) else 502
    headers = {}
    if isinstance(exc, httpx.HTTPStatusError):
        upstream = exc.response.status_code
        code = upstream if upstream in {401, 403, 404, 409, 422, 429} else 502
        if exc.response.headers.get("x-ratelimit-remaining") == "0":
            code = 429
        if "retry-after" in exc.response.headers:
            headers["Retry-After"] = exc.response.headers["retry-after"]
    response = JSONResponse(
        {
            "detail": "GitHub authorization has expired"
            if code == 401
            else "Upstream request failed. Please try again."
        },
        status_code=code,
        headers=headers,
    )
    if code == 401:
        response.delete_cookie(auth.SESSION_COOKIE)
    return response


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(repositories.router, prefix=settings.API_V1_STR)
app.include_router(discussions.router, prefix=settings.API_V1_STR)
app.include_router(workflows.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)
app.include_router(knowledge.router, prefix=settings.API_V1_STR)
app.include_router(webhooks.router, prefix=settings.API_V1_STR)

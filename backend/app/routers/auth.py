import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import User

router = APIRouter(prefix="/auth", tags=["auth"])
SESSION_COOKIE = "flowforge_session"
OAUTH_STATE_COOKIE = "flowforge_oauth_state"


def _session_token(user_id: int) -> str:
    return jwt.encode({"sub": str(user_id)}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _oauth_configured() -> bool:
    return bool(
        settings.GITHUB_CLIENT_ID
        and settings.GITHUB_CLIENT_SECRET
        and not settings.GITHUB_CLIENT_ID.startswith("replace_with_")
        and not settings.GITHUB_CLIENT_SECRET.startswith("replace_with_")
        and not settings.GITHUB_CLIENT_SECRET.startswith(("ghp_", "gho_", "github_pat_"))
    )


def _oauth_redirect(error: str) -> RedirectResponse:
    redirect = RedirectResponse(
        f"{settings.FRONTEND_URL}/?oauth_error={error}",
        status_code=status.HTTP_303_SEE_OTHER,
    )
    redirect.delete_cookie(OAUTH_STATE_COOKIE)
    return redirect


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session") from exc

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.get("/github/login")
def github_login() -> RedirectResponse:
    if not _oauth_configured():
        return _oauth_redirect("unavailable")

    state = secrets.token_urlsafe(32)
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
        "scope": "read:user user:email repo",
        "state": state,
    }
    redirect = RedirectResponse(
        f"https://github.com/login/oauth/authorize?{urlencode(params)}",
        status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    )
    redirect.set_cookie(
        OAUTH_STATE_COOKIE,
        state,
        httponly=True,
        secure=settings.FRONTEND_URL.startswith("https://"),
        samesite="lax",
        max_age=600,
    )
    return redirect


@router.get("/github/callback")
async def github_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    expected_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if not expected_state or not state or not secrets.compare_digest(expected_state, state):
        return _oauth_redirect("invalid_state")
    if error == "access_denied":
        return _oauth_redirect("access_denied")
    if error:
        return _oauth_redirect("failed")
    if not code:
        return _oauth_redirect("failed")
    if not _oauth_configured():
        return _oauth_redirect("unavailable")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_response = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": settings.GITHUB_REDIRECT_URI,
                },
                headers={"Accept": "application/json"},
            )
            token_response.raise_for_status()
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            if not access_token:
                return _oauth_redirect("failed")

            github_headers = {
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {access_token}",
                "X-GitHub-Api-Version": "2022-11-28",
            }
            user_response = await client.get("https://api.github.com/user", headers=github_headers)
            user_response.raise_for_status()
            account = user_response.json()
    except (httpx.HTTPError, ValueError):
        return _oauth_redirect("github_unavailable")

    github_id = account.get("id")
    username = account.get("login")
    if not github_id or not username:
        return _oauth_redirect("failed")

    user = db.query(User).filter(User.github_id == str(github_id)).one_or_none()
    if not user:
        user = User(github_id=str(github_id), username=username)
        db.add(user)

    user.username = username
    user.name = account.get("name") or username
    user.avatar_url = account.get("avatar_url")
    user.github_url = account.get("html_url")
    user.access_token = access_token
    db.commit()
    db.refresh(user)

    redirect = RedirectResponse(
        f"{settings.FRONTEND_URL}/dashboard?auth=connected",
        status_code=status.HTTP_303_SEE_OTHER,
    )
    redirect.set_cookie(
        SESSION_COOKIE,
        _session_token(user.id),
        httponly=True,
        secure=settings.FRONTEND_URL.startswith("https://"),
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    redirect.delete_cookie(OAUTH_STATE_COOKIE)
    return redirect


@router.get("/me")
async def current_user(
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not user.access_token:
        response.delete_cookie(SESSION_COOKIE)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="GitHub authorization has expired")

    try:
        async with httpx.AsyncClient(timeout=4) as client:
            gh_res = await client.get(
                "https://api.github.com/user",
                headers={
                    "Accept": "application/vnd.github+json",
                    "Authorization": f"Bearer {user.access_token}",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
            if gh_res.status_code == 401:
                user.access_token = None
                db.commit()
                response.delete_cookie(SESSION_COOKIE)
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="GitHub authorization has expired")
    except httpx.HTTPError:
        pass

    return {
        "id": str(user.github_id),
        "username": user.username,
        "name": user.name or user.username,
        "avatarUrl": user.avatar_url or "",
        "email": user.email or "",
        "githubUrl": user.github_url or "",
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> Response:
    response.delete_cookie(SESSION_COOKIE)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response

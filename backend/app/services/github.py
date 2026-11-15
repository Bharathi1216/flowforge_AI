"""A shared, thread-safe GitHub HTTP connection pool."""

from contextlib import contextmanager
from threading import Lock
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

_client = None
_guard = Lock()


@contextmanager
def github_client(**options):
    global _client
    with _guard:
        if _client is None or _client.is_closed:
            _client = httpx.Client(
                timeout=30,
                follow_redirects=True,
                limits=httpx.Limits(max_connections=30, max_keepalive_connections=20),
            )

    class RequestClient:
        def __getattr__(self, name):
            method = getattr(_client, name)
            if name in {"get", "post", "patch", "put", "delete", "request", "stream"}:

                def call(*args, **kwargs):
                    kwargs.setdefault("timeout", options.get("timeout", 30))
                    return method(*args, **kwargs)

                return call
            return method

    yield RequestClient()


def close_client():
    global _client
    with _guard:
        if _client is not None:
            _client.close()
            _client = None


def pages(client, url, *, headers, params=None, key=None, limit=None):
    items = []
    params = {"per_page": 100, **(params or {})}
    while url:
        if urlparse(url).netloc != "api.github.com":
            raise HTTPException(502, "GitHub returned an invalid pagination URL")
        response = client.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        batch = data.get(key, []) if key else data
        if not isinstance(batch, list):
            raise HTTPException(502, "GitHub returned an invalid collection")
        items.extend(batch)
        if limit is not None and len(items) >= limit:
            return items[:limit]
        url = response.links.get("next", {}).get("url")
        params = None
    return items

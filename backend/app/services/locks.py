from contextlib import contextmanager
from threading import Lock

_guard = Lock()
_locks = {}


@contextmanager
def keyed_lock(key):
    """Serialize only matching resources; release unused lock entries."""
    with _guard:
        lock, count = _locks.get(key, (Lock(), 0))
        _locks[key] = (lock, count + 1)
    try:
        with lock:
            yield
    finally:
        with _guard:
            _, count = _locks[key]
            if count == 1:
                del _locks[key]
            else:
                _locks[key] = (lock, count - 1)

"""Reuse model weights and predictors; serialize access to each shared predictor."""
from functools import lru_cache
from pathlib import Path
from threading import RLock

_cache_lock = RLock()


@lru_cache(maxsize=4)
def _load(path, task, modified_ns, size):
    from ultralytics import YOLO
    return YOLO(path, **({'task': task} if task else {})), RLock()


def get_model(path, task=None):
    resolved = Path(path).resolve()
    stat = resolved.stat()
    # A replaced weights file must not silently reuse the previous model.
    with _cache_lock:
        return _load(str(resolved), task, stat.st_mtime_ns, stat.st_size)

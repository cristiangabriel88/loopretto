"""Flask extensions instantiated once and initialised in the app factory."""
from __future__ import annotations

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from .config import Config

# In-process memory storage: resets on restart and isn't shared across workers.
# Fine for a single-user local app; would need Redis for a multi-worker deploy.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=Config.RATE_LIMITS,
    storage_uri="memory://",
)

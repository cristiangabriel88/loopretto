"""Loopretto application factory.

A local, single-user Flask app that extracts audio from a YouTube link and
serves a single-page UI for looping it. Not built for public/production use;
see CLAUDE.md.
"""
from __future__ import annotations

import os

from flask import Flask

from .config import Config
from .extensions import limiter
from .routes.audio import audio as audio_bp
from .routes.pages import pages as pages_bp

# Templates and static assets live at the repo root, not inside the package.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def create_app(config: type[Config] = Config) -> Flask:
    app = Flask(
        __name__,
        static_folder=os.path.join(_ROOT, "static"),
        template_folder=os.path.join(_ROOT, "templates"),
    )
    app.config.from_object(config)

    # Long-lived caching for static assets. Overridable via
    # STATIC_CACHE_SECONDS for active local development.
    app.config["SEND_FILE_MAX_AGE_DEFAULT"] = config.STATIC_CACHE_SECONDS

    limiter.init_app(app)

    app.register_blueprint(pages_bp)
    app.register_blueprint(audio_bp)

    return app

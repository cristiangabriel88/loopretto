"""Static page routes: /, /howto, /about."""
from __future__ import annotations

from flask import Blueprint, render_template

pages = Blueprint("pages", __name__)


@pages.route("/")
def index() -> str:
    return render_template("index.html")


@pages.route("/howto")
def howto() -> str:
    return render_template("howto.html")


@pages.route("/about")
def about() -> str:
    return render_template("about.html")

from .base import *  # noqa

DEBUG = True
ALLOWED_HOSTS = ["*"]

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://([a-z0-9-]+\.)?lvh\.me(:\d+)?$",
    r"^http://localhost(:\d+)?$",
    r"^http://127\.0\.0\.1(:\d+)?$",
]
CORS_ALLOW_CREDENTIALS = True

import os

from .base import *  # noqa

DEBUG = False
ALLOWED_HOSTS = [os.environ.get("ALLOWED_HOST_WILDCARD", ".yourapp.com")]

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

CORS_ALLOWED_ORIGIN_REGEXES = [r"^https://([a-z0-9-]+\.)?yourapp\.com$"]

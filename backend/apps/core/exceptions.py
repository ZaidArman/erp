"""Standardized API error envelope.

Every error response (validation, permission, auth, not-found, conflict,
unhandled server error) comes back in one consistent shape:

    {
        "success": false,
        "error_code": "VALIDATION_ERROR",
        "message": "Validation failed.",
        "errors": {"quantity": ["Quantity must be greater than zero."]}
    }

This wraps DRF's default exception handler rather than replacing it, so
every existing `raise serializers.ValidationError(...)` / `PermissionDenied`
/ `NotFound` call across the app keeps working unchanged — only the
outer envelope is new.
"""
import logging

from rest_framework import status
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger("apps.core.exceptions")

ERROR_CODES = {
    status.HTTP_400_BAD_REQUEST: "VALIDATION_ERROR",
    status.HTTP_401_UNAUTHORIZED: "AUTHENTICATION_ERROR",
    status.HTTP_403_FORBIDDEN: "PERMISSION_DENIED",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
    status.HTTP_409_CONFLICT: "CONFLICT",
    status.HTTP_429_TOO_MANY_REQUESTS: "RATE_LIMITED",
}

DEFAULT_MESSAGES = {
    "VALIDATION_ERROR": "Validation failed.",
    "AUTHENTICATION_ERROR": "Authentication failed.",
    "PERMISSION_DENIED": "You do not have permission to perform this action.",
    "NOT_FOUND": "The requested resource was not found.",
    "METHOD_NOT_ALLOWED": "This method is not allowed here.",
    "CONFLICT": "This action conflicts with the current state.",
    "RATE_LIMITED": "Too many requests — please slow down.",
    "SERVER_ERROR": "Something went wrong on our end.",
}


def _normalize_errors(detail):
    """DRF's default handler gives us either a plain ErrorDetail/str, a
    list of them (non-field errors), or a dict keyed by field name whose
    values are themselves str/list/dict. Flatten all of that into
    {field_or_"non_field": [str, ...]} — a single predictable shape for
    the frontend, regardless of which of those forms the underlying
    exception used."""
    if isinstance(detail, dict):
        errors = {}
        for key, value in detail.items():
            if isinstance(value, (list, tuple)):
                errors[key] = [str(v) for v in value]
            elif isinstance(value, dict):
                # nested (e.g. a nested serializer) — flatten with dotted keys
                nested = _normalize_errors(value)
                for nk, nv in nested.items():
                    errors[f"{key}.{nk}"] = nv
            else:
                errors[key] = [str(value)]
        return errors
    if isinstance(detail, (list, tuple)):
        return {"non_field_errors": [str(v) for v in detail]}
    return {"non_field_errors": [str(detail)]}


def _first_message(errors):
    for values in errors.values():
        if values:
            return values[0]
    return None


def standard_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        # Unhandled exception (bug, DB error, etc.) — DRF returns None here,
        # which would otherwise surface as Django's raw 500 debug page (or,
        # in production, an unformatted 500). Never leak internals to the
        # client; log the real exception server-side instead.
        logger.exception("Unhandled exception in %s", context.get("view"), exc_info=exc)
        return None

    if response.status_code >= 500:
        error_code = "SERVER_ERROR"
    else:
        error_code = ERROR_CODES.get(response.status_code, "ERROR")

    detail = response.data
    # Some hand-raised errors use {"detail": "..."} (a bare string, not a
    # list) — DRF's own convention for non-field errors. Treat that the
    # same as any other detail shape when normalizing.
    if isinstance(detail, dict) and set(detail.keys()) == {"detail"}:
        detail = detail["detail"]

    errors = _normalize_errors(detail)
    message = _first_message(errors) or DEFAULT_MESSAGES.get(error_code, "Request failed.")

    response.data = {
        "success": False,
        "error_code": error_code,
        "message": message,
        "errors": errors,
    }
    return response

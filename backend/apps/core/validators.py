"""Shared field-format validators, reused across serializers instead of
duplicating regexes per app."""
import re

from rest_framework import serializers

PHONE_RE = re.compile(r"^[0-9+\-\s()]{6,20}$")


def validate_phone_number(value):
    """Loose phone format check: digits, spaces, +, -, () — 6 to 20 chars.
    Blank is allowed by callers (these fields are optional); this only runs
    when a non-empty value is supplied."""
    if value and not PHONE_RE.match(value):
        raise serializers.ValidationError(
            "Enter a valid phone number (digits, spaces, +, - only)."
        )
    return value

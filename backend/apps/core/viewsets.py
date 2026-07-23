"""TenantAwareViewSet: the single place tenant filtering happens.

No view in this project ever filters by tenant manually — inherit this
and isolation is guaranteed (PRD section 2.3, leak prevention).
"""
from django.db import IntegrityError, transaction
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError

from .audit import log_action


class TenantAwareViewSet(viewsets.ModelViewSet):
    audit = True  # set False on viewsets that should not write audit rows

    def get_tenant(self):
        tenant = getattr(self.request, "tenant", None)
        if tenant is None:
            raise PermissionDenied("No shop context. Use your shop subdomain.")
        return tenant

    def get_queryset(self):
        return super().get_queryset().filter(tenant=self.get_tenant())

    def perform_create(self, serializer):
        # tenant is injected here (not in the serializer), so unique_together
        # constraints involving it can't be caught by DRF's validators up
        # front — turn the resulting DB IntegrityError into a clean 400.
        # Wrapped in its own savepoint: without one, Postgres marks the whole
        # outer transaction broken after the IntegrityError, so any query run
        # later in the same request/test would fail with
        # TransactionManagementError even though we "handled" the error here.
        try:
            with transaction.atomic():
                instance = serializer.save(tenant=self.get_tenant())
        except IntegrityError:
            raise ValidationError({"name": "An item with this name already exists in your shop."})
        if self.audit:
            log_action(self.request, "create", instance, {"after": _snapshot(instance)})

    def perform_update(self, serializer):
        before = _snapshot(serializer.instance)
        try:
            with transaction.atomic():
                instance = serializer.save(tenant=self.get_tenant())
        except IntegrityError:
            raise ValidationError({"name": "An item with this name already exists in your shop."})
        if self.audit:
            log_action(
                self.request,
                "update",
                instance,
                {"before": before, "after": _snapshot(instance)},
            )

    def perform_destroy(self, instance):
        if self.audit:
            log_action(self.request, "delete", instance, {"before": _snapshot(instance)})
        if hasattr(instance, "soft_delete"):
            if hasattr(instance, "deleted_by_id"):
                user = getattr(self.request, "user", None)
                instance.deleted_by = user if user and user.is_authenticated else None
            instance.soft_delete()
        else:
            instance.delete()


def _snapshot(instance):
    """JSON-safe dict of the instance's concrete fields."""
    data = {}
    for field in instance._meta.concrete_fields:
        value = getattr(instance, field.attname)
        data[field.attname] = value if isinstance(value, (int, float, bool, type(None))) else str(value)
    return data

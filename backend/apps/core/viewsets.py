"""TenantAwareViewSet: the single place tenant filtering happens.

No view in this project ever filters by tenant manually — inherit this
and isolation is guaranteed (PRD section 2.3, leak prevention).
"""
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

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
        instance = serializer.save(tenant=self.get_tenant())
        if self.audit:
            log_action(self.request, "create", instance, {"after": _snapshot(instance)})

    def perform_update(self, serializer):
        before = _snapshot(serializer.instance)
        instance = serializer.save(tenant=self.get_tenant())
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
        instance.delete()


def _snapshot(instance):
    """JSON-safe dict of the instance's concrete fields."""
    data = {}
    for field in instance._meta.concrete_fields:
        value = getattr(instance, field.attname)
        data[field.attname] = value if isinstance(value, (int, float, bool, type(None))) else str(value)
    return data

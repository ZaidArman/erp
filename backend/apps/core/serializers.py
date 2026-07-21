from rest_framework import serializers


class TenantPKRelatedField(serializers.PrimaryKeyRelatedField):
    """A PK field that only accepts objects belonging to the request tenant.

    Prevents cross-tenant foreign keys (e.g. attaching a SKU to another
    shop's product).
    """

    def get_queryset(self):
        queryset = super().get_queryset()
        request = self.context.get("request")
        tenant = getattr(request, "tenant", None) if request else None
        if tenant is None:
            return queryset.none()
        return queryset.filter(tenant=tenant)

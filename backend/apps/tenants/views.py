from rest_framework import serializers

from apps.accounts.permissions import IsAdmin, IsAdminOrReadOnlyEmployee
from apps.core.viewsets import TenantAwareViewSet

from .models import Branch
from .serializers import BranchSerializer


class BranchViewSet(TenantAwareViewSet):
    """Branches for the current tenant. Admin-only writes; creation is
    gated by Tenant.max_branches (PRD: plan limit enforced automatically).
    Inherits tenant filtering, audit logging, and soft-delete from
    TenantAwareViewSet."""

    queryset = Branch.objects.all().order_by("id")
    serializer_class = BranchSerializer

    def get_permissions(self):
        # Any shop member may read branches (needed for stock intake forms);
        # create/update/delete stay admin-only per the permission matrix.
        if self.action in ("list", "retrieve"):
            return [IsAdminOrReadOnlyEmployee()]
        return [IsAdmin()]

    def perform_create(self, serializer):
        tenant = self.get_tenant()
        current = Branch.objects.filter(tenant=tenant).count()
        if current >= tenant.max_branches:
            raise serializers.ValidationError(
                {
                    "detail": (
                        f"Branch limit reached ({tenant.max_branches}). "
                        "Contact support to upgrade your plan."
                    )
                }
            )
        super().perform_create(serializer)

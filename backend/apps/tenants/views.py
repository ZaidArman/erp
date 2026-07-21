from rest_framework import serializers, viewsets
from rest_framework.exceptions import PermissionDenied

from apps.accounts.permissions import IsAdmin, IsAdminOrReadOnlyEmployee
from apps.core.audit import log_action

from .models import Branch
from .serializers import BranchSerializer


class BranchViewSet(viewsets.ModelViewSet):
    """Branches for the current tenant. Admin-only writes; creation is
    gated by Tenant.max_branches (PRD: plan limit enforced automatically)."""

    serializer_class = BranchSerializer

    def get_permissions(self):
        # Any shop member may read branches (needed for stock intake forms);
        # create/update/delete stay admin-only per the permission matrix.
        if self.action in ("list", "retrieve"):
            return [IsAdminOrReadOnlyEmployee()]
        return [IsAdmin()]

    def get_tenant(self):
        tenant = getattr(self.request, "tenant", None)
        if tenant is None:
            raise PermissionDenied("No shop context.")
        return tenant

    def get_queryset(self):
        return Branch.objects.filter(tenant=self.get_tenant()).order_by("id")

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
        instance = serializer.save(tenant=tenant)
        log_action(self.request, "create", instance)

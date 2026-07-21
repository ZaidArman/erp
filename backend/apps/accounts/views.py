from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.core.audit import log_action

from .models import EmployeePermission, User
from .permissions import HasEmployeePermission, IsAdmin
from .serializers import (
    EmployeeCreateSerializer,
    EmployeePermissionSerializer,
    TenantTokenObtainPairSerializer,
    UserSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = TenantTokenObtainPairSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)


class EmployeeViewSet(viewsets.ModelViewSet):
    """Admin manages employees. Employees with can_create_users may create
    (matrix row: Create employee user — Employee: If permitted)."""

    def get_permissions(self):
        if self.action == "create":
            return [HasEmployeePermission("can_create_users")()]
        if self.action in ("list", "retrieve"):
            return [HasEmployeePermission("can_create_users")()]
        return [IsAdmin()]  # set_permissions / update / deactivate: admin only

    def get_tenant(self):
        tenant = getattr(self.request, "tenant", None)
        if tenant is None:
            raise PermissionDenied("No shop context.")
        return tenant

    def get_queryset(self):
        return (
            User.objects.filter(tenant=self.get_tenant(), role=User.ROLE_EMPLOYEE)
            .select_related("branch", "employee_permission")
            .order_by("id")
        )

    def get_serializer_class(self):
        return EmployeeCreateSerializer if self.action == "create" else UserSerializer

    def perform_create(self, serializer):
        tenant = self.get_tenant()
        current = User.objects.filter(tenant=tenant, role=User.ROLE_EMPLOYEE).count()
        if current >= tenant.max_employees:
            raise serializers.ValidationError(
                {
                    "detail": (
                        f"Employee limit reached ({tenant.max_employees}). "
                        "Contact support to upgrade your plan."
                    )
                }
            )
        instance = serializer.save()
        log_action(self.request, "create", instance)

    @action(detail=True, methods=["patch"], url_path="permissions")
    def set_permissions(self, request, pk=None):
        employee = self.get_object()
        perm, _ = EmployeePermission.objects.get_or_create(user=employee)
        serializer = EmployeePermissionSerializer(perm, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_action(request, "update", employee, {"permissions": serializer.data})
        return Response(UserSerializer(employee).data)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        employee = self.get_object()
        employee.is_active = False
        employee.save(update_fields=["is_active"])
        log_action(request, "update", employee, {"is_active": False})
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        employee = self.get_object()
        employee.is_active = True
        employee.save(update_fields=["is_active"])
        log_action(request, "update", employee, {"is_active": True})
        return Response(status=status.HTTP_204_NO_CONTENT)

"""DRF permission classes mapping the permission matrix (PRD section 4)."""
from rest_framework.permissions import BasePermission

from .models import User


class IsSuperadmin(BasePermission):
    message = "Superadmin access required."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == User.ROLE_SUPERADMIN)


class IsAdmin(BasePermission):
    message = "Shop admin access required."

    def has_permission(self, request, view):
        u = request.user
        tenant = getattr(request, "tenant", None)
        return bool(
            u
            and u.is_authenticated
            and u.role == User.ROLE_ADMIN
            and tenant is not None
            and u.tenant_id == tenant.id
        )


def HasEmployeePermission(flag):
    """Admin always allowed; employee allowed only when the flag is granted."""

    class _HasEmployeePermission(BasePermission):
        message = f"Missing permission: {flag}."

        def has_permission(self, request, view):
            u = request.user
            tenant = getattr(request, "tenant", None)
            if not (u and u.is_authenticated and tenant is not None):
                return False
            if u.tenant_id != tenant.id:
                return False
            if u.role == User.ROLE_ADMIN:
                return True
            if u.role == User.ROLE_EMPLOYEE:
                ep = getattr(u, "employee_permission", None)
                return bool(ep and getattr(ep, flag, False))
            return False

    _HasEmployeePermission.__name__ = f"HasEmployeePermission_{flag}"
    return _HasEmployeePermission


class IsAdminOrReadOnlyEmployee(BasePermission):
    """Reads for any shop member; writes for admin only (e.g. stock levels
    are viewable by employees, editing is admin-scoped)."""

    def has_permission(self, request, view):
        u = request.user
        tenant = getattr(request, "tenant", None)
        if not (u and u.is_authenticated and tenant is not None and u.tenant_id == tenant.id):
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return u.role in (User.ROLE_ADMIN, User.ROLE_EMPLOYEE)
        return u.role == User.ROLE_ADMIN

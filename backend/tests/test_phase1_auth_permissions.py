"""Phase 1 test gate: login-tenant match, permission classes, plan limits
(PRD section 9.4)."""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import EmployeePermission, User
from apps.tenants.models import Branch
from tests.conftest import ALPHA_HOST, BETA_HOST, client_for

pytestmark = pytest.mark.django_db


class TestLoginTenantMatch:
    def test_admin_logs_in_on_own_subdomain(self, tenant_a, admin_a):
        res = APIClient(HTTP_HOST=ALPHA_HOST).post(
            "/api/auth/login/", {"email": "admin@alpha.com", "password": "Admin@12345"}
        )
        assert res.status_code == 200
        body = res.json()
        assert "access" in body and body["user"]["role"] == "admin"

    def test_admin_cannot_log_in_on_other_shop(self, tenant_a, tenant_b, admin_a):
        res = APIClient(HTTP_HOST=BETA_HOST).post(
            "/api/auth/login/", {"email": "admin@alpha.com", "password": "Admin@12345"}
        )
        assert res.status_code == 401

    def test_wrong_password_rejected(self, tenant_a, admin_a):
        res = APIClient(HTTP_HOST=ALPHA_HOST).post(
            "/api/auth/login/", {"email": "admin@alpha.com", "password": "nope"}
        )
        assert res.status_code == 401

    def test_deactivated_user_cannot_login(self, tenant_a, admin_a):
        admin_a.is_active = False
        admin_a.save()
        res = APIClient(HTTP_HOST=ALPHA_HOST).post(
            "/api/auth/login/", {"email": "admin@alpha.com", "password": "Admin@12345"}
        )
        assert res.status_code == 401


class TestEmployeePermissionModel:
    def test_employee_gets_permission_row_with_all_flags_false(self, tenant_a, branch_a):
        user = User.objects.create_user(
            "e@alpha.com", "Pass@12345", role=User.ROLE_EMPLOYEE, tenant=tenant_a, branch=branch_a
        )
        perm = EmployeePermission.objects.get(user=user)
        assert all(getattr(perm, flag) is False for flag in EmployeePermission.FLAGS)

    def test_admin_does_not_get_permission_row(self, admin_a):
        assert not EmployeePermission.objects.filter(user=admin_a).exists()


class TestPermissionGating:
    def test_employee_without_flag_gets_403_on_inventory_write(self, client_employee_a):
        res = client_employee_a.post("/api/inventory/categories/", {"name": "Mobiles"})
        assert res.status_code == 403

    def test_employee_with_flag_can_write_inventory(self, employee_a, client_employee_a):
        perm = employee_a.employee_permission
        perm.can_manage_inventory = True
        perm.save()
        res = client_employee_a.post("/api/inventory/categories/", {"name": "Mobiles"})
        assert res.status_code == 201

    def test_admin_always_allowed_on_inventory(self, client_admin_a):
        res = client_admin_a.post("/api/inventory/categories/", {"name": "Mobiles"})
        assert res.status_code == 201

    def test_employee_can_view_stock_without_flag(self, client_employee_a):
        res = client_employee_a.get("/api/inventory/stock-units/")
        assert res.status_code == 200

    def test_unauthenticated_gets_401(self, tenant_a):
        res = APIClient(HTTP_HOST=ALPHA_HOST).get("/api/inventory/categories/")
        assert res.status_code == 401


class TestPlanLimits:
    def test_employee_limit_enforced(self, tenant_a, branch_a, client_admin_a):
        for i in range(tenant_a.max_employees):
            res = client_admin_a.post(
                "/api/auth/employees/",
                {"email": f"e{i}@alpha.com", "password": "Pass@12345", "branch": branch_a.id},
            )
            assert res.status_code == 201
        res = client_admin_a.post(
            "/api/auth/employees/",
            {"email": "extra@alpha.com", "password": "Pass@12345", "branch": branch_a.id},
        )
        assert res.status_code == 400
        assert "limit" in str(res.json()).lower()

    def test_branch_limit_enforced(self, tenant_a, client_admin_a):
        assert tenant_a.max_branches == 2
        assert client_admin_a.post("/api/tenants/branches/", {"name": "B1"}).status_code == 201
        assert client_admin_a.post("/api/tenants/branches/", {"name": "B2"}).status_code == 201
        res = client_admin_a.post("/api/tenants/branches/", {"name": "B3"})
        assert res.status_code == 400
        assert Branch.objects.filter(tenant=tenant_a).count() == 2

    def test_employee_cannot_create_branch(self, client_employee_a):
        res = client_employee_a.post("/api/tenants/branches/", {"name": "Rogue"})
        assert res.status_code == 403


class TestAdminManagesEmployees:
    def test_set_permission_flags(self, tenant_a, branch_a, employee_a, client_admin_a):
        res = client_admin_a.patch(
            f"/api/auth/employees/{employee_a.id}/permissions/",
            {"can_use_pos": True, "can_view_finance": True},
            format="json",
        )
        assert res.status_code == 200
        employee_a.employee_permission.refresh_from_db()
        assert employee_a.employee_permission.can_use_pos is True
        assert employee_a.employee_permission.can_manage_inventory is False

    def test_employee_cannot_set_permissions(self, employee_a, client_employee_a):
        res = client_employee_a.patch(
            f"/api/auth/employees/{employee_a.id}/permissions/", {"can_view_finance": True},
            format="json",
        )
        assert res.status_code == 403

    def test_deactivate_employee(self, employee_a, client_admin_a):
        res = client_admin_a.post(f"/api/auth/employees/{employee_a.id}/deactivate/")
        assert res.status_code == 204
        employee_a.refresh_from_db()
        assert employee_a.is_active is False

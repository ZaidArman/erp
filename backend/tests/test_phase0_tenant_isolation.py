"""Phase 0 test gate: middleware resolution + cross-tenant isolation.
These are the most important tests in the project (PRD section 9.3)."""
import pytest
from rest_framework.test import APIClient

from apps.inventory.models import Category
from tests.conftest import ALPHA_HOST, BETA_HOST, client_for

pytestmark = pytest.mark.django_db


class TestTenantMiddleware:
    def test_resolves_subdomain_to_tenant(self, tenant_a, admin_a):
        client = client_for(admin_a, ALPHA_HOST)
        res = client.get("/api/health/")
        assert res.status_code == 200
        assert res.json()["tenant"] == "alpha"

    def test_unknown_subdomain_returns_404(self, db):
        res = APIClient(HTTP_HOST="ghost.testserver").get("/api/health/")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_inactive_tenant_returns_404(self, tenant_a):
        tenant_a.is_active = False
        tenant_a.save()
        res = APIClient(HTTP_HOST=ALPHA_HOST).get("/api/health/")
        assert res.status_code == 404

    def test_bare_domain_has_no_tenant(self, db):
        res = APIClient(HTTP_HOST="testserver").get("/api/health/")
        assert res.status_code == 200
        assert res.json()["tenant"] is None


class TestTenantAwareViewSetIsolation:
    def test_list_returns_only_own_tenant_rows(self, tenant_a, tenant_b, client_admin_a):
        Category.objects.create(tenant=tenant_a, name="Mobiles")
        Category.objects.create(tenant=tenant_b, name="Laptops")
        res = client_admin_a.get("/api/inventory/categories/")
        names = [row["name"] for row in res.json()["results"]]
        assert names == ["Mobiles"]  # the core isolation guarantee

    def test_create_forces_request_tenant_even_if_payload_lies(
        self, tenant_a, tenant_b, client_admin_a
    ):
        res = client_admin_a.post(
            "/api/inventory/categories/", {"name": "ACs", "tenant": tenant_b.id}
        )
        assert res.status_code == 201
        category = Category.objects.get(name="ACs")
        assert category.tenant_id == tenant_a.id

    def test_cross_tenant_retrieve_is_404(self, tenant_a, tenant_b, client_admin_a):
        other = Category.objects.create(tenant=tenant_b, name="Fridges")
        res = client_admin_a.get(f"/api/inventory/categories/{other.id}/")
        assert res.status_code == 404

    def test_cross_tenant_delete_is_404(self, tenant_a, tenant_b, client_admin_a):
        other = Category.objects.create(tenant=tenant_b, name="Fridges")
        res = client_admin_a.delete(f"/api/inventory/categories/{other.id}/")
        assert res.status_code == 404
        assert Category.objects.filter(id=other.id).exists()

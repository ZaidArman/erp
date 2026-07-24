"""Phase 3 tests: checkout atomicity, price snapshots, receipt numbering,
double-sell prevention, sales-history matrix rows (PRD section 9.6).

The threaded concurrency test requires real row locking, so it is marked
`postgres` and skipped on the SQLite unit-test database. Run it with:
    docker compose run --rm backend python -m pytest -m postgres
"""
import threading

import pytest
from django.conf import settings
from django.db import connections

from apps.core.models import AuditLog
from apps.inventory.models import SKU, Brand, Category, Product, StockUnit
from apps.pos.models import Receipt, Sale, SaleItem
from apps.tenants.models import Branch, Tenant
from apps.accounts.models import User
from tests.conftest import ALPHA_HOST, BETA_HOST, client_for

pytestmark = pytest.mark.django_db

IS_SQLITE = "sqlite" in settings.DATABASES["default"]["ENGINE"]


def build_catalog(tenant, branch, price=1000, cost=700, imeis=("IMEI-A", "IMEI-B")):
    category = Category.objects.create(tenant=tenant, name="Mobiles")
    brand = Brand.objects.create(tenant=tenant, name="Apple", category=category)
    product = Product.objects.create(
        tenant=tenant, category=category, brand=brand, name="iPhone 15 Pro"
    )
    sku = SKU.objects.create(
        tenant=tenant, product=product, variant_name="256GB", sell_price=price
    )
    units = [
        StockUnit.objects.create(
            tenant=tenant, sku=sku, branch=branch, purchase_cost=cost, imei_serial=imei
        )
        for imei in imeis
    ]
    return sku, units


class TestCheckoutHappyPath:
    def test_checkout_creates_sale_items_receipt_and_marks_sold(
        self, tenant_a, branch_a, client_admin_a
    ):
        sku, units = build_catalog(tenant_a, branch_a)
        res = client_admin_a.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [u.id for u in units], "branch": branch_a.id,
             "customer_name": "Walk-in"},
            format="json",
        )
        assert res.status_code == 201
        body = res.json()
        assert body["total_amount"] == "2000.00"  # 2 units x 1000, server-side
        assert body["receipt"]["receipt_number"] == "0001"
        assert len(body["items"]) == 2
        for unit in units:
            unit.refresh_from_db()
            assert unit.is_sold is True
        assert Sale.objects.count() == 1
        assert SaleItem.objects.count() == 2

    def test_client_sent_total_is_ignored(self, tenant_a, branch_a, client_admin_a):
        sku, units = build_catalog(tenant_a, branch_a, price=500, imeis=("X",))
        res = client_admin_a.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [units[0].id], "branch": branch_a.id,
             "total_amount": "1.00"},  # tampered — must be ignored
            format="json",
        )
        assert res.status_code == 201
        assert res.json()["total_amount"] == "500.00"

    def test_checkout_writes_audit_log(self, tenant_a, branch_a, client_admin_a):
        sku, units = build_catalog(tenant_a, branch_a, imeis=("X",))
        client_admin_a.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [units[0].id], "branch": branch_a.id},
            format="json",
        )
        log = AuditLog.objects.get(tenant=tenant_a, model_name="Sale")
        assert log.action == "create"
        assert log.changes["after"]["imeis"] == ["X"]


class TestCheckoutFailures:
    def test_already_sold_unit_rejected_and_rolled_back(
        self, tenant_a, branch_a, client_admin_a
    ):
        sku, units = build_catalog(tenant_a, branch_a)
        units[1].is_sold = True
        units[1].save()
        res = client_admin_a.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [u.id for u in units], "branch": branch_a.id},
            format="json",
        )
        assert res.status_code == 409
        units[0].refresh_from_db()
        assert units[0].is_sold is False  # entire transaction rolled back
        assert Sale.objects.count() == 0

    def test_unit_from_other_tenant_is_400(self, tenant_a, branch_a, tenant_b, branch_b,
                                           client_admin_a):
        _, other_units = build_catalog(tenant_b, branch_b, imeis=("THEIRS",))
        res = client_admin_a.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [other_units[0].id], "branch": branch_a.id},
            format="json",
        )
        assert res.status_code == 400
        assert "not found" in res.json()["message"].lower()

    def test_unit_from_other_branch_is_400(self, tenant_a, branch_a, client_admin_a):
        branch2 = Branch.objects.create(tenant=tenant_a, name="Second")
        sku, units = build_catalog(tenant_a, branch2, imeis=("B2-UNIT",))
        res = client_admin_a.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [units[0].id], "branch": branch_a.id},
            format="json",
        )
        assert res.status_code == 400
        assert "branch" in res.json()["message"].lower()

    def test_employee_without_can_use_pos_gets_403(
        self, tenant_a, branch_a, client_employee_a
    ):
        sku, units = build_catalog(tenant_a, branch_a, imeis=("X",))
        res = client_employee_a.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [units[0].id], "branch": branch_a.id},
            format="json",
        )
        assert res.status_code == 403
        assert Sale.objects.count() == 0

    def test_employee_with_flag_can_sell_own_branch_only(
        self, tenant_a, branch_a, employee_a, client_employee_a
    ):
        perm = employee_a.employee_permission
        perm.can_use_pos = True
        perm.save()
        branch2 = Branch.objects.create(tenant=tenant_a, name="Second")
        sku, units = build_catalog(tenant_a, branch2, imeis=("B2",))
        res = client_employee_a.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [units[0].id], "branch": branch2.id},
            format="json",
        )
        assert res.status_code == 403  # not their branch


class TestPriceSnapshot:
    def test_sku_price_change_does_not_alter_past_sale(
        self, tenant_a, branch_a, client_admin_a
    ):
        sku, units = build_catalog(tenant_a, branch_a, price=1000, imeis=("X",))
        client_admin_a.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [units[0].id], "branch": branch_a.id},
            format="json",
        )
        sku.sell_price = 9999
        sku.save()
        item = SaleItem.objects.get()
        assert str(item.sell_price_at_sale) == "1000.00"  # frozen forever


class TestReceiptNumbering:
    def test_sequential_per_tenant_and_independent_across_tenants(
        self, tenant_a, branch_a, tenant_b, branch_b, client_admin_a, client_admin_b
    ):
        _, units_a = build_catalog(tenant_a, branch_a, imeis=("A1", "A2"))
        _, units_b = build_catalog(tenant_b, branch_b, imeis=("B1",))
        for unit in units_a:
            client_admin_a.post(
                "/api/pos/sales/checkout/",
                {"stock_unit_ids": [unit.id], "branch": branch_a.id},
                format="json",
            )
        client_admin_b.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [units_b[0].id], "branch": branch_b.id},
            format="json",
        )
        numbers_a = list(
            Receipt.objects.filter(sale__tenant=tenant_a)
            .order_by("sale_id")
            .values_list("receipt_number", flat=True)
        )
        numbers_b = list(
            Receipt.objects.filter(sale__tenant=tenant_b).values_list("receipt_number", flat=True)
        )
        assert numbers_a == ["0001", "0002"]
        assert numbers_b == ["0001"]  # each tenant has its own sequence


class TestSalesHistoryMatrix:
    def test_employee_sees_only_own_sales_admin_sees_all(
        self, tenant_a, branch_a, admin_a, employee_a, client_admin_a, client_employee_a
    ):
        perm = employee_a.employee_permission
        perm.can_use_pos = True
        perm.save()
        _, units = build_catalog(tenant_a, branch_a, imeis=("ADM", "EMP"))
        client_admin_a.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [units[0].id], "branch": branch_a.id}, format="json",
        )
        client_employee_a.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [units[1].id], "branch": branch_a.id}, format="json",
        )
        assert client_admin_a.get("/api/pos/sales/").json()["count"] == 2
        emp_list = client_employee_a.get("/api/pos/sales/").json()
        assert emp_list["count"] == 1
        assert emp_list["results"][0]["items"][0]["imei_serial"] == "EMP"

    def test_sales_isolated_per_tenant(
        self, tenant_a, branch_a, tenant_b, branch_b, client_admin_a, client_admin_b
    ):
        _, units_b = build_catalog(tenant_b, branch_b, imeis=("B1",))
        client_admin_b.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [units_b[0].id], "branch": branch_b.id}, format="json",
        )
        assert client_admin_a.get("/api/pos/sales/").json()["count"] == 0


@pytest.mark.postgres
@pytest.mark.skipif(IS_SQLITE, reason="Row-lock concurrency needs PostgreSQL")
class TestConcurrencyDoubleSell:
    """PRD 9.6 mandatory gate: two simultaneous checkouts for the SAME unit —
    exactly one succeeds, the unit is sold exactly once."""

    @pytest.mark.django_db(transaction=True)
    def test_double_sell_impossible(self):
        tenant = Tenant.objects.create(name="Race Shop", subdomain="race")
        branch = Branch.objects.create(tenant=tenant, name="Main")
        admin = User.objects.create_user(
            "race@shop.com", "Admin@12345", role=User.ROLE_ADMIN, tenant=tenant
        )
        sku, units = build_catalog(tenant, branch, imeis=("RACE-UNIT",))
        unit_id = units[0].id

        results = []
        barrier = threading.Barrier(2)

        def attempt():
            client = client_for(admin, "race.testserver")
            barrier.wait()
            res = client.post(
                "/api/pos/sales/checkout/",
                {"stock_unit_ids": [unit_id], "branch": branch.id},
                format="json",
            )
            results.append(res.status_code)
            connections.close_all()

        threads = [threading.Thread(target=attempt) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert sorted(results) == [201, 409]  # exactly one winner
        assert Sale.objects.filter(tenant=tenant).count() == 1
        assert SaleItem.objects.filter(sale__tenant=tenant).count() == 1
        unit = StockUnit.objects.get(id=unit_id)
        assert unit.is_sold is True


class TestCashierCanReadPrices:
    def test_pos_employee_reads_sku_but_cannot_edit(
        self, tenant_a, branch_a, employee_a, client_employee_a
    ):
        perm = employee_a.employee_permission
        perm.can_use_pos = True  # POS flag only — no inventory flag
        perm.save()
        sku, _ = build_catalog(tenant_a, branch_a, imeis=("P1",))
        assert client_employee_a.get(f"/api/inventory/skus/{sku.id}/").status_code == 200
        res = client_employee_a.patch(f"/api/inventory/skus/{sku.id}/", {"sell_price": "1.00"})
        assert res.status_code == 403  # matrix: Edit sell prices — Employee: No

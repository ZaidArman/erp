"""Phase 4 tests: formula reconciliation against hand-calculated data,
period boundaries, tenant isolation of totals, permission gating, and CSV
export parity (PRD section 9.7)."""
import csv
import io
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.pos.models import Sale
from apps.tenants.models import Branch
from tests.test_phase3_pos import build_catalog

pytestmark = pytest.mark.django_db


@pytest.fixture
def sold_data(tenant_a, branch_a, client_admin_a):
    """Hand-calculated dataset: 3 units sold today.
    Prices: 1000 each, cost 700 each ->
      Revenue = 3000, COGS = 2100, Gross profit = 900."""
    sku, units = build_catalog(
        tenant_a, branch_a, price=1000, cost=700, imeis=("S1", "S2", "S3")
    )
    for unit in units:
        res = client_admin_a.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [unit.id], "branch": branch_a.id},
            format="json",
        )
        assert res.status_code == 201
    return {"sku": sku, "units": units}


class TestFormulas:
    def test_summary_matches_hand_calculation(self, sold_data, client_admin_a):
        res = client_admin_a.get("/api/finance/summary/?period=today")
        body = res.json()
        assert body["revenue"] == "3000.00"
        assert body["cogs"] == "2100.00"
        assert body["gross_profit"] == "900.00"
        assert body["sales_count"] == 3
        assert body["units_sold"] == 3

    def test_summary_reconciles_with_raw_sale_rows(self, sold_data, tenant_a, client_admin_a):
        api_revenue = client_admin_a.get("/api/finance/summary/?period=today").json()["revenue"]
        raw = sum(s.total_amount for s in Sale.objects.filter(tenant=tenant_a))
        assert api_revenue == f"{raw:.2f}"

    def test_custom_range(self, sold_data, client_admin_a):
        today = timezone.localdate()
        res = client_admin_a.get(
            f"/api/finance/summary/?period=custom&start={today}&end={today}"
        )
        assert res.json()["revenue"] == "3000.00"

    def test_invalid_period_is_400(self, client_admin_a, tenant_a):
        assert client_admin_a.get("/api/finance/summary/?period=year").status_code == 400


class TestPeriodBoundaries:
    def test_sale_before_midnight_belongs_to_that_day(self, sold_data, tenant_a, client_admin_a):
        """A sale at 23:59 yesterday must NOT count in today's totals."""
        sale = Sale.objects.filter(tenant=tenant_a).first()
        yesterday_2359 = (
            timezone.localtime().replace(hour=23, minute=59, second=0, microsecond=0)
            - timedelta(days=1)
        )
        Sale.objects.filter(id=sale.id).update(created_at=yesterday_2359)

        today = client_admin_a.get("/api/finance/summary/?period=today").json()
        assert today["revenue"] == "2000.00"  # only 2 of 3 sales remain today

        y = yesterday_2359.date()
        yesterday = client_admin_a.get(
            f"/api/finance/summary/?period=custom&start={y}&end={y}"
        ).json()
        assert yesterday["revenue"] == "1000.00"


class TestTenantIsolationOfTotals:
    def test_other_tenant_sales_never_leak(
        self, sold_data, tenant_b, branch_b, client_admin_a, client_admin_b
    ):
        before = client_admin_a.get("/api/finance/summary/?period=today").json()["revenue"]
        _, units_b = build_catalog(tenant_b, branch_b, price=555, imeis=("B1",))
        client_admin_b.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [units_b[0].id], "branch": branch_b.id},
            format="json",
        )
        after = client_admin_a.get("/api/finance/summary/?period=today").json()["revenue"]
        assert before == after == "3000.00"  # tenant_b's sale changed nothing


class TestPermissionGating:
    FINANCE_URLS = [
        "/api/finance/summary/?period=today",
        "/api/finance/sales-over-time/?period=today",
        "/api/finance/top-products/?period=today",
        "/api/finance/stock-value/",
    ]

    def test_employee_without_flag_gets_403_everywhere(self, tenant_a, client_employee_a):
        for url in self.FINANCE_URLS:
            assert client_employee_a.get(url).status_code == 403, url
        assert (
            client_employee_a.get("/api/finance/sales-report/export/?period=today").status_code
            == 403
        )

    def test_employee_with_finance_flag_can_view_but_not_export(
        self, tenant_a, employee_a, client_employee_a
    ):
        perm = employee_a.employee_permission
        perm.can_view_finance = True
        perm.save()
        assert client_employee_a.get(self.FINANCE_URLS[0]).status_code == 200
        # export needs can_view_reports, a separate flag
        assert (
            client_employee_a.get("/api/finance/sales-report/export/?period=today").status_code
            == 403
        )

    def test_admin_always_allowed(self, tenant_a, client_admin_a):
        for url in self.FINANCE_URLS:
            assert client_admin_a.get(url).status_code == 200, url


class TestAnalyticsEndpoints:
    def test_top_products(self, sold_data, client_admin_a):
        rows = client_admin_a.get("/api/finance/top-products/?period=today").json()
        assert rows[0]["product"] == "iPhone 15 Pro"
        assert rows[0]["units"] == 3
        assert rows[0]["revenue"] == "3000.00"
        assert rows[0]["profit"] == "900.00"

    def test_sales_over_time_buckets(self, sold_data, client_admin_a):
        rows = client_admin_a.get("/api/finance/sales-over-time/?period=today").json()
        assert len(rows) == 1
        assert rows[0]["sales"] == 3
        assert rows[0]["revenue"] == "3000.00"

    def test_stock_value_counts_only_unsold(self, tenant_a, branch_a, client_admin_a):
        sku, units = build_catalog(
            tenant_a, branch_a, price=100, cost=60, imeis=("U1", "U2", "U3")
        )
        client_admin_a.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [units[0].id], "branch": branch_a.id},
            format="json",
        )
        body = client_admin_a.get("/api/finance/stock-value/").json()
        assert body["total_value"] == "120.00"  # 2 unsold x 60
        assert body["per_branch"][0]["units"] == 2
        assert body["per_category"][0]["category"] == "Mobiles"


class TestCSVExport:
    def test_csv_matches_screen_totals(self, sold_data, client_admin_a):
        res = client_admin_a.get("/api/finance/sales-report/export/?period=today")
        assert res.status_code == 200
        assert res["Content-Type"] == "text/csv"
        rows = list(csv.reader(io.StringIO(res.content.decode())))
        header, data_rows, totals = rows[0], rows[1:-2], rows[-1]
        assert header[0] == "Date"
        assert len(data_rows) == 3  # one row per sold unit
        assert totals[0] == "TOTALS"
        assert totals[7] == "3000.00"  # revenue column total
        assert totals[8] == "2100.00"  # cost
        assert totals[9] == "900.00"   # profit

    def test_csv_is_tenant_isolated(self, sold_data, tenant_b, branch_b, client_admin_b):
        _, units_b = build_catalog(tenant_b, branch_b, price=1, imeis=("B1",))
        client_admin_b.post(
            "/api/pos/sales/checkout/",
            {"stock_unit_ids": [units_b[0].id], "branch": branch_b.id},
            format="json",
        )
        res = client_admin_b.get("/api/finance/sales-report/export/?period=today")
        rows = list(csv.reader(io.StringIO(res.content.decode())))
        imeis_in_csv = [r[6] for r in rows[1:-2]]
        assert imeis_in_csv == ["B1"]  # none of tenant_a's units

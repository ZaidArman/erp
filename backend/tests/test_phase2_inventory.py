"""Phase 2 tests: constraints, hierarchy chain, bulk intake, filters,
audit logging, cross-tenant FK rejection (PRD section 9.5)."""
import pytest
from django.db import IntegrityError

from apps.core.models import AuditLog
from apps.inventory.models import SKU, Brand, Category, Product, StockUnit, Supplier
from tests.conftest import ALPHA_HOST, client_for

pytestmark = pytest.mark.django_db


@pytest.fixture
def catalog_a(tenant_a, branch_a):
    category = Category.objects.create(tenant=tenant_a, name="Mobiles")
    brand = Brand.objects.create(tenant=tenant_a, name="Apple", category=category)
    supplier = Supplier.objects.create(tenant=tenant_a, name="Karkhano Traders")
    product = Product.objects.create(
        tenant=tenant_a, category=category, brand=brand, name="iPhone 15 Pro"
    )
    sku = SKU.objects.create(
        tenant=tenant_a, product=product, variant_name="256GB Black", sell_price=452000,
        attributes={"color": "Black", "storage": "256GB"},
    )
    return {
        "category": category, "brand": brand, "supplier": supplier,
        "product": product, "sku": sku, "branch": branch_a,
    }


class TestConstraints:
    def test_duplicate_category_same_tenant_rejected(self, tenant_a):
        Category.objects.create(tenant=tenant_a, name="Mobiles")
        with pytest.raises(IntegrityError):
            Category.objects.create(tenant=tenant_a, name="Mobiles")

    def test_same_category_name_across_tenants_allowed(self, tenant_a, tenant_b):
        Category.objects.create(tenant=tenant_a, name="Mobiles")
        Category.objects.create(tenant=tenant_b, name="Mobiles")
        assert Category.objects.filter(name="Mobiles").count() == 2

    def test_duplicate_category_via_api_returns_clean_400(self, client_admin_a):
        client_admin_a.post("/api/inventory/categories/", {"name": "Mobiles"})
        res = client_admin_a.post("/api/inventory/categories/", {"name": "Mobiles"})
        assert res.status_code == 400
        assert "already exists" in res.json()["name"]

    def test_duplicate_imei_same_tenant_rejected(self, catalog_a, tenant_a):
        common = dict(
            tenant=tenant_a, sku=catalog_a["sku"], branch=catalog_a["branch"],
            purchase_cost=100, imei_serial="IMEI-1",
        )
        StockUnit.objects.create(**common)
        with pytest.raises(IntegrityError):
            StockUnit.objects.create(**common)

    def test_same_imei_across_tenants_allowed(self, catalog_a, tenant_a, tenant_b, branch_b):
        StockUnit.objects.create(
            tenant=tenant_a, sku=catalog_a["sku"], branch=catalog_a["branch"],
            purchase_cost=100, imei_serial="IMEI-1",
        )
        category = Category.objects.create(tenant=tenant_b, name="Mobiles")
        brand = Brand.objects.create(tenant=tenant_b, name="Apple", category=category)
        product = Product.objects.create(
            tenant=tenant_b, category=category, brand=brand, name="iPhone 15 Pro"
        )
        sku = SKU.objects.create(
            tenant=tenant_b, product=product, variant_name="256GB", sell_price=1
        )
        StockUnit.objects.create(
            tenant=tenant_b, sku=sku, branch=branch_b, purchase_cost=100, imei_serial="IMEI-1"
        )
        assert StockUnit.objects.filter(imei_serial="IMEI-1").count() == 2

    def test_sku_attributes_json_round_trip(self, catalog_a):
        sku = SKU.objects.get(id=catalog_a["sku"].id)
        assert sku.attributes == {"color": "Black", "storage": "256GB"}


class TestFullChainAPI:
    def test_create_full_chain(self, tenant_a, branch_a, client_admin_a):
        category = client_admin_a.post("/api/inventory/categories/", {"name": "Mobiles"}).json()
        brand = client_admin_a.post(
            "/api/inventory/brands/", {"name": "Apple", "category": category["id"]}
        ).json()
        product = client_admin_a.post(
            "/api/inventory/products/",
            {"name": "iPhone 15 Pro", "brand": brand["id"]},
        ).json()
        sku_res = client_admin_a.post(
            "/api/inventory/skus/",
            {"product": product["id"], "variant_name": "256GB Black",
             "sell_price": "452000.00", "attributes": {"storage": "256GB"}},
            format="json",
        )
        assert sku_res.status_code == 201
        unit_res = client_admin_a.post(
            "/api/inventory/stock-units/",
            {"sku": sku_res.json()["id"], "branch": branch_a.id,
             "imei_serial": "358743110912345", "condition": "new", "purchase_cost": "430000.00"},
        )
        assert unit_res.status_code == 201
        unit = StockUnit.objects.get(imei_serial="358743110912345")
        assert unit.tenant_id == tenant_a.id  # tenant set from subdomain

    def test_cross_tenant_fk_rejected(self, tenant_a, tenant_b, client_admin_a):
        theirs_cat = Category.objects.create(tenant=tenant_b, name="Mobiles")
        theirs_brand = Brand.objects.create(tenant=tenant_b, name="Sneaky Brand", category=theirs_cat)
        res = client_admin_a.post(
            "/api/inventory/products/",
            {"name": "Sneaky", "brand": theirs_brand.id},
        )
        assert res.status_code == 400  # FK cannot cross tenants

    def test_negative_sell_price_rejected(self, catalog_a, client_admin_a):
        res = client_admin_a.post(
            "/api/inventory/skus/",
            {"product": catalog_a["product"].id, "variant_name": "Bad", "sell_price": "-5"},
        )
        assert res.status_code == 400


class TestBulkIntake:
    def test_bulk_intake_creates_all_units(self, catalog_a, client_admin_a):
        res = client_admin_a.post(
            "/api/inventory/stock-units/bulk-intake/",
            {"sku": catalog_a["sku"].id, "branch": catalog_a["branch"].id,
             "supplier": catalog_a["supplier"].id, "condition": "new",
             "purchase_cost": "430000.00",
             "imeis": [f"IMEI-{i}" for i in range(10)]},
            format="json",
        )
        assert res.status_code == 201
        assert StockUnit.objects.count() == 10

    def test_bulk_intake_rolls_back_on_duplicate(self, catalog_a, tenant_a, client_admin_a):
        StockUnit.objects.create(
            tenant=tenant_a, sku=catalog_a["sku"], branch=catalog_a["branch"],
            purchase_cost=1, imei_serial="IMEI-3",
        )
        res = client_admin_a.post(
            "/api/inventory/stock-units/bulk-intake/",
            {"sku": catalog_a["sku"].id, "branch": catalog_a["branch"].id,
             "purchase_cost": "1.00", "imeis": ["IMEI-1", "IMEI-2", "IMEI-3"]},
            format="json",
        )
        assert res.status_code == 400
        assert StockUnit.objects.count() == 1  # nothing from the batch persisted

    def test_duplicate_imeis_within_batch_rejected(self, catalog_a, client_admin_a):
        res = client_admin_a.post(
            "/api/inventory/stock-units/bulk-intake/",
            {"sku": catalog_a["sku"].id, "branch": catalog_a["branch"].id,
             "purchase_cost": "1.00", "imeis": ["X", "X"]},
            format="json",
        )
        assert res.status_code == 400


class TestStockFiltersAndSearch:
    @pytest.fixture(autouse=True)
    def seed_units(self, catalog_a, tenant_a):
        for i, condition in enumerate(["new", "new", "used"]):
            StockUnit.objects.create(
                tenant=tenant_a, sku=catalog_a["sku"], branch=catalog_a["branch"],
                purchase_cost=100, imei_serial=f"IMEI-{i}", condition=condition,
                is_sold=(i == 2),
            )

    def test_filter_by_condition(self, client_admin_a):
        res = client_admin_a.get("/api/inventory/stock-units/?condition=new")
        assert res.json()["count"] == 2

    def test_filter_by_sold_status(self, client_admin_a):
        res = client_admin_a.get("/api/inventory/stock-units/?is_sold=false")
        assert res.json()["count"] == 2

    def test_imei_exact_search(self, client_admin_a):
        res = client_admin_a.get("/api/inventory/stock-units/?imei=IMEI-1")
        body = res.json()
        assert body["count"] == 1
        assert body["results"][0]["imei_serial"] == "IMEI-1"

    def test_unknown_imei_returns_empty(self, client_admin_a):
        res = client_admin_a.get("/api/inventory/stock-units/?imei=NOPE")
        assert res.json()["count"] == 0


class TestAuditLog:
    def test_create_update_delete_are_logged(self, tenant_a, client_admin_a):
        created = client_admin_a.post("/api/inventory/categories/", {"name": "Mobiles"}).json()
        client_admin_a.patch(f"/api/inventory/categories/{created['id']}/", {"name": "Phones"})
        client_admin_a.delete(f"/api/inventory/categories/{created['id']}/")
        actions = list(
            AuditLog.objects.filter(tenant=tenant_a, model_name="Category")
            .order_by("timestamp")
            .values_list("action", flat=True)
        )
        assert actions == ["create", "update", "delete"]

    def test_update_log_contains_before_after(self, tenant_a, client_admin_a):
        created = client_admin_a.post("/api/inventory/categories/", {"name": "Mobiles"}).json()
        client_admin_a.patch(f"/api/inventory/categories/{created['id']}/", {"name": "Phones"})
        log = AuditLog.objects.filter(action="update", model_name="Category").first()
        assert log.changes["before"]["name"] == "Mobiles"
        assert log.changes["after"]["name"] == "Phones"

    def test_forbidden_write_leaves_no_audit_row(self, tenant_a, client_employee_a):
        client_employee_a.post("/api/inventory/categories/", {"name": "Rogue"})
        assert AuditLog.objects.count() == 0


class TestProductOwnedPricing:
    """Product.selling_price / purchase_price are now the single place a
    shop enters price — SKU.sell_price and StockUnit.purchase_cost still
    exist (checkout/finance depend on them) but auto-inherit when omitted."""

    def test_sku_without_sell_price_inherits_product_selling_price(
        self, tenant_a, client_admin_a
    ):
        category = Category.objects.create(tenant=tenant_a, name="Air Conditioners")
        brand = Brand.objects.create(tenant=tenant_a, name="Haier", category=category)
        product = Product.objects.create(
            tenant=tenant_a, category=category, brand=brand, name="Haier 1.5 Ton",
            selling_price=95000,
        )
        res = client_admin_a.post(
            "/api/inventory/skus/",
            {"product": product.id, "variant_name": "Standard"},
        )
        assert res.status_code == 201
        assert res.json()["sell_price"] == "95000.00"

    def test_sku_without_sell_price_and_no_product_price_rejected(
        self, tenant_a, client_admin_a
    ):
        category = Category.objects.create(tenant=tenant_a, name="Fridges")
        brand = Brand.objects.create(tenant=tenant_a, name="Dawlance", category=category)
        product = Product.objects.create(
            tenant=tenant_a, category=category, brand=brand, name="Dawlance 260L"
        )
        res = client_admin_a.post(
            "/api/inventory/skus/",
            {"product": product.id, "variant_name": "Standard"},
        )
        assert res.status_code == 400
        assert "sell_price" in res.json()

    def test_explicit_sell_price_still_wins(self, tenant_a, client_admin_a):
        category = Category.objects.create(tenant=tenant_a, name="Mobiles")
        brand = Brand.objects.create(tenant=tenant_a, name="Apple", category=category)
        product = Product.objects.create(
            tenant=tenant_a, category=category, brand=brand, name="iPhone 15 Pro",
            selling_price=452000,
        )
        res = client_admin_a.post(
            "/api/inventory/skus/",
            {"product": product.id, "variant_name": "512GB", "sell_price": "520000.00"},
        )
        assert res.status_code == 201
        assert res.json()["sell_price"] == "520000.00"

    def test_bulk_intake_without_purchase_cost_inherits_product_purchase_price(
        self, tenant_a, branch_a, client_admin_a
    ):
        category = Category.objects.create(tenant=tenant_a, name="Air Conditioners")
        brand = Brand.objects.create(tenant=tenant_a, name="Haier", category=category)
        product = Product.objects.create(
            tenant=tenant_a, category=category, brand=brand, name="Haier 1.5 Ton",
            selling_price=95000, purchase_price=80000,
        )
        sku = SKU.objects.create(
            tenant=tenant_a, product=product, variant_name="Standard", sell_price=95000,
        )
        res = client_admin_a.post(
            "/api/inventory/stock-units/bulk-intake/",
            {"sku": sku.id, "branch": branch_a.id, "imeis": ["AC-1", "AC-2"]},
            format="json",
        )
        assert res.status_code == 201
        assert all(u["purchase_cost"] == "80000.00" for u in res.json())

    def test_bulk_intake_without_purchase_cost_and_no_product_price_rejected(
        self, tenant_a, branch_a, client_admin_a
    ):
        category = Category.objects.create(tenant=tenant_a, name="Fridges")
        brand = Brand.objects.create(tenant=tenant_a, name="Dawlance", category=category)
        product = Product.objects.create(
            tenant=tenant_a, category=category, brand=brand, name="Dawlance 260L",
            selling_price=50000,
        )
        sku = SKU.objects.create(
            tenant=tenant_a, product=product, variant_name="Standard", sell_price=50000,
        )
        res = client_admin_a.post(
            "/api/inventory/stock-units/bulk-intake/",
            {"sku": sku.id, "branch": branch_a.id, "imeis": ["FR-1"]},
            format="json",
        )
        assert res.status_code == 400
        assert "purchase_cost" in res.json()

    def test_profit_margin_auto_computed(self, tenant_a):
        category = Category.objects.create(tenant=tenant_a, name="Mobiles")
        brand = Brand.objects.create(tenant=tenant_a, name="Apple", category=category)
        product = Product.objects.create(
            tenant=tenant_a, category=category, brand=brand, name="iPhone 15 Pro",
            selling_price=452000, cost_price=400000,
        )
        assert product.profit_margin == 52000


class TestSoftDelete:
    def test_deleted_category_hidden_but_blocks_duplicate_name(
        self, tenant_a, client_admin_a
    ):
        created = client_admin_a.post("/api/inventory/categories/", {"name": "Mobiles"}).json()
        client_admin_a.delete(f"/api/inventory/categories/{created['id']}/")

        listed = client_admin_a.get("/api/inventory/categories/").json()
        assert all(c["id"] != created["id"] for c in listed["results"])

        res = client_admin_a.post("/api/inventory/categories/", {"name": "Mobiles"})
        assert res.status_code == 400
        assert "already exists" in res.json()["name"]

        category = Category.all_objects.get(id=created["id"])
        assert category.deleted_at is not None

    def test_deleted_brand_records_deleted_by(self, tenant_a, client_admin_a):
        category = client_admin_a.post(
            "/api/inventory/categories/", {"name": "Mobiles"}
        ).json()
        brand = client_admin_a.post(
            "/api/inventory/brands/", {"name": "Apple", "category": category["id"]}
        ).json()
        client_admin_a.delete(f"/api/inventory/brands/{brand['id']}/")

        deleted_brand = Brand.all_objects.get(id=brand["id"])
        assert deleted_brand.deleted_at is not None
        assert deleted_brand.deleted_by is not None

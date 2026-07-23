from decimal import Decimal
from rest_framework import serializers

from apps.core.serializers import TenantPKRelatedField
from apps.tenants.models import Branch

from .models import SKU, Brand, Category, Product, StockUnit, StockWarranty, Supplier


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "attribute_schema", "description", "is_active"]


class BrandSerializer(serializers.ModelSerializer):
    """created_by_name / updated_by_name are annotated onto the queryset by
    BrandViewSet (AuditLog subqueries) — Brand itself doesn't store who did
    what, consistent with the rest of the app (see ProductReportSerializer)."""

    category = TenantPKRelatedField(queryset=Category.objects.all())
    category_name = serializers.CharField(source="category.name", read_only=True)
    created_by_name = serializers.CharField(read_only=True, allow_null=True, required=False)
    updated_by_name = serializers.CharField(read_only=True, allow_null=True, required=False)

    class Meta:
        model = Brand
        fields = [
            "id", "name", "category", "category_name",
            "description", "supporter_phone_number", "is_active",
            "created_at", "updated_at", "created_by_name", "updated_by_name",
        ]
        read_only_fields = ["created_at", "updated_at"]


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "contact"]


class ProductSerializer(serializers.ModelSerializer):
    # Category now follows from the chosen brand (Category -> Brand -> Product),
    # so it's derived server-side rather than picked independently.
    brand = TenantPKRelatedField(queryset=Brand.objects.all())
    category = serializers.PrimaryKeyRelatedField(read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    sku_count = serializers.IntegerField(source="skus.count", read_only=True)
    # Live count, not a stored column — can't drift out of sync with real stock.
    current_stock = serializers.SerializerMethodField()
    profit_margin = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "name", "description",
            "category", "category_name",
            "brand", "brand_name",
            "sku_count", "current_stock",
            "model_number", "product_code", "barcode", "qr_code",
            "warranty_required", "warranty_period", "warranty_terms",
            "minimum_stock", "maximum_stock", "product_color",
            "purchase_price", "cost_price", "selling_price", "profit_margin",
            "is_active",
        ]

    def get_current_stock(self, obj):
        return StockUnit.objects.filter(sku__product=obj, is_sold=False).count()

    def create(self, validated_data):
        validated_data["category"] = validated_data["brand"].category
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "brand" in validated_data:
            validated_data["category"] = validated_data["brand"].category
        return super().update(instance, validated_data)


class SKUSerializer(serializers.ModelSerializer):
    """sell_price is normally inherited from Product.selling_price at
    creation time — price now belongs to the Product (see Product model
    docstring). An explicit sell_price is still accepted if given, for
    backward compatibility."""

    product = TenantPKRelatedField(queryset=Product.objects.all())
    product_name = serializers.CharField(source="product.name", read_only=True)
    available_units = serializers.SerializerMethodField()
    sell_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    product_purchase_price = serializers.DecimalField(
        source="product.purchase_price", max_digits=12, decimal_places=2,
        read_only=True, allow_null=True,
    )

    class Meta:
        model = SKU
        fields = [
            "id", "product", "product_name", "variant_name",
            "sell_price", "attributes", "available_units", "product_purchase_price",
        ]

    def get_available_units(self, obj):
        return obj.stock_units.filter(is_sold=False).count()

    def validate_sell_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Sell price must be positive.")
        return value

    def validate(self, attrs):
        if self.instance is None and attrs.get("sell_price") is None:
            product = attrs.get("product")
            if product is not None and product.selling_price is not None:
                attrs["sell_price"] = product.selling_price
            else:
                raise serializers.ValidationError(
                    {"sell_price": "Set a selling price on the product first, or provide one here."}
                )
        return attrs


class StockUnitSerializer(serializers.ModelSerializer):
    sku = TenantPKRelatedField(queryset=SKU.objects.all())
    branch = TenantPKRelatedField(queryset=Branch.objects.all())
    supplier = TenantPKRelatedField(
        queryset=Supplier.objects.all(), required=False, allow_null=True
    )
    sku_label = serializers.CharField(source="sku.__str__", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    product_name = serializers.CharField(source="sku.product.name", read_only=True)
    brand_name = serializers.CharField(source="sku.product.brand.name", read_only=True)
    sell_price = serializers.DecimalField(
        source="sku.sell_price", max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = StockUnit
        fields = [
            "id", "sku", "sku_label", "product_name", "brand_name", "sell_price",
            "branch", "branch_name",
            "supplier", "supplier_name", "imei_serial", "condition",
            "purchase_cost", "is_sold", "warranty_expiry",
        ]
        read_only_fields = ["is_sold"]


class ProductReportSerializer(StockUnitSerializer):
    """One row per physical stock unit, joined all the way up the hierarchy
    (Category -> Brand -> Product -> SKU), plus who created/last touched the
    row — derived from AuditLog since StockUnit itself doesn't store that.

    created_by_name / updated_by_name are annotated onto the queryset by
    ProductReportViewSet (subqueries against AuditLog), so pagination and
    per-column filtering can happen entirely in the database rather than
    requiring every row to be loaded into Python first."""

    product_id = serializers.IntegerField(source="sku.product.id", read_only=True)
    category_name = serializers.CharField(source="sku.product.category.name", read_only=True)
    created_by_name = serializers.CharField(read_only=True, allow_null=True)
    updated_by_name = serializers.CharField(read_only=True, allow_null=True)

    # Product-level fields, duplicated onto every stock-unit row (same as
    # category_name/brand_name above) so the Products table can show the
    # full product record without a second request per row.
    model_number = serializers.CharField(source="sku.product.model_number", read_only=True)
    product_code = serializers.CharField(source="sku.product.product_code", read_only=True)
    barcode = serializers.CharField(source="sku.product.barcode", read_only=True)
    qr_code = serializers.CharField(source="sku.product.qr_code", read_only=True)
    warranty_required = serializers.BooleanField(source="sku.product.warranty_required", read_only=True)
    warranty_period = serializers.IntegerField(source="sku.product.warranty_period", read_only=True, allow_null=True)
    warranty_terms = serializers.CharField(source="sku.product.warranty_terms", read_only=True)
    minimum_stock = serializers.IntegerField(source="sku.product.minimum_stock", read_only=True, allow_null=True)
    maximum_stock = serializers.IntegerField(source="sku.product.maximum_stock", read_only=True, allow_null=True)
    product_color = serializers.CharField(source="sku.product.product_color", read_only=True)
    purchase_price = serializers.DecimalField(
        source="sku.product.purchase_price", max_digits=12, decimal_places=2, read_only=True, allow_null=True
    )
    cost_price = serializers.DecimalField(
        source="sku.product.cost_price", max_digits=12, decimal_places=2, read_only=True, allow_null=True
    )
    selling_price = serializers.DecimalField(
        source="sku.product.selling_price", max_digits=12, decimal_places=2, read_only=True, allow_null=True
    )
    profit_margin = serializers.DecimalField(
        source="sku.product.profit_margin", max_digits=12, decimal_places=2, read_only=True, allow_null=True
    )
    product_is_active = serializers.BooleanField(source="sku.product.is_active", read_only=True)

    # Product-level edit/delete history — separate from the StockUnit-level
    # created_by_name/updated_by_name above. product_updated_at/deleted_at
    # come straight off Product's own columns; the "by" names are annotated
    # onto the queryset by ProductReportViewSet (see product_updated_by_name
    # subquery, scoped to AuditLog rows for the Product, not the StockUnit).
    product_updated_at = serializers.DateTimeField(source="sku.product.updated_at", read_only=True)
    product_updated_by_name = serializers.CharField(read_only=True, allow_null=True)
    product_deleted_at = serializers.DateTimeField(source="sku.product.deleted_at", read_only=True, allow_null=True)
    product_deleted_by_name = serializers.SerializerMethodField()

    class Meta(StockUnitSerializer.Meta):
        fields = StockUnitSerializer.Meta.fields + [
            "product_id", "category_name",
            "created_at", "updated_at",
            "created_by_name", "updated_by_name",
            "model_number", "product_code", "barcode", "qr_code",
            "warranty_required", "warranty_period", "warranty_terms",
            "minimum_stock", "maximum_stock", "product_color",
            "purchase_price", "cost_price", "selling_price", "profit_margin",
            "product_is_active",
            "product_updated_at", "product_updated_by_name",
            "product_deleted_at", "product_deleted_by_name",
        ]

    def get_product_deleted_by_name(self, obj):
        user = obj.sku.product.deleted_by
        if not user:
            return None
        return user.full_name or user.email


class BulkIntakeSerializer(serializers.Serializer):
    """Receive a batch of physical units in one request (PRD phase 2, task 4)."""

    sku = TenantPKRelatedField(queryset=SKU.objects.all())
    branch = TenantPKRelatedField(queryset=Branch.objects.all())
    supplier = TenantPKRelatedField(
        queryset=Supplier.objects.all(), required=False, allow_null=True
    )
    condition = serializers.ChoiceField(
        choices=StockUnit.CONDITION_CHOICES, default=StockUnit.CONDITION_NEW
    )
    # Normally inherited from the SKU's Product.purchase_price at intake time
    # (see StockUnitViewSet.bulk_intake) — price belongs to the Product now.
    # Still accepted explicitly for backward compatibility / per-batch override.
    purchase_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=False
    )
    warranty_expiry = serializers.DateField(required=False, allow_null=True)
    imeis = serializers.ListField(
        child=serializers.CharField(max_length=64), allow_empty=False, max_length=500
    )

    def validate_imeis(self, imeis):
        cleaned = [i.strip() for i in imeis if i.strip()]
        if len(cleaned) != len(set(cleaned)):
            raise serializers.ValidationError("Duplicate IMEIs in this batch.")
        return cleaned


class StockWarrantySerializer(serializers.ModelSerializer):
    stock_unit = TenantPKRelatedField(queryset=StockUnit.objects.all())
    imei_serial = serializers.CharField(source="stock_unit.imei_serial", read_only=True)

    class Meta:
        model = StockWarranty
        fields = [
            "id", "stock_unit", "imei_serial", "warrant_id", "warranty_type",
            "duration_months", "coverage", "terms", "is_active",
        ]

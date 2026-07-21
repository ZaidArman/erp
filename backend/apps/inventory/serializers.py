from decimal import Decimal
from rest_framework import serializers

from apps.core.serializers import TenantPKRelatedField
from apps.tenants.models import Branch

from .models import SKU, Brand, Category, Product, StockUnit, Supplier


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "name"]


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "contact"]


class ProductSerializer(serializers.ModelSerializer):
    category = TenantPKRelatedField(queryset=Category.objects.all())
    brand = TenantPKRelatedField(queryset=Brand.objects.all())
    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    sku_count = serializers.IntegerField(source="skus.count", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "name", "description",
            "category", "category_name",
            "brand", "brand_name",
            "sku_count",
        ]


class SKUSerializer(serializers.ModelSerializer):
    product = TenantPKRelatedField(queryset=Product.objects.all())
    product_name = serializers.CharField(source="product.name", read_only=True)
    available_units = serializers.SerializerMethodField()

    class Meta:
        model = SKU
        fields = [
            "id", "product", "product_name", "variant_name",
            "sell_price", "attributes", "available_units",
        ]

    def get_available_units(self, obj):
        return obj.stock_units.filter(is_sold=False).count()

    def validate_sell_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Sell price must be positive.")
        return value


class StockUnitSerializer(serializers.ModelSerializer):
    sku = TenantPKRelatedField(queryset=SKU.objects.all())
    branch = TenantPKRelatedField(queryset=Branch.objects.all())
    supplier = TenantPKRelatedField(
        queryset=Supplier.objects.all(), required=False, allow_null=True
    )
    sku_label = serializers.CharField(source="sku.__str__", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = StockUnit
        fields = [
            "id", "sku", "sku_label", "branch", "branch_name",
            "supplier", "supplier_name", "imei_serial", "condition",
            "purchase_cost", "is_sold", "warranty_expiry",
        ]
        read_only_fields = ["is_sold"]

    def validate_purchase_cost(self, value):
        if value <= 0:
            raise serializers.ValidationError("Purchase cost must be positive.")
        return value


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
    purchase_cost = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    warranty_expiry = serializers.DateField(required=False, allow_null=True)
    imeis = serializers.ListField(
        child=serializers.CharField(max_length=64), allow_empty=False, max_length=500
    )

    def validate_imeis(self, imeis):
        cleaned = [i.strip() for i in imeis if i.strip()]
        if len(cleaned) != len(set(cleaned)):
            raise serializers.ValidationError("Duplicate IMEIs in this batch.")
        return cleaned

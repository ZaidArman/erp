from rest_framework import serializers

from apps.core.serializers import TenantPKRelatedField
from apps.tenants.models import Branch

from .models import Receipt, Sale, SaleItem


class SaleItemSerializer(serializers.ModelSerializer):
    imei_serial = serializers.CharField(source="stock_unit.imei_serial", read_only=True)
    sku_label = serializers.CharField(source="stock_unit.sku.__str__", read_only=True)
    condition = serializers.CharField(source="stock_unit.condition", read_only=True)

    class Meta:
        model = SaleItem
        fields = ["id", "stock_unit", "imei_serial", "sku_label", "condition", "sell_price_at_sale"]


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = ["receipt_number", "printed_at"]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    receipt = ReceiptSerializer(read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    sold_by_name = serializers.SerializerMethodField()
    shop_name = serializers.CharField(source="tenant.name", read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id", "branch", "branch_name", "sold_by", "sold_by_name",
            "customer_name", "payment_method", "total_amount",
            "created_at", "items", "receipt", "shop_name",
        ]

    def get_sold_by_name(self, obj):
        return obj.sold_by.full_name or obj.sold_by.email


class CheckoutSerializer(serializers.Serializer):
    """Input for the atomic checkout. Note: NO total field — the total is
    always computed server-side from price snapshots (PRD 9.6)."""

    stock_unit_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), allow_empty=False, max_length=100
    )
    branch = TenantPKRelatedField(queryset=Branch.objects.all())
    customer_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )

    def validate_stock_unit_ids(self, ids):
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Duplicate units in cart.")
        return ids

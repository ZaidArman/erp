from decimal import Decimal

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
    balance_due = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id", "branch", "branch_name", "sold_by", "sold_by_name",
            "customer_name", "customer_phone", "payment_method",
            "total_amount", "amount_paid", "balance_due",
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
    customer_phone = serializers.CharField(
        max_length=32, required=False, allow_blank=True, default=""
    )
    payment_method = serializers.ChoiceField(
        choices=Sale.PAYMENT_CHOICES, required=False, default=Sale.PAYMENT_CASH
    )
    # Only meaningful when payment_method="credit" — an optional down-payment
    # made at checkout time; the rest becomes the loan balance. Ignored for
    # cash sales, which are always recorded as paid in full.
    amount_paid = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0"), required=False, default=Decimal("0")
    )

    def validate_stock_unit_ids(self, ids):
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Duplicate units in cart.")
        return ids


class RecordPaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))

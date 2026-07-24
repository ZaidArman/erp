"""POS models: Sale, SaleItem, Receipt (PRD section 3.3).

Critical rule: a sale references specific StockUnit rows, not SKUs.
SaleItem.sell_price_at_sale is snapshotted at checkout and is the only
price ever used for historical revenue and profit.
"""
from django.conf import settings
from django.db import models

from apps.core.models import TenantAwareModel


class Sale(TenantAwareModel):
    PAYMENT_CASH = "cash"
    PAYMENT_CREDIT = "credit"
    PAYMENT_CHOICES = [(PAYMENT_CASH, "Cash"), (PAYMENT_CREDIT, "Credit (loan)")]

    branch = models.ForeignKey("tenants.Branch", on_delete=models.PROTECT, related_name="sales")
    sold_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sales"
    )
    customer_name = models.CharField(max_length=255, blank=True, default="")
    customer_phone = models.CharField(max_length=32, blank=True, default="")
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default=PAYMENT_CASH)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)
    # Cash sales are always paid in full at checkout; credit (loan) sales can
    # start at 0 (or a partial down-payment) and get settled later via
    # SaleViewSet.record_payment.
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Sale #{self.pk} — {self.total_amount}"

    @property
    def balance_due(self):
        return self.total_amount - self.amount_paid


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    # OneToOne: a physical unit can only ever be sold once.
    stock_unit = models.OneToOneField(
        "inventory.StockUnit", on_delete=models.PROTECT, related_name="sale_item"
    )
    sell_price_at_sale = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.stock_unit.imei_serial} @ {self.sell_price_at_sale}"


class Receipt(models.Model):
    sale = models.OneToOneField(Sale, on_delete=models.CASCADE, related_name="receipt")
    receipt_number = models.CharField(max_length=20)
    printed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # Sequential per tenant; uniqueness scoped through the sale's tenant.
        constraints = [
            models.UniqueConstraint(fields=["receipt_number", "sale"], name="uniq_receipt_sale")
        ]

    def __str__(self):
        return self.receipt_number


class ReceiptCounter(models.Model):
    """Per-tenant sequential counter, incremented under select_for_update
    inside the checkout transaction so numbers never collide."""

    tenant = models.OneToOneField(
        "tenants.Tenant", on_delete=models.CASCADE, related_name="receipt_counter"
    )
    value = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.tenant.subdomain}: {self.value}"

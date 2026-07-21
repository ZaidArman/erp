"""Inventory hierarchy: Category -> Brand -> Product -> SKU -> StockUnit
(PRD section 3.2)."""
from django.db import models

from apps.core.models import TenantAwareModel


class Category(TenantAwareModel):
    name = models.CharField(max_length=255)

    class Meta:
        unique_together = ("tenant", "name")
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Brand(TenantAwareModel):
    name = models.CharField(max_length=255)

    class Meta:
        unique_together = ("tenant", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class Supplier(TenantAwareModel):
    name = models.CharField(max_length=255)
    contact = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        unique_together = ("tenant", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class Product(TenantAwareModel):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="products")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    class Meta:
        unique_together = ("tenant", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class SKU(TenantAwareModel):
    """The sellable variant. Carries the sell price (PRD 2.3)."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="skus")
    variant_name = models.CharField(max_length=255)
    sell_price = models.DecimalField(max_digits=12, decimal_places=2)
    attributes = models.JSONField(default=dict, blank=True)  # {"color": "...", "storage": "..."}

    class Meta:
        unique_together = ("product", "variant_name")
        verbose_name = "SKU"
        verbose_name_plural = "SKUs"
        ordering = ["product__name", "variant_name"]

    def __str__(self):
        return f"{self.product.name} — {self.variant_name}"


class StockUnit(TenantAwareModel):
    """One physical unit. Carries IMEI, condition, purchase cost (PRD 2.3)."""

    CONDITION_NEW = "new"
    CONDITION_OPEN_BOX = "open_box"
    CONDITION_REFURBISHED = "refurbished"
    CONDITION_USED = "used"
    CONDITION_CHOICES = [
        (CONDITION_NEW, "New"),
        (CONDITION_OPEN_BOX, "Open box"),
        (CONDITION_REFURBISHED, "Refurbished"),
        (CONDITION_USED, "Used"),
    ]

    sku = models.ForeignKey(SKU, on_delete=models.PROTECT, related_name="stock_units")
    branch = models.ForeignKey("tenants.Branch", on_delete=models.PROTECT, related_name="stock_units")
    supplier = models.ForeignKey(
        Supplier, null=True, blank=True, on_delete=models.SET_NULL, related_name="stock_units"
    )
    imei_serial = models.CharField(max_length=64)
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES, default=CONDITION_NEW)
    purchase_cost = models.DecimalField(max_digits=12, decimal_places=2)
    is_sold = models.BooleanField(default=False)
    warranty_expiry = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ("tenant", "imei_serial")  # IMEI unique per tenant (PRD 3.2)
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.sku} [{self.imei_serial}]"

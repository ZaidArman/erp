"""Inventory hierarchy: Category -> Brand -> Product -> SKU -> StockUnit
(PRD section 3.2)."""
from django.conf import settings
from django.db import models

from apps.core.models import SoftDeleteModel, TenantAwareModel


class Category(TenantAwareModel, SoftDeleteModel):
    """`attribute_schema` defines the custom SKU-level fields this category's
    products should capture (e.g. Mobiles: storage/RAM, AC: tonnage,
    Fridge: capacity in liters) — [{"key": "tonnage", "label": "Tonnage",
    "type": "text"}, ...]."""

    name = models.CharField(max_length=255)
    attribute_schema = models.JSONField(default=list, blank=True)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        unique_together = ("tenant", "name")
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Brand(TenantAwareModel, SoftDeleteModel):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="brands")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    supporter_phone_number = models.CharField(max_length=32, blank=True, default="")
    is_active = models.BooleanField(default=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+",
    )

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


class Product(TenantAwareModel, SoftDeleteModel):
    """Pricing lives here, not on SKU/StockUnit: `purchase_price`,
    `cost_price`, and `selling_price` are the single place a shop enters
    prices. SKU.sell_price / StockUnit.purchase_cost still exist (checkout
    and profit reports read them), but they're auto-filled from these
    fields whenever a client doesn't supply its own value explicitly —
    see SKUSerializer / BulkIntakeSerializer."""

    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="products")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    model_number = models.CharField(max_length=100, blank=True, default="")
    product_code = models.CharField(max_length=100, blank=True, default="")
    barcode = models.CharField(max_length=100, blank=True, default="")
    qr_code = models.CharField(max_length=255, blank=True, default="")

    warranty_required = models.BooleanField(default=False)
    warranty_period = models.PositiveIntegerField(null=True, blank=True, help_text="Months")
    warranty_terms = models.TextField(blank=True, default="")

    minimum_stock = models.PositiveIntegerField(null=True, blank=True)
    maximum_stock = models.PositiveIntegerField(null=True, blank=True)
    product_color = models.CharField(max_length=50, blank=True, default="")

    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    profit_margin = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        unique_together = ("tenant", "name")
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(purchase_price__isnull=True) | models.Q(purchase_price__gte=0),
                name="product_purchase_price_non_negative",
            ),
            models.CheckConstraint(
                check=models.Q(cost_price__isnull=True) | models.Q(cost_price__gte=0),
                name="product_cost_price_non_negative",
            ),
            models.CheckConstraint(
                check=models.Q(selling_price__isnull=True) | models.Q(selling_price__gte=0),
                name="product_selling_price_non_negative",
            ),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.selling_price is not None and self.cost_price is not None:
            self.profit_margin = self.selling_price - self.cost_price
        else:
            self.profit_margin = None
        super().save(*args, **kwargs)


class SKU(TenantAwareModel):
    """The sellable variant. Carries the sell price (PRD 2.3) — normally
    inherited from Product.selling_price at creation time; see
    SKUSerializer."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="skus")
    variant_name = models.CharField(max_length=255)
    sell_price = models.DecimalField(max_digits=12, decimal_places=2)
    attributes = models.JSONField(default=dict, blank=True)  # {"color": "...", "storage": "..."}

    class Meta:
        unique_together = ("product", "variant_name")
        verbose_name = "SKU"
        verbose_name_plural = "SKUs"
        ordering = ["product__name", "variant_name"]
        constraints = [
            models.CheckConstraint(check=models.Q(sell_price__gt=0), name="sku_sell_price_positive"),
        ]

    def __str__(self):
        return f"{self.product.name} — {self.variant_name}"


class StockUnit(TenantAwareModel):
    """One physical unit. Carries IMEI, condition, purchase cost (PRD 2.3) —
    purchase_cost is normally inherited from Product.purchase_price at
    intake time; see BulkIntakeSerializer."""

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
        constraints = [
            models.CheckConstraint(check=models.Q(purchase_cost__gt=0), name="stockunit_purchase_cost_positive"),
        ]

    def __str__(self):
        return f"{self.sku} [{self.imei_serial}]"


class StockWarranty(TenantAwareModel, SoftDeleteModel):
    """A structured warranty policy attached to a physical stock unit —
    richer than StockUnit.warranty_expiry (a bare date). A unit can carry
    more than one of these over time (e.g. original + a later extended
    warranty purchase)."""

    WARRANTY_MANUFACTURER = "manufacturer"
    WARRANTY_EXTENDED = "extended"
    WARRANTY_TYPE_CHOICES = [
        (WARRANTY_MANUFACTURER, "Manufacturer"),
        (WARRANTY_EXTENDED, "Extended"),
    ]

    stock_unit = models.ForeignKey(StockUnit, on_delete=models.CASCADE, related_name="warranties")
    warrant_id = models.CharField(max_length=64, blank=True, default="")
    warranty_type = models.CharField(
        max_length=20, choices=WARRANTY_TYPE_CHOICES, default=WARRANTY_MANUFACTURER
    )
    duration_months = models.PositiveIntegerField(null=True, blank=True)
    coverage = models.TextField(blank=True, default="")
    terms = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        verbose_name_plural = "stock warranties"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.warranty_type} warranty for {self.stock_unit.imei_serial}"

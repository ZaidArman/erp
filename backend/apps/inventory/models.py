"""Inventory hierarchy: Category -> Brand -> Product -> SKU -> StockUnit
(PRD section 3.2)."""
from django.db import models

from apps.core.models import TenantAwareModel


class Category(TenantAwareModel):
    """`attribute_schema` defines the custom SKU-level fields this category's
    products should capture (e.g. Mobiles: storage/RAM, AC: tonnage,
    Fridge: capacity in liters) — [{"key": "tonnage", "label": "Tonnage",
    "type": "text"}, ...]."""

    name = models.CharField(max_length=255)
    attribute_schema = models.JSONField(default=list, blank=True)
    # These fields will be added
    # description # Category detail (e.g. Electronics, Home Appliances, etc.)
    # is_active
    # created_by # Who created this into the app (EMployee or Admin / Inserted by)
    # updated_by # Who updated this into the app (EMployee or Admin / updated by)
    # deleted_at # When this category was deleted (soft delete)
    # deleted_by # Who deleted this category (soft delete)


    class Meta:
        unique_together = ("tenant", "name")
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Brand(TenantAwareModel):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="brands")
    name = models.CharField(max_length=255)
    # These fields will be added
    # description
    # supporter_phone_number 
    # is_active
    # created_by # Who created this into the app (EMployee or Admin / Inserted by)
    # updated_by # Who updated this into the app (EMployee or Admin / updated by)
    # deleted_at # When this brand was deleted (soft delete)
    # Deleted_by # Who deleted this brand (soft delete)

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

    # These fields will be added
    # model_number # Product model number (i.e. iPhone 14, Samsung AC 1.5 Ton, LG Fridge 260L)
    # product_code # product Internal Code (i.e. Phone001, AC001, Fridge001)
    # barcode # product barcode (i.e. 1234567890123)
    # qr_code # product QR code (i.e. https://example.com/product/1234567890123)
    # warranty_required # Whether the product requires warranty (i.e. True/False)
    # warranty_period # Warranty period in months (i.e. 12, 24, 36)
    # warranty_terms # Warranty terms and conditions (i.e. "1 year warranty for manufacturing defects only")
    # current_stock # How much units do you have in the stock(shop)
    # minimum_stock # Minimum stock level for this product (i.e. 10, 20, 30)
    # maximum_stock # Maximum stock level for this product (i.e. 100, 200, 300)
    # product_color # Product color (i.e. Black, White, Silver, Gold)
    # purchase_price # how much did you buy this product for (i.e. 1000, 2000, 3000)
    # cost_price # how much does it cost to make this product (i.e. 800, 1800, 2800)
    # selling_price # how much are you selling this product for (i.e. 1800, 3800, 5800)
    # profit_margin # how much profit are you making on this product (i.e. 800, 1800, 2800)
    # is_active # Whether the product is active (i.e. True/False)
    # created_by # Who created this into the app (EMployee or Admin / Inserted by)
    # updated_by # Who updated this into the app (EMployee or Admin / updated by)
    # deleted_at # When this product was deleted (soft delete)
    # deleted_by # Who deleted this product (soft delete)

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


# Stock Warranty details
# class StockWarranty(TenantAwareModel):
    # warrant_id # Unique warranty ID for the stock unit in the tanent
    # warranty_type # Warranty type (i.e. Manufacturer, Extended, etc.)
    # duration_months # Warranty duration in months
    # coverage # Warranty coverage details (i.e. Parts, Labor, etc.)
    # terms # Warranty terms and conditions (i.e. "1 year warranty for manufacturing defects only")
    # is_active # Whether the product is active (i.e. True/False)
    # created_by # Who created this into the app (EMployee or Admin / Inserted by)
    # updated_by # Who updated this into the app (EMployee or Admin / updated by)
    # deleted_at # When this product was deleted (soft delete)
    # deleted_by # Who deleted this product (soft delete)
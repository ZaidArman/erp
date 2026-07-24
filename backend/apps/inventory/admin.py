from django.contrib import admin

from .models import SKU, Brand, Category, Product, StockUnit, Supplier, SupplierCatalogItem

for model in (Category, Brand, Supplier, SupplierCatalogItem):
    admin.site.register(model)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "tenant", "category", "brand")
    list_filter = ("tenant", "category")


@admin.register(SKU)
class SKUAdmin(admin.ModelAdmin):
    list_display = ("variant_name", "product", "sell_price", "tenant")
    list_filter = ("tenant",)


@admin.register(StockUnit)
class StockUnitAdmin(admin.ModelAdmin):
    list_display = ("imei_serial", "sku", "branch", "condition", "purchase_cost", "is_sold", "tenant")
    list_filter = ("tenant", "branch", "condition", "is_sold")
    search_fields = ("imei_serial",)

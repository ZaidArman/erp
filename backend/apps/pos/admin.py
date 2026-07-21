from django.contrib import admin

from .models import Receipt, ReceiptCounter, Sale, SaleItem


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ("stock_unit", "sell_price_at_sale")


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("id", "tenant", "branch", "sold_by", "total_amount", "created_at")
    list_filter = ("tenant", "branch")
    inlines = [SaleItemInline]


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("receipt_number", "sale", "printed_at")


admin.site.register(ReceiptCounter)

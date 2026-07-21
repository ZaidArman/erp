from django.contrib import admin

from .models import Branch, Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "subdomain", "is_active", "max_branches", "max_employees", "created_at")
    search_fields = ("name", "subdomain")
    list_filter = ("is_active",)
    prepopulated_fields = {"subdomain": ("name",)}


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("name", "tenant", "is_active")
    list_filter = ("tenant",)

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/tenants/", include("apps.tenants.urls")),
    path("api/inventory/", include("apps.inventory.urls")),
    path("api/pos/", include("apps.pos.urls")),
    path("api/finance/", include("apps.finance.urls")),
]

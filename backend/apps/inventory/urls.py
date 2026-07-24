from rest_framework.routers import DefaultRouter

from .views import (
    BrandViewSet,
    CategoryViewSet,
    ProductReportViewSet,
    ProductViewSet,
    SKUViewSet,
    StockUnitViewSet,
    StockWarrantyViewSet,
    SupplierCatalogItemViewSet,
    SupplierViewSet,
)

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("brands", BrandViewSet, basename="brand")
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("supplier-catalog-items", SupplierCatalogItemViewSet, basename="supplier-catalog-item")
router.register("products", ProductViewSet, basename="product")
router.register("skus", SKUViewSet, basename="sku")
router.register("stock-units", StockUnitViewSet, basename="stockunit")
router.register("stock-warranties", StockWarrantyViewSet, basename="stockwarranty")
router.register("product-report", ProductReportViewSet, basename="product-report")

urlpatterns = router.urls

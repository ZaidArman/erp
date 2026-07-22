from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasEmployeePermission, IsAdminOrReadOnlyEmployee
from apps.core.audit import log_action
from apps.core.models import AuditLog
from apps.core.viewsets import TenantAwareViewSet

from .models import SKU, Brand, Category, Product, StockUnit, Supplier
from .serializers import (
    BrandSerializer,
    BulkIntakeSerializer,
    CategorySerializer,
    ProductReportSerializer,
    ProductSerializer,
    SKUSerializer,
    StockUnitSerializer,
    SupplierSerializer,
)

MANAGE_INVENTORY = HasEmployeePermission("can_manage_inventory")


class CategoryViewSet(TenantAwareViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [MANAGE_INVENTORY]


class BrandViewSet(TenantAwareViewSet):
    queryset = Brand.objects.select_related("category")
    serializer_class = BrandSerializer
    permission_classes = [MANAGE_INVENTORY]

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        return qs


class SupplierViewSet(TenantAwareViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [MANAGE_INVENTORY]


class ProductViewSet(TenantAwareViewSet):
    queryset = Product.objects.select_related("category", "brand")
    serializer_class = ProductSerializer
    permission_classes = [MANAGE_INVENTORY]

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category")
        brand = self.request.query_params.get("brand")
        search = self.request.query_params.get("search")
        if category:
            qs = qs.filter(category_id=category)
        if brand:
            qs = qs.filter(brand_id=brand)
        if search:
            qs = qs.filter(name__icontains=search)
        return qs


class SKUViewSet(TenantAwareViewSet):
    queryset = SKU.objects.select_related("product")
    serializer_class = SKUSerializer

    def get_permissions(self):
        # Reads open to all shop members (POS cashiers need prices; matches
        # the matrix row "View stock levels"). Writes need the inventory flag.
        if self.action in ("list", "retrieve"):
            return [IsAdminOrReadOnlyEmployee()]
        return [MANAGE_INVENTORY()]

    def get_queryset(self):
        qs = super().get_queryset()
        product = self.request.query_params.get("product")
        if product:
            qs = qs.filter(product_id=product)
        return qs


class StockUnitViewSet(TenantAwareViewSet):
    """Stock views: filter by branch / condition / sold status; exact IMEI
    search; bulk intake (PRD phase 2, tasks 4-5).

    Reads are open to all shop members (matrix: View stock levels — Employee
    Yes); writes require can_manage_inventory.
    """

    queryset = StockUnit.objects.select_related(
        "sku__product__brand", "branch", "supplier"
    )
    serializer_class = StockUnitSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAdminOrReadOnlyEmployee()]
        return [MANAGE_INVENTORY()]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("branch"):
            qs = qs.filter(branch_id=params["branch"])
        if params.get("sku"):
            qs = qs.filter(sku_id=params["sku"])
        if params.get("condition"):
            qs = qs.filter(condition=params["condition"])
        if params.get("is_sold") in ("true", "false"):
            qs = qs.filter(is_sold=params["is_sold"] == "true")
        if params.get("imei"):
            qs = qs.filter(imei_serial=params["imei"])  # exact-match IMEI search
        return qs

    @action(detail=False, methods=["post"], url_path="bulk-intake")
    def bulk_intake(self, request):
        serializer = BulkIntakeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        tenant = self.get_tenant()

        existing = StockUnit.objects.filter(
            tenant=tenant, imei_serial__in=data["imeis"]
        ).values_list("imei_serial", flat=True)
        if existing:
            raise drf_serializers.ValidationError(
                {"imeis": [f"IMEI already exists in this shop: {', '.join(existing)}"]}
            )

        try:
            with transaction.atomic():
                units = StockUnit.objects.bulk_create(
                    [
                        StockUnit(
                            tenant=tenant,
                            sku=data["sku"],
                            branch=data["branch"],
                            supplier=data.get("supplier"),
                            condition=data["condition"],
                            purchase_cost=data["purchase_cost"],
                            warranty_expiry=data.get("warranty_expiry"),
                            imei_serial=imei,
                        )
                        for imei in data["imeis"]
                    ]
                )
        except IntegrityError:
            raise drf_serializers.ValidationError(
                {"imeis": ["One or more IMEIs already exist in this shop."]}
            )

        for unit in units:
            log_action(request, "create", unit, {"after": {"imei_serial": unit.imei_serial}})

        return Response(
            StockUnitSerializer(units, many=True).data, status=status.HTTP_201_CREATED
        )


class ProductReportViewSet(TenantAwareViewSet):
    """Read-only, flattened Category -> Brand -> Product -> SKU -> StockUnit
    report for the Products page (full-hierarchy table + column search +
    CSV export)."""

    http_method_names = ["get"]
    queryset = StockUnit.objects.select_related(
        "sku__product__brand", "sku__product__category", "branch", "supplier"
    )
    serializer_class = ProductReportSerializer
    permission_classes = [IsAdminOrReadOnlyEmployee]
    audit = False

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(sku__product__name__icontains=search)
                | Q(sku__product__category__name__icontains=search)
                | Q(sku__product__brand__name__icontains=search)
                | Q(imei_serial__icontains=search)
            )
        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        rows = list(self.filter_queryset(self.get_queryset())) if self.action in ("list",) else []
        context["audit_by_object_id"] = self._audit_cache(rows)
        return context

    def _audit_cache(self, rows):
        ids = [str(r.id) for r in rows]
        if not ids:
            return {}
        logs = (
            AuditLog.objects.filter(
                tenant=self.get_tenant(), model_name="StockUnit", object_id__in=ids
            )
            .select_related("user")
            .order_by("-timestamp")
        )
        cache = {}
        for log in logs:
            cache.setdefault(log.object_id, []).append(log)
        return cache

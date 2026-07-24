from django.db import IntegrityError, transaction
from django.db.models import CharField, Q
from django.db.models.functions import Cast
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasEmployeePermission, IsAdminOrReadOnlyEmployee
from apps.core.audit import audit_name_subquery, log_action
from apps.core.pagination import StandardPagination
from apps.core.viewsets import TenantAwareViewSet

from .models import (
    SKU,
    Brand,
    Category,
    Product,
    StockUnit,
    StockWarranty,
    Supplier,
    SupplierCatalogItem,
)
from .serializers import (
    BrandSerializer,
    BulkIntakeSerializer,
    CategorySerializer,
    ProductReportSerializer,
    ProductSerializer,
    SKUSerializer,
    StockUnitSerializer,
    StockWarrantySerializer,
    SupplierCatalogItemSerializer,
    SupplierSerializer,
)

MANAGE_INVENTORY = HasEmployeePermission("can_manage_inventory")


class CategoryViewSet(TenantAwareViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [MANAGE_INVENTORY]

    def get_queryset(self):
        return super().get_queryset().annotate(
            created_by_name=audit_name_subquery("Category", action_filter="create"),
            updated_by_name=audit_name_subquery("Category"),
        )


class BrandViewSet(TenantAwareViewSet):
    queryset = Brand.objects.select_related("category")
    serializer_class = BrandSerializer
    permission_classes = [MANAGE_INVENTORY]

    def get_queryset(self):
        qs = super().get_queryset().annotate(
            created_by_name=audit_name_subquery("Brand", action_filter="create"),
            updated_by_name=audit_name_subquery("Brand"),
        )
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        return qs


class SupplierViewSet(TenantAwareViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [MANAGE_INVENTORY]

    def get_queryset(self):
        return super().get_queryset().annotate(
            created_by_name=audit_name_subquery("Supplier", action_filter="create"),
            updated_by_name=audit_name_subquery("Supplier"),
        )


class SupplierCatalogItemViewSet(TenantAwareViewSet):
    queryset = SupplierCatalogItem.objects.select_related(
        "supplier", "product__brand", "product__category"
    )
    serializer_class = SupplierCatalogItemSerializer
    permission_classes = [MANAGE_INVENTORY]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("supplier"):
            qs = qs.filter(supplier_id=params["supplier"])
        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(product__name__icontains=search)
                | Q(product__product_code__icontains=search)
                | Q(product__brand__name__icontains=search)
            )
        return qs

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        tenant = self.get_tenant()
        supplier_id = request.data.get("supplier")
        items = request.data.get("items", [])
        supplier = Supplier.objects.filter(tenant=tenant, id=supplier_id).first()
        if not supplier:
            raise drf_serializers.ValidationError({"supplier": "Select a valid supplier."})

        created, skipped = [], []
        for row in items:
            serializer = SupplierCatalogItemSerializer(
                data={**row, "supplier": supplier.id}, context={"request": request}
            )
            if not serializer.is_valid():
                skipped.append({"product": row.get("product"), "errors": serializer.errors})
                continue
            try:
                with transaction.atomic():
                    instance = serializer.save(tenant=tenant)
            except IntegrityError:
                skipped.append({"product": row.get("product"), "errors": "Already in this supplier's catalog."})
                continue
            log_action(request, "create", instance, {"after": {"product_id": instance.product_id}})
            created.append(SupplierCatalogItemSerializer(instance).data)

        return Response(
            {"created": created, "skipped": skipped}, status=status.HTTP_201_CREATED
        )


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

        purchase_cost = data.get("purchase_cost")
        if purchase_cost is None:
            purchase_cost = data["sku"].product.purchase_price
            if purchase_cost is None:
                raise drf_serializers.ValidationError(
                    {"purchase_cost": "Set a purchase price on the product first, or provide one here."}
                )

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
                            purchase_cost=purchase_cost,
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


class StockWarrantyViewSet(TenantAwareViewSet):
    queryset = StockWarranty.objects.select_related("stock_unit")
    serializer_class = StockWarrantySerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAdminOrReadOnlyEmployee()]
        return [MANAGE_INVENTORY()]

    def get_queryset(self):
        qs = super().get_queryset()
        stock_unit = self.request.query_params.get("stock_unit")
        if stock_unit:
            qs = qs.filter(stock_unit_id=stock_unit)
        return qs


class ProductReportPagination(StandardPagination):
    page_size = 20


class ProductReportViewSet(TenantAwareViewSet):
    """Read-only, flattened Category -> Brand -> Product -> SKU -> StockUnit
    report for the Products page (full-hierarchy table + column search +
    CSV export). Pagination, global search, and per-column filtering all
    happen in the database — the frontend only ever holds one page at a
    time (PAGE_SIZE = 20)."""

    http_method_names = ["get"]
    queryset = StockUnit.objects.select_related(
        "sku__product__brand", "sku__product__category", "branch", "supplier"
    )
    serializer_class = ProductReportSerializer
    permission_classes = [IsAdminOrReadOnlyEmployee]
    pagination_class = ProductReportPagination
    audit = False

    # column key (as used by the frontend) -> ORM lookup path for icontains
    TEXT_COLUMN_LOOKUPS = {
        "product_name": "sku__product__name",
        "category_name": "sku__product__category__name",
        "brand_name": "sku__product__brand__name",
        "imei_serial": "imei_serial",
        "branch_name": "branch__name",
        "condition": "condition",
        "model_number": "sku__product__model_number",
        "product_code": "sku__product__product_code",
        "barcode": "sku__product__barcode",
        "product_color": "sku__product__product_color",
    }

    def get_queryset(self):
        qs = super().get_queryset().annotate(
            created_by_name=audit_name_subquery("StockUnit", "pk", action_filter="create"),
            updated_by_name=audit_name_subquery("StockUnit", "pk"),
            product_updated_by_name=audit_name_subquery("Product", "sku__product_id"),
        )
        # Deleted products stay in the DB (soft delete keeps the audit trail),
        # but they don't belong in the everyday Products report.
        qs = qs.filter(sku__product__deleted_at__isnull=True)
        params = self.request.query_params

        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(sku__product__name__icontains=search)
                | Q(sku__product__category__name__icontains=search)
                | Q(sku__product__brand__name__icontains=search)
                | Q(imei_serial__icontains=search)
                | Q(branch__name__icontains=search)
                | Q(created_by_name__icontains=search)
                | Q(updated_by_name__icontains=search)
            )

        for column, lookup in self.TEXT_COLUMN_LOOKUPS.items():
            value = params.get(column)
            if value:
                qs = qs.filter(**{f"{lookup}__icontains": value})

        for column in ("created_by_name", "updated_by_name"):
            value = params.get(column)
            if value:
                qs = qs.filter(**{f"{column}__icontains": value})

        product_id = params.get("product_id")
        if product_id:
            qs = qs.filter(sku__product_id=product_id)

        for column, field in (("sell_price", "sku__sell_price"), ("purchase_cost", "purchase_cost")):
            value = params.get(column)
            if value:
                qs = qs.annotate(**{f"{column}_text": Cast(field, output_field=CharField())}).filter(
                    **{f"{column}_text__icontains": value}
                )

        return qs

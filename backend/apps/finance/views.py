"""Finance & reports (Phase 4). Read-only: this app owns no tables — it
aggregates from pos and inventory (PRD section 5.2).

Formulas (PRD section 3.4):
  Revenue      = SUM(Sale.total_amount) in period
  COGS         = SUM(StockUnit.purchase_cost) of units sold in period
  Gross Profit = Revenue - COGS
Period boundaries use the tenant timezone (settings.TIME_ZONE).
"""
import csv
from datetime import datetime, time, timedelta

from django.db.models import Count, DecimalField, F, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import HasEmployeePermission
from apps.inventory.models import StockUnit
from apps.pos.models import Sale, SaleItem

DEC = DecimalField(max_digits=14, decimal_places=2)


def _money(value):
    """Normalize DB aggregates (Decimal on Postgres, float on SQLite) to a
    consistent '1234.00' string, matching DRF's decimal rendering."""
    from decimal import Decimal
    return f"{Decimal(str(value or 0)):.2f}"
ZERO = Value(0, output_field=DEC)

CanViewFinance = HasEmployeePermission("can_view_finance")
CanViewReports = HasEmployeePermission("can_view_reports")


def _tenant(request):
    tenant = getattr(request, "tenant", None)
    if tenant is None:
        raise PermissionDenied("No shop context.")
    return tenant


def _period_range(request):
    """Resolve ?period=today|week|month|custom into aware [start, end).
    'week' starts Monday; 'custom' needs ?start=YYYY-MM-DD&end=YYYY-MM-DD
    (end date inclusive)."""
    period = request.query_params.get("period", "today")
    now = timezone.localtime()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if period == "today":
        start, end = today_start, today_start + timedelta(days=1)
    elif period == "week":
        start = today_start - timedelta(days=today_start.weekday())
        end = start + timedelta(days=7)
    elif period == "month":
        start = today_start.replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1)
    elif period == "custom":
        try:
            start_date = datetime.strptime(request.query_params["start"], "%Y-%m-%d").date()
            end_date = datetime.strptime(request.query_params["end"], "%Y-%m-%d").date()
        except (KeyError, ValueError):
            raise ValidationError({"detail": "custom period needs start and end as YYYY-MM-DD"})
        tz = timezone.get_current_timezone()
        start = timezone.make_aware(datetime.combine(start_date, time.min), tz)
        end = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min), tz)
    else:
        raise ValidationError({"detail": "period must be today, week, month, or custom"})
    return start, end


def _sales_qs(request, start, end):
    qs = Sale.objects.filter(tenant=_tenant(request), created_at__gte=start, created_at__lt=end)
    branch = request.query_params.get("branch")
    if branch:
        qs = qs.filter(branch_id=branch)
    return qs


def _items_qs(request, start, end):
    qs = SaleItem.objects.filter(
        sale__tenant=_tenant(request), sale__created_at__gte=start, sale__created_at__lt=end
    )
    branch = request.query_params.get("branch")
    if branch:
        qs = qs.filter(sale__branch_id=branch)
    return qs


@api_view(["GET"])
@permission_classes([CanViewFinance])
def summary(request):
    start, end = _period_range(request)
    revenue = _sales_qs(request, start, end).aggregate(v=Coalesce(Sum("total_amount"), ZERO))["v"]
    cogs = _items_qs(request, start, end).aggregate(
        v=Coalesce(Sum("stock_unit__purchase_cost"), ZERO)
    )["v"]
    sales_count = _sales_qs(request, start, end).count()
    units_sold = _items_qs(request, start, end).count()
    return Response(
        {
            "start": start.date(),
            "end": (end - timedelta(days=1)).date(),
            "revenue": _money(revenue),
            "cogs": _money(cogs),
            "gross_profit": _money(revenue - cogs),
            "sales_count": sales_count,
            "units_sold": units_sold,
        }
    )


@api_view(["GET"])
@permission_classes([CanViewFinance])
def sales_over_time(request):
    start, end = _period_range(request)
    rows = (
        _sales_qs(request, start, end)
        .annotate(day=TruncDate("created_at", tzinfo=timezone.get_current_timezone()))
        .values("day")
        .annotate(revenue=Coalesce(Sum("total_amount"), ZERO), sales=Count("id"))
        .order_by("day")
    )
    return Response(
        [{**row, "revenue": _money(row["revenue"])} for row in rows]
    )


@api_view(["GET"])
@permission_classes([CanViewFinance])
def top_products(request):
    start, end = _period_range(request)
    rows = (
        _items_qs(request, start, end)
        .values(product=F("stock_unit__sku__product__name"))
        .annotate(
            units=Count("id"),
            revenue=Coalesce(Sum("sell_price_at_sale"), ZERO),
            cogs=Coalesce(Sum("stock_unit__purchase_cost"), ZERO),
        )
        .annotate(profit=F("revenue") - F("cogs"))
        .order_by("-units")[:10]
    )
    return Response(
        [
            {**row, "revenue": _money(row["revenue"]), "cogs": _money(row["cogs"]),
             "profit": _money(row["profit"])}
            for row in rows
        ]
    )


@api_view(["GET"])
@permission_classes([CanViewFinance])
def stock_value(request):
    """Current stock value = sum of purchase_cost of UNSOLD units,
    per branch and per category (PRD phase 4, task 4)."""
    unsold = StockUnit.objects.filter(tenant=_tenant(request), is_sold=False)
    total = unsold.aggregate(v=Coalesce(Sum("purchase_cost"), ZERO))["v"]
    per_branch = list(
        unsold.values(branch_name=F("branch__name"))
        .annotate(units=Count("id"), value=Coalesce(Sum("purchase_cost"), ZERO))
        .order_by("-value")
    )
    per_category = list(
        unsold.values(category=F("sku__product__category__name"))
        .annotate(units=Count("id"), value=Coalesce(Sum("purchase_cost"), ZERO))
        .order_by("-value")
    )
    per_branch = [{**r, "value": _money(r["value"])} for r in per_branch]
    per_category = [{**r, "value": _money(r["value"])} for r in per_category]
    return Response(
        {"total_value": _money(total), "per_branch": per_branch, "per_category": per_category}
    )


@api_view(["GET"])
@permission_classes([CanViewReports])
def sales_report_csv(request):
    """Synchronous CSV export (PRD: Celery deferred post-MVP). One row per
    sold unit, with a totals row — matches the on-screen report."""
    start, end = _period_range(request)
    items = (
        _items_qs(request, start, end)
        .select_related("sale__branch", "sale__sold_by", "sale__receipt", "stock_unit__sku__product")
        .order_by("sale__created_at")
    )

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="sales-report.csv"'
    writer = csv.writer(response)
    writer.writerow(
        ["Date", "Receipt", "Branch", "Seller", "Product", "Variant",
         "IMEI/Serial", "Sell price", "Purchase cost", "Profit"]
    )

    total_revenue = total_cost = 0
    for item in items:
        sale = item.sale
        profit = item.sell_price_at_sale - item.stock_unit.purchase_cost
        total_revenue += item.sell_price_at_sale
        total_cost += item.stock_unit.purchase_cost
        writer.writerow(
            [
                timezone.localtime(sale.created_at).strftime("%Y-%m-%d %H:%M"),
                getattr(sale.receipt, "receipt_number", ""),
                sale.branch.name,
                sale.sold_by.full_name or sale.sold_by.email,
                item.stock_unit.sku.product.name,
                item.stock_unit.sku.variant_name,
                item.stock_unit.imei_serial,
                _money(item.sell_price_at_sale),
                _money(item.stock_unit.purchase_cost),
                _money(profit),
            ]
        )
    writer.writerow([])
    writer.writerow(["TOTALS", "", "", "", "", "", "", _money(total_revenue),
                     _money(total_cost), _money(total_revenue - total_cost)])
    return response

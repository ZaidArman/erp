"""POS endpoints: atomic checkout with row locking, role-aware sales history.

The checkout transaction is the double-sell guarantee (PRD section 9.6):
StockUnits are locked with select_for_update, so two simultaneous checkouts
for the same unit cannot both succeed — the loser gets a clean 409.
"""
from django.db import models, transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import HasEmployeePermission
from apps.core.audit import log_action
from apps.core.viewsets import TenantScopedMixin
from apps.inventory.models import StockUnit

from .models import Receipt, ReceiptCounter, Sale, SaleItem
from .serializers import CheckoutSerializer, RecordPaymentSerializer, SaleSerializer


class UnitConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "One or more units were just sold by someone else."
    default_code = "unit_conflict"


class IsShopMember(BasePermission):
    """Any authenticated member of this shop (admin or employee)."""

    def has_permission(self, request, view):
        u = request.user
        tenant = getattr(request, "tenant", None)
        return bool(
            u and u.is_authenticated and tenant is not None
            and u.tenant_id == tenant.id
            and u.role in (User.ROLE_ADMIN, User.ROLE_EMPLOYEE)
        )


class SaleViewSet(TenantScopedMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Sales history (read-only) + the checkout action.

    Matrix rows enforced here:
    - Use POS: admin always; employee only with can_use_pos.
    - View own sales history: employee yes (their own sales only).
    - View all branch sales history: admin only.
    """

    serializer_class = SaleSerializer

    def get_permissions(self):
        if self.action == "checkout":
            return [HasEmployeePermission("can_use_pos")()]
        # list/retrieve/mark-printed: any shop member; the queryset itself
        # restricts employees to their own sales (matrix rows).
        return [IsShopMember()]

    def get_queryset(self):
        tenant = self.get_tenant()
        qs = (
            Sale.objects.filter(tenant=tenant)
            .select_related("branch", "sold_by", "receipt")
            .prefetch_related("items__stock_unit__sku__product")
        )
        user = self.request.user
        if user.role == User.ROLE_EMPLOYEE:
            qs = qs.filter(sold_by=user)  # employees see only their own sales

        params = self.request.query_params
        if params.get("branch") and user.role == User.ROLE_ADMIN:
            qs = qs.filter(branch_id=params["branch"])
        if params.get("date_from"):
            qs = qs.filter(created_at__date__gte=params["date_from"])
        if params.get("date_to"):
            qs = qs.filter(created_at__date__lte=params["date_to"])
        if params.get("seller") and user.role == User.ROLE_ADMIN:
            qs = qs.filter(sold_by_id=params["seller"])
        if params.get("payment_method"):
            qs = qs.filter(payment_method=params["payment_method"])
        if params.get("outstanding") == "true":
            qs = qs.filter(payment_method=Sale.PAYMENT_CREDIT, amount_paid__lt=models.F("total_amount"))
        return qs

    @action(detail=False, methods=["post"])
    def checkout(self, request):
        serializer = CheckoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        tenant = self.get_tenant()
        branch = data["branch"]
        unit_ids = data["stock_unit_ids"]

        # Employees sell from their own branch only.
        if request.user.role == User.ROLE_EMPLOYEE and request.user.branch_id:
            if branch.id != request.user.branch_id:
                raise PermissionDenied("You can only sell from your own branch.")

        with transaction.atomic():
            # THE double-sell lock: rows are locked until commit.
            units = list(
                StockUnit.objects.select_for_update()
                .select_related("sku")
                .filter(tenant=tenant, id__in=unit_ids)
            )

            if len(units) != len(unit_ids):
                found = {u.id for u in units}
                missing = [str(i) for i in unit_ids if i not in found]
                raise ValidationError(
                    {"detail": f"Unit(s) not found in this shop: {', '.join(missing)}"}
                )

            already_sold = [u.imei_serial for u in units if u.is_sold]
            if already_sold:
                raise UnitConflict(f"Already sold: {', '.join(already_sold)}")

            wrong_branch = [u.imei_serial for u in units if u.branch_id != branch.id]
            if wrong_branch:
                raise ValidationError(
                    {"detail": f"Unit(s) belong to another branch: {', '.join(wrong_branch)}"}
                )

            # Server-side total from live SKU prices, snapshotted per item.
            total = sum(u.sku.sell_price for u in units)

            payment_method = data.get("payment_method", Sale.PAYMENT_CASH)
            if payment_method == Sale.PAYMENT_CREDIT:
                amount_paid = data.get("amount_paid") or 0
                if amount_paid > total:
                    raise ValidationError({"amount_paid": "Cannot exceed the sale total."})
            else:
                amount_paid = total  # cash is always paid in full

            sale = Sale.objects.create(
                tenant=tenant,
                branch=branch,
                sold_by=request.user,
                customer_name=data.get("customer_name", ""),
                customer_phone=data.get("customer_phone", ""),
                payment_method=payment_method,
                total_amount=total,
                amount_paid=amount_paid,
            )
            SaleItem.objects.bulk_create(
                [
                    SaleItem(sale=sale, stock_unit=u, sell_price_at_sale=u.sku.sell_price)
                    for u in units
                ]
            )
            StockUnit.objects.filter(id__in=[u.id for u in units]).update(is_sold=True)

            # Sequential receipt number per tenant, race-free under the lock.
            counter, _ = ReceiptCounter.objects.select_for_update().get_or_create(tenant=tenant)
            counter.value += 1
            counter.save(update_fields=["value"])
            receipt = Receipt.objects.create(sale=sale, receipt_number=f"{counter.value:04d}")

            log_action(
                request,
                "create",
                sale,
                {
                    "after": {
                        "receipt": receipt.receipt_number,
                        "total": str(total),
                        "imeis": [u.imei_serial for u in units],
                    }
                },
            )

        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="mark-printed")
    def mark_printed(self, request, pk=None):
        sale = self.get_object()
        receipt = sale.receipt
        receipt.printed_at = timezone.now()
        receipt.save(update_fields=["printed_at"])
        return Response({"printed_at": receipt.printed_at})

    @action(detail=True, methods=["post"], url_path="record-payment")
    def record_payment(self, request, pk=None):
        """Settle part or all of an outstanding credit sale's balance."""
        sale = self.get_object()
        serializer = RecordPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]

        with transaction.atomic():
            locked = Sale.objects.select_for_update().get(pk=sale.pk)
            balance = locked.total_amount - locked.amount_paid
            if amount > balance:
                raise ValidationError({"amount": f"Exceeds the remaining balance of {balance}."})
            locked.amount_paid += amount
            locked.save(update_fields=["amount_paid"])
            log_action(
                request, "update", locked,
                {"after": {"payment_recorded": str(amount), "new_amount_paid": str(locked.amount_paid)}},
            )

        return Response(SaleSerializer(locked).data)




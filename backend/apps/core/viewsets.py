"""TenantAwareViewSet: the single place tenant filtering happens.

No view in this project ever filters by tenant manually — inherit this
and isolation is guaranteed (PRD section 2.3, leak prevention).
"""
from django.db import IntegrityError, transaction
from django.db.models import UniqueConstraint
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError

from .audit import log_action


class TenantScopedMixin:
    """Just the tenant lookup, for views that aren't a full ModelViewSet
    (e.g. a GenericViewSet with custom actions) but still need to resolve
    `request.tenant` consistently with everything else in the app."""

    def get_tenant(self):
        tenant = getattr(self.request, "tenant", None)
        if tenant is None:
            raise PermissionDenied("No shop context. Use your shop subdomain.")
        return tenant


class TenantAwareViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    audit = True  # set False on viewsets that should not write audit rows

    def get_queryset(self):
        return super().get_queryset().filter(tenant=self.get_tenant())

    def perform_create(self, serializer):
        # tenant is injected here (not in the serializer), so unique_together
        # constraints involving it can't be caught by DRF's validators up
        # front — turn the resulting DB IntegrityError into a clean 400.
        # Wrapped in its own savepoint: without one, Postgres marks the whole
        # outer transaction broken after the IntegrityError, so any query run
        # later in the same request/test would fail with
        # TransactionManagementError even though we "handled" the error here.
        try:
            with transaction.atomic():
                instance = serializer.save(tenant=self.get_tenant())
        except IntegrityError:
            raise ValidationError(_conflict_error(serializer, self.get_tenant()))
        if self.audit:
            log_action(self.request, "create", instance, {"after": _snapshot(instance)})

    def perform_update(self, serializer):
        before = _snapshot(serializer.instance)
        try:
            with transaction.atomic():
                instance = serializer.save(tenant=self.get_tenant())
        except IntegrityError:
            raise ValidationError(_conflict_error(serializer, self.get_tenant()))
        if self.audit:
            log_action(
                self.request,
                "update",
                instance,
                {"before": before, "after": _snapshot(instance)},
            )

    def perform_destroy(self, instance):
        if self.audit:
            log_action(self.request, "delete", instance, {"before": _snapshot(instance)})
        if hasattr(instance, "soft_delete"):
            if hasattr(instance, "deleted_by_id"):
                user = getattr(self.request, "user", None)
                instance.deleted_by = user if user and user.is_authenticated else None
            instance.soft_delete()
        else:
            instance.delete()


def _snapshot(instance):
    """JSON-safe dict of the instance's concrete fields."""
    data = {}
    for field in instance._meta.concrete_fields:
        value = getattr(instance, field.attname)
        data[field.attname] = value if isinstance(value, (int, float, bool, type(None))) else str(value)
    return data


def _unique_field_groups(model):
    """Every unique_together tuple and UniqueConstraint field list declared
    on the model, as a list of tuples."""
    groups = [tuple(fields) for fields in getattr(model._meta, "unique_together", [])]
    for constraint in getattr(model._meta, "constraints", []):
        if isinstance(constraint, UniqueConstraint) and constraint.fields:
            groups.append(tuple(constraint.fields))
    return groups


def _conflict_error(serializer, tenant):
    """After an IntegrityError, figure out which unique constraint actually
    collided (instead of always blaming a hardcoded "name" field) by
    re-checking each declared unique_together/UniqueConstraint against the
    data that was being saved. Falls back to a generic non-field message if
    nothing matches (e.g. the conflict was some other DB constraint)."""
    model = serializer.Meta.model
    validated_data = getattr(serializer, "validated_data", {}) or {}
    instance = getattr(serializer, "instance", None)

    for fields in _unique_field_groups(model):
        lookup = {}
        matched = True
        for field_name in fields:
            if field_name == "tenant":
                lookup["tenant"] = tenant
                continue
            if field_name in validated_data:
                lookup[field_name] = validated_data[field_name]
            elif instance is not None and hasattr(instance, field_name):
                lookup[field_name] = getattr(instance, field_name)
            else:
                matched = False
                break
        if not matched:
            continue
        # Use the unfiltered manager if the model is soft-deletable — a
        # soft-deleted row still occupies the unique constraint at the DB
        # level, so it must still count as a collision here even though
        # the default manager hides it from normal reads.
        manager = model.all_objects if hasattr(model, "all_objects") else model.objects
        qs = manager.filter(**lookup)
        if instance is not None:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            display_fields = [f for f in fields if f != "tenant"]
            field_key = display_fields[0] if len(display_fields) == 1 else "__all__"
            names = " + ".join(display_fields)
            return {field_key: f"A record with this {names} already exists in your shop."}

    return {"__all__": "This item conflicts with an existing record in your shop."}

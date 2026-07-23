"""Helpers to write and read AuditLog rows from views."""
from django.db.models import CharField, OuterRef, Subquery, Value
from django.db.models.functions import Cast, Coalesce, NullIf

from .models import AuditLog


def log_action(request, action, instance, changes=None):
    tenant = getattr(request, "tenant", None)
    if tenant is None:
        return
    AuditLog.objects.create(
        tenant=tenant,
        user=request.user if request.user.is_authenticated else None,
        action=action,
        model_name=instance.__class__.__name__,
        object_id=str(instance.pk),
        changes=changes or {},
    )


def audit_name_subquery(model_name, object_id_ref="pk", action_filter=None):
    """Subquery expression for `.annotate(...)`: the display name (full_name,
    falling back to email) of whoever last touched a row per AuditLog,
    optionally restricted to a specific action (e.g. 'create'). Models don't
    store created_by/updated_by themselves — this is how the app surfaces
    "who did this" on read views instead (see ProductReportSerializer,
    BrandSerializer)."""
    logs = AuditLog.objects.filter(
        tenant_id=OuterRef("tenant_id"),
        model_name=model_name,
        object_id=Cast(OuterRef(object_id_ref), output_field=CharField()),
    )
    if action_filter:
        logs = logs.filter(action=action_filter)
    logs = logs.order_by("-timestamp").annotate(
        display_name=Coalesce(
            NullIf("user__full_name", Value("")), "user__email", output_field=CharField()
        )
    )
    return Subquery(logs.values("display_name")[:1], output_field=CharField())

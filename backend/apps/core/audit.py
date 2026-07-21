"""Helper to write AuditLog rows from views."""
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

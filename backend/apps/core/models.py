"""Core abstractions: TenantAwareModel and AuditLog."""
from django.conf import settings
from django.db import models
from django.utils import timezone


class TenantAwareModel(models.Model):
    """Every tenant-scoped model inherits this. The tenant FK is the
    row-level isolation key (PRD section 2.3)."""

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="%(class)s_set",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteManager(models.Manager):
    """Default manager: excludes soft-deleted rows everywhere (list views,
    dropdowns, FK validation) without any per-view code."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class SoftDeleteModel(models.Model):
    """Opt-in soft delete: `deleted_at` set instead of a real row delete.
    Models that also want a `deleted_by` column add it themselves (not every
    soft-deletable model in this app tracks who deleted it)."""

    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()  # includes soft-deleted rows (admin/debug only)

    class Meta:
        abstract = True

    def soft_delete(self):
        self.deleted_at = timezone.now()
        fields = ["deleted_at"]
        if hasattr(self, "deleted_by_id"):
            fields.append("deleted_by")
        self.save(update_fields=fields)


class AuditLog(models.Model):
    ACTION_CREATE = "create"
    ACTION_UPDATE = "update"
    ACTION_DELETE = "delete"
    ACTION_CHOICES = [
        (ACTION_CREATE, "Create"),
        (ACTION_UPDATE, "Update"),
        (ACTION_DELETE, "Delete"),
    ]

    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, related_name="audit_logs")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="audit_logs"
    )
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=64)
    changes = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    request_path = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.action} {self.model_name}#{self.object_id} by {self.user}"

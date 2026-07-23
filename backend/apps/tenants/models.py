from django.db import models

from apps.core.models import SoftDeleteModel


class Tenant(models.Model):
    name = models.CharField(max_length=255)
    subdomain = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)
    max_branches = models.PositiveIntegerField(default=1)
    max_employees = models.PositiveIntegerField(default=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.subdomain})"


class Branch(SoftDeleteModel):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="branches")
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    branch_code = models.CharField(max_length=50, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    branch_phone_number = models.CharField(max_length=32, blank=True, default="")
    branch_city = models.CharField(max_length=100, blank=True, default="")
    branch_province = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        unique_together = ("tenant", "name")

    def __str__(self):
        return f"{self.name} — {self.tenant.subdomain}"

from django.db import models


class Tenant(models.Model):
    name = models.CharField(max_length=255)
    subdomain = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)
    max_branches = models.PositiveIntegerField(default=1)
    max_employees = models.PositiveIntegerField(default=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.subdomain})"


class Branch(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="branches")
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # These fields will be implemented
    # branch_code # Unique code for the branch (e.g. BR001, BR002, etc.)
    # email # email of the branch owner
    # branch_phone_number # phone number of the manager manager / employeer
    # branch_city # City address of the branch
    # branch_province # province of the branch 
    # created_by # Who created this branch into the app (EMployee or Admin / Inserted by)
    # updated_by # Who updated this branch into the app (EMployee or Admin / updated by)
    # deleted_at # When this branch was deleted (soft delete)
    
    class Meta:
        unique_together = ("tenant", "name")

    def __str__(self):
        return f"{self.name} — {self.tenant.subdomain}"

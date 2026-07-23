from rest_framework import serializers

from .models import Branch, Tenant


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ["id", "name", "subdomain", "is_active", "max_branches", "max_employees"]


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = [
            "id", "name", "address", "is_active", "created_at",
            "branch_code", "email", "branch_phone_number", "branch_city", "branch_province",
            "deleted_at",
        ]
        read_only_fields = ["deleted_at"]

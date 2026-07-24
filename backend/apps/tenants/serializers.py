from rest_framework import serializers

from apps.core.validators import validate_phone_number

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

    def validate_branch_phone_number(self, value):
        return validate_phone_number(value)

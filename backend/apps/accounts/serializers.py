from rest_framework import serializers
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.core.serializers import TenantPKRelatedField
from apps.tenants.models import Branch

from .models import EmployeePermission, User


class EmployeePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeePermission
        fields = EmployeePermission.FLAGS


class UserSerializer(serializers.ModelSerializer):
    permissions = EmployeePermissionSerializer(source="employee_permission", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "role",
            "branch",
            "branch_name",
            "tenant_name",
            "is_active",
            "permissions",
        ]
        read_only_fields = ["role"]


class EmployeeCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    branch = TenantPKRelatedField(queryset=Branch.objects.all(), required=True)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "password", "branch"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        tenant = self.context["request"].tenant
        return User.objects.create_user(
            password=password, role=User.ROLE_EMPLOYEE, tenant=tenant, **validated_data
        )


class TenantTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login is only valid on the subdomain of the user's own shop
    (PRD phase 1, task 3)."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["tenant_id"] = user.tenant_id
        return token

    #################### When their is a sub domain
    # def validate(self, attrs):
    #     data = super().validate(attrs)
    #     request = self.context["request"]
    #     tenant = getattr(request, "tenant", None)
    #     user = self.user

    #     if user.role == User.ROLE_SUPERADMIN:
    #         if tenant is not None:
    #             raise AuthenticationFailed("Superadmin must log in on the main domain.")
    #     else:
    #         if tenant is None or user.tenant_id != tenant.id:
    #             raise AuthenticationFailed("This account does not belong to this shop.")

    #     data["user"] = UserSerializer(user).data
    #     return data

    ################ When there is No Sub Domain
    def validate(self, attrs):
        data = super().validate(attrs)
        request = self.context["request"]
        tenant = getattr(request, "tenant", None)
        user = self.user

        if user.role == User.ROLE_SUPERADMIN:
            if tenant is not None:
                raise AuthenticationFailed("Superadmin must log in on the main domain.")
        else:
            # On a shop subdomain: user must belong to THAT shop.
            # On the bare domain (localhost): allow — tenant comes from the user.
            if tenant is not None and user.tenant_id != tenant.id:
                raise AuthenticationFailed("This account does not belong to this shop.")
            if user.tenant is None or not user.tenant.is_active:
                raise AuthenticationFailed("Your shop account is inactive.")

        data["user"] = UserSerializer(user).data
        return data

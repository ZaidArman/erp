from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", User.ROLE_SUPERADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_SUPERADMIN = "superadmin"
    ROLE_ADMIN = "admin"
    ROLE_EMPLOYEE = "employee"
    ROLE_CHOICES = [
        (ROLE_SUPERADMIN, "Superadmin"),
        (ROLE_ADMIN, "Admin (shop owner)"),
        (ROLE_EMPLOYEE, "Employee"),
    ]

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True, default="")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_EMPLOYEE)
    # Null tenant => Superadmin. Null branch => Admin (shop-wide access).
    tenant = models.ForeignKey(
        "tenants.Tenant", null=True, blank=True, on_delete=models.CASCADE, related_name="users"
    )
    branch = models.ForeignKey(
        "tenants.Branch", null=True, blank=True, on_delete=models.SET_NULL, related_name="users"
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return f"{self.email} ({self.role})"

    @property
    def is_superadmin(self):
        return self.role == self.ROLE_SUPERADMIN

    @property
    def is_shop_admin(self):
        return self.role == self.ROLE_ADMIN

    @property
    def is_employee(self):
        return self.role == self.ROLE_EMPLOYEE


class EmployeePermission(models.Model):
    """One-to-one permission flags for employees (PRD section 3.1).
    Auto-created with all flags False when an employee user is created."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="employee_permission")
    can_view_finance = models.BooleanField(default=False)
    can_use_pos = models.BooleanField(default=False)
    can_manage_inventory = models.BooleanField(default=False)
    can_create_users = models.BooleanField(default=False)
    can_view_reports = models.BooleanField(default=False)

    FLAGS = [
        "can_view_finance",
        "can_use_pos",
        "can_manage_inventory",
        "can_create_users",
        "can_view_reports",
    ]

    def __str__(self):
        return f"Permissions for {self.user.email}"

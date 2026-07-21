"""Idempotent demo seed: two tenants, admins, employees, sample inventory.

Login details (see README):
  Superadmin:  root@yourapp.com / Root@12345   at http://lvh.me:8000/admin/
  Alpha admin: admin@alpha.com / Admin@12345   at http://alpha.lvh.me:3000
  Alpha employee: staff@alpha.com / Staff@12345
  Beta admin:  admin@beta.com  / Admin@12345   at http://beta.lvh.me:3000
"""
from django.core.management.base import BaseCommand

from apps.accounts.models import EmployeePermission, User
from apps.inventory.models import SKU, Brand, Category, Product, StockUnit, Supplier
from apps.tenants.models import Branch, Tenant


class Command(BaseCommand):
    help = "Seed two demo tenants with users and sample inventory (idempotent)."

    def handle(self, *args, **options):
        if not User.objects.filter(email="root@yourapp.com").exists():
            User.objects.create_superuser("root@yourapp.com", "Root@12345", full_name="Platform Root")
            self.stdout.write("Created superadmin root@yourapp.com")

        alpha = self._tenant("Alpha Electronics", "alpha", max_branches=2, max_employees=5)
        beta = self._tenant("Beta Mobiles", "beta", max_branches=1, max_employees=2)

        alpha_main = self._branch(alpha, "Main Branch", "Saddar Road, Peshawar")
        self._branch(beta, "Main Branch", "University Road")

        self._user(alpha, None, "admin@alpha.com", "Admin@12345", User.ROLE_ADMIN, "Ali (Owner)")
        staff = self._user(
            alpha, alpha_main, "staff@alpha.com", "Staff@12345", User.ROLE_EMPLOYEE, "Ahmed (Staff)"
        )
        perm, _ = EmployeePermission.objects.get_or_create(user=staff)
        perm.can_manage_inventory = True
        perm.can_view_finance = False
        perm.can_use_pos = True
        perm.save()

        self._user(beta, None, "admin@beta.com", "Admin@12345", User.ROLE_ADMIN, "Bilal (Owner)")

        if not Category.objects.filter(tenant=alpha).exists():
            mobiles = Category.objects.create(tenant=alpha, name="Mobiles")
            Category.objects.create(tenant=alpha, name="Laptops")
            Category.objects.create(tenant=alpha, name="Accessories")
            apple = Brand.objects.create(tenant=alpha, name="Apple")
            Brand.objects.create(tenant=alpha, name="Samsung")
            supplier = Supplier.objects.create(
                tenant=alpha, name="Karkhano Traders", contact="0300-1234567"
            )
            iphone = Product.objects.create(
                tenant=alpha, category=mobiles, brand=apple,
                name="iPhone 15 Pro", description="Apple flagship",
            )
            sku = SKU.objects.create(
                tenant=alpha, product=iphone, variant_name="256GB Black",
                sell_price=452000, attributes={"color": "Black", "storage": "256GB"},
            )
            SKU.objects.create(
                tenant=alpha, product=iphone, variant_name="512GB Natural",
                sell_price=520000, attributes={"color": "Natural", "storage": "512GB"},
            )
            for i in range(3):
                StockUnit.objects.create(
                    tenant=alpha, sku=sku, branch=alpha_main, supplier=supplier,
                    imei_serial=f"35874311091234{i}", condition="new", purchase_cost=430000,
                )
            self.stdout.write("Seeded Alpha inventory (3 units of iPhone 15 Pro 256GB)")

        self.stdout.write(self.style.SUCCESS("Demo seed complete."))

    def _tenant(self, name, subdomain, **kwargs):
        tenant, created = Tenant.objects.get_or_create(
            subdomain=subdomain, defaults={"name": name, **kwargs}
        )
        if created:
            self.stdout.write(f"Created tenant {subdomain}")
        return tenant

    def _branch(self, tenant, name, address):
        branch, _ = Branch.objects.get_or_create(
            tenant=tenant, name=name, defaults={"address": address}
        )
        return branch

    def _user(self, tenant, branch, email, password, role, full_name):
        user = User.objects.filter(email=email).first()
        if user is None:
            user = User.objects.create_user(
                email=email, password=password, role=role,
                tenant=tenant, branch=branch, full_name=full_name,
            )
            self.stdout.write(f"Created {role} {email}")
        return user

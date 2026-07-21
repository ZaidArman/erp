import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.tenants.models import Branch, Tenant

ALPHA_HOST = "alpha.testserver"
BETA_HOST = "beta.testserver"


@pytest.fixture
def tenant_a(db):
    return Tenant.objects.create(name="Alpha Electronics", subdomain="alpha",
                                 max_branches=2, max_employees=2)


@pytest.fixture
def tenant_b(db):
    return Tenant.objects.create(name="Beta Mobiles", subdomain="beta")


@pytest.fixture
def branch_a(tenant_a):
    return Branch.objects.create(tenant=tenant_a, name="Main")


@pytest.fixture
def branch_b(tenant_b):
    return Branch.objects.create(tenant=tenant_b, name="Main")


@pytest.fixture
def admin_a(tenant_a):
    return User.objects.create_user("admin@alpha.com", "Admin@12345",
                                    role=User.ROLE_ADMIN, tenant=tenant_a)


@pytest.fixture
def admin_b(tenant_b):
    return User.objects.create_user("admin@beta.com", "Admin@12345",
                                    role=User.ROLE_ADMIN, tenant=tenant_b)


@pytest.fixture
def employee_a(tenant_a, branch_a):
    return User.objects.create_user("staff@alpha.com", "Staff@12345",
                                    role=User.ROLE_EMPLOYEE, tenant=tenant_a, branch=branch_a)


def client_for(user, host):
    client = APIClient(HTTP_HOST=host)
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def client_admin_a(admin_a):
    return client_for(admin_a, ALPHA_HOST)


@pytest.fixture
def client_admin_b(admin_b):
    return client_for(admin_b, BETA_HOST)


@pytest.fixture
def client_employee_a(employee_a):
    return client_for(employee_a, ALPHA_HOST)

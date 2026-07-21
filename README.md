# SaaS ERP for Electronics Shops — MVP (Phases 0–2)

Multi-tenant ERP with subdomain-based tenancy, role & permission system,
and the full electronics inventory module (Category → Brand → Product →
SKU → StockUnit with per-unit IMEI tracking).

**Included phases**

| Phase | What works |
|---|---|
| Phase 0 | Tenant resolution by subdomain, `TenantAwareModel` / `TenantAwareViewSet` isolation, Django Admin for Superadmin, health check |
| Phase 1 | JWT login tied to the shop subdomain, 3 roles, per-employee permission flags, employee & branch management with plan limits |
| Phase 2 | Full inventory: categories, brands, suppliers, products, SKUs (variants + price), stock units (IMEI, condition, cost, warranty), bulk intake, filters, exact IMEI search, audit log |

Phases 3–5 (POS, finance, hardening) come next and plug into this codebase.

---

## 1. Run it

Requires Docker + Docker Compose. From this directory:

```bash
docker compose up --build
```

First start takes a couple of minutes (image build + npm install). The
backend waits for PostgreSQL, migrates, and seeds demo data automatically.

## 2. Open it

`lvh.me` is a public domain that always resolves to `127.0.0.1`, so
subdomains work locally with zero configuration.

| URL | What it is |
|---|---|
| http://alpha.lvh.me:3000 | Alpha Electronics — shop app (React) |
| http://beta.lvh.me:3000 | Beta Mobiles — a second, fully isolated shop |
| http://lvh.me:8000/admin/ | Superadmin panel (Django Admin) — create tenants here |
| http://alpha.lvh.me:8000/api/health/ | Tenant-aware health check |

## 3. Demo logins (seeded automatically)

| Who | Where | Email | Password |
|---|---|---|---|
| Superadmin | http://lvh.me:8000/admin/ | root@yourapp.com | Root@12345 |
| Alpha admin (shop owner) | http://alpha.lvh.me:3000 | admin@alpha.com | Admin@12345 |
| Alpha employee | http://alpha.lvh.me:3000 | staff@alpha.com | Staff@12345 |
| Beta admin | http://beta.lvh.me:3000 | admin@beta.com | Admin@12345 |

Try this first: log in as `admin@alpha.com` on **beta**.lvh.me:3000 — it is
rejected. Login is bound to the shop's subdomain (Phase 1 guarantee).

The seeded Alpha employee already has `can_manage_inventory` and
`can_use_pos` enabled so you can see the permission-driven navigation.
Log in as the Alpha admin → Employees to flip flags live.

## 4. Run the test suite (43 tests)

```bash
docker compose run --rm backend python -m pytest
```

Covers the Phase 0 isolation gate (cross-tenant reads/writes impossible),
the Phase 1 auth/permission/limit rules, and Phase 2 inventory constraints,
bulk-intake atomicity, filters, and audit logging.

## 5. Project layout

```
backend/
  config/settings/        base / development / production / test
  apps/core/              TenantAwareModel, TenantMiddleware, TenantAwareViewSet, AuditLog
  apps/tenants/           Tenant, Branch + plan-limit checks + seed_demo command
  apps/accounts/          User (3 roles), EmployeePermission, JWT auth, DRF permission classes
  apps/inventory/         Category, Brand, Supplier, Product, SKU, StockUnit + bulk intake
  tests/                  Phase 0 / 1 / 2 suites (pytest)
frontend/
  src/                    React SPA: login, dashboard, employees, branches, inventory, stock
docker-compose.yml        db (Postgres 16) + backend (8000) + frontend (3000)
```

## 6. How tenancy works (30-second version)

1. `TenantMiddleware` reads the Host header: `alpha.lvh.me` → subdomain `alpha`
   → loads the active Tenant → `request.tenant`. Unknown/inactive → 404.
2. Every tenant-scoped model inherits `TenantAwareModel` (a `tenant` FK).
3. Every ViewSet extends `TenantAwareViewSet`, which filters **every** queryset
   by `request.tenant` and forces `tenant` on create — even if the payload lies.
4. JWT login refuses users whose tenant doesn't match the subdomain, and every
   authenticated request re-checks the match.

No view ever filters by tenant manually. That is the leak-prevention contract.

## 7. Superadmin: onboarding a new shop (manual MVP flow)

1. Open http://lvh.me:8000/admin/ and log in as the superadmin.
2. Tenants → Add: name, subdomain (e.g. `zeeshan`), max branches/employees.
3. Branches → Add a "Main Branch" for that tenant.
4. Users → Add: email + password, role `admin`, select the tenant.
5. Send the owner their URL: http://zeeshan.lvh.me:3000

## 8. Useful commands

```bash
docker compose up --build          # start everything
docker compose down                # stop (keeps DB data)
docker compose down -v             # stop and wipe the database
docker compose run --rm backend python -m pytest         # tests
docker compose run --rm backend python manage.py seed_demo  # re-seed
docker compose logs -f backend     # tail Django logs
```

## 9. Troubleshooting

- **"Shop not found or inactive"** — the subdomain has no Tenant row, or
  `is_active` is off. Create/enable it in Django Admin.
- **Login says "does not belong to this shop"** — working as intended:
  you're on the wrong shop's subdomain.
- **Port already in use** — free ports 3000, 8000, 5432 or edit the
  `ports:` mappings in `docker-compose.yml`.
- **lvh.me unreachable** — some corporate DNS blocks it. Add lines like
  `127.0.0.1 alpha.lvh.me` to your hosts file, or use
  `alpha.localhost:3000` (already in `TENANT_BASE_DOMAINS`).

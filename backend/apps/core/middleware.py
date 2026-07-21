"""Resolve the tenant from the request subdomain (PRD section 2.3)."""
from django.conf import settings
from django.http import JsonResponse


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        host = request.get_host().split(":")[0].lower()
        subdomain = self._extract_subdomain(host)
        request.tenant = None

        if subdomain:
            from apps.tenants.models import Tenant

            try:
                request.tenant = Tenant.objects.get(subdomain=subdomain, is_active=True)
            except Tenant.DoesNotExist:
                return JsonResponse({"detail": "Shop not found or inactive."}, status=404)

        return self.get_response(request)

    @staticmethod
    def _extract_subdomain(host):
        """'alpha.lvh.me' -> 'alpha'. Bare base domain -> None (superadmin)."""
        for base in settings.TENANT_BASE_DOMAINS:
            base = base.lower()
            if host == base:
                return None
            if host.endswith("." + base):
                prefix = host[: -(len(base) + 1)]
                # Ignore deeper nesting like www.alpha.lvh.me -> take last label.
                return prefix.split(".")[-1] or None
        return None

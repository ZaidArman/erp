from django.http import JsonResponse


def health(request):
    tenant = getattr(request, "tenant", None)
    return JsonResponse(
        {
            "status": "ok",
            "tenant": tenant.subdomain if tenant else None,
            "shop_name": tenant.name if tenant else None,
        }
    )

# """JWT authentication that also enforces token-tenant == request-subdomain."""
# from rest_framework_simplejwt.authentication import JWTAuthentication
# from rest_framework_simplejwt.exceptions import AuthenticationFailed


# class TenantJWTAuthentication(JWTAuthentication):
#     def authenticate(self, request):
#         result = super().authenticate(request)
#         if result is None:
#             return None
#         user, token = result

#         if user.role != "superadmin":
#             tenant = getattr(request, "tenant", None)
#             if tenant is None or user.tenant_id != tenant.id:
#                 raise AuthenticationFailed(
#                     "This account does not belong to this shop.", code="tenant_mismatch"
#                 )
#         return user, token




"""JWT authentication with flexible tenant resolution.

- On a shop subdomain: token tenant MUST match the subdomain (production mode).
- On the bare domain (e.g. localhost): the tenant is resolved from the
  authenticated user's own record, so every shop can use one URL in dev.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed


class TenantJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result

        if user.role != "superadmin":
            tenant = getattr(request, "tenant", None)
            if tenant is None:
                # Bare domain: derive the tenant from the user themselves.
                if user.tenant is None or not user.tenant.is_active:
                    raise AuthenticationFailed("Your shop account is inactive.")
                request._request.tenant = user.tenant
            elif user.tenant_id != tenant.id:
                raise AuthenticationFailed(
                    "This account does not belong to this shop.", code="tenant_mismatch"
                )
        return user, token
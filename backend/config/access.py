"""Default backend membership and CSRF boundaries, before private work."""

from django.contrib.auth import SESSION_KEY, get_user_model, logout
from django.http import JsonResponse
from django.middleware.csrf import CsrfViewMiddleware

from users.access import is_effective_member, is_public_operation


def unauthenticated():
    return JsonResponse(
        {"code": "unauthenticated", "message": "Debes iniciar sesión."}, status=401
    )


def csrf_failure(request, reason=""):
    # Do not expose Django's rejection reason, request input or HTML debug page.
    return JsonResponse(
        {"code": "forbidden", "message": "No tienes permiso para esta acción."},
        status=403,
    )


class MembershipMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if is_public_operation(request.method, request.path_info):
            return self.get_response(request)
        identity = request.user
        if identity.is_authenticated:
            # Even a cached/authenticated identity must still exist and be eligible.
            identity = get_user_model().objects.filter(pk=identity.pk).first()
        if identity is None or not is_effective_member(identity):
            if SESSION_KEY in request.session:
                logout(request)  # Delete the server session, preventing cookie replay.
            return unauthenticated()
        request.user = identity
        return self.get_response(request)


class RequiredCsrfMiddleware(CsrfViewMiddleware):
    def process_view(self, request, callback, callback_args, callback_kwargs):
        # Ninja marks its generated views exempt. Apply Django's normal token and
        # origin checks to all backend views regardless of that framework flag.
        def protected_view(*args, **kwargs):
            return callback(*args, **kwargs)

        return super().process_view(
            request, protected_view, callback_args, callback_kwargs
        )


class AuthenticationCacheMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path_info in {
            "/api/session",
            "/api/auth/discord/start",
            "/api/auth/discord/callback",
            "/api/auth/logout",
            "/api/auth/demo",
        }:
            response["Cache-Control"] = "no-store"
        return response

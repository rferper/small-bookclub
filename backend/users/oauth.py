"""Allauth code exchange/state validation with exact native club identities."""

import re

from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.internal import statekit
from allauth.socialaccount.providers.discord.views import DiscordOAuth2Adapter
from allauth.socialaccount.providers.oauth2.views import OAuth2CallbackView
from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.http import HttpResponseRedirect
from django.utils import timezone

from .authentication import (
    DENIED_KEY,
    EXPORT_KEY,
    INTENT_KEY,
    PURPOSE_KEY,
    current_identity,
)


def fail(request):
    intent = getattr(request, "club_oauth_intent", {})
    request.session.pop(EXPORT_KEY, None)
    if intent.get("purpose") == "export":
        identity = current_identity(request)
        return HttpResponseRedirect("/administracion" if identity else "/")
    logout(request)
    request.session[DENIED_KEY] = True
    return HttpResponseRedirect("/")


class ClubDiscordAdapter(DiscordOAuth2Adapter):
    def get_callback_url(self, request, app):
        return settings.DISCORD_REDIRECT_URI

    def parse_token(self, data):
        if (
            not isinstance(data, dict)
            or not isinstance(data.get("access_token"), str)
            or not data["access_token"]
        ):
            raise ImmediateHttpResponse(fail(self.request))
        return super().parse_token(data)

    def complete_login(self, request, app, token, **kwargs):
        # Discord's stock extract_uid coerces numbers to strings. Reject them
        # before coercion, and never import provider names/email/avatar.
        with ClubSocialAdapter().get_requests_session() as provider_http:
            response = provider_http.get(
                self.profile_url, headers={"Authorization": f"Bearer {token.token}"}
            )
            response.raise_for_status()
            data = response.json()
        identity = data.get("id") if isinstance(data, dict) else None
        if not isinstance(identity, str) or not re.fullmatch(r"[0-9]{17,20}", identity):
            raise ImmediateHttpResponse(fail(request))
        return self.get_provider().sociallogin_from_response(request, {"id": identity})


class ClubSocialAdapter(DefaultSocialAccountAdapter):
    def populate_user(self, request, sociallogin, data):
        return sociallogin.user

    def is_open_for_signup(self, request, sociallogin):
        return False

    def on_authentication_error(self, request, provider, **kwargs):
        # Never render/log provider errors or raw exceptions.
        raise ImmediateHttpResponse(fail(request))

    def pre_social_login(self, request, sociallogin):
        intent = sociallogin.state.get("data", {})
        identity = (
            get_user_model()
            .objects.filter(
                discord_user_id=sociallogin.account.uid, approved=True, revoked_at=None
            )
            .first()
        )
        if identity is None:
            raise ImmediateHttpResponse(fail(request))
        if intent.get("purpose") == "export":
            current = current_identity(request)
            if (
                current is None
                or current.role != "admin"
                or identity.pk != current.pk
                or intent.get("id") != str(current.pk)
                or intent.get("discord") != current.discord_user_id
            ):
                raise ImmediateHttpResponse(fail(request))
            request.session[EXPORT_KEY] = {
                "id": str(identity.pk),
                "at": timezone.now().timestamp(),
            }
            response = HttpResponseRedirect("/administracion")
        else:
            request.session.pop(EXPORT_KEY, None)
            login(
                request, identity, backend="django.contrib.auth.backends.ModelBackend"
            )
            # Django keeps the key when logging the same identity in again.
            request.session.cycle_key()
            request.session.pop(DENIED_KEY, None)
            response = HttpResponseRedirect("/")
        # Stop allauth before signup, account association, profile/token saving.
        raise ImmediateHttpResponse(response)


class ClubCallbackView(OAuth2CallbackView):
    def _get_state(self, request, provider):
        state, response = super()._get_state(request, provider)
        if response:
            return state, response
        intent = state.get("data")
        pending = getattr(request, "club_oauth_intent", None)
        if (
            not isinstance(intent, dict)
            or intent != pending
            or not 0 <= timezone.now().timestamp() - intent.get("issued", 0) < 600
        ):
            return None, fail(request)
        return state, None


allauth_callback = ClubCallbackView.adapter_view(ClubDiscordAdapter)


def callback(request):
    request.club_oauth_intent = request.session.get(
        INTENT_KEY, {"purpose": request.session.get(PURPOSE_KEY, "login")}
    )
    try:
        return allauth_callback(request)
    except (KeyError, ValueError, TypeError, AttributeError):
        # Malformed token/profile payloads have no library error-page fallback.
        return fail(request)
    finally:
        request.session.pop(INTENT_KEY, None)
        request.session.pop(statekit.STATES_SESSION_KEY, None)

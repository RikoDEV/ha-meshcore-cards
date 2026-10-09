"""Config flow for MeshCore Companion Cards: one sidebar panel per companion."""

from __future__ import annotations

import re
from typing import Any

import voluptuous as vol

from homeassistant.components.frontend import DATA_PANELS
from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import selector

from .const import (
    CONF_COMPANION,
    CONF_ICON,
    CONF_LITESCOPE_URL,
    CONF_REQUIRE_ADMIN,
    CONF_TITLE,
    CONF_URL_PATH,
    DEFAULT_ICON,
    DEFAULT_TITLE,
    DEFAULT_URL_PATH,
    DOMAIN,
    MESHCORE_DOMAIN,
)

_URL_PATH_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
_HTTP_URL_RE = re.compile(r"^https?://[^\s/]+", re.IGNORECASE)


def _panel_schema(defaults: dict[str, Any]) -> dict[Any, Any]:
    """Fields shared by the setup and options forms."""
    return {
        vol.Required(
            CONF_TITLE, default=defaults.get(CONF_TITLE, DEFAULT_TITLE)
        ): selector.TextSelector(),
        vol.Required(
            CONF_ICON, default=defaults.get(CONF_ICON, DEFAULT_ICON)
        ): selector.IconSelector(),
        vol.Required(
            CONF_URL_PATH, default=defaults.get(CONF_URL_PATH, DEFAULT_URL_PATH)
        ): selector.TextSelector(),
        vol.Required(
            CONF_REQUIRE_ADMIN, default=defaults.get(CONF_REQUIRE_ADMIN, False)
        ): selector.BooleanSelector(),
        # Optional, and a suggested value rather than a default so that it can
        # be cleared again.
        vol.Optional(
            CONF_LITESCOPE_URL,
            description={"suggested_value": defaults.get(CONF_LITESCOPE_URL) or ""},
        ): selector.TextSelector(
            selector.TextSelectorConfig(type=selector.TextSelectorType.URL)
        ),
    }


def _validate(
    hass: HomeAssistant, user_input: dict[str, Any], current_url_path: str | None = None
) -> dict[str, str]:
    """Normalise the submitted values in place and return field errors."""
    errors: dict[str, str] = {}
    user_input[CONF_URL_PATH] = user_input[CONF_URL_PATH].strip().strip("/")
    if error := _url_path_error(hass, user_input[CONF_URL_PATH], current_url_path):
        errors[CONF_URL_PATH] = error
    # Always store the key: a cleared field must override an earlier value.
    litescope = (user_input.get(CONF_LITESCOPE_URL) or "").strip().rstrip("/")
    user_input[CONF_LITESCOPE_URL] = litescope
    if litescope and not _HTTP_URL_RE.match(litescope):
        errors[CONF_LITESCOPE_URL] = "invalid_litescope_url"
    return errors


def _url_path_error(
    hass: HomeAssistant, url_path: str, current: str | None = None
) -> str | None:
    """Return an error key when the URL path can't be used for a new panel."""
    if not _URL_PATH_RE.match(url_path):
        return "invalid_url_path"
    if url_path != current and url_path in hass.data.get(DATA_PANELS, {}):
        return "url_path_in_use"
    return None


def _free_url_path(hass: HomeAssistant) -> str:
    """Suggest a URL path that no panel uses yet: meshcore, meshcore-2, …"""
    panels = hass.data.get(DATA_PANELS, {})
    candidate, n = DEFAULT_URL_PATH, 1
    while candidate in panels:
        n += 1
        candidate = f"{DEFAULT_URL_PATH}-{n}"
    return candidate


class MeshcoreCardsConfigFlow(ConfigFlow, domain=DOMAIN):
    """Add a MeshCore sidebar panel."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Pick the companion and how its panel appears in the sidebar."""
        taken = {entry.unique_id for entry in self._async_current_entries()}
        companions = {
            entry.entry_id: entry.title
            for entry in self.hass.config_entries.async_entries(MESHCORE_DOMAIN)
            if entry.entry_id not in taken
        }
        if not companions:
            has_any = bool(self.hass.config_entries.async_entries(MESHCORE_DOMAIN))
            return self.async_abort(
                reason="all_companions_configured" if has_any else "no_companions"
            )

        errors: dict[str, str] = {}
        if user_input is not None:
            errors = _validate(self.hass, user_input)
            if not errors:
                await self.async_set_unique_id(user_input[CONF_COMPANION])
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=companions.get(
                        user_input[CONF_COMPANION], user_input[CONF_TITLE]
                    ),
                    data=user_input,
                )

        defaults = user_input or {CONF_URL_PATH: _free_url_path(self.hass)}
        schema = vol.Schema(
            {
                vol.Required(
                    CONF_COMPANION,
                    default=defaults.get(CONF_COMPANION, next(iter(companions))),
                ): selector.SelectSelector(
                    selector.SelectSelectorConfig(
                        options=[
                            selector.SelectOptionDict(value=entry_id, label=title)
                            for entry_id, title in companions.items()
                        ],
                        mode=selector.SelectSelectorMode.DROPDOWN,
                    )
                ),
                **_panel_schema(defaults),
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        """Return the options flow."""
        return MeshcoreCardsOptionsFlow()


class MeshcoreCardsOptionsFlow(OptionsFlow):
    """Change a panel's title, icon, URL path or admin restriction."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Edit the panel."""
        current = {**self.config_entry.data, **self.config_entry.options}
        errors: dict[str, str] = {}
        if user_input is not None:
            errors = _validate(self.hass, user_input, current.get(CONF_URL_PATH))
            if not errors:
                return self.async_create_entry(data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(_panel_schema(user_input or current)),
            errors=errors,
        )

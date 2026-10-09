"""MeshCore Companion Cards.

Serves the bundled dashboard cards, loads them in the frontend, and registers
one sidebar panel per config entry (one entry per MeshCore companion).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import ConfigEntryError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration

from .const import (
    CHAT_CARD_JS,
    CONF_COMPANION,
    CONF_ICON,
    CONF_LITESCOPE_URL,
    CONF_REQUIRE_ADMIN,
    CONF_TITLE,
    CONF_URL_PATH,
    DEFAULT_ICON,
    DEFAULT_TITLE,
    DOMAIN,
    PANEL_WEBCOMPONENT,
    REPEATER_CARD_JS,
    URL_BASE,
)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

# Config entry runtime data: the url_path of the panel the entry registered.
type MeshcoreCardsConfigEntry = ConfigEntry[str]


def _module_url(filename: str, version: str) -> str:
    """URL of a bundled JS file; the version busts browser caches on update."""
    return f"{URL_BASE}/{filename}?v={version}"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the bundled JS and load both cards in every frontend session."""
    integration = await async_get_integration(hass, DOMAIN)
    version = str(integration.version)
    hass.data[DOMAIN] = {"version": version}

    await hass.http.async_register_static_paths(
        [StaticPathConfig(URL_BASE, str(Path(__file__).parent / "www"), False)]
    )
    # Makes custom:meshcore-chat-card and custom:meshcore-repeater-card
    # available on dashboards without adding them as resources.
    for filename in (CHAT_CARD_JS, REPEATER_CARD_JS):
        frontend.add_extra_js_url(hass, _module_url(filename, version))
    websocket_api.async_register_command(hass, _ws_config)
    return True


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/config"})
@callback
def _ws_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Hand the cards and panels the settings kept in the config entries."""
    entries = []
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.disabled_by is not None:
            continue
        conf = {**entry.data, **entry.options}
        entries.append(
            {
                "companion_entry_id": conf.get(CONF_COMPANION),
                "litescope_url": conf.get(CONF_LITESCOPE_URL) or "",
            }
        )
    connection.send_result(msg["id"], {"entries": entries})


async def async_setup_entry(
    hass: HomeAssistant, entry: MeshcoreCardsConfigEntry
) -> bool:
    """Register the sidebar panel for one companion."""
    conf = {**entry.data, **entry.options}
    url_path: str = conf[CONF_URL_PATH]

    try:
        await panel_custom.async_register_panel(
            hass,
            frontend_url_path=url_path,
            webcomponent_name=PANEL_WEBCOMPONENT,
            sidebar_title=conf.get(CONF_TITLE) or DEFAULT_TITLE,
            sidebar_icon=conf.get(CONF_ICON) or DEFAULT_ICON,
            module_url=_module_url(CHAT_CARD_JS, hass.data[DOMAIN]["version"]),
            config={"entry_id": conf.get(CONF_COMPANION)},
            require_admin=bool(conf.get(CONF_REQUIRE_ADMIN, False)),
        )
    except ValueError as err:
        # The frontend refuses to overwrite an existing panel.
        raise ConfigEntryError(
            f"The URL path '/{url_path}' is already used by another panel"
        ) from err

    entry.runtime_data = url_path
    entry.async_on_unload(entry.add_update_listener(_async_reload_entry))
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: MeshcoreCardsConfigEntry
) -> bool:
    """Remove the sidebar panel."""
    frontend.async_remove_panel(hass, entry.runtime_data, warn_if_unknown=False)
    return True


async def _async_reload_entry(
    hass: HomeAssistant, entry: MeshcoreCardsConfigEntry
) -> None:
    """Re-register the panel after its options changed."""
    await hass.config_entries.async_reload(entry.entry_id)

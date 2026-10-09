"""Constants for the MeshCore Companion Cards integration."""

DOMAIN = "meshcore_cards"

# Domain of the meshcore-ha integration whose companions the panels show.
MESHCORE_DOMAIN = "meshcore"

# The bundled JS is served from this URL prefix.
URL_BASE = "/meshcore_cards"
CHAT_CARD_JS = "meshcore-chat-card.js"
REPEATER_CARD_JS = "meshcore-repeater-card.js"

# Custom element defined in meshcore-chat-card.js.
PANEL_WEBCOMPONENT = "meshcore-panel"

CONF_COMPANION = "companion_entry_id"
CONF_TITLE = "title"
CONF_ICON = "icon"
CONF_URL_PATH = "url_path"
CONF_REQUIRE_ADMIN = "require_admin"

DEFAULT_TITLE = "MeshCore"
DEFAULT_ICON = "mdi:radio-tower"
DEFAULT_URL_PATH = "meshcore"

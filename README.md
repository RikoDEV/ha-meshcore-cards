# MeshCore Companion Cards for Home Assistant

Custom Lovelace cards that bring a full MeshCore mesh-radio companion experience into Home Assistant — real-time chat, channel messaging, contact management, repeater telemetry, and more.

<img width="2560" height="1269" alt="image" src="https://github.com/user-attachments/assets/a3b80ca7-6280-48d9-aec4-e8eb907edd9b" />

---

<img width="2560" height="1269" alt="image" src="https://github.com/user-attachments/assets/b269045b-1df8-4bb6-8b94-41cc757f7602" />

---

## Cards included

| File | Card type | Purpose |
|------|-----------|---------|
| `meshcore-chat-card.js` | `custom:meshcore-chat-card` | Full companion chat UI — channels, DMs, contacts, node list |
| `meshcore-repeater-card.js` | `custom:meshcore-repeater-card` | Live repeater stats with sparkline charts |


---

## Prerequisites

1. **[meshcore-ha integration](https://github.com/meshcore-dev/meshcore-ha)** installed and configured in Home Assistant (HACS or manual).
2. At least one MeshCore node connected (USB, BLE, or TCP).
3. Home Assistant **2023.8** or newer.

---

## Installation

### Method 1 — HACS (recommended)

1. Open HACS in your Home Assistant sidebar.
2. Go to **Frontend**.
3. Click **⋮ → Custom repositories**.
4. Add this repository URL and set category to **Lovelace**.
5. Click **Download** on **MeshCore Companion Cards**.
6. Reload the browser.

HACS registers the resource URLs automatically. Skip to step 3 below.

### Method 2 — Manual

Copy `meshcore-chat-card.js` (and optionally `meshcore-repeater-card.js`) to your HA `config/www/` directory:

```
/config/www/meshcore-chat-card.js
/config/www/meshcore-repeater-card.js
```

Then register the resources. Go to **Settings → Dashboards → ⋮ (top-right menu) → Resources** and add:

| URL | Type |
|-----|------|
| `/local/meshcore-chat-card.js` | JavaScript module |
| `/local/meshcore-repeater-card.js` | JavaScript module |

Or add to your `configuration.yaml` / `ui-lovelace.yaml`:

```yaml
lovelace:
  resources:
    - url: /local/meshcore-chat-card.js
      type: module
    - url: /local/meshcore-repeater-card.js
      type: module
```

Reload Lovelace (or hard-refresh the browser) after adding resources.

### Step 3 — Add the card to a dashboard

Use the visual editor (**+ Add Card → Custom: Meshcore Chat Card**) or paste YAML directly:

```yaml
type: custom:meshcore-chat-card
```

The card auto-discovers your node from `binary_sensor.meshcore_*_messages` entities — no manual configuration required for a basic setup.

---

## Chat Card (`meshcore-chat-card`)

### Minimal config (auto-discovery)

```yaml
type: custom:meshcore-chat-card
```

### Full config reference

```yaml
type: custom:meshcore-chat-card

# Your own node's display name — used to highlight your own messages.
# Must match the name your device broadcasts.
node_name: MyNode

# 6-character public-key prefix of your connected device.
# Auto-detected from binary sensor entity IDs; set manually if auto-detection
# fails or you have multiple devices.
device_prefix: b8f68f

# Config entry ID — only needed when you have more than one MeshCore device.
entry_id: abc123def456

# Override or pre-configure channel names. Without this, channels are
# discovered automatically from the integration.
channels:
  - idx: 0
    name: Public
  - idx: 1
    name: "#local"
  - idx: 2
    name: "#emergency"

# Pin DM contacts by pubkey prefix. These appear in the sidebar even before
# any message has been received, and are synced to/from the device.
contacts:
  - pubkey_prefix: fe3af51b24b9
    name: Alice Pocket V2
  - pubkey_prefix: a1b2c3d4e5f6
    name: Bob HT

# Number of messages kept in memory per chat (default: 200).
max_messages: 200

# Hours of logbook history to load on first open (default: 24).
history_hours: 48

# Starting pane when the card loads: "chats" or "nodes" (default: "chats").
default_pane: chats

# Compact row spacing in the sidebar (default: false).
compact: false

# Card height — any CSS length value (default: 600px).
# Examples: 600px | 80vh | min(80vh, 900px)
height: 700px
```

### Visual editor

All options above are also available through the Lovelace **visual card editor** — click the pencil icon on any added card.

### Companion settings (per-browser)

Click the **gear icon** (⚙) in the sidebar header to open companion settings. These are stored in browser `localStorage` and override card YAML, so each browser/device can have its own preferences:

- Node name and device prefix
- History hours and message limit
- Default pane
- Channel list (add, rename, remove, apply to device)
- Contact list (add, remove, sync to device)

---

## Features — Chat Card

### Channels

- Auto-discovered from `binary_sensor.meshcore_*_ch_*_messages` entities.
- Additional channels fetched from the integration's `get_channels` service.
- **Add a channel:** click **+** in the sidebar or open Settings → Channels.
- **Apply to device:** the Settings modal provisions new/renamed channels on the radio via `set_channel`.
- Channel names starting with `#` are preserved as-is; plain names work too.

### Direct messages (DMs)

- Auto-discovered from `binary_sensor.meshcore_*_<pubkey>_messages` entities.
- Pin permanent contacts via `contacts:` config or Settings → Contacts.
- Add/remove contacts on the device from within the settings modal.

### Messaging

- **Send:** type and press `Enter` (or the send button).
- **Reply:** hover a message and click ↩ — the reply bar appears with an `@[Name]` prefix following MeshCore companion convention.
- **Multiline:** `Shift+Enter` inserts a newline; messages preserve line breaks.
- **Mention autocomplete:** type `@` to get a dropdown of contacts and nodes; navigate with `↑ ↓`, confirm with `Enter` or `Tab`.
- **Channel autocomplete:** type `#` to get a dropdown of channels; selecting navigates to that channel.
- **Inline highlights:** `@[Name]` mentions are shown as blue chips; `#channel` references as green chips (clicking navigates to that channel).
- **Resend:** when a channel message is not heard by any repeater (or a DM receives no ACK), a **↺ Resend** button appears on the bubble.

### Delivery status

Each own message shows a status footer under the bubble:

| Status | Meaning |
|--------|---------|
| `↑ sent` | Message dispatched to the radio |
| `📡 sending…` | Waiting for repeater confirmation |
| `📡 heard by N repeater(s)` | Confirmed reception with repeater list |
| `📡 broadcast (no relays heard)` | Sent but no repeater reported hearing it |
| `✓ delivered` | DM ACK received |
| `✕ no ACK` | DM sent, no acknowledgement |

The **hops toggle** button (📡 icon, top-right of chat header) collapses the status footer. When hidden, a compact `✓` in accent colour appears instead on confirmed messages.

### Nodes tab

Switch between **Chats** and **Nodes** using the tab bar at the top of the sidebar. The Nodes tab shows all discovered mesh nodes with online/offline status and a detail view on click.

### Mobile layout

At ≤ 640 px viewport width the sidebar and chat panel stack: the sidebar shows first; selecting a chat slides the panel in. A **‹** back button returns to the sidebar.

### Card height

Set `height:` in YAML to any CSS length. Examples:

```yaml
height: 700px    # fixed pixels
height: 80vh     # fraction of viewport
height: "min(80vh, 900px)"   # capped
```

---

## Repeater Card (`meshcore-repeater-card`)

### Minimal config

```yaml
type: custom:meshcore-repeater-card
```

Auto-discovers the first available repeater from `sensor.meshcore_*` entities.

### Full config reference

```yaml
type: custom:meshcore-repeater-card

# 10-hex pubkey prefix used in entity IDs, OR the repeater's friendly name.
# Omit to use the first discovered repeater.
repeater: b8f68f1234

# Card title override (default: repeater name from HA).
title: "Hilltop Repeater"

# History window for sparkline charts in hours (default: 24).
hours: 24

# Stat tiles to show (and their order). All available keys:
stats:
  - battery_percentage
  - bat
  - uptime
  - last_rssi
  - last_snr
  - tx_queue_len
  - noise_floor
  - nb_sent
  - nb_recv
  - airtime

# Sparkline charts to render (and their order).
charts:
  - battery_percentage
  - last_rssi
  - last_snr
  - airtime
  - tx_queue_len
  - noise_floor
```

### Available metrics

| Key | Label | Unit |
|-----|-------|------|
| `battery_percentage` | Battery | % |
| `bat` | Voltage | V |
| `uptime` | Uptime | — |
| `airtime` | Airtime | min |
| `last_rssi` | RSSI | dBm |
| `last_snr` | SNR | dB |
| `tx_queue_len` | TX queue | — |
| `noise_floor` | Noise floor | dBm |
| `nb_sent` | Packets sent | — |
| `nb_recv` | Packets recv | — |
| `sent_flood` | Flood sent | — |
| `sent_direct` | Direct sent | — |
| `recv_flood` | Flood recv | — |
| `recv_direct` | Direct recv | — |
| `full_evts` | Full events | — |
| `direct_dups` | Direct dups | — |

---

## Theming

Both cards read the active Home Assistant theme automatically via CSS custom properties (`--primary-color`, `--card-background-color`, `--primary-text-color`, etc.). Light, dark, and custom themes all work without any configuration.

To override the chat bubble border-radius:

```yaml
# In your theme YAML or card's style: override
# --bubble-radius controls chat bubble rounding (default: 18px)
```

Card height and border-radius follow `--ha-card-border-radius` and `--ha-card-box-shadow` from the active theme.

---

## Troubleshooting

### Card doesn't appear / "Custom element doesn't exist"

- Confirm the `.js` files are in `/config/www/`.
- Confirm the resource URLs are registered (Settings → Dashboards → Resources).
- Hard-refresh the browser (`Ctrl+Shift+R` / `Cmd+Shift+R`).

### No channels or messages appear

- Check that the meshcore-ha integration is installed and your node is connected.
- Look for `binary_sensor.meshcore_*_messages` entities in **Developer Tools → States**.
- If entities exist but the card doesn't find them, set `device_prefix:` manually to the 6-char prefix shown in the entity IDs.

### Messages load slowly / missing history

- Increase `history_hours:` (e.g. `48`).
- The logbook must be enabled in HA. If the logbook integration is disabled, history won't load.
- History is loaded once per chat per page load; navigate away and back to reload.

### "Apply to device" does nothing

- Ensure the meshcore-ha integration is connected (check the integration status in Settings → Devices & Services).
- The `set_channel` command requires firmware that supports API commands.
- Check HA logs for `meshcore` errors after clicking Apply.

### Autocomplete doesn't show contacts

- The card builds the contact list from `_discoveredContacts` and `_discoveredNodes` populated by the integration. If no contacts appear, verify the integration has discovered your mesh nodes (check the Nodes tab).
- Ensure at least one advert has been received from the target node.

### Messages stuck on "sending…"

- The card waits up to 10 seconds for a delivery update from the integration. If none arrives, status clears to "broadcast (no relays heard)".

### Multiple MeshCore devices

Set `entry_id:` in each card's YAML to the config entry ID of the device it should use. Find the entry ID in **Settings → Devices & Services → Meshcore → ⋮ → System information**.

---

## Example dashboard YAML

```yaml
views:
  - title: MeshCore
    cards:
      - type: custom:meshcore-chat-card
        node_name: MyNode
        height: 75vh
        history_hours: 48
        channels:
          - idx: 0
            name: Public
          - idx: 1
            name: "#local"

      - type: custom:meshcore-repeater-card
        repeater: b8f68f1234
        hours: 24
        charts:
          - battery_percentage
          - last_rssi
          - last_snr
```

---

## Related

- [meshcore-ha integration](https://github.com/meshcore-dev/meshcore-ha) — the HA integration these cards depend on
- [meshcore-ha documentation](https://meshcore-dev.github.io/meshcore-ha/) — full sensor, service, and automation reference
- [MeshCore firmware](https://github.com/meshcore-dev/MeshCore) — the radio firmware

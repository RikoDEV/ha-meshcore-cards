# MeshCore Companion Cards for Home Assistant

A MeshCore companion app inside Home Assistant: real-time chat, channels, direct messages, contacts, a node browser, a command console and repeater telemetry. It runs as a full-page sidebar panel and as dashboard cards.

[![Open your Home Assistant instance and open this repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=RikoDEV&repository=ha-meshcore-cards&category=integration)

<img width="2560" height="1269" alt="MeshCore chat" src="https://github.com/user-attachments/assets/a3b80ca7-6280-48d9-aec4-e8eb907edd9b" />

<img width="2560" height="1269" alt="MeshCore repeater card" src="https://github.com/user-attachments/assets/96ed2ad6-b4d6-49ff-ab70-ab10b54f2996" />

## Contents

- [What you get](#what-you-get)
- [Requirements](#requirements)
- [Installation](#installation)
- [Sidebar panel](#sidebar-panel)
- [Chat card](#chat-card)
- [LiteScope (optional)](#litescope-optional)
- [Repeater card](#repeater-card)
- [Theming](#theming)
- [Troubleshooting](#troubleshooting)
- [Bot automations](#bot-automations)
- [Related](#related)

## What you get

| | How you use it | Purpose |
|---|---|---|
| **Sidebar panel** | **MeshCore** entry in the Home Assistant sidebar | The chat UI as a full page, with a URL for every view |
| **Chat card** | `type: custom:meshcore-chat-card` | The same chat UI on any dashboard |
| **Repeater card** | `type: custom:meshcore-repeater-card` | Live stats, history charts, settings and a console for one repeater |

All three come from one small integration, `meshcore_cards`. It serves the JavaScript, loads the cards in the frontend and registers the panel, so there are no dashboard resources to add and nothing to put in `configuration.yaml`.

## Requirements

- [meshcore-ha](https://github.com/meshcore-dev/meshcore-ha) **3.0 or newer**, set up with at least one companion (USB, BLE or TCP).
- Home Assistant **2025.6 or newer**.
- An **administrator** account for anything that runs a companion command: the consoles, channel provisioning, adding or removing contacts, adverts and device settings. meshcore-ha 3.0 restricts those to admins. Reading and sending messages works for every user.

## Installation

### 1. Install

**HACS (recommended).** Click the button at the top of this page, then **Download**. If HACS answers "Repository not found", add the repository once by hand:

1. Open HACS and choose **⋮ → Custom repositories**.
2. Add `https://github.com/RikoDEV/ha-meshcore-cards` with type **Integration**.
3. Click **Download** on **MeshCore Companion Cards**.

**Manual.** Copy `custom_components/meshcore_cards` from this repository into `config/custom_components/`.

Either way, **restart Home Assistant** afterwards.

### 2. Add the integration

[![Open your Home Assistant instance and start setting up a new integration.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=meshcore_cards)

Go to **Settings → Devices & Services → Add integration → MeshCore Companion Cards**, pick your companion and confirm the sidebar title, icon and URL path.

The **MeshCore** panel appears in the sidebar, and both cards become available on every dashboard. Reload the browser once so the frontend picks them up.

### 3. Add cards to a dashboard (optional)

Use **+ Add card** and search for *MeshCore*, or paste YAML:

```yaml
type: custom:meshcore-chat-card
```

The card finds your companion from its `binary_sensor.meshcore_*_messages` entities, so a basic setup needs no options.

<details>
<summary><b>Upgrading from the dashboard-plugin version (2.0 and older)</b></summary>

Earlier versions were a HACS *Dashboard* plugin. To switch:

1. In HACS, remove the old **MeshCore Companion Cards** download, then add the repository again as an **Integration**.
2. Remove the old entries under **Settings → Dashboards → ⋮ → Resources** (`/hacsfiles/ha-meshcore-cards/…` or `/local/meshcore-…-card.js`) and delete any copies in `config/www/`.
3. If you added a `panel_custom:` entry for `meshcore-panel` to `configuration.yaml`, remove it. The integration registers the panel now, and one URL path cannot be registered twice.

Your dashboards keep working: card types and options are unchanged.

</details>

## Sidebar panel

The panel fills the page, uses the Home Assistant app bar, and gives every view its own URL. Browser back, bookmarks and links all work.

| URL (default path `meshcore`) | View |
|---|---|
| `/meshcore/chats` | Chat list (wide screens also show the last-open chat) |
| `/meshcore/chats/ch/<idx>` | A channel |
| `/meshcore/chats/dm/<pubkey prefix>` | A direct conversation |
| `/meshcore/nodes` | Node list |
| `/meshcore/nodes/<pubkey prefix>` | Node detail |
| `/meshcore/console` | Command console |
| `/meshcore/settings/<tab>` | Settings: `general`, `device`, `channels`, `contacts`, `about` |

- **Change it:** **Settings → Devices & Services → MeshCore Companion Cards → Configure** edits the title, icon and URL path, can limit the panel to administrators, and sets the optional [LiteScope](#litescope-optional) address.
- **Several companions:** add the integration once per companion. Each gets its own panel and URL path.
- **Remove it:** delete the integration entry.

## Chat card

The card and the panel are the same UI with four tabs: **Chat**, **Nodes**, **Console** and **Settings**.

### Options

Every option is optional and can also be set in the visual card editor.

| Option | Default | Description |
|---|---|---|
| `node_name` | from the device | Your node's name, used to mark your own messages |
| `device_prefix` | auto-detected | First 6 hex characters of the companion's public key, as used in entity IDs |
| `entry_id` | auto-detected | Config entry of the companion. Set it only if detection picks the wrong one |
| `channels` | discovered | List of `idx` / `name` pairs that override or pre-configure channel names |
| `contacts` | discovered | List of `pubkey_prefix` / `name` pairs to pin in the chat list |
| `max_messages` | `200` | Messages kept in memory per chat |
| `history_hours` | `24` | Hours of logbook history loaded when a chat is first opened |
| `default_pane` | `chats` | Tab shown first: `chats` or `nodes` |
| `compact` | `false` | Tighter rows in the chat list |
| `height` | `600px` | Card height as any CSS length: `700px`, `80vh`, `"min(80vh, 900px)"`. Ignored by the panel |
| `litescope_auto_resend` | `false` | Resend a channel message that nobody heard. Needs a [LiteScope](#litescope-optional) address in the integration |
| `litescope_resend_delay` | `60` | Seconds to wait before a resend, 20 to 600 |
| `litescope_max_resends` | `1` | Automatic resends per message, 1 to 3 |

```yaml
type: custom:meshcore-chat-card
node_name: MyNode
height: 75vh
history_hours: 48
channels:
  - idx: 0
    name: Public
  - idx: 1
    name: "#local"
contacts:
  - pubkey_prefix: fe3af51b24b9
    name: Alice Pocket V2
```

The **Settings** tab stores the same preferences per browser (in `localStorage`), and they take priority over the YAML. Each phone or computer can therefore keep its own node name, history length, channel list and so on.

### Chats

- **Channels** come from the integration's `get_channels` service and from `binary_sensor.meshcore_*_ch_*_messages` entities.
- **Direct chats** come from `binary_sensor.meshcore_*_<pubkey>_messages` entities and from `contacts:`.
- **Add a channel** with **+** in the chat list, or edit the list under **Settings → Channels** and choose **Apply to device**.
- **Region scope:** each channel header has a scope picker. Pick or add a scope (for example `#region`) to send that channel's messages as a region-scoped flood.
- **Close a chat** with **×**. It comes back when a new message arrives, or through "Show hidden chats".
- **Send an advert** (flood or zero-hop) with the antenna button.

### Messaging

| Action | How |
|---|---|
| Send | `Enter` or the send button |
| New line | `Shift+Enter` |
| Reply | Hover a message and click ↩. The message is prefixed with `@[Name]` |
| Mention | Type `@`, choose with `↑` `↓`, confirm with `Enter` or `Tab` |
| Link a channel | Type `#`. Clicking a `#channel` chip in a message opens that channel |
| Resend | **↺ Resend** appears when no repeater heard a channel message or a direct message got no ACK |

### Delivery status

Your own messages show a status line under the bubble.

| Status | Meaning |
|---|---|
| `↑ sent` | Direct message accepted by the companion, waiting for the ACK |
| `✓ delivered` | Direct message acknowledged |
| `✕ no ACK` | Direct message not acknowledged in time |
| `📡 sending…` | Channel message sent, still listening for repeats (4 to 20 seconds) |
| `📡 heard by N repeaters` | Repeaters were heard relaying it; they are listed next to the status |
| `📡 broadcast (no relays heard)` | Sent, but no repeat was heard |
| `📡 unconfirmed (too long to hear repeats)` | The message is too long for the companion to report relayed copies |
| `🔭 …` | What a LiteScope analyzer saw, when one is connected. See [LiteScope](#litescope-optional) |
| `✕ <reason>` | The message never left the companion: not connected, rejected, contact missing, or held back by the mesh traffic policy |

The toggle at the top right of a chat hides these lines; confirmed messages then show a small `✓` instead.

### Nodes, Console and Settings

- **Nodes** lists every discovered node with its type and online state. Selecting one opens its details, including a map when it reports a position.
- **Console** runs companion commands (`get_bat`, `send_advert`, `set_channel …`) and shows the response. Click a command in the list to prefill it.
- **Settings** has five tabs: **General** (preferences), **Device** (name, radio, location, time sync), **Channels**, **Contacts** and **About**.

### Narrow screens

When the card or panel is 640 px wide or less, the list and the conversation stack. Selecting a chat slides it in, and the back arrow returns to the list. In the panel that step is a real navigation, so the browser or phone back button works too.

## LiteScope (optional)

[LiteScope](https://github.com/RikoDEV/litescope) is a self-hosted MeshCore network analyzer fed by observer nodes. The companion only hears repeats within its own radio range; LiteScope sees the message wherever its observers are. Connect one that covers your mesh and every **channel message you send** gets a second status chip:

| Chip | Meaning |
|---|---|
| `🔭 checking…` | Looking for the message on LiteScope |
| `🔭 4 observers · 3 hops` | Heard by 4 observers; the longest path had 3 hops. Hover for the regions reached, click to open the packet trace in LiteScope |
| `🔭 not seen` | LiteScope answered and has no trace of the message |
| `🔭 not seen · resent` | Nobody heard it, so it was sent again |
| `🔭 unavailable` | LiteScope could not be reached, or cannot read this channel. Hover for the reason |

A message seen by at least one observer counts as delivered, so the **↺ Resend** button no longer appears on it.

**Set it up** in the integration: **Settings → Devices & Services → MeshCore Companion Cards → Configure → LiteScope URL** (the same field is offered when you first add the integration). It applies to that companion's panel and cards for every user and browser. Reload the browser after changing it. Leave it empty to turn the feature off; nothing is requested then.

**Auto-resend** is off by default and is a per-browser preference: enable it under the chat's **Settings → General**, or with `litescope_auto_resend:` in the card YAML. A channel message is sent again after the configured wait only if all of these hold:

- LiteScope answered and has not seen the message,
- the companion heard no repeater relay it,
- the send itself did not fail,
- the resend limit (1 to 3) is not used up.

The wait is also the pause between two resends. Each resend is a new message on air, and anyone who did receive the first one sees it twice, so keep the limit low. Under the Governed traffic policy a resend spends message credit like any other send.

What to know:

- **Channel messages only.** Direct messages are encrypted end to end, so LiteScope cannot match them.
- **LiteScope must be able to read the channel.** Public and `#hashtag` channels work out of the box; a private channel needs its key in LiteScope's `channelKeys`.
- **The browser talks to LiteScope directly.** If Home Assistant is served over `https`, the LiteScope URL must be `https` too, and your origin must be allowed by LiteScope's `allowedOrigins` (the default allows all).
- **Checks stop when you leave the page.** A message is polled for up to 90 seconds after sending (or until the resend wait is over) while the card or panel stays open.

## Repeater card

Shows one repeater in three tabs: **Information** (stat tiles, history charts, neighbours), **Settings** and **Console**.

### Options

| Option | Default | Description |
|---|---|---|
| `repeater` | first one found | 10-hex public-key prefix from the entity IDs, or the repeater's name |
| `title` | repeater name | Card title |
| `hours` | `24` | History window for the charts, 1 to 720 |
| `stats` | see below | Stat tiles to show, in order |
| `charts` | see below | Charts to show, in order |
| `entry_id` | auto-detected | Config entry of the companion used to reach the repeater. Only needed if the console cannot find it |
| `login_password` | empty | Repeater admin password, used by the Settings and Console tabs |

```yaml
type: custom:meshcore-repeater-card
repeater: b8f68f1234
title: Hilltop Repeater
hours: 48
stats: [battery_percentage, bat, uptime, last_rssi, last_snr, tx_queue_len]
charts: [battery_percentage, last_rssi, last_snr, airtime]
```

The `stats` and `charts` shown are the defaults.

### Metrics

| Key | Label | Unit |
|---|---|---|
| `battery_percentage` | Battery | % |
| `bat` | Voltage | V |
| `uptime` | Uptime | |
| `airtime` | Airtime | min |
| `last_rssi` | RSSI | dBm |
| `last_snr` | SNR | dB |
| `noise_floor` | Noise floor | dBm |
| `tx_queue_len` | TX queue | |
| `nb_sent` / `nb_recv` | Packets sent / received | |
| `sent_flood` / `sent_direct` | Flood / direct packets sent | |
| `recv_flood` / `recv_direct` | Flood / direct packets received | |
| `full_evts` | Full events | |
| `direct_dups` | Direct duplicates | |

A metric is only available when meshcore-ha exposes the matching `sensor.meshcore_<pubkey>_*` entity for that repeater.

## Theming

Everything follows the active Home Assistant theme through its CSS variables (`--primary-color`, `--card-background-color`, `--primary-text-color` and so on). Light, dark and custom themes work without configuration. Cards use the theme's `--ha-card-border-radius` and `--ha-card-box-shadow`; the panel's app bar uses `--app-header-background-color` and `--app-header-text-color`.

## Troubleshooting

<details>
<summary><b>The panel or cards don't appear ("Custom element doesn't exist")</b></summary>

- Check that **MeshCore Companion Cards** is listed under **Settings → Devices & Services**. Nothing is loaded until the integration is set up.
- Restart Home Assistant after installing or updating, then hard-refresh the browser (`Ctrl+Shift+R` / `Cmd+Shift+R`).
- If the integration entry failed to set up, another panel or dashboard probably uses the same URL path. Remove a leftover `panel_custom:` entry or choose another path.

</details>

<details>
<summary><b>No channels or messages</b></summary>

- Check that meshcore-ha is set up and the companion is connected.
- Look for `binary_sensor.meshcore_*_messages` entities under **Developer Tools → States**.
- If they exist but the card stays empty, set `device_prefix:` to the 6 characters shown in those entity IDs.

</details>

<details>
<summary><b>History is missing</b></summary>

- Raise `history_hours:`.
- History comes from the Home Assistant logbook, which must be enabled.
- It is loaded once per chat per page load. Reload the page to fetch it again.

</details>

<details>
<summary><b>A message stays on "sending…"</b></summary>

Listening for repeats takes 4 to 20 seconds depending on the packet's airtime. If no final result arrives within 25 seconds, the status changes to "broadcast (no relays heard)".

</details>

<details>
<summary><b>"This action needs a Home Assistant administrator"</b></summary>

meshcore-ha 3.0 only lets administrators run companion commands. Log in with an admin account to use the consoles, provision channels, manage contacts, send adverts or change device settings.

</details>

<details>
<summary><b>A command is rejected, or "try again in N seconds"</b></summary>

- meshcore-ha 3.0 refuses commands that reset the node, replace its identity or send raw frames.
- Under the Governed mesh traffic policy, sends and mesh commands spend credit from a budget. When it runs out, the integration says how long to wait, and that message is shown under the bubble or in the console.

</details>

<details>
<summary><b>"Apply to device" does nothing</b></summary>

- Check that the companion is connected and that you are an administrator.
- Look for `meshcore` errors in the Home Assistant log after clicking **Apply to device**.

</details>

<details>
<summary><b>Mention autocomplete shows no contacts</b></summary>

Suggestions come from the nodes the integration has discovered. Check the **Nodes** tab; a node appears there after its first advert is received.

</details>

<details>
<summary><b>Several companions</b></summary>

Each panel and card only shows its own companion's messages. The panel is bound to the companion you picked when adding the integration. A card picks its companion from `device_prefix:`, or from `entry_id:` if you set it; the entry ID is the last part of the URL when you open the companion under **Settings → Devices & Services → MeshCore**.

</details>

## Bot automations

The `automations/` folder has optional example automations that answer commands sent on a channel. They are plain Home Assistant automations: paste one into **Settings → Automations → ⋮ → Edit in YAML** and adjust it. All of them listen on **channel 2**; change `channel_idx` to suit your mesh.

| File | Command | Reply | Also needs |
|---|---|---|---|
| `meshcore-path-automation.yaml` | `es path` | The repeaters the message travelled through, one per line | `input_text.meshcore_path_ratelimit` helper |
| `meshcore-traceroute-automation.yaml` | `es trace` | Hop count, path and signal (RSSI, SNR) | |
| `meshcore-testreg-automation.yml` | `es testreg` | The region scope the message arrived with | |
| `meshcore-weather-automation.yaml` | `es weather <city>` | Current weather for that city | `rest_command.geocode_city` and `rest_command.get_weather_dynamic` |

<details>
<summary><b>Path automation setup</b></summary>

It limits each sender to 2 requests per minute and keeps that state in a text helper. Create it under **Settings → Devices & Services → Helpers → Create helper → Text** with the name `meshcore_path_ratelimit`, or in `configuration.yaml`:

```yaml
input_text:
  meshcore_path_ratelimit:
    name: MeshCore Path Rate Limit
    max: 1024
```

To show a friendly name for your own repeater, edit the two lines at the top of the `reply_text` template:

```yaml
{% set my_rpt_prefix = 'B37E15' %}       # first 6 hex chars of your repeater's public key
{% set my_rpt_name   = 'My Repeater' %}  # name to show instead
```

Set `my_rpt_prefix` to `''` to turn the override off.

</details>

## Related

- [meshcore-ha](https://github.com/meshcore-dev/meshcore-ha): the integration these cards build on
- [meshcore-ha documentation](https://meshcore-dev.github.io/meshcore-ha/): sensors, services, events and the traffic policy
- [MeshCore](https://github.com/meshcore-dev/MeshCore): the radio firmware

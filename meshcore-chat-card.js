/**
 * MeshCore Chat Card for Home Assistant
 * Inspired by the MeshCore companion app UI
 *
 * Installation:
 *   1. Copy this file to /config/www/meshcore-chat-card.js
 *   2. Add to Lovelace resources:
 *      url: /local/meshcore-chat-card.js
 *      type: module
 *
 * Card YAML config (everything is optional — auto-discovered from binary sensors):
 *   type: custom:meshcore-chat-card
 *   node_name: MattDub                # your own node name (to mark own messages)
 *   device_prefix: b8f68f              # 6-char device pubkey prefix; auto-detected
 *                                      # from binary_sensor.meshcore_*_messages
 *   entry_id: abc123                   # config entry id; only needed with multiple devices
 *   channels:                          # OPTIONAL: override discovered channel names
 *     - idx: 0
 *       name: Public
 *     - idx: 1
 *       name: "#test"
 *   contacts:                          # OPTIONAL: pin DM contacts by pubkey prefix
 *     - pubkey_prefix: fe3af51b24b9
 *       name: MattDub Pocket V2
 *   max_messages: 200                  # messages kept per chat (default 200)
 *   history_hours: 24                  # backlog hours to load from logbook (default 24)
 *   default_pane: chats                # "chats" | "nodes"
 *   compact: false                     # tighter row spacing
 *
 * The same options are editable via the gear icon in the sidebar (companion
 * settings) and via the Lovelace visual editor (getConfigElement).
 */

const CHAT_CARD_VERSION = "1.0.0";
console.info(
  `%c MESHCORE-CHAT-CARD %c v${CHAT_CARD_VERSION} `,
  "color:#fff;background:#1976d2;font-weight:700;padding:2px 4px;border-radius:3px 0 0 3px",
  "color:#1976d2;background:#e3f2fd;font-weight:700;padding:2px 4px;border-radius:0 3px 3px 0",
);

const LS_PREFIX = "meshcore-chat-card:";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const COLORS = [
  "#4fc3f7",
  "#81c784",
  "#ffb74d",
  "#f06292",
  "#ce93d8",
  "#80deea",
  "#a5d6a7",
  "#fff176",
  "#ff8a65",
  "#90caf9",
  "#e57373",
  "#4db6ac",
  "#dce775",
  "#ba68c8",
  "#4dd0e1",
];

function colorForName(name) {
  let hash = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++)
    hash = (hash * 31 + s.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(hash) % COLORS.length];
}

const iconStyle = (color) =>
  `background:${color}22;color:${color};border:1.5px solid ${color}44`;

function relativeTime(ts) {
  if (!ts) return "—";
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 32-char hex SHA-256 (matches HA's sha256|truncate(32)); falls back to pure-JS on HTTP.
async function sha256Hex32(text) {
  const bytes = _utf8Bytes(text);
  // WebCrypto path — preferred, native code.
  if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
    try {
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return _bytesToHex(new Uint8Array(digest)).slice(0, 32);
    } catch (_) {
      // fall through to JS implementation
    }
  }
  return _sha256JsHex(bytes).slice(0, 32);
}

function _utf8Bytes(str) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
  // Manual UTF-8 encoder for very old browsers.
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0xd800 || c >= 0xe000) {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else {
      i++;
      c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      out.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
    }
  }
  return new Uint8Array(out);
}

function _bytesToHex(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, "0");
  }
  return s;
}

// Pure-JS SHA-256 — used as a fallback when WebCrypto isn't available
// (i.e. the page is served over plain HTTP from a non-localhost host).
// FIPS 180-4 reference implementation; ~80 lines, no external deps.
function _sha256JsHex(bytes) {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  // Pad to a multiple of 64 bytes per the spec.
  const bitLen = bytes.length * 8;
  const padLen = (56 - ((bytes.length + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(bytes.length + 1 + padLen + 8);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  // Length is appended as 64-bit big-endian; bitLen fits in 32 bits for
  // anything we'd hash from a channel name, so the high word is 0.
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(chunk + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  let out = "";
  for (let i = 0; i < 8; i++) out += H[i].toString(16).padStart(8, "0");
  return out;
}

const STYLE = `
  :host {
    /*
     * Map our internal palette onto the active HA theme.
     * HA exposes its full palette as CSS custom properties on :root / the
     * document, which cascade into shadow DOM through :host.  We re-publish
     * them under short names so the rest of the stylesheet doesn't need to
     * change.  Hardcoded fallbacks kick in only when the HA vars are absent
     * (e.g. in a plain browser preview).
     *
     * Surface hierarchy (dark example → light equivalent):
     *   --bg   page/app bg      --primary-background-color   #111 → #fafafa
     *   --bg2  sidebar surface  --card-background-color      #1c1c1e → #fff
     *   --bg3  chat area        --secondary-background-color #202020 → #f3f4f6
     *   --bg4  active row       slight primary tint on --bg3
     */
    --bg:       var(--primary-background-color,   #0d0f10);
    --bg2:      var(--card-background-color,       #161a1d);
    --bg3:      var(--secondary-background-color,  #1e2428);
    /* Active / hover rows: subtle primary tint. HA provides --rgb-primary-color
       as "r,g,b" so we can use it in rgba() without color-mix(). */
    --bg4:      rgba(var(--rgb-primary-color, 56,189,248), 0.07);

    --border:   var(--divider-color,              #2a3038);

    --text:     var(--primary-text-color,         #e2e8f0);
    --text2:    var(--secondary-text-color,       #94a3b8);
    --text3:    var(--disabled-text-color,        #64748b);

    --accent:   var(--primary-color,              #38bdf8);
    /* Tinted accent backgrounds via --rgb-primary-color */
    --accent-bg: rgba(var(--rgb-primary-color, 56,189,248), 0.12);

    /* Own-message bubble: soft primary tint */
    --own-bg:   rgba(var(--rgb-primary-color, 56,189,248), 0.16);
    --own-text: var(--primary-color,              #7dd3fc);

    --online:   var(--success-color,              #4ade80);
    --offline:  var(--disabled-text-color,        #475569);
    --unread:   var(--accent-color, var(--primary-color, #f97316));

    /* Border radius from HA card theme; falls back to 12px */
    --radius:        var(--ha-card-border-radius,  12px);
    --radius-sm:     8px;
    --bubble-radius: 18px; /* chat bubbles intentionally rounder than the card */

    font-family: var(--mdc-typography-font-family, var(--paper-font-body1_-_font-family, 'Roboto', 'Segoe UI', system-ui, sans-serif));
    display: block;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .card {
    background: var(--ha-card-background, var(--bg));
    border-radius: var(--ha-card-border-radius, var(--radius));
    box-shadow: var(--ha-card-box-shadow, none);
    border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--border));
    overflow: hidden;
    display: flex;
    flex-direction: column;
    /* Height comes from --mcc-card-height (set inline on :host from
       config.height). Defaults to 600px, but can be any CSS length:
       a number → px, or strings like "80vh", "100%", "min(80vh, 900px)". */
    height: var(--mcc-card-height, 600px);
  }

  /* ── TOP TAB BAR ── */
  .top-tab-bar {
    display: flex;
    border-bottom: 1px solid var(--border);
    background: var(--bg2);
    flex-shrink: 0;
  }
  .top-tab {
    flex: 1;
    padding: 10px 4px 8px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text2);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    outline: none;
    transition: color 0.15s, border-color 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
  }
  .top-tab:hover:not(.active) { color: var(--text); }
  .top-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .top-tab-badge {
    background: var(--accent);
    /* Fallback for older browsers */
    color: #fff;
    /* oklch relative color: if accent lightness > 0.6 → black text, else → white.
       Supported Chrome 111+, Firefox 116+, Safari 16.4+. */
    color: oklch(from var(--accent) clamp(0, calc((0.6 - l) * 9999), 1) 0 h);
    font-size: 10px;
    font-weight: 700;
    border-radius: 8px;
    padding: 0 5px;
    min-width: 16px;
    text-align: center;
    line-height: 16px;
  }

  /* ── MAIN CONTENT (below tab bar) ── */
  .main-content {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── SETTINGS PANEL ── */
  .settings-panel {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  /* ── SIDEBAR ── */
  .sidebar {
    width: 260px;
    min-width: 220px;
    background: var(--bg2);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  .sidebar-header {
    padding: 12px 12px 8px;
    border-bottom: 1px solid var(--border);
  }
  .sidebar-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 8px;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .add-btn {
    background: var(--bg3);
    border: 1px solid var(--border);
    color: var(--text2);
    border-radius: 6px;
    width: 22px; height: 22px;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .add-btn:hover { background: var(--accent-bg); color: var(--accent); border-color: var(--accent); }
  .add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .add-btn.advert-btn { display: inline-flex; align-items: center; justify-content: center; }
  .add-btn.advert-btn svg { display: block; }
  .add-btn.broadcasting svg { animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.55; transform: scale(0.85); }
  }

  /* Advert popover (anchored under the antenna button) */
  .advert-popover {
    position: absolute;
    top: 28px; right: 0;
    z-index: 40;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--ha-card-box-shadow, 0 8px 24px rgba(0,0,0,0.35));
    width: 220px;
    padding: 10px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .advert-popover h5 {
    font-size: 11px; font-weight: 700;
    color: var(--text2);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .advert-popover button {
    text-align: left;
    background: var(--bg3);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    display: flex; align-items: center; gap: 8px;
    transition: all 0.12s;
  }
  .advert-popover button:hover {
    background: var(--accent-bg);
    color: var(--accent);
    border-color: var(--accent);
  }
  .advert-popover button:disabled { opacity: 0.55; cursor: not-allowed; }
  .advert-popover button .desc {
    color: var(--text3); font-weight: 500; font-size: 10.5px;
    display: block; margin-top: 1px;
  }
  .advert-popover .last-sent {
    color: var(--text3); font-size: 10.5px; padding: 2px 2px 0;
    border-top: 1px solid var(--border); margin-top: 2px; padding-top: 6px;
  }

  /* Toast banner (transient feedback) */
  .toast {
    position: absolute;
    left: 50%; bottom: 14px;
    transform: translateX(-50%);
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 12px;
    color: var(--text);
    box-shadow: var(--ha-card-box-shadow, 0 8px 24px rgba(0,0,0,0.35));
    z-index: 60;
    max-width: calc(100% - 32px);
    pointer-events: none;
    animation: toast-in 0.18s ease-out, toast-out 0.3s ease-in 2.7s forwards;
  }
  .toast.ok    { border-color: var(--success-color, #4ade80); color: var(--success-color, #86efac); }
  .toast.err   { border-color: var(--error-color, #ef4444); color: var(--error-color, #fca5a5); }
  @keyframes toast-in {
    from { opacity: 0; transform: translate(-50%, 8px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes toast-out {
    to { opacity: 0; transform: translate(-50%, 8px); }
  }
  .search-box {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 10px;
  }
  .search-box ha-icon { color: var(--text3); flex-shrink: 0; --mdc-icon-size: 18px; }
  .search-box input {
    background: none; border: none; outline: none;
    color: var(--text2); font-size: 13px; width: 100%;
    font-family: inherit;
  }
  .search-box input::placeholder { color: var(--text3); }

  /* Top-level Chats / Nodes selector */
  .pane-tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
  }
  .pane-tab {
    flex: 1;
    padding: 9px 0;
    background: var(--bg2);
    border: none;
    color: var(--text3);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
    font-family: inherit;
  }
  .pane-tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
    background: var(--bg3);
  }
  .pane-tab:hover:not(.active) { color: var(--text2); }

  .filter-tabs {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .filter-tab {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 9px;
    border-radius: 20px;
    cursor: pointer;
    color: var(--text3);
    background: none;
    border: none;
    transition: all 0.15s;
    letter-spacing: 0.02em;
    font-family: inherit;
  }
  .filter-tab.active {
    background: var(--accent-bg);
    color: var(--accent);
  }
  .filter-tab:hover:not(.active) { color: var(--text2); }

  /* Add-channel inline form */
  .add-form {
    padding: 8px 12px 10px;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--bg3);
  }
  .add-form-row { display: flex; gap: 6px; }
  .add-form input {
    flex: 1;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-size: 12px;
    padding: 6px 8px;
    outline: none;
    font-family: inherit;
  }
  .add-form input.idx { flex: 0 0 50px; }
  .add-form input:focus { border-color: var(--accent); }
  .add-form button {
    background: var(--accent);
    color: var(--primary-background-color, #0d0f10);
    border: none;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
  }
  .add-form button.cancel {
    background: var(--bg2);
    color: var(--text2);
    border: 1px solid var(--border);
  }
  .add-form .hint { color: var(--text3); font-size: 10px; }

  .channel-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .channel-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.12s;
    position: relative;
  }
  .channel-item:hover { background: var(--bg3); }
  .channel-item.active { background: var(--bg4); }
  .channel-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
    letter-spacing: -0.5px;
    position: relative;
  }
  .presence-dot {
    position: absolute;
    bottom: -1px; right: -1px;
    width: 11px; height: 11px;
    border-radius: 50%;
    border: 2px solid var(--bg2);
    background: var(--offline);
  }
  .presence-dot.online { background: var(--online); }
  .channel-info { flex: 1; min-width: 0; }
  .channel-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .channel-sub {
    font-size: 11px;
    color: var(--text3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .channel-sub.node-type { color: var(--text2); font-style: italic; }
  .unread-badge {
    background: var(--unread);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    border-radius: 10px;
    padding: 2px 6px;
    min-width: 18px;
    text-align: center;
    text-shadow: 0 0 2px #000;
  }
  .chat-close {
    display: none;
    background: none;
    border: none;
    color: var(--text3);
    font-size: 17px;
    line-height: 1;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 2px;
    flex-shrink: 0;
  }
  .channel-item:hover .chat-close { display: inline-block; }
  .channel-item .chat-close:hover { color: var(--error-color, #fca5a5); background: rgba(var(--rgb-error-color, 239,68,68), 0.12); }
  .hidden-footer {
    margin: 8px 12px 4px;
    padding: 6px 8px;
    text-align: center;
    color: var(--text3);
    font-size: 11px;
    font-weight: 600;
    border: 1px dashed var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .hidden-footer:hover { color: var(--accent); border-color: var(--accent); }

  .empty-list {
    padding: 24px 14px;
    color: var(--text3);
    font-size: 12px;
    text-align: center;
    line-height: 1.5;
  }

  /* ── CHAT PANEL ── */
  .chat-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    position: relative;
  }
  .chat-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg2);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .chat-header-icon {
    width: 32px; height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
  }
  .chat-header-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .chat-header-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
  }
  /* ── Scope picker row (channel header) ── */
  .scope-row {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .scope-select {
    font-size: 10px;
    color: var(--text3);
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 1px 3px;
    cursor: pointer;
    max-width: 130px;
    outline: none;
    font-family: inherit;
  }
  .scope-select:hover, .scope-select:focus {
    background: var(--bg3, rgba(255,255,255,0.08));
    color: var(--text2);
  }
  .scope-add-btn {
    background: none;
    border: none;
    padding: 0 4px;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    color: var(--text3);
    border-radius: 4px;
  }
  .scope-add-btn:hover { color: var(--accent); }
  .scope-new-input {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg3, var(--bg));
    color: var(--text);
    width: 88px;
    outline: none;
    font-family: inherit;
  }
  .scope-new-confirm {
    background: none;
    border: none;
    padding: 0 4px;
    cursor: pointer;
    font-size: 11px;
    color: var(--accent);
    border-radius: 4px;
    line-height: 1;
  }
  /* Sidebar channel scope badge */
  .scope-badge {
    display: inline-block;
    margin-left: 5px;
    font-size: 9px;
    padding: 0 4px;
    border-radius: 6px;
    background: rgba(var(--rgb-primary-color, 56,189,248), 0.15);
    color: var(--accent);
    vertical-align: middle;
    font-weight: 600;
    white-space: nowrap;
  }
  /* Scope chip in message meta footer */
  .meta-scope {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 6px;
    background: rgba(var(--rgb-primary-color, 56,189,248), 0.12);
    color: var(--accent);
    white-space: nowrap;
    font-weight: 600;
  }
  .chat-header-sub {
    font-size: 12px;
    color: var(--text3);
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Hops-toggle pill button in the chat header */
  .hops-toggle {
    background: rgba(var(--rgb-secondary-text-color, 148,163,184), 0.10);
    border: 1px solid rgba(var(--rgb-secondary-text-color, 148,163,184), 0.20);
    border-radius: 10px;
    color: var(--text3);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    gap: 3px;
    font-size: 10px;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }
  .hops-toggle:hover {
    background: rgba(var(--rgb-secondary-text-color, 148,163,184), 0.20);
    color: var(--text2);
  }
  .hops-toggle.on {
    background: rgba(var(--rgb-primary-color, 56,189,248), 0.15);
    border-color: rgba(var(--rgb-primary-color, 56,189,248), 0.35);
    color: var(--accent);
  }

  /* Hide the meta footer when the toggle is off */
  :host(.hide-hops) .msg-meta { display: none; }

  .messages-area {
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  .scroll-to-bottom {
    position: absolute;
    bottom: 72px;
    right: 16px;
    width: 36px; height: 36px;
    border-radius: 50%;
    border: none;
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,.3);
    transition: opacity 0.2s, transform 0.2s;
    z-index: 10;
    --mdc-icon-size: 20px;
  }
  .scroll-to-bottom[hidden] { display: none; }
  .scroll-to-bottom:hover { opacity: 0.85; }

  .msg-group { margin-bottom: 6px; }
  .msg-sender {
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 3px;
    padding-left: 2px;
  }
  .msg-row {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    margin-bottom: 2px;
  }
  .msg-row.own { flex-direction: row-reverse; }

  .msg-bubble {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: var(--bubble-radius);
    border-bottom-left-radius: 4px;
    padding: 7px 11px;
    font-size: 13.5px;
    color: var(--text);
    max-width: 75%;
    line-height: 1.45;
    word-break: break-word;
  }
  .msg-bubble .msg-text {
    white-space: pre-wrap;
    word-break: break-word;
  }
  /* Compact delivery tick — shown on own bubbles only when the full
     meta footer is toggled off. Uses ::after so no extra DOM node needed. */
  :host(.hide-hops) .msg-row.own .msg-bubble[data-ack="confirmed"]::after {
    content: "✓";
    display: block;
    font-size: 9px;
    color: var(--accent);
    text-align: right;
    margin-top: 2px;
    line-height: 1;
    opacity: 0.85;
  }
  .msg-row.own .msg-bubble {
    background: var(--own-bg);
    border-color: rgba(var(--rgb-primary-color, 56,189,248), 0.4);
    color: var(--own-text);
    border-bottom-left-radius: var(--bubble-radius);
    border-bottom-right-radius: 4px;
  }
  .msg-time {
    font-size: 10px;
    color: var(--text3);
    padding: 0 3px;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .msg-row.own .msg-time { text-align: right; }

  /* Inline reply affordance — visible on bubble hover. */
  .msg-row { position: relative; }
  .reply-action, .copy-action {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 50%;
    width: 22px; height: 22px;
    display: none;
    align-items: center; justify-content: center;
    color: var(--text2);
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
  }
  .reply-action:hover { color: var(--accent); border-color: var(--accent); }
  .copy-action:hover  { color: var(--success-color, #4ade80); border-color: var(--success-color, #4ade80); }
  .msg-row:hover .reply-action,
  .msg-row:hover .copy-action { display: inline-flex; }

  /* Channel chip — #channelname references inside message text. */
  .channel-chip {
    display: inline-block;
    background: rgba(var(--rgb-success-color, 74,222,128), 0.13);
    color: var(--success-color, #86efac);
    border-radius: 4px;
    padding: 0 4px;
    font-size: 0.9em;
    font-weight: 600;
    cursor: pointer;
    line-height: 1.4;
  }
  .channel-chip:hover { background: rgba(var(--rgb-success-color, 74,222,128), 0.25); }

  /* MeshCore mention chip — Android companion's @[NAME] syntax. */
  .mention-chip {
    display: inline-block;
    background: rgba(var(--rgb-primary-color, 56,189,248), 0.18);
    color: var(--accent);
    border-radius: 4px;
    padding: 0 5px;
    font-weight: 700;
    font-size: 12.5px;
    cursor: pointer;
    line-height: 1.4;
  }
  .mention-chip:hover { background: rgba(var(--rgb-primary-color, 56,189,248), 0.32); }
  .mention-chip.me {
    background: rgba(var(--rgb-warning-color, 249,115,22), 0.22);
    color: var(--warning-color, #fdba74);
  }
  .mention-chip.inline { font-weight: 600; }

  /* Per-message meta footer (delivery / hop / repeater list) */
  .msg-meta {
    margin-top: 5px;
    padding-top: 4px;
    border-top: 1px dashed rgba(var(--rgb-secondary-text-color, 148,163,184), 0.18);
    color: var(--text3);
    font-size: 10.5px;
    line-height: 1.35;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }
  .msg-meta .meta-icon {
    font-size: 11px;
    margin-right: 1px;
  }
  .msg-meta .meta-rps {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-left: 4px;
  }
  .msg-meta .meta-rp {
    background: rgba(var(--rgb-secondary-text-color, 148,163,184), 0.14);
    color: var(--text2);
    border-radius: 8px;
    padding: 1px 6px;
    font-size: 10px;
    white-space: nowrap;
  }
  .msg-meta .meta-rp.more {
    background: rgba(var(--rgb-secondary-text-color, 148,163,184), 0.06);
    color: var(--text3);
    cursor: default;
    position: relative;
  }
  .msg-meta .meta-rp.more:hover { color: var(--text2); }
  .meta-rp-overflow {
    display: none;
    position: absolute;
    bottom: calc(100% + 4px);
    left: 0;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 6px 8px;
    min-width: 120px;
    z-index: 50;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    display: none;
    flex-direction: column;
    gap: 3px;
  }
  .msg-meta .meta-rp.more:hover .meta-rp-overflow {
    display: flex;
  }
  .meta-rp-overflow-item {
    font-size: 11px;
    color: var(--text2);
    padding: 2px 4px;
    border-radius: 4px;
    white-space: nowrap;
  }
  .msg-row.own .msg-meta {
    color: rgba(var(--rgb-primary-color, 125,211,252), 0.65);
    border-top-color: rgba(var(--rgb-primary-color, 125,211,252), 0.20);
  }
  .msg-row.own .msg-meta .meta-rp {
    background: rgba(var(--rgb-primary-color, 125,211,252), 0.16);
    color: var(--own-text);
  }

  /* When a message mentions me, give the bubble a left accent stripe. */
  .msg-row.mentions-me .msg-bubble {
    border-left: 3px solid #fdba74;
  }
  .msg-row.mentions-me.own .msg-bubble {
    border-left: 3px solid var(--own-text);
  }

  /* Briefly highlight a message when its quote is clicked */
  @keyframes flash {
    0%, 100% { box-shadow: 0 0 0 0 transparent; }
    20%      { box-shadow: 0 0 0 3px rgba(56,189,248,0.55); }
  }
  .msg-bubble.flash { animation: flash 1.2s ease-out; }

  /* Resend button — appears on own unacknowledged messages */
  .resend-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-top: 5px;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--warning-color, #f97316);
    background: rgba(var(--rgb-warning-color, 249,115,22), 0.10);
    color: var(--warning-color, #f97316);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .resend-btn:hover {
    background: rgba(var(--rgb-warning-color, 249,115,22), 0.22);
  }

  /* Reply composer bar above the input */
  .reply-bar {
    display: flex;
    align-items: stretch;
    gap: 0;
    padding: 6px 14px 6px;
    background: var(--bg2);
    border-top: 1px solid var(--border);
  }
  .reply-bar-inner {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: 6px;
    padding: 5px 8px 5px 10px;
    min-width: 0;
  }
  .reply-bar-icon { color: var(--accent); flex-shrink: 0; }
  .reply-bar-text { flex: 1; min-width: 0; font-size: 12px; line-height: 1.3; }
  .reply-bar-text .who { color: var(--accent); font-weight: 700; }
  .reply-bar-text .what {
    color: var(--text2);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .reply-bar-cancel {
    background: none;
    border: none;
    color: var(--text3);
    cursor: pointer;
    font-size: 16px;
    padding: 0 4px;
    flex-shrink: 0;
  }
  .reply-bar-cancel:hover { color: var(--text); }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text3);
    gap: 8px;
  }
  .empty-state svg { opacity: 0.3; }
  .empty-state p { font-size: 13px; }

  /* ── AUTOCOMPLETE POPUP ── */
  .autocomplete-popup {
    background: var(--bg2);
    border-top: 1px solid var(--border);
    overflow-y: auto;
    max-height: 192px;
  }
  .autocomplete-popup[hidden] { display: none; }
  .autocomplete-item {
    padding: 7px 14px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.1s;
  }
  .autocomplete-item:hover,
  .autocomplete-item[aria-selected="true"] {
    background: var(--accent-bg);
    color: var(--accent);
  }
  .autocomplete-item .ac-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .autocomplete-item .ac-hint { font-size: 10.5px; color: var(--text3); flex-shrink: 0; }

  /* ── INPUT ── */
  .input-area {
    padding: 10px 14px;
    border-top: 1px solid var(--border);
    background: var(--bg2);
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }
  .msg-input {
    flex: 1;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 9px 14px;
    color: var(--text);
    font-size: 13.5px;
    line-height: 1.45;
    outline: none;
    font-family: inherit;
    resize: none;
    min-height: 38px;
    max-height: 140px;
    overflow-y: auto;
    transition: border-color 0.15s;
  }
  .msg-input::placeholder { color: var(--text3); }
  .msg-input:focus { border-color: var(--accent); }
  .send-btn {
    background: var(--accent);
    border: none;
    border-radius: 50%;
    width: 36px; height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 0.15s, transform 0.1s;
    color: var(--primary-background-color, #0d0f10);
  }
  .send-btn:hover { opacity: 0.88; }
  .send-btn:active { transform: scale(0.93); }
  .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .status-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--online);
    margin-left: 6px;
    box-shadow: 0 0 6px var(--online);
  }

  .node-detail {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    color: var(--text2);
    font-size: 13px;
    line-height: 1.6;
  }
  .node-detail h3 {
    color: var(--text);
    font-size: 15px;
    margin-bottom: 8px;
  }
  .node-detail .kv { display: flex; gap: 8px; }
  .node-detail .kv .k { color: var(--text3); min-width: 110px; }
  .node-detail .kv .v { color: var(--text); word-break: break-all; }
  .node-map-wrap {
    margin-bottom: 14px;
    border: 1px solid var(--divider-color, rgba(255,255,255,0.08));
    border-radius: 8px;
    overflow: hidden;
    background: var(--secondary-background-color, rgba(0,0,0,0.2));
  }
  .node-map-title {
    font-size: 11px;
    color: var(--text3);
    padding: 5px 10px 4px;
    border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.06));
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .node-map-svg { display: block; width: 100%; height: auto; }
  .node-map-container { height: 220px; }
  .node-map-container ha-map { display: block; height: 100%; }
  .node-map-empty {
    padding: 14px;
    color: var(--text3);
    font-size: 12px;
    text-align: center;
    line-height: 1.6;
  }
  .node-map-legend {
    display: flex;
    gap: 10px;
    padding: 5px 10px;
    border-top: 1px solid var(--divider-color, rgba(255,255,255,0.06));
    font-size: 10px;
    color: var(--text3);
    flex-wrap: wrap;
  }
  .node-map-legend span { display: flex; align-items: center; gap: 4px; }
  .node-map-legend i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

  /* ── Settings modal ── */
  ha-dialog {
    --mdc-dialog-min-width: min(560px, 92vw);
    --mdc-dialog-content-padding-top: 0;
    --mdc-dialog-content-padding-bottom: 0;
    --mdc-dialog-content-padding-left: 0;
    --mdc-dialog-content-padding-right: 0;
    --mdc-dialog-max-height: 90vh;
  }
  .modal-tabs {
    display: flex;
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .modal-tab {
    flex: 1;
    padding: 10px 4px 8px;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text2);
    font-family: inherit;
    outline: none;
    transition: color 0.15s, border-color 0.15s;
  }
  .modal-tab:hover:not(.active) { color: var(--text); }
  .modal-tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
  .modal-body {
    padding: 16px;
    color: var(--text2);
    font-size: 13px;
  }
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--divider-color, rgba(0,0,0,.12));
    background: var(--card-background-color, var(--primary-background-color, #fff));
    position: sticky;
    bottom: 0;
    z-index: 2;
  }
  .modal-footer .spacer { flex: 1; }
  .modal-btn {
    padding: 8px 20px;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    transition: opacity 0.15s;
  }
  .modal-btn:hover { opacity: 0.85; }
  .modal-btn.secondary {
    background: none;
    color: var(--primary-color);
  }
  .modal-btn.primary {
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
  }
  .saved-pill {
    align-self: center;
    color: var(--success-color, #4caf50);
    font-size: 12px;
    font-weight: 600;
    margin-right: 4px;
    animation: saved-fade 3.6s ease-out forwards;
  }
  @keyframes saved-fade {
    0%, 70% { opacity: 1; }
    100% { opacity: 0; }
  }
  .form button {
    background: var(--accent);
    color: var(--primary-background-color, #0d0f10);
    border: none;
    border-radius: 6px;
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
  }
  .form button.secondary {
    background: var(--bg2);
    color: var(--text2);
    border: 1px solid var(--border);
  }

  .form { display: flex; flex-direction: column; gap: 12px; }
  /* Stretch labels so siblings without a .help line still match the height
     of ones that do, keeping the inputs themselves aligned at the top of
     each cell. align-items:center pushed the inputs down whenever a single
     label in the row had a description below it. */
  .form .row { display: flex; gap: 8px; align-items: stretch; }
  .form-section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text3);
    margin-bottom: -4px;
  }
  .form-row-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .settings-action-btn {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 12px;
    color: var(--text);
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
  }
  .settings-action-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .settings-action-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  /* Device tab pane */
  .device-pane { gap: 0; padding: 0; }
  .device-section {
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .device-section:last-child { border-bottom: none; }
  .device-section-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .device-section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .device-info-grid {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .device-info-grid .kv {
    display: flex;
    gap: 8px;
    font-size: 12px;
  }
  .device-info-grid .k {
    color: var(--text3);
    min-width: 100px;
    flex-shrink: 0;
  }
  .device-info-grid .v {
    color: var(--text);
    word-break: break-all;
  }
  .device-pubkey {
    font-family: ui-monospace, 'Cascadia Code', 'Fira Mono', monospace;
    font-size: 11px;
    cursor: pointer;
  }
  .device-loading {
    font-size: 12px;
    color: var(--text3);
    padding: 4px 0 8px;
  }
  .form .help, .dvc-field .help { color: var(--text3); font-size: 11px; margin-top: 4px; line-height: 1.4; }
  .form hr { border: none; border-top: 1px solid var(--border); margin: 4px 0; }
  /* Form field labels */
  .form label {
    display: flex; flex-direction: column; gap: 4px; flex: 1;
    font-size: 12px; font-weight: 600; color: var(--text2);
  }
  .form .row > label > .help { margin-top: auto; }
  /* Native inputs styled to match HA's filled text field look */
  .form input[type="text"],
  .form input[type="number"],
  .form select {
    background: var(--input-fill-color, var(--secondary-background-color, rgba(0,0,0,.06)));
    border: none;
    border-bottom: 1px solid var(--divider-color, rgba(var(--rgb-primary-text-color,0,0,0),.12));
    border-radius: var(--mdc-shape-small, 4px) var(--mdc-shape-small, 4px) 0 0;
    color: var(--primary-text-color);
    font-size: var(--mdc-typography-subtitle1-font-size, .875rem);
    font-family: inherit;
    padding: 8px 12px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    transition: border-bottom-color 0.15s;
  }
  .form input:focus,
  .form select:focus {
    border-bottom: 2px solid var(--primary-color);
  }
  .form ha-formfield { display: block; padding: 4px 0; }
  .dvc-field { margin-bottom: 8px; }
  .dvc-row { display: flex; align-items: flex-end; gap: 8px; }
  .dvc-row label, .radio-group label {
    display: flex; flex-direction: column; gap: 4px;
    font-size: 12px; font-weight: 600; color: var(--secondary-text-color);
  }
  .dvc-row label { flex: 1; }
  .dvc-row input, .dvc-row select { flex: 1; min-width: 0; }
  .radio-group { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }

  /* Stale-channel pill + orphan cleanup section in the modal */
  .list-editor .item.stale {
    border-color: rgba(249,115,22,0.5);
    background: rgba(249,115,22,0.08);
  }
  .list-editor .item.invalid {
    border-color: rgba(239,68,68,0.55);
    background: rgba(239,68,68,0.06);
  }
  /* Reserve space for the stale pill so it never pushes the × button out
     of the row's last grid column. */
  .list-editor .item { grid-template-columns: 80px 1fr auto 32px; }
  .list-editor .item.contact { grid-template-columns: 160px 1fr auto 32px; }
  .list-editor .item input {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 6px 8px;
    color: var(--text);
    font-size: 12px;
    outline: none;
    font-family: inherit;
    width: 100%;
  }
  .list-editor .item input:focus { border-color: var(--accent); }
  .list-editor .item input.field-invalid {
    border-color: rgba(239,68,68,0.65);
    background: rgba(239,68,68,0.06);
  }
  .stale-pill {
    background: rgba(249,115,22,0.22);
    color: #fdba74;
    font-size: 10px;
    font-weight: 700;
    border-radius: 10px;
    padding: 1px 7px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    align-self: center;
  }
  .orphan-section { display: flex; flex-direction: column; gap: 8px; }
  .orphan-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 0.02em;
  }
  .orphan-list { display: flex; flex-direction: column; gap: 6px; }
  .orphan-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
  }
  .orphan-name { color: var(--text); font-weight: 600; font-size: 13px; }
  .orphan-meta {
    display: block;
    color: var(--text3);
    font-size: 11px;
    margin-top: 1px;
    word-break: break-all;
  }
  .orphan-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .orphan-actions button {
    background: var(--bg2);
    color: var(--text2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
  }
  .orphan-actions button:hover { color: var(--text); border-color: var(--accent); }
  .orphan-actions button.danger {
    background: rgba(239,68,68,0.10);
    color: #fca5a5;
    border-color: rgba(239,68,68,0.4);
  }
  .orphan-actions button.danger:hover {
    background: rgba(239,68,68,0.25);
    color: #fff;
    border-color: #ef4444;
  }
  .orphan-actions button:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Contacts tab — device-side add/remove rows */
  .contact-section {
    display: flex; flex-direction: column; gap: 6px;
    margin-bottom: 12px;
  }
  .contact-section .section-head {
    display: flex; justify-content: space-between; align-items: center;
    color: var(--text2);
    font-size: 12px; font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0 2px;
  }
  .contact-section .section-head .help { text-transform: none; letter-spacing: 0; font-weight: 500; }
  .link-btn {
    background: none; border: none;
    color: var(--text3);
    font-family: inherit; font-size: 11px; font-weight: 700;
    cursor: pointer; padding: 0 4px;
  }
  .link-btn:hover { color: var(--accent); }
  .link-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .contact-list { display: flex; flex-direction: column; gap: 5px; }
  .contact-row {
    display: flex; align-items: center; gap: 10px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 7px 10px;
  }
  .contact-avatar {
    width: 30px; height: 30px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
    flex-shrink: 0;
  }
  .contact-info { flex: 1; min-width: 0; }
  .contact-name {
    color: var(--text); font-size: 13px; font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .contact-meta {
    color: var(--text3); font-size: 11px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .contact-meta code {
    color: var(--text2);
    font-family: ui-monospace, monospace;
    font-size: 10.5px;
  }
  .contact-action {
    background: var(--bg2);
    color: var(--text2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 11px; font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
  }
  .contact-action:hover { color: var(--text); border-color: var(--accent); }
  .contact-action:disabled { opacity: 0.55; cursor: not-allowed; }
  .contact-action.accent {
    background: var(--accent-bg);
    color: var(--accent);
    border-color: rgba(56,189,248,0.4);
  }
  .contact-action.accent:hover {
    background: rgba(56,189,248,0.25);
  }
  .contact-action.danger {
    background: rgba(239,68,68,0.10);
    color: #fca5a5;
    border-color: rgba(239,68,68,0.35);
  }
  .contact-action.danger:hover {
    background: rgba(239,68,68,0.25);
    color: #fff;
    border-color: #ef4444;
  }

  /* Apply-to-device status banner */
  .apply-banner {
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.4;
    margin-bottom: 10px;
    border: 1px solid var(--border);
  }
  .apply-banner.ok {
    background: rgba(74, 222, 128, 0.10);
    border-color: rgba(74, 222, 128, 0.5);
    color: #86efac;
  }
  .apply-banner.warn {
    background: rgba(249, 115, 22, 0.10);
    border-color: rgba(249, 115, 22, 0.5);
    color: #fdba74;
  }
  .apply-banner.err {
    background: rgba(239, 68, 68, 0.10);
    border-color: rgba(239, 68, 68, 0.5);
    color: #fca5a5;
  }
  .apply-banner ul { margin: 4px 0 0 16px; padding: 0; }
  .apply-banner li { font-size: 11px; }

  /* List editors (channels, contacts) inside settings modal */
  .list-editor { display: flex; flex-direction: column; gap: 6px; }
  .list-editor .item {
    display: grid;
    grid-template-columns: 80px 1fr auto 32px;
    gap: 6px;
    align-items: center;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px;
  }
  .list-editor .item.contact {
    grid-template-columns: 160px 1fr auto 32px;
  }
  .list-editor .remove {
    background: none;
    border: none;
    color: var(--text3);
    cursor: pointer;
    font-size: 16px;
  }
  .list-editor .remove:hover { color: #ef4444; }
  .list-editor .add-item {
    background: var(--bg3);
    border: 1px dashed var(--border);
    color: var(--text2);
    border-radius: 6px;
    padding: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .list-editor .add-item:hover { color: var(--accent); border-color: var(--accent); }
  .list-editor .empty {
    color: var(--text3); font-size: 12px; text-align: center; padding: 8px;
  }

  /* Visual editor (Lovelace getConfigElement) shares form styles. */

  /* Mobile back button — only visible on small screens. */
  .mobile-back {
    display: none;
    background: none;
    border: none;
    color: var(--text2);
    font-size: 22px;
    line-height: 1;
    padding: 0 6px 0 0;
    cursor: pointer;
    flex-shrink: 0;
  }
  .mobile-back:hover { color: var(--accent); }

  /* Master / detail layout on phones — show ONE panel at a time so the
     sidebar gets full width (search, filter chips, channel previews are
     all readable instead of being squeezed into a 64 px icon strip). */
  @media (max-width: 640px) {
    /* Keep the card a flex column (its default) so the
       card → main-content → settings-panel height chain stays intact and the
       settings panel can scroll. position:relative is kept as the positioning
       context for the absolutely-positioned chat panel. */
    .card { position: relative; }
    .sidebar {
      width: 100%; min-width: 0; max-width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--border);
      height: 100%;
    }
    .chat-panel {
      position: absolute; inset: 0;
      background: var(--bg);
      transform: translateX(100%);
      transition: transform 0.18s ease-out;
      z-index: 5;
      will-change: transform;
    }
    /* When the user picks a chat / node, the host gets the mobile-show-chat
       class and the chat panel slides in over the sidebar. */
    :host(.mobile-show-chat) .chat-panel { transform: translateX(0); }
    :host(.mobile-show-chat) .sidebar { visibility: hidden; }

    .mobile-back { display: inline-block; }
    .chat-header { padding-left: 12px; }

.add-form-row { flex-wrap: wrap; }
    .filter-tabs { padding: 6px 10px; }
    .pane-tab { font-size: 11px; padding: 8px 0; }
    /* Sidebar rows already render full info now — nothing to hide. */
  }


  /* ── Console pane ─────────────────────────────────────────────── */
  .console-log {
    flex: 1;
    overflow-y: auto;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: ui-monospace, 'Cascadia Code', 'Fira Mono', monospace;
    font-size: 12px;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .console-empty {
    color: var(--text3);
    font-size: 12px;
    text-align: center;
    margin: auto;
    padding: 24px;
    line-height: 1.8;
  }
  .console-entry {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 10px;
    border-radius: 7px;
    background: var(--bg2);
    border: 1px solid var(--border);
    word-break: break-all;
  }
  .console-entry.ok  { border-color: rgba(74,222,128,0.22); }
  .console-entry.err { border-color: rgba(239,68,68,0.30); }
  .console-entry-row {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .console-copy-btn {
    margin-left: auto;
    background: none;
    border: none;
    padding: 2px 4px;
    color: var(--text3);
    cursor: pointer;
    border-radius: 4px;
    line-height: 1;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s;
  }
  .console-entry:hover .console-copy-btn { opacity: 1; }
  .console-copy-btn:hover { color: var(--success-color, #4ade80); }
  .console-prompt { color: var(--accent); flex-shrink: 0; }
  .console-cmd    { color: var(--text); flex: 1; }
  .console-ts     { color: var(--text3); font-size: 10px; flex-shrink: 0; }
  .console-badge {
    font-size: 10px;
    flex-shrink: 0;
    padding: 1px 5px;
    border-radius: 4px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }
  .console-badge.pending { color: var(--text3); }
  .console-badge.ok      { color: var(--success-color, #4ade80); }
  .console-badge.err     { color: var(--error-color, #ef4444); }
  .console-output {
    color: var(--text2);
    font-size: 11px;
    padding: 2px 0 2px 16px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .console-error-text {
    color: var(--error-color, #fca5a5);
    font-size: 11px;
    padding-left: 16px;
  }
  .console-input-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border-top: 1px solid var(--border);
    background: var(--bg2);
  }
  .console-prompt-label {
    color: var(--accent);
    font-family: ui-monospace, 'Cascadia Code', 'Fira Mono', monospace;
    font-size: 13px;
    flex-shrink: 0;
    user-select: none;
  }
  .console-input {
    flex: 1;
    background: var(--bg3, var(--bg));
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 7px 10px;
    color: var(--text);
    font-family: ui-monospace, 'Cascadia Code', 'Fira Mono', monospace;
    font-size: 12px;
    outline: none;
    caret-color: var(--accent);
    transition: border-color 0.15s;
  }
  .console-input:focus { border-color: var(--accent); }
  .console-send-btn {
    padding: 7px 13px;
    border-radius: 6px;
    border: none;
    background: var(--accent);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 0.15s;
  }
  .console-send-btn:hover:not(:disabled) { opacity: 0.85; }
  .console-send-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Console commands sidebar ── */
  .cmd-list {
    padding: 4px 0 8px;
    overflow-y: auto;
    flex: 1;
  }
  .cmd-list-title {
    font-size: 10px;
    font-weight: 600;
    color: var(--text3);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 8px 14px 4px;
  }
  .cmd-item {
    padding: 5px 14px;
    cursor: pointer;
    border-radius: 6px;
    margin: 1px 6px;
    transition: background 0.12s;
  }
  .cmd-item:hover { background: var(--bg3, rgba(255,255,255,0.07)); }
  .cmd-sig {
    font-family: ui-monospace, 'Cascadia Code', 'Fira Mono', monospace;
    font-size: 11px;
    color: var(--accent);
    word-break: break-all;
  }
  .cmd-desc {
    font-size: 10px;
    color: var(--text3);
    margin-top: 1px;
  }

  /* ── Full-width console input at card bottom ── */
  .card[data-pane="console"] > .input-area {
    flex-shrink: 0;
    padding: 0;
    border-top: none;
  }
  .card[data-pane="console"] .console-input-wrap {
    border-top: none;
    width: 100%;
  }
`;

class MeshcoreChatCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = {};
    this._messages = {}; // { key: [ {sender, text, ts, own} ] }
    this._unread = {}; // { key: count }
    this._activeKey = null; // active chat OR active node
    this._pane = "chats"; // "chats" | "nodes"
    this._filter = "all"; // chats sub-filter
    this._nodeFilter = "all"; // nodes sub-filter: "all" | "clients" | "repeaters"
    this._search = "";
    this._unsubscribe = null;
    this._connReadyHandler = null;
    this._sending = false;
    this._tickInterval = null;
    this._showAddChannel = false;
    this._pendingScrollToBottom = true; // scroll to bottom on very first render
    this._autocomplete = null; // { trigger, items, idx, replaceStart, replaceEnd }
    this._historyLoaded = new Set(); // keys we've fetched logbook history for
    this._discoveryDone = false;
    this._discoveredChannels = []; // [{idx, name}]
    this._discoveredContacts = []; // [{pubkey_prefix, name}]
    this._discoveredNodes = []; // [{pubkey_prefix, name, type, online, ...}]
    this._devicePrefix = null; // 6 hex chars used in entity IDs

    this._replyDrafts = {}; // { [chatKey]: {sender, text} } — per-chat reply drafts

    // Channel scope selection
    this._channelScopes = {};    // { 'ch:0': '#pl-mz', ... } — selected scope per channel
    this._availableScopes = [];  // known scope names, persisted to localStorage
    this._scopeStateLoaded = false;

    this._settingsTab = "general"; // "general" | "device" | "channels" | "contacts" | "about"
    this._settings = this._loadSettings(); // companion prefs (per-browser)
    this._draftSettings = null; // working copy while modal is open
    this._draftChannels = null;
    this._draftContacts = null;
    this._deviceSettings = {
      loading: false,
      // info
      deviceName: null,
      firmware: null,
      hardware: null,
      publicKey: null,
      connectionType: null,
      // radio
      radioFreq: null,
      radioBw: null,
      radioSf: null,
      radioCr: null,
      txPower: null,
      rxGain: null,
      // location
      lat: null,
      lon: null,
      // mesh
      pathHashMode: null,
    };

    this._hiddenChats = new Set(this._settings.hidden_chats || []);

    // Advert popover + transmit state.
    this._advertOpen = false;
    this._advertSending = false;
    this._lastAdvertSent = null; // epoch ms

    // Hops/relay meta-footer visibility (toggleable from the chat header).
    // Persisted in companion settings so the choice survives reloads.
    this._showHops = this._settings.show_hops !== false;

    // Console pane state.
    this._consoleLogs = [];
    this._consoleSeq = 0;
    this._consoleSending = false;

    // Region join state (inside Settings > Channels).
  }

  setConfig(config) {
    this._config = {
      node_name: config?.node_name || "",
      device_prefix: config?.device_prefix || null,
      entry_id: config?.entry_id || null,
      channels: Array.isArray(config?.channels) ? config.channels : [],
      contacts: Array.isArray(config?.contacts) ? config.contacts : [],
      max_messages: Number(config?.max_messages) || 200,
      history_hours: Number(config?.history_hours) || 24,
      default_pane: config?.default_pane === "nodes" ? "nodes" : "chats",
      compact: !!config?.compact,
      // Card height. Accepts a number (pixels) or any CSS length string,
      // e.g. 800, "800px", "80vh", "100%", "min(80vh, 1000px)". The
      // hardcoded 600px previously couldn't be overridden because the
      // shadow-DOM CSS won out over outer card-mod styles.
      height: config?.height ?? null,
    };
    if (this._config.device_prefix)
      this._devicePrefix = this._config.device_prefix;
    if (!this._activeKey) this._pane = this._config.default_pane;

    // Companion settings (per-browser localStorage) override card-level config
    // when the user has explicitly set them via the gear icon.
    this._mergeSettingsIntoConfig();
    this._applyHeightVar();
    this._applyHopsVisibility();
    this._renderIfReady();
  }

  // Push the configured height into a custom property on the host element so
  // the shadow-DOM CSS rule `height: var(--mcc-card-height, 600px)` honours it.
  _applyHeightVar() {
    const h = this._config?.height;
    if (h == null || h === "") {
      this.style.removeProperty("--mcc-card-height");
      return;
    }
    // Numbers (or numeric strings like "800") → px. Anything else passes through
    // as a raw CSS length (vh, %, calc(...), etc.).
    const cssVal =
      typeof h === "number" || /^\d+(\.\d+)?$/.test(String(h))
        ? `${parseFloat(h)}px`
        : String(h);
    this.style.setProperty("--mcc-card-height", cssVal);
  }

  // ── Companion settings (per-browser, persisted via localStorage) ───
  _settingsKey() {
    // Per-card-instance namespace: keep multiple cards isolated.
    const k = this._config?.device_prefix || this._devicePrefix || "default";
    return `${LS_PREFIX}${k}`;
  }
  _loadSettings() {
    try {
      const raw = localStorage.getItem(this._settingsKey());
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch (_) {
      return {};
    }
  }
  _saveSettings() {
    try {
      localStorage.setItem(
        this._settingsKey(),
        JSON.stringify(this._settings || {}),
      );
    } catch (_) {}
  }
  _viewStateKey() {
    const k = this._config?.device_prefix || this._devicePrefix || "default";
    return `${LS_PREFIX}${k}:view`;
  }
  _saveViewState() {
    try {
      localStorage.setItem(
        this._viewStateKey(),
        JSON.stringify({
          pane: this._pane === "settings" ? "chats" : this._pane,
          activeKey: this._activeKey,
          filter: this._filter,
          nodeFilter: this._nodeFilter,
        }),
      );
    } catch (_) {}
  }
  _restoreViewState() {
    try {
      const raw = localStorage.getItem(this._viewStateKey());
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || typeof s !== "object") return;
      if (s.pane === "chats" || s.pane === "nodes" || s.pane === "console")
        this._pane = s.pane;
      if (s.activeKey) this._activeKey = s.activeKey;
      if (s.filter) this._filter = s.filter;
      if (s.nodeFilter) this._nodeFilter = s.nodeFilter;
    } catch (_) {}
  }

  _consoleHistoryKey() {
    const k = this._config?.device_prefix || this._devicePrefix || "default";
    return `${LS_PREFIX}${k}:console`;
  }

  _scopePfx() {
    return this._config?.device_prefix || this._devicePrefix || null;
  }
  _loadScopeStateIfNeeded() {
    if (this._scopeStateLoaded) return;
    const pfx = this._scopePfx();
    if (!pfx) return;
    this._scopeStateLoaded = true;
    try {
      const cs = localStorage.getItem(`${LS_PREFIX}${pfx}:channel_scopes`);
      const as = localStorage.getItem(`${LS_PREFIX}${pfx}:available_scopes`);
      if (cs) this._channelScopes = JSON.parse(cs);
      if (as) this._availableScopes = JSON.parse(as);
    } catch (_) {}
  }
  _saveScopeState() {
    const pfx = this._scopePfx();
    if (!pfx) return;
    try {
      localStorage.setItem(`${LS_PREFIX}${pfx}:channel_scopes`, JSON.stringify(this._channelScopes));
      localStorage.setItem(`${LS_PREFIX}${pfx}:available_scopes`, JSON.stringify(this._availableScopes));
    } catch (_) {}
  }
  _addAvailableScope(scope) {
    if (!scope || this._availableScopes.includes(scope)) return;
    this._availableScopes.push(scope);
    this._saveScopeState();
  }
  _loadConsoleHistory() {
    try {
      const raw = localStorage.getItem(this._consoleHistoryKey());
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }
  _saveConsoleHistory() {
    try {
      const keep = this._consoleLogs.slice(-50);
      localStorage.setItem(this._consoleHistoryKey(), JSON.stringify(keep));
    } catch (_) {}
  }

  _mergeSettingsIntoConfig() {
    const s = this._settings || {};
    if (s.node_name !== undefined && s.node_name !== "")
      this._config.node_name = s.node_name;
    if (s.device_prefix) {
      this._config.device_prefix = s.device_prefix;
      this._devicePrefix = s.device_prefix;
    }
    if (s.entry_id !== undefined) this._config.entry_id = s.entry_id || null;
    if (typeof s.max_messages === "number" && s.max_messages > 0)
      this._config.max_messages = s.max_messages;
    if (typeof s.history_hours === "number" && s.history_hours > 0)
      this._config.history_hours = s.history_hours;
    if (s.default_pane === "chats" || s.default_pane === "nodes")
      this._config.default_pane = s.default_pane;
    if (typeof s.compact === "boolean") this._config.compact = s.compact;
    if (s.height !== undefined && s.height !== "")
      this._config.height = s.height;
    if (Array.isArray(s.channels)) this._config.channels = s.channels;
    if (Array.isArray(s.contacts)) this._config.contacts = s.contacts;
    if (typeof s.show_hops === "boolean") this._showHops = s.show_hops;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this._discoverFromHass();
    if (first) {
      this._consoleLogs = this._loadConsoleHistory();
      this._consoleSeq = this._consoleLogs.length;
      this._restoreViewState();
      this._subscribe();
      this._render();
      this._tickInterval = setInterval(() => this._renderMessages(), 30000);
      this._loadHistoryForActive();
      // Pull the canonical channel list from the integration. This includes
      // configured channels that have NO binary_sensor yet (no traffic), so
      // freshly-provisioned channels like "#test" appear immediately.
      this._refreshChannelsFromService();
      this._fetchDeviceSettings();
    }
  }

  connectedCallback() {
    // Re-render the message list when the tab becomes visible again. Renders are
    // skipped while hidden (see _renderMessages) to avoid the scroll jumping to
    // the top, so we flush the deferred render once the layout is reliable.
    if (!this._visibilityHandler) {
      this._visibilityHandler = () => {
        if (!document.hidden && this._deferredMessageRender) {
          this._deferredMessageRender = false;
          this._renderMessages();
        }
      };
    }
    document.addEventListener("visibilitychange", this._visibilityHandler);
  }

  disconnectedCallback() {
    if (this._visibilityHandler) {
      document.removeEventListener("visibilitychange", this._visibilityHandler);
    }
    if (this._connReadyHandler && this._hass) {
      this._hass.connection.removeEventListener(
        "ready",
        this._connReadyHandler,
      );
      this._connReadyHandler = null;
    }
    if (this._unsubscribers) {
      for (const u of this._unsubscribers) {
        try {
          Promise.resolve(u()).catch(() => {});
        } catch (_) {}
      }
      this._unsubscribers = [];
    }
    this._unsubscribe = null;
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
    if (this._advertCloseHandler) {
      document.removeEventListener("click", this._advertCloseHandler, true);
      this._advertCloseHandler = null;
    }
    if (this._savedPillTimer) {
      clearTimeout(this._savedPillTimer);
      this._savedPillTimer = null;
    }
  }

  // ── Discovery from hass.states ─────────────────────────────────────
  _discoverFromHass() {
    if (!this._hass?.states) return;
    const states = this._hass.states;

    // Auto-detect device prefix from any binary_sensor.meshcore_<6hex>_*_messages
    const hadPrefix = !!this._devicePrefix;
    if (!this._devicePrefix) {
      for (const id of Object.keys(states)) {
        const m = id.match(
          /^binary_sensor\.meshcore_([a-f0-9]{6})_.+_messages$/,
        );
        if (m) {
          this._devicePrefix = m[1];
          break;
        }
      }
    }
    if (!this._devicePrefix) return;
    this._loadScopeStateIfNeeded();
    // If prefix was just discovered and active chat history hasn't loaded yet,
    // kick off the load now (first attempt failed with null entityId).
    if (
      !hadPrefix &&
      this._activeKey &&
      !this._historyLoaded.has(this._activeKey)
    ) {
      this._loadHistoryForActive();
    }

    const dev = this._devicePrefix;
    const channels = [];
    const dmContacts = [];
    const seenChannels = new Set();
    const seenContacts = new Set();

    const channelRe = new RegExp(
      `^binary_sensor\\.meshcore_${dev}_ch_(\\d+)_messages$`,
    );
    const contactRe = new RegExp(
      `^binary_sensor\\.meshcore_${dev}_([a-f0-9]{6,})_messages$`,
    );

    for (const [id, st] of Object.entries(states)) {
      const cm = id.match(channelRe);
      if (cm) {
        const idx = parseInt(cm[1], 10);
        if (seenChannels.has(idx)) continue;
        seenChannels.add(idx);
        // friendly_name from integration is "<channel_name> Messages"
        const fn = st.attributes?.friendly_name || "";
        const name =
          fn.replace(/\s*Messages\s*$/i, "").trim() || `Channel ${idx}`;
        channels.push({ idx, name, entity_id: id });
        continue;
      }
      const xm = id.match(contactRe);
      if (xm && !id.match(channelRe)) {
        const pk = xm[1].slice(0, 12);
        if (seenContacts.has(pk)) continue;
        seenContacts.add(pk);
        const fn = st.attributes?.friendly_name || "";
        const name =
          fn.replace(/\s*Messages\s*$/i, "").trim() || pk.slice(0, 8);
        dmContacts.push({ pubkey_prefix: pk, name, entity_id: id });
      }
    }

    // Seed any channel slots the integration's `select.meshcore_channel`
    // helper knows about (it lists every configured channel name from
    // coordinator._channel_info, even ones that haven't seen traffic yet
    // and therefore have no binary_sensor). Format: "Name (idx)".
    for (const id of Object.keys(states)) {
      if (!id.startsWith("select.")) continue;
      const st = states[id];
      const opts = st?.attributes?.options || [];
      if (!opts.length) continue;
      // Only treat as the channel-select if EVERY option matches "<name> (idx)".
      const parsed = [];
      let allMatch = true;
      for (const opt of opts) {
        const m = String(opt).match(/^(.*?)\s*\((\d+)\)$/);
        if (!m) {
          allMatch = false;
          break;
        }
        parsed.push({ name: m[1].trim(), idx: parseInt(m[2], 10) });
      }
      if (!allMatch) continue;
      // Heuristic: it's the channel select if the entity name contains "channel".
      if (!id.toLowerCase().includes("channel")) continue;
      for (const { name, idx } of parsed) {
        if (!name || name === "(unused)") continue;
        const existing = channels.find((x) => x.idx === idx);
        if (existing) {
          if (!existing.name || existing.name === `Channel ${idx}`)
            existing.name = name;
        } else {
          channels.push({ idx, name });
          seenChannels.add(idx);
        }
      }
      break;
    }

    // Merge any channels we already pulled via meshcore.get_channels.
    if (this._serviceChannels) {
      for (const c of this._serviceChannels) {
        const existing = channels.find((x) => x.idx === c.idx);
        if (existing) {
          existing.name = c.name;
        } else {
          channels.push({ idx: c.idx, name: c.name });
        }
      }
    }

    // Merge user-supplied channels (override discovered names if matched)
    for (const c of this._config.channels) {
      if (typeof c?.idx !== "number") continue;
      const existing = channels.find((x) => x.idx === c.idx);
      if (existing) {
        if (c.name) existing.name = c.name;
      } else channels.push({ idx: c.idx, name: c.name || `Channel ${c.idx}` });
    }
    // Merge user-supplied contacts
    for (const c of this._config.contacts) {
      if (!c?.pubkey_prefix) continue;
      const pk = c.pubkey_prefix;
      const existing = dmContacts.find(
        (x) => pk.startsWith(x.pubkey_prefix) || x.pubkey_prefix.startsWith(pk),
      );
      if (existing) {
        if (c.name) existing.name = c.name;
      } else
        dmContacts.push({ pubkey_prefix: pk, name: c.name || pk.slice(0, 8) });
    }

    channels.sort((a, b) => a.idx - b.idx);
    dmContacts.sort((a, b) => a.name.localeCompare(b.name));

    // Filter out chats the user has explicitly closed (× in the sidebar).
    // Snapshot full lists first so the "show hidden" footer can count them.
    this._hiddenChannelKeys = channels
      .map((c) => `ch:${c.idx}`)
      .filter((k) => this._hiddenChats.has(k));
    this._hiddenContactKeys = dmContacts
      .map((c) => `dm:${c.pubkey_prefix}`)
      .filter((k) => this._hiddenChats.has(k));
    const visibleChannels = channels.filter(
      (c) => !this._hiddenChats.has(`ch:${c.idx}`),
    );
    const visibleContacts = dmContacts.filter(
      (c) => !this._hiddenChats.has(`dm:${c.pubkey_prefix}`),
    );

    const nodes = [];
    for (const [id, st] of Object.entries(states)) {
      if (!id.startsWith("binary_sensor.") || !id.endsWith("_contact"))
        continue;
      const attrs = st.attributes || {};
      if (!attrs.public_key && !attrs.adv_name) continue;
      const pk = (attrs.public_key || "").slice(0, 12);
      if (!pk) continue;
      const advName = (attrs.adv_name || "").trim();
      let name = advName;
      if (!name) {
        const fn = (attrs.friendly_name || "").trim();
        name =
          fn
            .replace(
              /\s*\((Client|Repeater|Room Server|Sensor|Unknown)\)\s*$/i,
              "",
            )
            .trim() || pk.slice(0, 8);
      }
      nodes.push({
        pubkey_prefix: pk,
        name,
        type: attrs.node_type_str || "Unknown",
        online: st.state === "fresh" || st.state === "on",
        added_to_node: attrs.added_to_node !== false,
        last_advert: attrs.last_advert || 0,
        entity_id: id,
        attrs,
      });
    }
    nodes.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Keep a "raw" copy so unhide can restore without re-running discovery,
    // but expose only the visible subset to the rest of the card.
    this._allChannels = channels;
    this._allContacts = dmContacts;
    this._discoveredChannels = visibleChannels;
    this._discoveredContacts = visibleContacts;
    this._discoveredNodes = nodes;

    // Init message stores for known keys
    const allKeys = [
      ...visibleChannels.map((c) => `ch:${c.idx}`),
      ...visibleContacts.map((c) => `dm:${c.pubkey_prefix}`),
    ];
    for (const k of allKeys) {
      if (!this._messages[k]) this._messages[k] = [];
      if (!(k in this._unread)) this._unread[k] = 0;
    }

    if (!this._activeKey && this._pane === "chats" && allKeys.length) {
      this._activeKey = allKeys[0];
      this._loadHistoryForActive();
      // If the DOM is already built (e.g. called from _refreshChannelsFromService
      // after first render), update the messages panel immediately rather than
      // waiting for the async history load to call _renderMessages().
      if (this.shadowRoot?.getElementById("messages-area")) {
        this._renderMessages();
        this._renderHeader();
        this._renderInput();
      }
    }
  }

  _renderIfReady() {
    if (this.shadowRoot && this.shadowRoot.firstChild) this._render();
  }

  _persistHidden() {
    this._settings.hidden_chats = Array.from(this._hiddenChats);
    this._saveSettings();
  }

  _hideChat(key) {
    if (!key || (!key.startsWith("ch:") && !key.startsWith("dm:"))) return;
    this._hiddenChats.add(key);
    this._persistHidden();
    // Drop local message buffer + drafts so re-opening starts clean.
    delete this._messages[key];
    delete this._unread[key];
    delete this._replyDrafts[key];
    this._historyLoaded.delete(key);
    // Re-run discovery so the visible list shrinks and counters update.
    this._discoverFromHass();
    // If we just hid the active chat, jump to the next visible one.
    if (this._activeKey === key) {
      const remaining = this._chatKeys();
      this._activeKey = remaining[0] || null;
      this._render();
      if (this._activeKey) this._loadHistoryForActive();
    } else {
      this._renderSidebar();
    }
  }

  _unhideAll() {
    if (!this._hiddenChats.size) return;
    this._hiddenChats.clear();
    this._persistHidden();
    this._discoverFromHass();
    this._renderSidebar();
  }

  _maybeUnhide(key) {
    if (!this._hiddenChats.has(key)) return false;
    // Auto-restore: a hidden chat receiving a new message reappears in the
    // sidebar. Closing is "out of sight" not "muted".
    this._hiddenChats.delete(key);
    this._persistHidden();
    this._discoverFromHass();
    return true;
  }

  // Pull canonical channel list from the integration via the get_channels
  // service. Returns [{channel_idx, channel_name, shared_secret_present}, ...]
  // and lists every configured slot regardless of whether a binary_sensor
  // was created. This is the only reliable source for "#test was just
  // provisioned but no traffic yet" — without it the card can't show or
  // send to that channel.
  async _refreshChannelsFromService() {
    if (!this._hass) return;
    let list = null;
    try {
      const resp = await this._hass.connection.sendMessagePromise({
        type: "call_service",
        domain: "meshcore",
        service: "get_channels",
        service_data: this._svcData(),
        return_response: true,
      });
      list =
        resp?.response?.channels || resp?.result?.response?.channels || null;
    } catch (err) {
      try {
        await this._hass.callService(
          "meshcore",
          "get_channels",
          this._svcData(),
        );
      } catch (e2) {
        console.debug("meshcore-chat-card: get_channels unavailable:", err, e2);
      }
    }
    if (Array.isArray(list)) {
      this._serviceChannels = list
        .filter(
          (c) =>
            Number.isInteger(c.channel_idx) &&
            c.channel_name &&
            c.channel_name !== "(unused)",
        )
        .map((c) => ({ idx: c.channel_idx, name: c.channel_name }));
    }
    // Re-merge into _discoveredChannels (also re-reads select helper).
    this._discoverFromHass();
    if (this.shadowRoot?.firstChild) this._renderSidebar();
  }

  // Pull the canonical contact list from the integration via meshcore.get_contacts.
  // Returns rows with `added_to_node`, so we can present "on device" vs
  // "discovered" without scraping entity registry. Used by the Contacts tab
  // in the settings modal for add/remove operations.
  async _refreshContactsFromService() {
    if (!this._hass) return;
    let list = null;
    try {
      const resp = await this._hass.connection.sendMessagePromise({
        type: "call_service",
        domain: "meshcore",
        service: "get_contacts",
        service_data: this._svcData(),
        return_response: true,
      });
      list =
        resp?.response?.contacts || resp?.result?.response?.contacts || null;
    } catch (err) {
      try {
        await this._hass.callService(
          "meshcore",
          "get_contacts",
          this._svcData(),
        );
      } catch (e2) {
        console.debug("meshcore-chat-card: get_contacts unavailable:", err, e2);
      }
    }
    if (Array.isArray(list)) {
      this._serviceContacts = list.map((c) => ({
        pubkey: c.public_key || "",
        pubkey_prefix: c.pubkey_prefix || (c.public_key || "").slice(0, 12),
        name: (c.adv_name || "").trim() || (c.public_key || "").slice(0, 8),
        type: typeof c.type === "number" ? c.type : null,
        added_to_node: c.added_to_node !== false,
        last_advert: c.last_advert || 0,
      }));
    }
    if (this._pane === "settings" && this._settingsTab === "contacts") {
      this._renderSettingsPanel();
    }
  }

  async _contactOp(action, pubkeyOrName) {
    if (!this._hass || !pubkeyOrName) return { ok: false, error: "no input" };
    // shlex double-quoting so names with spaces / shell metacharacters round-trip cleanly.
    const safe = `"${String(pubkeyOrName).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    try {
      await this._hass.callService(
        "meshcore",
        "execute_command",
        this._svcData({ command: `${action}_contact ${safe}` }),
      );
      await new Promise((r) => setTimeout(r, 250));
      await this._refreshContactsFromService();
      return { ok: true };
    } catch (err) {
      console.error(`meshcore-chat-card: ${action}_contact failed`, err);
      return {
        ok: false,
        error: err?.message || err?.error || String(err) || "unknown error",
      };
    }
  }
  _addContactToDevice(pk) {
    return this._contactOp("add", pk);
  }
  _removeContactFromDevice(pk) {
    return this._contactOp("remove", pk);
  }

  _nodeTypeLabel(type) {
    switch (type) {
      case 1:
        return "Client";
      case 2:
        return "Repeater";
      case 3:
        return "Room Server";
      case 4:
        return "Sensor";
      default:
        return "Unknown";
    }
  }

  // Resolve a channel idx for the active sidebar key. Sidebar keys are stored
  // as "ch:<idx>" but the user may have typed a stale idx in the modal — if
  // a channel with the discovered name exists at a different idx (because the
  // device renumbered or the user provisioned it elsewhere), prefer the live
  // device idx. Returns the canonical idx or null if no match.
  _resolveChannelIdx(key) {
    if (!key.startsWith("ch:")) return null;
    const stored = parseInt(key.split(":")[1], 10);
    if (!Number.isInteger(stored)) return null;
    const ch = this._discoveredChannels.find((x) => x.idx === stored);
    if (!ch) return stored;
    // If we have a service-truth list and the name is set, double-check by name.
    if (this._serviceChannels && ch.name) {
      const byName = this._serviceChannels.find((s) => s.name === ch.name);
      if (byName && byName.idx !== stored) return byName.idx;
    }
    return stored;
  }

  // ── Live event subscription ───────────────────────────────────────
  _subscribe() {
    if (!this._hass) return;
    this._unsubscribers = this._unsubscribers || [];

    // Re-subscribe automatically when the WS connection reconnects.
    // Only register once; _resubscribe clears stale unsubs then calls _subscribe again.
    if (!this._connReadyHandler) {
      this._connReadyHandler = () => setTimeout(() => this._resubscribe(), 0);
      this._hass.connection.addEventListener("ready", this._connReadyHandler);
    }

    this._hass.connection
      .subscribeEvents((event) => this._handleEvent(event), "meshcore_message")
      .then((unsub) => {
        this._unsubscribe = unsub;
        this._unsubscribers.push(unsub);
      })
      .catch((err) =>
        console.warn("meshcore-chat-card: event subscription failed", err),
      );
    this._hass.connection
      .subscribeEvents(
        (event) => this._handleDeliveryUpdate(event),
        "meshcore_delivery_update",
      )
      .then((unsub) => this._unsubscribers.push(unsub))
      .catch(() => {});
  }

  _resubscribe() {
    // Server dropped all subscriptions on reconnect — clear the stale handles
    // and re-subscribe so messages resume without a page refresh.
    this._unsubscribers = [];
    this._unsubscribe = null;
    this._subscribe();
  }

  _handleEvent(event) {
    const d = event?.data || {};
    const myName = this._myName;
    let key,
      sender,
      text,
      isOwn = false,
      ts = Date.now();

    if (d.timestamp) {
      const parsed = Date.parse(d.timestamp);
      if (!isNaN(parsed)) ts = parsed;
    }

    if (d.message_type === "channel") {
      const chIdx = d.channel_idx ?? 0;
      key = `ch:${chIdx}`;
      // Auto-add if not yet known
      if (!this._discoveredChannels.find((c) => c.idx === chIdx)) {
        this._discoveredChannels.push({
          idx: chIdx,
          name: d.channel || `Channel ${chIdx}`,
        });
        this._discoveredChannels.sort((a, b) => a.idx - b.idx);
      }
      sender = d.sender_name || (d.outgoing ? myName || "Me" : "Unknown");
      text = d.message || "";
      isOwn = !!d.outgoing || (myName && sender === myName);
    } else if (d.message_type === "direct") {
      const prefix = (d.pubkey_prefix || "").substring(0, 12);
      if (!prefix) return;
      let contact = this._discoveredContacts.find(
        (c) =>
          prefix.startsWith(c.pubkey_prefix) ||
          c.pubkey_prefix.startsWith(prefix),
      );
      if (!contact) {
        // Auto-add unknown DM peer
        const fallbackName = d.outgoing
          ? d.receiver_name || prefix.slice(0, 8)
          : d.sender_name || prefix.slice(0, 8);
        contact = { pubkey_prefix: prefix, name: fallbackName };
        this._discoveredContacts.push(contact);
        this._discoveredContacts.sort((a, b) => a.name.localeCompare(b.name));
      }
      key = `dm:${contact.pubkey_prefix}`;
      sender = d.outgoing
        ? myName || d.sender_name || "Me"
        : d.sender_name || contact.name;
      text = d.message || "";
      isOwn = !!d.outgoing;
    } else {
      return;
    }

    // Pull the radio metadata the integration attaches:
    //   • Outgoing channel: rx_log_data (per-repeater RX_LOG entries) +
    //     repeater_count after the final collection pass.
    //   • Outgoing DM: ack_received boolean (true/false/null).
    //   • Incoming DM: hop_count + optional snr.
    //   • Incoming channel: rx_log_data (one entry per heard re-broadcast),
    //     each carrying path_len + path bytes.
    const meta = {
      outgoing: !!d.outgoing,
      message_type: d.message_type,
      ack_received:
        d.ack_received === true
          ? true
          : d.ack_received === false
            ? false
            : null,
      hop_count: typeof d.hop_count === "number" ? d.hop_count : null,
      snr: typeof d.snr === "number" ? d.snr : null,
      rx_log_data: Array.isArray(d.rx_log_data) ? d.rx_log_data : null,
      repeater_count:
        typeof d.repeater_count === "number" ? d.repeater_count : null,
      send_id: d.send_id || null,
    };

    // Auto-discover scope names from incoming rx_log flood_scope fields.
    if (!d.outgoing && Array.isArray(d.rx_log_data)) {
      this._loadScopeStateIfNeeded();
      for (const entry of d.rx_log_data) {
        if (entry?.flood_scope) this._addAvailableScope(entry.flood_scope);
      }
    }

    this._appendMessage(key, { sender, text, ts, own: isOwn, meta });

    // Auto-restore the chat if it was previously closed via the × button.
    this._maybeUnhide(key);

    if (key !== this._activeKey || this._pane !== "chats") {
      this._unread[key] = (this._unread[key] || 0) + 1;
    }

    if (this._pane === "chats") {
      this._renderSidebarList();
      if (key === this._activeKey) this._renderMessages();
    }
  }

  _appendMessage(key, msg) {
    if (!this._messages[key]) this._messages[key] = [];
    // De-dup against last few entries (logbook + live event can overlap).
    // When a duplicate is found and the incoming message brings new meta
    // (ack_received, rx_log_data, etc.), merge it onto the existing entry
    // so the optimistic local echo gets upgraded with delivery info.
    const arr = this._messages[key];
    for (let i = arr.length - 1; i >= Math.max(0, arr.length - 8); i--) {
      const m = arr[i];
      if (
        m.text === msg.text &&
        m.sender === msg.sender &&
        Math.abs(m.ts - msg.ts) < 5000
      ) {
        if (msg.meta) m.meta = { ...(m.meta || {}), ...msg.meta };
        return;
      }
    }
    arr.push(msg);
    arr.sort((a, b) => a.ts - b.ts);
    const max = this._config.max_messages;
    if (arr.length > max) this._messages[key] = arr.slice(-max);
  }

  // Reverse of _entityIdFor: turn a binary_sensor entity_id back into the
  // chat key used by this card. Used to correlate meshcore_delivery_update
  // events to the right message bubble.
  _keyForEntityId(entityId) {
    if (!entityId || !this._devicePrefix) return null;
    const dev = this._devicePrefix;
    let m = entityId.match(
      new RegExp(`^binary_sensor\\.meshcore_${dev}_ch_(\\d+)_messages$`),
    );
    if (m) return `ch:${parseInt(m[1], 10)}`;
    m = entityId.match(
      new RegExp(`^binary_sensor\\.meshcore_${dev}_([a-f0-9]{6,})_messages$`),
    );
    if (m) {
      const pk6 = m[1].slice(0, 6);
      // Match against discovered DM contacts whose pubkey starts with this 6-byte slice.
      const c = this._discoveredContacts.find((x) =>
        x.pubkey_prefix.startsWith(pk6),
      );
      return c ? `dm:${c.pubkey_prefix}` : `dm:${pk6}`;
    }
    return null;
  }

  // Progressive delivery updates fired by the integration during outgoing
  // channel-message correlation passes (logbook.py:_collect_*). Each one
  // carries the same correlation fields as the original meshcore_message
  // event plus an updated rx_log_data / repeater_count snapshot.
  _handleDeliveryUpdate(event) {
    const d = event?.data || {};
    if (!d.entity_id) return;
    const key = this._keyForEntityId(d.entity_id);
    if (!key) return;
    const arr = this._messages[key];
    if (!arr || !arr.length) return;
    const evTs = d.timestamp ? Date.parse(d.timestamp) : Date.now();
    const text = d.message || "";
    const sender = d.sender_name || this._myName || "";
    // Walk the most-recent few entries and upgrade the matching own message.
    // For own messages we don't require sender match: the integration's sender_name
    // may differ from the locally configured node_name (e.g. raw device name vs
    // display alias), causing false misses that leave status stuck on "sending…".
    for (let i = arr.length - 1; i >= Math.max(0, arr.length - 12); i--) {
      const m = arr[i];
      if (!m.own) continue;
      if (text && m.text !== text) continue;
      if (Math.abs(m.ts - evTs) > 20000) continue;
      m.meta = m.meta || {};
      if (Array.isArray(d.rx_log_data)) m.meta.rx_log_data = d.rx_log_data;
      if (typeof d.repeater_count === "number")
        m.meta.repeater_count = d.repeater_count;
      m.meta.progressive = !!d.progressive;
      if (key === this._activeKey && this._pane === "chats")
        this._renderMessages();
      return;
    }
  }

  // ── Logbook history backfill ──────────────────────────────────────
  async _loadHistoryForActive() {
    if (!this._hass || !this._activeKey || this._pane !== "chats") return;
    // Capture key immediately — before any await — so a channel switch mid-fetch
    // cannot cause history from channel A to land in channel B's message array.
    const key = this._activeKey;
    if (this._historyLoaded.has(key)) return;
    const entityId = this._entityIdFor(key);
    if (!entityId) {
      // No entity ID yet (prefix unknown); don't mark as loaded so a retry can succeed.
      if (this.shadowRoot?.getElementById("messages-area"))
        this._renderMessages();
      return;
    }
    this._historyLoaded.add(key);

    const hours = Math.max(1, this._config.history_hours || 24);
    const start = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    try {
      const events = await this._hass.callWS({
        type: "logbook/get_events",
        start_time: start,
        entity_ids: [entityId],
      });
      if (!Array.isArray(events)) return;
      const myName = this._myName;
      for (const ev of events) {
        // Logbook entries from this integration carry "<channel> Sender: msg"
        // or "Sender: msg". The raw event also contains domain=meshcore.
        if (ev.domain && ev.domain !== "meshcore") continue;
        const raw = ev.message || "";
        if (!raw) continue;
        let sender = "Unknown",
          text = raw;
        // Strip leading <channel> if present
        const stripped = raw.replace(/^<[^>]+>\s*/, "");
        const colon = stripped.indexOf(":");
        if (colon > 0 && colon < 64) {
          sender = stripped.slice(0, colon).trim();
          text = stripped.slice(colon + 1).trim();
        } else {
          text = stripped;
        }
        const ts = ev.when
          ? Math.floor(ev.when * 1000) || Date.parse(ev.when)
          : Date.now();
        const own = !!myName && sender === myName;
        this._appendMessage(key, { sender, text, ts, own });
      }
      // Only update the UI if the user is still looking at this channel.
      if (key === this._activeKey) {
        this._renderMessages();
        this._renderHeader();
        this._renderSidebarList();
      }
    } catch (err) {
      // Older HA versions: try the history fallback
      console.debug(
        "meshcore-chat-card: logbook fetch failed, history disabled:",
        err,
      );
    }
  }

  // ── Reply / mention helpers ───────────────────────────────────────
  // MeshCore mention syntax: @[NAME] body — bracketed form survives spaces.
  _parseMention(text) {
    if (!text) return { mention: null, body: "" };
    const s = String(text);
    const m = s.match(/^\s*@\[([^\]]{1,64})\]\s*/);
    if (!m) return { mention: null, body: s };
    return { mention: { name: m[1].trim() }, body: s.slice(m[0].length) };
  }

  _buildReplyText(reply, body) {
    if (!reply || !reply.sender) return body;
    if (this._myName && reply.sender === this._myName) return body;
    return `@[${reply.sender}] ${body}`;
  }

  _setReply(key, msg) {
    if (!msg || msg.sender === "system") return;
    this._replyDrafts[key] = {
      sender: msg.sender || "",
      text: msg.text || "",
      ts: msg.ts || Date.now(),
    };
    this._renderInput();
    // Focus the composer so the user can type immediately.
    setTimeout(() => {
      const inp = this.shadowRoot.querySelector(".msg-input");
      if (inp) inp.focus();
    }, 0);
  }

  _clearReply(key) {
    if (key in this._replyDrafts) {
      delete this._replyDrafts[key];
      this._renderInput();
    }
  }

  _flashMessage(key, predicate) {
    const area = this.shadowRoot.getElementById("messages-area");
    if (!area) return;
    const rows = area.querySelectorAll(".msg-row");
    for (const row of rows) {
      if (predicate(row)) {
        const bubble = row.querySelector(".msg-bubble");
        if (bubble) {
          bubble.classList.remove("flash");
          // restart animation
          // eslint-disable-next-line no-unused-expressions
          bubble.offsetWidth;
          bubble.classList.add("flash");
          row.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
    }
  }

  _entityIdFor(key) {
    if (!this._devicePrefix) return null;
    const dev = this._devicePrefix;
    if (key.startsWith("ch:")) {
      const idx = key.split(":")[1];
      return `binary_sensor.meshcore_${dev}_ch_${idx}_messages`;
    }
    if (key.startsWith("dm:")) {
      const pk = key.split(":")[1].slice(0, 6);
      return `binary_sensor.meshcore_${dev}_${pk}_messages`;
    }
    return null;
  }

  // Build service call data, automatically injecting entry_id when configured.
  _svcData(base = {}) {
    return this._config.entry_id
      ? { ...base, entry_id: this._config.entry_id }
      : base;
  }

  get _myName() {
    return this._deviceSettings.deviceName ?? this._config.node_name ?? "";
  }

  // ── Sending ───────────────────────────────────────────────────────
  async _sendMessage() {
    const input = this.shadowRoot.querySelector(".msg-input");
    const userText = input?.value?.trim();
    if (
      !userText ||
      this._sending ||
      !this._activeKey ||
      this._pane !== "chats"
    )
      return;

    this._sending = true;
    const btn = this.shadowRoot.querySelector(".send-btn");
    if (btn) btn.disabled = true;

    const key = this._activeKey;
    // Apply reply context (prepended quote line) to the wire payload.
    const replyDraft = this._replyDrafts[key] || null;
    const text = this._buildReplyText(replyDraft, userText);
    let serviceCall;

    if (key.startsWith("ch:")) {
      const chIdx = this._resolveChannelIdx(key);
      if (!Number.isInteger(chIdx)) {
        this._sending = false;
        if (btn) btn.disabled = false;
        this._appendMessage(key, {
          sender: "system",
          text: "⚠ Channel not configured on the device. Open settings → Channels and click 'Apply to device'.",
          ts: Date.now(),
          own: false,
        });
        this._renderMessages();
        return;
      }
      // Pre-flight check: only block if a FRESH get_channels confirms the idx
      // really isn't on the device. The cached _serviceChannels may simply be
      // stale (e.g. a channel was just provisioned and our cache wasn't
      // refreshed yet) — refusing on stale data caused false negatives.
      const cachedMissing =
        this._serviceChannels &&
        this._serviceChannels.length &&
        !this._serviceChannels.find((c) => c.idx === chIdx);
      if (cachedMissing) {
        await this._refreshChannelsFromService();
        const stillMissing =
          this._serviceChannels &&
          this._serviceChannels.length &&
          !this._serviceChannels.find((c) => c.idx === chIdx);
        if (stillMissing) {
          this._sending = false;
          if (btn) btn.disabled = false;
          const ch = this._discoveredChannels.find((c) => c.idx === chIdx);
          const label = ch?.name
            ? `"${ch.name}" (idx ${chIdx})`
            : `idx ${chIdx}`;
          this._appendMessage(key, {
            sender: "system",
            text: `⚠ Channel ${label} is not provisioned on the device. Open settings → Channels and click 'Apply to device' to create it.`,
            ts: Date.now(),
            own: false,
          });
          this._renderMessages();
          return;
        }
      }
      const scope = this._channelScopes[key] || undefined;
      serviceCall = this._hass.callService(
        "meshcore",
        "send_channel_message",
        this._svcData({ channel_idx: chIdx, message: text, ...(scope ? { scope } : {}) }),
      );
    } else if (key.startsWith("dm:")) {
      const prefix = key.split(":")[1];
      serviceCall = this._hass.callService(
        "meshcore",
        "send_message",
        this._svcData({ pubkey_prefix: prefix, message: text }),
      );
    } else {
      this._sending = false;
      if (btn) btn.disabled = false;
      return;
    }

    // Optimistic local echo. Carry initial meta so the status footer renders
    // immediately ("sending…" for channels, "↑ sent" for DMs) without waiting
    // for a delivery update event.
    const echoMeta = key.startsWith("ch:")
      ? {
          outgoing: true,
          message_type: "channel",
          progressive: true,
          repeater_count: null,
        }
      : key.startsWith("dm:")
        ? { outgoing: true, message_type: "direct", ack_received: null }
        : null;
    this._appendMessage(key, {
      sender: this._myName || "Me",
      text,
      ts: Date.now(),
      own: true,
      meta: echoMeta,
    });
    if (input) { input.value = ""; input.style.height = "auto"; }
    this._dismissAutocomplete();
    // Reply has been consumed — drop the draft and re-render the input area
    // so the reply-bar disappears.
    if (replyDraft) {
      delete this._replyDrafts[key];
      this._renderInput();
    }
    this._renderMessages();
    this._renderSidebarList();

    const echoText = text;
    const echoTs = Date.now();
    serviceCall
      .catch((err) => {
        console.error("meshcore-chat-card: send failed", err);
        // Mark the optimistic echo as failed instead of adding a second system msg.
        const arr = this._messages[key] || [];
        for (let i = arr.length - 1; i >= Math.max(0, arr.length - 4); i--) {
          const m = arr[i];
          if (m.own && m.text === echoText && Math.abs(m.ts - echoTs) < 8000) {
            m.meta = m.meta || {};
            m.meta.progressive = false;
            m.meta.send_error = err?.message || String(err);
            break;
          }
        }
        this._appendMessage(key, {
          sender: "system",
          text: `⚠ Send failed: ${err?.message || err}`,
          ts: Date.now(),
          own: false,
        });
        this._renderMessages();
      })
      .finally(() => {
        this._sending = false;
        if (btn) btn.disabled = false;
        const input2 = this.shadowRoot.querySelector(".msg-input");
        if (input2) input2.focus();
        // If no delivery update arrives within 10s, clear "sending…" so the
        // status doesn't stay stuck. Progressive delivery updates will still
        // upgrade the meta if they arrive later.
        if (key.startsWith("ch:")) {
          setTimeout(() => {
            const arr2 = this._messages[key] || [];
            for (
              let i = arr2.length - 1;
              i >= Math.max(0, arr2.length - 4);
              i--
            ) {
              const m = arr2[i];
              if (
                m.own &&
                m.text === echoText &&
                Math.abs(m.ts - echoTs) < 8000
              ) {
                if (m.meta?.progressive) {
                  m.meta.progressive = false;
                  if (key === this._activeKey) this._renderMessages();
                }
                break;
              }
            }
          }, 10000);
        }
      });
  }

  // Resend an existing message that was not received by any repeater / ACK'd.
  // Creates a fresh outgoing echo so delivery tracking starts over.
  async _resendMessage(key, msg) {
    if (!this._hass || !key || !msg?.text) return;
    const text = msg.text;
    let serviceCall;
    if (key.startsWith("ch:")) {
      const chIdx = this._resolveChannelIdx(key);
      if (!Number.isInteger(chIdx)) return;
      const scope = this._channelScopes[key] || undefined;
      serviceCall = this._hass.callService(
        "meshcore",
        "send_channel_message",
        this._svcData({ channel_idx: chIdx, message: text, ...(scope ? { scope } : {}) }),
      );
    } else if (key.startsWith("dm:")) {
      const prefix = key.split(":")[1];
      serviceCall = this._hass.callService(
        "meshcore",
        "send_message",
        this._svcData({ pubkey_prefix: prefix, message: text }),
      );
    } else {
      return;
    }
    const echoTs = Date.now();
    const echoMeta = key.startsWith("ch:")
      ? {
          outgoing: true,
          message_type: "channel",
          progressive: true,
          repeater_count: null,
        }
      : { outgoing: true, message_type: "direct", ack_received: null };
    this._appendMessage(key, {
      sender: this._config.node_name || "Me",
      text,
      ts: echoTs,
      own: true,
      meta: echoMeta,
    });
    this._renderMessages();
    serviceCall
      .catch((err) => console.error("meshcore-chat-card: resend failed", err))
      .finally(() => {
        if (key.startsWith("ch:")) {
          setTimeout(() => {
            const arr = this._messages[key] || [];
            for (
              let i = arr.length - 1;
              i >= Math.max(0, arr.length - 4);
              i--
            ) {
              const m = arr[i];
              if (
                m.own &&
                m.text === text &&
                Math.abs(m.ts - echoTs) < 8000 &&
                m.meta?.progressive
              ) {
                m.meta.progressive = false;
                if (key === this._activeKey) this._renderMessages();
                break;
              }
            }
          }, 10000);
        }
      });
  }

  // ── Console pane ──────────────────────────────────────────────────────────

  _renderConsoleLog(el) {
    el.className = "console-log";
    if (!this._consoleLogs.length) {
      el.innerHTML = `<div class="console-empty">No commands yet.<br>Type a MeshCore command below and press Enter.<br><span style="opacity:0.55">e.g. <code>send_advert</code> · <code>reset_path &lt;pubkey_prefix&gt;</code></span></div>`;
      return;
    }
    el.innerHTML = this._consoleLogs
      .map((entry, i) => {
        const time = new Date(entry.ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        const badgeCls = entry.status;
        const badgeLabel =
          entry.status === "pending"
            ? "…"
            : entry.status === "ok"
              ? "✓ ok"
              : "✗ err";
        const extraRow = entry.error
          ? `<div class="console-error-text">${esc(entry.error)}</div>`
          : entry.output
            ? `<div class="console-output">${esc(entry.output)}</div>`
            : "";
        const consoleCopyIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        return `<div class="console-entry ${entry.status}" data-entry-idx="${i}">
        <div class="console-entry-row">
          <span class="console-prompt">&gt;</span>
          <span class="console-cmd">${esc(entry.cmd)}</span>
          <span class="console-ts">${esc(time)}</span>
          <span class="console-badge ${badgeCls}">${badgeLabel}</span>
          <button class="console-copy-btn" data-console-copy-idx="${i}" title="Copy command">${consoleCopyIcon}</button>
        </div>
        ${extraRow}
      </div>`;
      })
      .join("");
    // Wire console copy buttons.
    el.querySelectorAll(".console-copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.consoleCopyIdx, 10);
        const entry = this._consoleLogs[idx];
        if (!entry) return;
        const text = entry.output ? `${entry.cmd}\n${entry.output}` : entry.cmd;
        navigator.clipboard.writeText(text).catch(() => {});
      });
    });
    el.scrollTop = el.scrollHeight;
  }

  _renderConsoleInput(el) {
    el.style.display = "";
    const existingInput = el.querySelector(".console-input");
    const savedText = existingInput ? existingInput.value : "";
    el.innerHTML = `
      <div class="console-input-wrap">
        <span class="console-prompt-label">&gt;</span>
        <input class="console-input" placeholder="Enter MeshCore command…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-bwignore />
        <button class="console-send-btn"${this._consoleSending ? " disabled" : ""}>Run</button>
      </div>`;
    const input = el.querySelector(".console-input");
    const btn = el.querySelector(".console-send-btn");
    if (savedText) input.value = savedText;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this._sendCommand(input.value.trim());
      }
    });
    btn.addEventListener("click", () => this._sendCommand(input.value.trim()));
  }

  async _sendCommand(cmd) {
    if (!cmd || this._consoleSending || !this._hass) return;
    const id = ++this._consoleSeq;
    const entry = { id, cmd, status: "pending", error: null, ts: Date.now() };
    this._consoleLogs.push(entry);
    this._consoleSending = true;
    this._renderMessages();
    this._renderHeader();
    const inputEl = this.shadowRoot.querySelector(".console-input");
    if (inputEl) inputEl.value = "";
    const btnEl = this.shadowRoot.querySelector(".console-send-btn");
    if (btnEl) btnEl.disabled = true;

    try {
      // returnResponse:true (6th arg) forces HA to propagate HomeAssistantError
      // as a WS-level rejection instead of silently logging it.
      const result = await this._hass.callService(
        "meshcore",
        "execute_command",
        this._svcData({ command: cmd }),
        undefined,
        false,
        true,
      );
      entry.status = "ok";
      const raw = result?.response;
      if (raw != null) {
        entry.output =
          typeof raw === "string"
            ? raw
            : (raw.output ??
              raw.response ??
              raw.result ??
              raw.message ??
              JSON.stringify(raw, null, 2));
      }
    } catch (err) {
      entry.status = "err";
      const msg = err?.message || String(err);
      entry.error = msg.includes("NoneType")
        ? "Unknown or unsupported command"
        : msg;
    } finally {
      this._consoleSending = false;
      this._saveConsoleHistory();
      this._renderMessages();
      this._renderHeader();
      this._renderInput();
    }
  }

  // Channel management: create / set a channel via execute_command set_channel.
  // Mirrors the docs recipe: set_channel <idx> <name> <sha256(name)[:32]>
  async _addChannel(idx, name) {
    if (!this._hass) return;
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    if (!Number.isInteger(idx) || idx < 0 || idx > 255) return;
    try {
      const hash = await sha256Hex32(trimmed);
      await this._hass.callService(
        "meshcore",
        "execute_command",
        this._svcData({ command: `set_channel ${idx} ${trimmed} ${hash}` }),
      );
      // Optimistic local insertion so it appears immediately
      const existing = this._discoveredChannels.find((c) => c.idx === idx);
      if (existing) existing.name = trimmed;
      else this._discoveredChannels.push({ idx, name: trimmed });
      this._discoveredChannels.sort((a, b) => a.idx - b.idx);
      const key = `ch:${idx}`;
      if (!this._messages[key]) this._messages[key] = [];
      if (!(key in this._unread)) this._unread[key] = 0;
      this._showAddChannel = false;
      this._activeKey = key;
      this._pendingScrollToBottom = true;
      this._renderSidebar();
      this._renderHeader();
      this._renderInput();
      this._loadHistoryForActive();
      // Re-pull canonical channel list so subsequent sends see the new idx.
      this._refreshChannelsFromService();
    } catch (err) {
      console.error("meshcore-chat-card: set_channel failed", err);
      alert(`Failed to set channel ${idx}: ${err?.message || err}`);
    }
  }

  _selectKey(key) {
    this._activeKey = key;
    this._pendingScrollToBottom = true; // always land at the bottom when opening a chat
    if (this._pane === "chats") this._unread[key] = 0;
    this._saveViewState();
    this._renderSidebarList();
    this._renderHeader();
    this._renderMessages();
    this._renderInput();
    this._loadHistoryForActive();
    // Slide the chat panel in on mobile (CSS @media only triggers <=640px).
    this._mobileShowChat();
  }

  _setPane(pane) {
    if (this._pane === pane) return;
    const leavingSettings = this._pane === "settings";
    this._pane = pane;

    if (pane === "settings") {
      this._applyStatus = null;
      this._refreshContactsFromService();
      this._draftSettings = {
        node_name: this._settings.node_name ?? this._config.node_name ?? "",
        device_prefix:
          this._settings.device_prefix ??
          this._config.device_prefix ??
          this._devicePrefix ??
          "",
        entry_id: this._settings.entry_id ?? this._config.entry_id ?? "",
        max_messages:
          this._settings.max_messages ?? this._config.max_messages ?? 200,
        history_hours:
          this._settings.history_hours ?? this._config.history_hours ?? 24,
        default_pane:
          this._settings.default_pane ?? this._config.default_pane ?? "chats",
        compact: this._settings.compact ?? this._config.compact ?? false,
        height: this._settings.height ?? this._config.height ?? "",
        show_hops: this._showHops,
      };
      this._draftChannels = this._settings.channels?.length
        ? this._settings.channels.map((c) => ({ ...c }))
        : this._discoveredChannels.map((c) => ({ idx: c.idx, name: c.name }));
      this._draftContacts = this._settings.contacts?.length
        ? this._settings.contacts.map((c) => ({ ...c }))
        : this._discoveredContacts.map((c) => ({
            pubkey_prefix: c.pubkey_prefix,
            name: c.name,
          }));
      this._knownChannelIdxsAtOpen = new Set(
        this._discoveredChannels.map((c) => c.idx),
      );
    } else {
      if (leavingSettings) {
        this._draftSettings = null;
        this._draftChannels = null;
        this._draftContacts = null;
      }
      // Pick a sensible active item for the new pane.
      if (pane === "chats") {
        const keys = this._chatKeys();
        this._activeKey = keys[0] || null;
      } else if (pane === "nodes") {
        this._activeKey = this._discoveredNodes[0]
          ? `node:${this._discoveredNodes[0].pubkey_prefix}`
          : null;
      } else {
        this._activeKey = null;
      }
    }

    this._saveViewState();
    this._render();
    if (pane === "settings") {
      this._fetchDeviceSettings();
    } else if (pane === "console") {
      this._mobileShowChat();
    } else {
      this._loadHistoryForActive();
      this._mobileShowSidebar();
    }
  }

  // ── Display helpers ───────────────────────────────────────────────
  _chatKeys() {
    return [
      ...this._discoveredChannels.map((c) => `ch:${c.idx}`),
      ...this._discoveredContacts.map((c) => `dm:${c.pubkey_prefix}`),
    ];
  }

  _channelIcon(key) {
    if (key.startsWith("ch:")) {
      // For named channels with leading "#" use the hash as icon; otherwise idx.
      const idx = parseInt(key.split(":")[1], 10);
      const ch = this._discoveredChannels.find((c) => c.idx === idx);
      if (ch?.name?.startsWith("#")) return "#";
      return `#${idx}`;
    }
    if (key.startsWith("dm:")) {
      const name = this._channelName(key);
      const initials = name
        .split(/\s+/)
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("");
      return initials.toUpperCase() || "DM";
    }
    if (key.startsWith("node:")) {
      const pk = key.split(":")[1];
      const node = this._discoveredNodes.find((n) => n.pubkey_prefix === pk);
      const name = node?.name || pk.slice(0, 6);
      return (name[0] || "?").toUpperCase();
    }
    return "?";
  }

  _channelName(key) {
    if (key.startsWith("ch:")) {
      const idx = parseInt(key.split(":")[1], 10);
      const ch = this._discoveredChannels.find((c) => c.idx === idx);
      return ch?.name || `Channel ${idx}`;
    }
    if (key.startsWith("dm:")) {
      const prefix = key.split(":")[1];
      const c = this._discoveredContacts.find(
        (x) => x.pubkey_prefix === prefix,
      );
      return c?.name || prefix.substring(0, 8);
    }
    if (key.startsWith("node:")) {
      const pk = key.split(":")[1];
      const node = this._discoveredNodes.find((n) => n.pubkey_prefix === pk);
      return node?.name || pk.slice(0, 8);
    }
    return key;
  }

  _filteredChatKeys() {
    const all = this._chatKeys();
    const q = this._search.toLowerCase();
    return all.filter((key) => {
      if (this._filter === "channels" && !key.startsWith("ch:")) return false;
      if (this._filter === "dms" && !key.startsWith("dm:")) return false;
      if (this._filter === "unread" && !this._unread[key]) return false;
      if (q && !this._channelName(key).toLowerCase().includes(q)) return false;
      return true;
    });
  }

  _filteredNodes() {
    const q = this._search.toLowerCase();
    const f = this._nodeFilter;
    return this._discoveredNodes.filter((n) => {
      const t = (n.type || "").toLowerCase();
      if (f === "repeaters" && !t.includes("repeater")) return false;
      if (f === "clients" && t.includes("repeater")) return false;
      if (
        q &&
        !(n.name || "").toLowerCase().includes(q) &&
        !(n.pubkey_prefix || "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }

  // ── Rendering ─────────────────────────────────────────────────────
  _render() {
    const shadow = this.shadowRoot;
    const p = this._pane;
    const unread = Object.values(this._unread).reduce((a, b) => a + b, 0);
    const onSettings = p === "settings";
    const onConsole = p === "console";
    shadow.innerHTML = `<style>${STYLE}</style><div class="card" data-pane="${p}">
      <div class="top-tab-bar">
        <button class="top-tab${p === "chats" ? " active" : ""}" data-pane="chats">
          Chat${unread ? `<span class="top-tab-badge">${unread}</span>` : ""}
        </button>
        <button class="top-tab${p === "nodes" ? " active" : ""}" data-pane="nodes">
          Nodes${this._discoveredNodes.length ? `<span class="top-tab-badge">${this._discoveredNodes.length}</span>` : ""}
        </button>
        <button class="top-tab${onConsole ? " active" : ""}" data-pane="console">Console</button>
        <button class="top-tab${onSettings ? " active" : ""}" data-pane="settings">Settings</button>
      </div>
      <div class="main-content">
        <div class="sidebar" id="sidebar" style="${onSettings ? "display:none" : ""}"></div>
        <div class="chat-panel" style="${onSettings ? "display:none" : ""}">
          <div class="chat-header" id="chat-header"></div>
          <div class="messages-area" id="messages-area"></div>
          ${
            onConsole
              ? ""
              : `<div class="autocomplete-popup" id="autocomplete-popup" hidden></div>
          <div class="input-area" id="input-area"></div>
          <button class="scroll-to-bottom" id="scroll-to-bottom-btn" hidden title="Scroll to bottom">
            <ha-icon icon="mdi:chevron-down"></ha-icon>
          </button>`
          }
        </div>
        <div class="settings-panel" id="panel-settings" style="${onSettings ? "" : "display:none"}"></div>
      </div>
      ${onConsole ? `<div class="input-area" id="input-area"></div>` : ""}
    </div>`;

    shadow.querySelector(".top-tab-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".top-tab");
      if (btn) this._setPane(btn.dataset.pane);
    });

    this._renderSidebar();
    if (!onSettings) {
      this._renderHeader();
      this._renderMessages();
      this._renderInput();
      if (!onConsole) this._wireScrollToBottom();
    } else {
      this._renderSettingsPanel();
    }
  }

  _wireScrollToBottom() {
    const area = this.shadowRoot.getElementById("messages-area");
    const btn = this.shadowRoot.getElementById("scroll-to-bottom-btn");
    if (!area || !btn) return;
    const update = () => {
      const dist = area.scrollHeight - area.scrollTop - area.clientHeight;
      btn.hidden = dist <= 80;
    };
    area.addEventListener("scroll", update, { passive: true });
    btn.addEventListener("click", () => {
      area.scrollTo({ top: area.scrollHeight, behavior: "smooth" });
    });
  }

  // Full sidebar render: rebuilds header/tabs (search input rebuilt here too —
  // called only on pane/filter/add-form toggles, NOT on every keystroke).
  _renderSidebar() {
    const el = this.shadowRoot.getElementById("sidebar");
    if (!el) return;

    const totalUnread = Object.values(this._unread).reduce((a, b) => a + b, 0);
    const onChats = this._pane === "chats";

    let filterTabs = "";
    let addForm = "";
    if (onChats) {
      filterTabs = `
        <div class="filter-tabs">
          <button class="filter-tab ${this._filter === "all" ? "active" : ""}" data-filter="all">All</button>
          <button class="filter-tab ${this._filter === "unread" ? "active" : ""}" data-filter="unread">
            Unread${totalUnread ? ` (${totalUnread})` : ""}
          </button>
          <button class="filter-tab ${this._filter === "channels" ? "active" : ""}" data-filter="channels"># Ch</button>
          <button class="filter-tab ${this._filter === "dms" ? "active" : ""}" data-filter="dms">DMs</button>
        </div>`;
      if (this._showAddChannel) {
        addForm = `
          <div class="add-form">
            <div class="add-form-row">
              <input class="idx" type="number" min="0" max="255" placeholder="idx" />
              <input class="name" type="text" placeholder="#channel-name" maxlength="32" />
            </div>
            <div class="add-form-row">
              <button class="cancel" data-action="cancel-add">Cancel</button>
              <button data-action="commit-add">Set channel</button>
            </div>
            <div class="hint">Hash is auto-derived (sha256, 32 chars). Use <code>#name</code> for community channels.</div>
          </div>`;
      }
    } else if (this._pane === "nodes") {
      filterTabs = `
        <div class="filter-tabs">
          <button class="filter-tab ${this._nodeFilter === "all" ? "active" : ""}" data-node-filter="all">All</button>
          <button class="filter-tab ${this._nodeFilter === "clients" ? "active" : ""}" data-node-filter="clients">Clients</button>
          <button class="filter-tab ${this._nodeFilter === "repeaters" ? "active" : ""}" data-node-filter="repeaters">Repeaters</button>
        </div>`;
    } else if (this._pane === "console") {
      const CMDS = [
        { sig: "send_advert", desc: "Broadcast presence to mesh" },
        { sig: "reset_path <pubkey_prefix>", desc: "Reset path to contact" },
        { sig: "get_bat", desc: "Get battery level" },
        { sig: "get_time", desc: "Get device time" },
        { sig: "get_devicetime", desc: "Get device timestamp" },
        { sig: "set_name <name>", desc: "Set node name" },
        {
          sig: "set_radio <freq> <bw> <sf> <cr>",
          desc: "Set radio parameters",
        },
        { sig: "set_tx_power <tx>", desc: "Set TX power" },
        { sig: "set_radio.rxgain <val>", desc: "Set RX gain" },
        { sig: "set_coords <lat> <lon>", desc: "Set GPS coordinates" },
        { sig: "set_channel <idx> <name> <hash>", desc: "Set channel" },
        { sig: "set_path_hash_mode <0|1>", desc: "Set path hash mode" },
        { sig: "get_msg <offset>", desc: "Get message at offset" },
        { sig: "send_login <key> <password>", desc: "Login to contact" },
        { sig: "send_msg <key> <text>", desc: "Send direct message" },
      ];
      filterTabs = `<div class="cmd-list">
        <div class="cmd-list-title">Available Commands</div>
        ${CMDS.map(
          (c, i) => `<div class="cmd-item" data-cmd-idx="${i}">
          <div class="cmd-sig">${esc(c.sig)}</div>
          <div class="cmd-desc">${esc(c.desc)}</div>
        </div>`,
        ).join("")}
      </div>`;
    }

    const addBtn = onChats
      ? `<button class="add-btn" title="Add # channel" data-action="toggle-add">+</button>`
      : "";
    const advertBtn = `<button class="add-btn advert-btn" title="Send advert (announce yourself to the mesh)" data-action="open-advert">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12a7 7 0 0 1 14 0"/>
        <path d="M2 12a10 10 0 0 1 20 0"/>
        <circle cx="12" cy="13" r="2"/>
        <line x1="12" y1="15" x2="12" y2="22"/>
      </svg>
    </button>`;

    el.innerHTML = `
      <div class="sidebar-header"${this._pane === "console" ? ' style="display:none"' : ""}>
        <div class="sidebar-title">
          <span>MeshCore</span>
          <span style="display:flex;gap:4px;position:relative" id="header-actions">${addBtn}${advertBtn}</span>
        </div>
        ${
          this._pane !== "console"
            ? `<div class="search-box">
          <ha-icon icon="mdi:magnify"></ha-icon>
          <input class="search-input" placeholder="${onChats ? "Search chats…" : "Search nodes…"}" />
        </div>`
            : ""
        }
      </div>
      ${filterTabs}
      ${addForm}
      ${this._pane !== "console" ? `<div class="channel-list" id="channel-list"></div>` : ""}`;

    // Restore search value & cursor without re-creating the input
    const searchInput = el.querySelector(".search-input");
    if (searchInput) {
      searchInput.value = this._search;
      searchInput.addEventListener("input", (e) => {
        this._search = e.target.value;
        // Partial render — keeps focus & caret position in the input.
        this._renderSidebarList();
      });
    }

    el.querySelectorAll(".filter-tab[data-filter]").forEach((b) =>
      b.addEventListener("click", () => {
        this._filter = b.dataset.filter;
        this._saveViewState();
        this._renderSidebar();
      }),
    );
    el.querySelectorAll(".filter-tab[data-node-filter]").forEach((b) =>
      b.addEventListener("click", () => {
        this._nodeFilter = b.dataset.nodeFilter;
        this._saveViewState();
        this._renderSidebar();
      }),
    );

    const addBtnEl = el.querySelector('[data-action="toggle-add"]');
    if (addBtnEl)
      addBtnEl.addEventListener("click", () => {
        this._showAddChannel = !this._showAddChannel;
        this._renderSidebar();
      });
    const cancelBtn = el.querySelector('[data-action="cancel-add"]');
    if (cancelBtn)
      cancelBtn.addEventListener("click", () => {
        this._showAddChannel = false;
        this._renderSidebar();
      });
    const commitBtn = el.querySelector('[data-action="commit-add"]');
    if (commitBtn)
      commitBtn.addEventListener("click", () => {
        const idxEl = el.querySelector(".add-form input.idx");
        const nameEl = el.querySelector(".add-form input.name");
        const idx = parseInt(idxEl?.value, 10);
        const name = nameEl?.value || "";
        this._addChannel(idx, name);
      });

    const advertBtnEl = el.querySelector('[data-action="open-advert"]');
    if (advertBtnEl)
      advertBtnEl.addEventListener("click", (e) => {
        e.stopPropagation();
        this._toggleAdvertMenu();
      });

    el.querySelectorAll(".cmd-item[data-cmd-idx]").forEach((item) => {
      item.addEventListener("click", () => {
        const sig = item.querySelector(".cmd-sig")?.textContent?.trim() ?? "";
        // Strip placeholder tokens (<…>) and trailing space so the user fills them in.
        const base = sig.replace(/<[^>]+>/g, "").replace(/\s+$/, "");
        const input = this.shadowRoot.querySelector(".console-input");
        if (input) {
          input.value = base;
          input.focus();
        }
      });
    });

    this._renderSidebarList();
  }

  // Partial render of just the list — preserves the search input & its focus.
  _renderSidebarList() {
    const list = this.shadowRoot.getElementById("channel-list");
    if (!list) return;

    if (this._pane === "chats") {
      const keys = this._filteredChatKeys();
      const hiddenCount = this._hiddenChats.size;
      const footer = hiddenCount
        ? `<div class="hidden-footer" data-action="unhide-all"
                title="Restore all closed chats">+ Show ${hiddenCount} hidden chat${hiddenCount === 1 ? "" : "s"}</div>`
        : "";
      if (!keys.length) {
        list.innerHTML = `<div class="empty-list">${hiddenCount ? "All chats are hidden." : "No chats yet."}<br>Send a message or tap <b>+</b> to add a # channel.</div>${footer}`;
        const unh = list.querySelector('[data-action="unhide-all"]');
        if (unh) unh.addEventListener("click", () => this._unhideAll());
        return;
      }
      list.innerHTML =
        keys.map((key) => this._renderChatRow(key)).join("") + footer;
      list.querySelectorAll(".channel-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          if (e.target.closest('[data-action="close-chat"]')) return;
          this._selectKey(item.dataset.key);
        });
      });
      list.querySelectorAll('[data-action="close-chat"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          this._hideChat(btn.dataset.key);
        });
      });
      const unh = list.querySelector('[data-action="unhide-all"]');
      if (unh) unh.addEventListener("click", () => this._unhideAll());
    } else if (this._pane === "nodes") {
      const nodes = this._filteredNodes();
      if (!nodes.length) {
        list.innerHTML = `<div class="empty-list">No nodes discovered yet.</div>`;
        return;
      }
      list.innerHTML = nodes.map((n) => this._renderNodeRow(n)).join("");
      list
        .querySelectorAll(".channel-item")
        .forEach((item) =>
          item.addEventListener("click", () =>
            this._selectKey(item.dataset.key),
          ),
        );
    } else {
      // console pane — sidebar list is empty
      list.innerHTML = `<div class="empty-list" style="font-size:11px;opacity:0.7">Send MeshCore commands<br>and see feedback in the panel.</div>`;
    }
  }

  _renderChatRow(key) {
    const name = this._channelName(key);
    const color = colorForName(key);
    const icon = this._channelIcon(key);
    const active = key === this._activeKey;
    const unread = this._unread[key] || 0;
    const msgs = this._messages[key] || [];
    const last = msgs[msgs.length - 1];
    const sub = last
      ? `${esc(last.sender)}: ${esc((last.text || "").substring(0, 30))}${(last.text || "").length > 30 ? "…" : ""}`
      : "No messages";
    return `
      <div class="channel-item ${active ? "active" : ""}" data-key="${esc(key)}">
        <div class="channel-icon" style="${iconStyle(color)}">${esc(icon)}</div>
        <div class="channel-info">
          <div class="channel-name">
            ${esc(name)}
            ${key.startsWith("ch:") && this._channelScopes[key] ? `<span class="scope-badge">${esc(this._channelScopes[key])}</span>` : ""}
          </div>
          <div class="channel-sub">${sub}</div>
        </div>
        ${unread ? `<div class="unread-badge">${unread}</div>` : ""}
        <button class="chat-close" data-action="close-chat" data-key="${esc(key)}" title="Close chat (hide from sidebar)">×</button>
      </div>`;
  }

  _renderNodeRow(node) {
    const key = `node:${node.pubkey_prefix}`;
    const color = colorForName(node.name);
    const icon = (node.name[0] || "?").toUpperCase();
    const active = key === this._activeKey;
    const sub = `${node.type}${node.added_to_node === false ? " · discovered" : ""}`;
    return `
      <div class="channel-item ${active ? "active" : ""}" data-key="${esc(key)}">
        <div class="channel-icon" style="${iconStyle(color)}">
          ${esc(icon)}
          <div class="presence-dot ${node.online ? "online" : ""}"></div>
        </div>
        <div class="channel-info">
          <div class="channel-name">${esc(node.name)}</div>
          <div class="channel-sub node-type">${esc(sub)}</div>
        </div>
      </div>`;
  }

  _renderHeader() {
    const el = this.shadowRoot.getElementById("chat-header");
    if (!el) return;
    if (this._pane === "console") {
      const count = this._consoleLogs.length;
      el.innerHTML = `
        <button class="mobile-back" data-action="mobile-back" title="Back" aria-label="Back">‹</button>
        <div class="chat-header-icon" style="background:#1e293b33;color:#94a3b8;border:1.5px solid #94a3b844;font-family:monospace">&gt;_</div>
        <div><div class="chat-header-name">Console</div></div>
        <div class="chat-header-sub">${count} command${count === 1 ? "" : "s"}</div>
        <button class="hops-toggle" data-action="clear-console" title="Clear log">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          Clear
        </button>
        <div class="status-dot" title="Connected"></div>`;
      el.querySelector('[data-action="mobile-back"]')?.addEventListener(
        "click",
        () => this._mobileShowSidebar(),
      );
      el.querySelector('[data-action="clear-console"]')?.addEventListener(
        "click",
        () => {
          this._consoleLogs = [];
          this._saveConsoleHistory();
          this._renderHeader();
          this._renderMessages();
        },
      );
      return;
    }
    if (!this._activeKey) {
      el.innerHTML = `<div class="chat-header-name" style="color:var(--text3)">Select a chat or node</div>`;
      return;
    }
    const key = this._activeKey;
    const name = this._channelName(key);
    const color = colorForName(key);
    const icon = this._channelIcon(key);

    let sub = "";
    if (key.startsWith("ch:") || key.startsWith("dm:")) {
      const msgs = this._messages[key] || [];
      sub = `${msgs.length} message${msgs.length === 1 ? "" : "s"}`;
    } else if (key.startsWith("node:")) {
      const pk = key.split(":")[1];
      const node = this._discoveredNodes.find((n) => n.pubkey_prefix === pk);
      sub = node ? `${node.type} · ${node.online ? "online" : "offline"}` : "";
    }

    // Show the hops-toggle only on chat keys (it has no meaning on node detail).
    const isChat = key.startsWith("ch:") || key.startsWith("dm:");
    const hopsBtn = isChat
      ? `<button class="hops-toggle ${this._showHops ? "on" : ""}"
                 data-action="toggle-hops"
                 title="${this._showHops ? "Hide" : "Show"} hops & repeater info under messages"
                 aria-pressed="${this._showHops}">
           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
             <circle cx="5" cy="12" r="2"/>
             <circle cx="12" cy="12" r="2"/>
             <circle cx="19" cy="12" r="2"/>
             <path d="M7 12h3M14 12h3"/>
           </svg>
         </button>`
      : "";

    const isChannel = key.startsWith("ch:");
    let scopePickerHtml = "";
    if (isChannel) {
      this._loadScopeStateIfNeeded();
      const selScope = this._channelScopes[key] || "";
      const opts = [`<option value="">global</option>`]
        .concat(this._availableScopes.map(
          (s) => `<option value="${esc(s)}"${s === selScope ? " selected" : ""}>${esc(s)}</option>`
        ))
        .join("");
      scopePickerHtml = `
        <div class="scope-row">
          <select class="scope-select" data-action="scope-select">${opts}</select>
          <button class="scope-add-btn" data-action="scope-add" title="Add scope">+</button>
          <input class="scope-new-input" data-action="scope-new-input" placeholder="#region" hidden />
          <button class="scope-new-confirm" data-action="scope-new-confirm" hidden title="Confirm">✓</button>
        </div>`;
    }

    el.innerHTML = `
      <button class="mobile-back" data-action="mobile-back" title="Back to chats" aria-label="Back to chats">‹</button>
      <div class="chat-header-icon" style="${iconStyle(color)}">${esc(icon)}</div>
      <div class="chat-header-info">
        <div class="chat-header-name">${esc(name)}</div>
        ${scopePickerHtml}
      </div>
      <div class="chat-header-sub">${esc(sub)}</div>
      ${hopsBtn}
      <div class="status-dot" title="Connected"></div>`;

    const backBtn = el.querySelector('[data-action="mobile-back"]');
    if (backBtn)
      backBtn.addEventListener("click", () => this._mobileShowSidebar());
    const hopsBtnEl = el.querySelector('[data-action="toggle-hops"]');
    if (hopsBtnEl)
      hopsBtnEl.addEventListener("click", () => this._toggleHops());

    // Scope picker wiring (channel views only)
    const scopeSel = el.querySelector('[data-action="scope-select"]');
    if (scopeSel) {
      scopeSel.addEventListener("change", () => {
        const v = scopeSel.value;
        if (v) this._channelScopes[key] = v;
        else delete this._channelScopes[key];
        this._saveScopeState();
        this._renderSidebarList();
      });
    }
    const scopeAddBtn = el.querySelector('[data-action="scope-add"]');
    const scopeInput  = el.querySelector('[data-action="scope-new-input"]');
    const scopeConfirm = el.querySelector('[data-action="scope-new-confirm"]');
    const _showScopeInput = (show) => {
      if (scopeInput)  scopeInput.hidden = !show;
      if (scopeConfirm) scopeConfirm.hidden = !show;
      if (scopeAddBtn) scopeAddBtn.hidden = show;
      if (show && scopeInput) scopeInput.focus();
    };
    const _confirmNewScope = () => {
      let v = scopeInput?.value?.trim() ?? "";
      if (!v) { _showScopeInput(false); return; }
      if (!v.startsWith("#")) v = "#" + v;
      this._addAvailableScope(v);
      this._channelScopes[key] = v;
      this._saveScopeState();
      this._renderHeader();
      this._renderSidebarList();
    };
    if (scopeAddBtn) scopeAddBtn.addEventListener("click", () => _showScopeInput(true));
    if (scopeConfirm) scopeConfirm.addEventListener("click", _confirmNewScope);
    if (scopeInput) {
      scopeInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); _confirmNewScope(); }
        if (e.key === "Escape") _showScopeInput(false);
      });
    }
  }

  _toggleHops() {
    this._showHops = !this._showHops;
    this._settings = this._settings || {};
    this._settings.show_hops = this._showHops;
    this._saveSettings();
    this._applyHopsVisibility();
    this._renderHeader();
  }

  _applyHopsVisibility() {
    if (this._showHops) this.classList.remove("hide-hops");
    else this.classList.add("hide-hops");
  }

  _mobileShowChat() {
    this.classList.add("mobile-show-chat");
  }
  _mobileShowSidebar() {
    this.classList.remove("mobile-show-chat");
  }

  _renderNodeMap(node) {
    if (!this._hass?.states) return "";
    const a = node.attrs || {};

    // Collect neighbor SNR data from HA sensor entities.
    // Entity pattern: sensor.meshcore_{repeater[:10]}_neighbor_{neighbor[:6]}
    const repPrefix = node.pubkey_prefix.slice(0, 10).toLowerCase();
    const neighbors = [];
    for (const [id, st] of Object.entries(this._hass.states)) {
      if (!id.startsWith(`sensor.meshcore_${repPrefix}_neighbor_`)) continue;
      if (id.endsWith("_seen")) continue;
      const snr = parseFloat(st.state);
      if (isNaN(snr)) continue;
      const neighborPk = st.attributes?.pubkey_prefix || "";
      const match = neighborPk
        ? this._discoveredNodes.find((n) =>
            n.pubkey_prefix
              .toLowerCase()
              .startsWith(neighborPk.slice(0, 6).toLowerCase()),
          )
        : null;
      neighbors.push({
        pubkey: neighborPk,
        name: st.attributes?.resolved_name || neighborPk.slice(0, 6) || "?",
        snr,
        lastSeen: st.attributes?.last_seen || "",
        lat: match?.attrs?.adv_lat || null,
        lon: match?.attrs?.adv_lon || null,
      });
    }

    if (!neighbors.length) {
      return `<div class="node-map-wrap"><div class="node-map-empty">No neighbor data.<br>Enable repeater neighbor tracking in integration settings.</div></div>`;
    }

    const W = 420,
      H = 220,
      PAD = 44;
    const hasGps = a.adv_lat && a.adv_lon;
    const allHaveGps = hasGps && neighbors.every((n) => n.lat && n.lon);

    const snrColor = (snr) => {
      if (snr >= 0) return "#4ade80";
      if (snr >= -5) return "#a3e635";
      if (snr >= -12) return "#facc15";
      if (snr >= -20) return "#fb923c";
      return "#f87171";
    };

    const pos = {};
    if (allHaveGps) {
      const lats = [a.adv_lat, ...neighbors.map((n) => n.lat)];
      const lons = [a.adv_lon, ...neighbors.map((n) => n.lon)];
      const minLat = Math.min(...lats),
        maxLat = Math.max(...lats);
      const minLon = Math.min(...lons),
        maxLon = Math.max(...lons);
      const dLat = maxLat - minLat || 0.002;
      const dLon = maxLon - minLon || 0.002;
      const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
      const scaleX = (W - 2 * PAD) / (dLon * cosLat);
      const scaleY = (H - 2 * PAD) / dLat;
      const scale = Math.min(scaleX, scaleY);
      const offX = (W - dLon * cosLat * scale) / 2;
      const offY = (H - dLat * scale) / 2;
      pos["self"] = {
        x: offX + (a.adv_lon - minLon) * cosLat * scale,
        y: H - offY - (a.adv_lat - minLat) * scale,
      };
      neighbors.forEach((n, i) => {
        pos[i] = {
          x: offX + (n.lon - minLon) * cosLat * scale,
          y: H - offY - (n.lat - minLat) * scale,
        };
      });
    } else {
      pos["self"] = { x: W / 2, y: H / 2 };
      const R = Math.min(W, H) / 2 - PAD;
      neighbors.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / neighbors.length - Math.PI / 2;
        pos[i] = {
          x: W / 2 + R * Math.cos(angle),
          y: H / 2 + R * Math.sin(angle),
        };
      });
    }

    const lines = neighbors
      .map((n, i) => {
        const p1 = pos["self"],
          p2 = pos[i];
        const mx = (p1.x + p2.x) / 2,
          my = (p1.y + p2.y) / 2;
        const c = snrColor(n.snr);
        const label = `${n.snr >= 0 ? "+" : ""}${n.snr.toFixed(0)} dB`;
        return `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="${c}" stroke-width="1.5" opacity="0.6"/>
<rect x="${(mx - 18).toFixed(1)}" y="${(my - 8).toFixed(1)}" width="36" height="15" rx="4" fill="var(--card-background-color,#1a1a2e)" opacity="0.88"/>
<text x="${mx.toFixed(1)}" y="${(my + 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="${c}" font-family="monospace">${esc(label)}</text>`;
      })
      .join("\n");

    const neighborNodes = neighbors
      .map((n, i) => {
        const p = pos[i];
        const c = snrColor(n.snr);
        const label = n.name.length > 9 ? n.name.slice(0, 9) + "…" : n.name;
        const subLabel = n.lastSeen ? n.lastSeen : "";
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9" fill="var(--card-background-color,#1a1a2e)" stroke="${c}" stroke-width="2"/>
<text x="${p.x.toFixed(1)}" y="${(p.y - 13).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--primary-text-color,#e0e0e0)" font-family="sans-serif">${esc(label)}</text>
${subLabel ? `<text x="${p.x.toFixed(1)}" y="${(p.y + 21).toFixed(1)}" text-anchor="middle" font-size="8" fill="var(--text3,#888)" font-family="sans-serif">${esc(subLabel)}</text>` : ""}`;
      })
      .join("\n");

    const sp = pos["self"];
    const selfLabel =
      node.name.length > 8 ? node.name.slice(0, 8) + "…" : node.name;
    const selfNode = `<circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="11" fill="var(--primary-color,#3b82f6)" opacity="0.9" stroke="var(--card-background-color,#1a1a2e)" stroke-width="2"/>
<text x="${sp.x.toFixed(1)}" y="${(sp.y + 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="#fff" font-weight="bold" font-family="sans-serif">${esc(selfLabel)}</text>`;

    const mode = allHaveGps ? "geographic" : "schematic";
    const legend = `<div class="node-map-legend">
      <span><i style="background:#4ade80"></i>&ge;0 dB</span>
      <span><i style="background:#facc15"></i>-12…-5</span>
      <span><i style="background:#fb923c"></i>-20…-12</span>
      <span><i style="background:#f87171"></i>&lt;-20 dB</span>
      <span style="margin-left:auto;opacity:0.6">${esc(mode)}</span>
    </div>`;

    return `<div class="node-map-wrap">
      <div class="node-map-title">Neighbors (${neighbors.length})</div>
      <svg class="node-map-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        ${lines}
        ${neighborNodes}
        ${selfNode}
      </svg>
      ${legend}
    </div>`;
  }

  async _injectNodeHaMap(node) {
    if (!customElements.get("ha-map")) {
      try {
        const helpers = await window.loadCardHelpers();
        await helpers.createCardElement({ type: "map", entities: [] });
        await Promise.race([
          customElements.whenDefined("ha-map"),
          new Promise((_, rej) => setTimeout(rej, 10000)),
        ]);
      } catch {
        const s = this.shadowRoot.getElementById("node-ha-map-slot");
        if (s) s.textContent = "Map unavailable";
        return;
      }
    }
    const slot = this.shadowRoot.getElementById("node-ha-map-slot");
    if (!slot) return;
    const a = node.attrs || {};
    const lat = parseFloat(a.adv_lat);
    const lon = parseFloat(a.adv_lon);
    if (isNaN(lat) || isNaN(lon)) return;
    const haMap = document.createElement("ha-map");
    haMap.hass = this._hass;
    haMap.entities = node.entity_id ? [{ entity_id: node.entity_id }] : [];
    haMap.centerLatLng = [lat, lon];
    haMap.zoom = 13;
    slot.innerHTML = "";
    slot.appendChild(haMap);
  }

  _renderMessages() {
    // While the browser tab is hidden the messages container has no reliable
    // layout (clientHeight/scrollHeight read as 0), so the scroll-restore math
    // below would mistake the view for "at bottom" and jump to the top. Defer
    // until the tab is visible again — not touching innerHTML here preserves the
    // current scrollTop, and the visibilitychange handler re-renders on return.
    if (document.hidden) {
      this._deferredMessageRender = true;
      return;
    }
    const el = this.shadowRoot.getElementById("messages-area");
    if (!el) return;
    if (this._pane === "console") {
      this._renderConsoleLog(el);
      return;
    }
    if (!this._activeKey) {
      el.innerHTML = "";
      return;
    }
    const key = this._activeKey;

    // Node detail view
    if (key.startsWith("node:")) {
      const pk = key.split(":")[1];
      const node = this._discoveredNodes.find((n) => n.pubkey_prefix === pk);
      if (!node) {
        el.innerHTML = "";
        return;
      }
      const a = node.attrs || {};
      const lastAdv = a.last_advert
        ? new Date((a.last_advert || 0) * 1000).toLocaleString()
        : "—";
      const rows = [
        ["Name", node.name],
        ["Type", node.type],
        ["Status", node.online ? "online" : "offline"],
        ["Public key", a.public_key || node.pubkey_prefix],
        ["Last advert", lastAdv],
        a.adv_lat ? ["Latitude", a.adv_lat] : null,
        a.adv_lon ? ["Longitude", a.adv_lon] : null,
        [
          "On device",
          a.added_to_node === false ? "no (discovered only)" : "yes",
        ],
      ].filter(Boolean);
      const hasGps = !!(a.adv_lat && a.adv_lon);
      el.innerHTML = `
        <div class="node-detail">
          <h3>${esc(node.name)}</h3>
          ${hasGps ? `<div class="node-map-wrap"><div class="node-map-title">Location</div><div id="node-ha-map-slot" class="node-map-container"></div></div>` : ""}
          ${rows
            .map(
              ([k, v]) =>
                `<div class="kv"><div class="k">${esc(k)}</div><div class="v">${esc(String(v))}</div></div>`,
            )
            .join("")}
        </div>`;
      if (hasGps) this._injectNodeHaMap(node);
      return;
    }

    // Chat view
    const msgs = this._messages[key] || [];
    if (!msgs.length) {
      el.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <p>No messages yet</p>
        </div>`;
      return;
    }

    const groups = [];
    msgs.forEach((msg, i) => {
      const prev = msgs[i - 1];
      if (
        prev &&
        prev.sender === msg.sender &&
        prev.own === msg.own &&
        msg.ts - prev.ts < 120000
      ) {
        groups[groups.length - 1].messages.push(msg);
      } else {
        groups.push({ sender: msg.sender, own: msg.own, messages: [msg] });
      }
    });

    // Capture scroll state before replacing innerHTML (which resets scrollTop to 0).
    // distFromBottom lets us restore position when content is prepended (e.g. history load).
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const shouldScrollToBottom =
      this._pendingScrollToBottom || distFromBottom <= 40;

    const replyIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>`;

    const myName = this._myName;

    el.innerHTML = groups
      .map((group) => {
        const color = colorForName(group.sender);
        return `
        <div class="msg-group">
          ${!group.own ? `<div class="msg-sender" style="color:${color}">${esc(group.sender)}</div>` : ""}
          ${group.messages
            .map((msg) => {
              const parsed = this._parseMention(msg.text || "");
              const idx = msgs.indexOf(msg);
              const mentionsMe =
                !!myName &&
                (parsed.mention?.name === myName ||
                  (/\@\[([^\]]{1,64})\]/g.test(parsed.body) &&
                    this._mentionsName(parsed.body, myName)));
              const mentionChip = parsed.mention
                ? `<span class="mention-chip ${parsed.mention.name === myName ? "me" : ""}" data-mention="${esc(parsed.mention.name)}">@${esc(parsed.mention.name)}</span> `
                : "";
              const bodyHtml = this._renderInlineMentions(parsed.body, myName);
              const metaHtml = this._renderMessageMeta(msg);
              const ack = group.own ? this._ackLevel(msg) : "";
              const resendBtn =
                group.own && this._needsResend(msg)
                  ? `<button class="resend-btn" data-resend-idx="${idx}">↺ Resend</button>`
                  : "";
              const copyIconSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
              return `<div class="msg-row ${group.own ? "own" : ""} ${mentionsMe ? "mentions-me" : ""}" data-msg-idx="${idx}"><div class="msg-bubble"${ack ? ` data-ack="${ack}"` : ""}><span class="msg-text">${mentionChip}${bodyHtml}</span>${metaHtml}${resendBtn}</div><button class="reply-action" data-reply-idx="${idx}" title="Reply">${replyIconSvg}</button><button class="copy-action" data-copy-idx="${idx}" title="Copy message">${copyIconSvg}</button><span class="msg-time" title="${esc(formatTime(msg.ts))}">${relativeTime(msg.ts)}</span></div>`;
            })
            .join("")}
        </div>`;
      })
      .join("");

    // Wire reply buttons
    el.querySelectorAll(".reply-action").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const i = parseInt(btn.dataset.replyIdx, 10);
        const target = msgs[i];
        if (target)
          this._setReply(key, {
            sender: target.sender,
            // Use the BODY (after stripping any leading mention) so the reply
            // bar shows the actual content the user is replying to.
            text: this._parseMention(target.text || "").body,
            ts: target.ts,
          });
      });
    });

    // Copy message text to clipboard.
    el.querySelectorAll(".copy-action").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const i = parseInt(btn.dataset.copyIdx, 10);
        const target = msgs[i];
        if (target?.text)
          navigator.clipboard.writeText(target.text).catch(() => {});
      });
    });

    // Click a leading mention chip → reply to that user.
    el.querySelectorAll(".mention-chip").forEach((m) => {
      m.addEventListener("click", (e) => {
        e.stopPropagation();
        const name = m.dataset.mention;
        if (name)
          this._setReply(key, { sender: name, text: "", ts: Date.now() });
      });
    });

    // Click a #channel chip → navigate to that channel.
    el.querySelectorAll(".channel-chip").forEach((chip) => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        const idxStr = chip.dataset.channelIdx;
        const tag = chip.dataset.channelTag;
        let targetKey = null;
        if (idxStr !== "") {
          targetKey = `ch:${idxStr}`;
        } else {
          // Try matching by name in case index wasn't resolved at render time.
          const ch = this._discoveredChannels.find(
            (c) =>
              c.name &&
              c.name.replace(/^#/, "").toLowerCase() ===
                (tag || "").toLowerCase(),
          );
          if (ch != null) targetKey = `ch:${ch.idx}`;
        }
        if (targetKey && this._chatKeys().includes(targetKey)) {
          this._selectKey(targetKey);
        }
      });
    });

    // Resend button on unacknowledged own messages.
    el.querySelectorAll(".resend-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const i = parseInt(btn.dataset.resendIdx, 10);
        const target = msgs[i];
        if (target) this._resendMessage(key, target);
      });
    });

    if (shouldScrollToBottom) {
      el.scrollTop = el.scrollHeight;
      this._pendingScrollToBottom = false;
    } else {
      // Restore position relative to the bottom so prepended history (older
      // messages inserted above) doesn't teleport the view to the top.
      el.scrollTop = el.scrollHeight - el.clientHeight - distFromBottom;
    }
  }

  // Returns "confirmed" when delivery is confirmed (repeater heard / DM ACK'd), "" otherwise.
  // Used by data-ack for the compact tick and by _needsResend.
  _ackLevel(msg) {
    const m = msg.meta;
    if (!m || m.send_error) return "";
    if (m.message_type === "direct")
      return m.ack_received === true ? "confirmed" : "";
    if (m.message_type === "channel") {
      const heard =
        m.repeater_count > 0 ||
        (Array.isArray(m.rx_log_data) && m.rx_log_data.length > 0);
      return heard ? "confirmed" : "";
    }
    return "";
  }

  _needsResend(msg) {
    const m = msg.meta;
    if (!m || !m.outgoing || m.send_error || m.progressive) return false;
    return this._ackLevel(msg) !== "confirmed";
  }

  _renderMessageMeta(msg) {
    const m = msg.meta;
    if (!m) return "";

    // Surface send errors inline under the bubble.
    if (m.send_error) {
      return `<div class="msg-meta" style="color:#f87171"><span class="meta-icon">✕</span> ${esc(m.send_error)}</div>`;
    }

    let icon = "",
      text = "",
      repeaters = null,
      scope = null;

    if (m.outgoing) {
      if (m.message_type === "direct") {
        if (m.ack_received === true) {
          icon = "✓";
          text = "delivered";
        } else if (m.ack_received === false) {
          icon = "✕";
          text = "no ACK";
        } else {
          icon = "↑";
          text = "sent";
        }
      } else if (m.message_type === "channel") {
        const list = this._repeatersFromRxLog(m.rx_log_data);
        const n = m.repeater_count != null ? m.repeater_count : list.length;
        if (n > 0) {
          icon = "📡";
          text = `heard by ${n} repeater${n === 1 ? "" : "s"}`;
          repeaters = list;
        } else if (m.progressive) {
          icon = "📡";
          text = "sending…";
        } else {
          icon = "📡";
          text = "broadcast (no relays heard)";
        }
      }
    } else {
      // Incoming
      if (m.message_type === "direct") {
        const h = m.hop_count;
        if (h === 0) {
          icon = "↘";
          text = "direct";
        } else if (typeof h === "number" && h > 0) {
          icon = "↘";
          text = `${h} hop${h === 1 ? "" : "s"}`;
        }
        if (typeof m.snr === "number") {
          text = (text ? `${text} · ` : "") + `SNR ${m.snr.toFixed(1)} dB`;
        }
      } else if (m.message_type === "channel") {
        const list = this._repeatersFromRxLog(m.rx_log_data);
        if (list.length) {
          // list now contains ALL unique hops in the path (full trace).
          icon = "↘";
          text = `${list.length} hop${list.length === 1 ? "" : "s"}`;
          repeaters = list;
        }
        scope = Array.isArray(m.rx_log_data)
          ? (m.rx_log_data.find((e) => e?.flood_scope)?.flood_scope ?? null)
          : null;
        if (scope && !text) { icon = "↘"; text = "received"; }
      }
    }

    if (!text) return "";

    const MAX_VISIBLE = this._settings?.max_repeaters ?? 4;
    const repeaterChips = (() => {
      if (!repeaters || !repeaters.length) return "";
      const visible = repeaters.slice(0, MAX_VISIBLE);
      const overflow = repeaters.slice(MAX_VISIBLE);
      const chips = visible.map(
        (r) => `<span class="meta-rp" title="${esc(r.full || r.byte)}">${esc(r.name)}</span>`
      ).join("");
      const moreChip = overflow.length
        ? `<span class="meta-rp more">+${overflow.length}<span class="meta-rp-overflow">${
            overflow.map((r) => `<span class="meta-rp-overflow-item" title="${esc(r.full || r.byte)}">${esc(r.name)}</span>`).join("")
          }</span></span>`
        : "";
      return ` <span class="meta-rps">${chips}${moreChip}</span>`;
    })();
    const scopeChip = scope ? ` <span class="meta-scope">${esc(scope)}</span>` : "";
    return `<div class="msg-meta"><span class="meta-icon">${icon}</span> ${esc(text)}${repeaterChips}${scopeChip}</div>`;
  }

  // Walk ALL path nodes from ALL rx_log_data entries — deduplicated, ordered by first appearance.
  _repeatersFromRxLog(rxLogData) {
    if (!Array.isArray(rxLogData) || !rxLogData.length) return [];
    const out = new Map(); // hex -> {name, byte, full}
    for (const entry of rxLogData) {
      if (!entry) continue;
      const size = entry.path_hash_size || 1;
      const stride = size * 2; // hex chars per node in path string
      // Prefer the pre-split path_nodes array; fall back to splitting path string.
      let nodes;
      if (Array.isArray(entry.path_nodes) && entry.path_nodes.length) {
        nodes = entry.path_nodes;
      } else if (
        typeof entry.path === "string" &&
        entry.path.length >= stride
      ) {
        nodes = [];
        for (let i = 0; i + stride <= entry.path.length; i += stride)
          nodes.push(entry.path.slice(i, i + stride));
      } else {
        continue;
      }
      for (const nodeHex of nodes) {
        if (!nodeHex) continue;
        const k = nodeHex.toLowerCase();
        if (out.has(k)) continue;
        const match = this._discoveredNodes.find(
          (n) => n.pubkey_prefix && n.pubkey_prefix.toLowerCase().startsWith(k),
        );
        const fullPk = match?.pubkey_prefix || "";
        const name = match?.name || `…${k}`;
        out.set(k, { name, byte: k, full: fullPk });
      }
    }
    return Array.from(out.values());
  }

  _mentionsName(body, name) {
    if (!body || !name) return false;
    const re = /@\[([^\]]{1,64})\]/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      if (m[1].trim() === name) return true;
    }
    return false;
  }

  _renderInlineMentions(body, myName) {
    if (!body) return "";
    // Split on @[name] mentions AND #word channel references.
    const parts = String(body).split(/(@\[[^\]]{1,64}\]|#[\w\-]+)/g);
    return parts
      .map((p) => {
        // @[NAME] mention
        const mention = p.match(/^@\[([^\]]{1,64})\]$/);
        if (mention) {
          const name = mention[1].trim();
          const cls =
            myName && name === myName
              ? "mention-chip inline me"
              : "mention-chip inline";
          return `<span class="${cls}" data-mention="${esc(name)}">@${esc(name)}</span>`;
        }
        // #channel reference
        const chanRef = p.match(/^#([\w\-]+)$/);
        if (chanRef) {
          const tag = chanRef[1];
          // Find a matching channel by name (strip leading # for comparison).
          const ch = this._discoveredChannels.find(
            (c) =>
              c.name &&
              c.name.replace(/^#/, "").toLowerCase() === tag.toLowerCase(),
          );
          const chIdx = ch?.idx ?? null;
          return `<span class="channel-chip" data-channel-idx="${chIdx ?? ""}" data-channel-tag="${esc(tag)}">#${esc(tag)}</span>`;
        }
        return esc(p);
      })
      .join("");
  }

  _renderInput() {
    const el = this.shadowRoot.getElementById("input-area");
    if (!el) return;
    if (this._pane === "console") {
      this._renderConsoleInput(el);
      return;
    }
    if (!this._activeKey || this._activeKey.startsWith("node:")) {
      el.innerHTML = "";
      el.style.display = "none";
      const rb = this.shadowRoot.getElementById("reply-bar");
      if (rb) rb.remove();
      this._dismissAutocomplete();
      return;
    }
    el.style.display = "";

    // Preserve draft text across re-renders (e.g. when reply is set while typing).
    const prevInput = el.querySelector(".msg-input");
    const savedText = prevInput ? prevInput.value : "";
    const savedCursor = prevInput ? prevInput.selectionStart : null;

    const reply = this._replyDrafts[this._activeKey];

    // Replace any existing reply-bar before rebuilding.
    const existingRb = this.shadowRoot.getElementById("reply-bar");
    if (existingRb) existingRb.remove();

    el.innerHTML = `<textarea class="msg-input" placeholder="${reply ? `Mention @${esc(reply.sender || "user")}…` : "Type a message…"}" maxlength="200" rows="1" data-bwignore></textarea><button class="send-btn" title="Send"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>`;

    if (reply) {
      el.insertAdjacentHTML(
        "beforebegin",
        `<div class="reply-bar" id="reply-bar"><div class="reply-bar-inner"><span class="reply-bar-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg></span><div class="reply-bar-text"><span class="who">@[${esc(reply.sender || "")}]</span><span class="what">${esc(reply.text || "(no preview)")}</span></div><button class="reply-bar-cancel" title="Cancel reply (Esc)" data-action="cancel-reply">×</button></div></div>`,
      );
      const cancel = this.shadowRoot.querySelector(
        '[data-action="cancel-reply"]',
      );
      if (cancel)
        cancel.addEventListener("click", () =>
          this._clearReply(this._activeKey),
        );
    }

    const input = el.querySelector(".msg-input");
    const btn = el.querySelector(".send-btn");

    // Restore any draft text that was present before the re-render.
    if (savedText) {
      input.value = savedText;
      if (savedCursor != null) {
        input.selectionStart = input.selectionEnd = savedCursor;
      }
    }

    const _autoResize = () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 140) + "px";
    };
    input.addEventListener("input", () => {
      _autoResize();
      this._updateAutocomplete(input);
    });
    input.addEventListener("keydown", (e) => {
      if (this._autocomplete) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          this._autocomplete.idx =
            (this._autocomplete.idx + 1) % this._autocomplete.items.length;
          this._renderAutocomplete();
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          this._autocomplete.idx =
            (this._autocomplete.idx - 1 + this._autocomplete.items.length) %
            this._autocomplete.items.length;
          this._renderAutocomplete();
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          this._selectAutocomplete(input);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          this._dismissAutocomplete();
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this._sendMessage();
      } else if (e.key === "Escape" && this._replyDrafts[this._activeKey]) {
        e.preventDefault();
        this._clearReply(this._activeKey);
      }
    });
    btn.addEventListener("click", () => this._sendMessage());
  }

  // ── Autocomplete ──────────────────────────────────────────────────────────

  _updateAutocomplete(inputEl) {
    const val = inputEl.value;
    const pos = inputEl.selectionStart ?? val.length;
    const before = val.slice(0, pos);

    // Match a @ or # token that starts at the beginning or after whitespace.
    // Captures: [1] = trigger char, [2] = query so far (may be empty).
    const m = before.match(/(^|[\s>])([@#])([\w\-]*)$/);
    if (!m) {
      this._dismissAutocomplete();
      return;
    }

    const trigger = m[2];
    const query = m[3].toLowerCase();
    const triggerStart = pos - m[2].length - m[3].length;
    const replaceEnd = pos;

    let items = [];
    if (trigger === "@") {
      // Build a deduplicated list of mentionable names from contacts + nodes.
      const seen = new Set();
      const candidates = [
        ...this._discoveredContacts,
        ...this._discoveredNodes,
      ];
      for (const c of candidates) {
        const name = c.name;
        if (!name || seen.has(name)) continue;
        if (query && !name.toLowerCase().includes(query)) continue;
        seen.add(name);
        items.push({
          label: name,
          hint: c.pubkey_prefix ? c.pubkey_prefix.slice(0, 6) : "",
          insert: `@[${name}] `,
        });
      }
    } else {
      // # channels
      for (const c of this._discoveredChannels) {
        const raw = c.name || "";
        const display = raw.startsWith("#") ? raw : `#${raw}`;
        if (query && !raw.toLowerCase().includes(query)) continue;
        items.push({
          label: display,
          hint: `idx ${c.idx}`,
          insert: `${display} `,
        });
      }
    }

    if (!items.length) {
      this._dismissAutocomplete();
      return;
    }

    this._autocomplete = { trigger, items, idx: 0, triggerStart, replaceEnd };
    this._renderAutocomplete(inputEl);
  }

  _renderAutocomplete(inputEl) {
    const popup = this.shadowRoot.getElementById("autocomplete-popup");
    if (!popup) return;
    const ac = this._autocomplete;
    if (!ac || !ac.items.length) {
      popup.hidden = true;
      return;
    }

    popup.hidden = false;
    popup.innerHTML = ac.items
      .map(
        (item, i) =>
          `<div class="autocomplete-item" aria-selected="${i === ac.idx}" data-idx="${i}">
        <span class="ac-label">${esc(item.label)}</span>
        ${item.hint ? `<span class="ac-hint">${esc(item.hint)}</span>` : ""}
      </div>`,
      )
      .join("");

    // Scroll selected item into view inside the popup.
    const selected = popup.querySelector(`[data-idx="${ac.idx}"]`);
    if (selected) selected.scrollIntoView({ block: "nearest" });

    // Wire click handlers.
    popup.querySelectorAll(".autocomplete-item").forEach((row) => {
      row.addEventListener("mousedown", (e) => {
        // mousedown fires before blur; prevent input losing focus.
        e.preventDefault();
        const i = parseInt(row.dataset.idx, 10);
        this._autocomplete.idx = i;
        const inp = this.shadowRoot.querySelector(".msg-input");
        if (inp) this._selectAutocomplete(inp);
      });
    });
  }

  _selectAutocomplete(inputEl) {
    const ac = this._autocomplete;
    if (!ac) return;
    const item = ac.items[ac.idx];
    if (!item) {
      this._dismissAutocomplete();
      return;
    }

    const val = inputEl.value;
    // Recalculate replaceEnd from current cursor (user may have typed more).
    const curPos = inputEl.selectionStart ?? ac.replaceEnd;
    const newVal =
      val.slice(0, ac.triggerStart) + item.insert + val.slice(curPos);
    inputEl.value = newVal;
    const newCursor = ac.triggerStart + item.insert.length;
    inputEl.selectionStart = inputEl.selectionEnd = newCursor;

    this._dismissAutocomplete();
    inputEl.focus();
    // Re-check for a new trigger immediately after insertion.
    this._updateAutocomplete(inputEl);
  }

  _dismissAutocomplete() {
    this._autocomplete = null;
    const popup = this.shadowRoot?.getElementById("autocomplete-popup");
    if (popup) popup.hidden = true;
  }

  // ── Settings modal ───────────────────────────────────────────────
  // ── Advert popover ────────────────────────────────────────────────
  // Sends a MeshCore advertisement (the "I exist" beacon used for contact
  // discovery and routing-table refresh) via meshcore.execute_command:
  //   send_advert            → flood mode (default; reaches every neighbour
  //                            who'll re-broadcast it)
  //   send_advert false      → zero-hop (only direct neighbours; quiet)
  _toggleAdvertMenu() {
    this._advertOpen = !this._advertOpen;
    this._renderAdvertPopover();
  }

  _closeAdvertMenu() {
    if (!this._advertOpen) return;
    this._advertOpen = false;
    this._renderAdvertPopover();
  }

  _renderAdvertPopover() {
    const anchor = this.shadowRoot.getElementById("header-actions");
    if (!anchor) return;
    // Remove any existing popover first.
    const old = anchor.querySelector(".advert-popover");
    if (old) old.remove();
    if (!this._advertOpen) {
      // Drop the global click-away listener if no longer needed.
      if (this._advertCloseHandler) {
        document.removeEventListener("click", this._advertCloseHandler, true);
        this._advertCloseHandler = null;
      }
      return;
    }

    const lastSent = this._lastAdvertSent
      ? `Last sent ${relativeTime(this._lastAdvertSent)} ago`
      : "Not sent yet from this card";
    const disabled = this._advertSending ? "disabled" : "";
    const popover = document.createElement("div");
    popover.className = "advert-popover";
    popover.innerHTML = `
      <h5>Send advertisement</h5>
      <button data-mode="flood" ${disabled} title="Broadcast to the whole mesh — neighbours will re-broadcast">
        <span>📡 Flood advert</span>
        <span class="desc">Reaches every node via repeaters</span>
      </button>
      <button data-mode="zero-hop" ${disabled} title="One-hop only — only direct neighbours will see it">
        <span>📍 Zero-hop advert</span>
        <span class="desc">Only direct neighbours, no relay</span>
      </button>
      <div class="last-sent">${esc(lastSent)}</div>`;
    anchor.appendChild(popover);

    popover.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const flood = b.dataset.mode === "flood";
        this._sendAdvert(flood);
      });
    });

    // Click-away to close (capture phase so it fires before any inner handler).
    if (!this._advertCloseHandler) {
      this._advertCloseHandler = (ev) => {
        const path = ev.composedPath ? ev.composedPath() : [];
        if (
          !path.includes(popover) &&
          !path.includes(anchor.querySelector(".advert-btn"))
        ) {
          this._closeAdvertMenu();
        }
      };
      // Defer registration so the opening click doesn't immediately close it.
      setTimeout(() => {
        document.addEventListener("click", this._advertCloseHandler, true);
      }, 0);
    }
  }

  async _sendAdvert(flood) {
    if (!this._hass) return;
    if (this._advertSending) return;
    this._advertSending = true;

    // Visual feedback: pulse the antenna icon while in-flight.
    const antennaBtn = this.shadowRoot.querySelector(".advert-btn");
    if (antennaBtn) antennaBtn.classList.add("broadcasting");
    this._renderAdvertPopover();

    const cmd = flood ? "send_advert" : "send_advert false";
    try {
      await this._hass.callService(
        "meshcore",
        "execute_command",
        this._svcData({ command: cmd }),
      );
      this._lastAdvertSent = Date.now();
      this._toast(
        flood ? "📡 Flood advert sent" : "📍 Zero-hop advert sent",
        "ok",
      );
    } catch (err) {
      const msg = err?.message || err?.error || String(err) || "unknown error";
      this._toast(`Advert failed: ${msg}`, "err");
      console.error("meshcore-chat-card: send_advert failed", err);
    } finally {
      this._advertSending = false;
      if (antennaBtn) antennaBtn.classList.remove("broadcasting");
      this._closeAdvertMenu();
    }
  }

  _toast(text, kind) {
    const card = this.shadowRoot.querySelector(".card");
    if (!card) return;
    // Remove prior toast immediately so multiple sends don't stack.
    const old = card.querySelector(".toast");
    if (old) old.remove();
    const t = document.createElement("div");
    t.className = `toast ${kind || ""}`;
    t.textContent = text;
    card.appendChild(t);
    setTimeout(() => {
      try {
        t.remove();
      } catch (_) {}
    }, 3200);
  }

  async _fetchDeviceSettings() {
    if (!this._hass) return;
    this._deviceSettings = { ...this._deviceSettings, loading: true };
    if (this._pane === "settings" && this._settingsTab === "device")
      this._renderSettingsPanel();

    // Read values from HA entity states/attributes synchronously — no commands needed.
    const states = this._hass.states || {};
    const prefix =
      this._devicePrefix ||
      this._config.device_prefix ||
      this._settings.device_prefix;
    let attrFirmware = null,
      attrHardware = null,
      attrPublicKey = null;
    let sensorFreq = null,
      sensorBw = null,
      sensorSf = null,
      sensorCr = null;
    let sensorTx = null,
      sensorLat = null,
      sensorLon = null;
    if (prefix) {
      for (const [id, st] of Object.entries(states)) {
        const isSensor = id.startsWith(`sensor.meshcore_${prefix}_`);
        const isBinary = id.startsWith(`binary_sensor.meshcore_${prefix}`);
        if (!isSensor && !isBinary) continue;
        const a = st.attributes || {};
        const v = st.state;
        if (!attrFirmware && (a.firmware_version || a.fw_build || a.ver))
          attrFirmware =
            String(a.firmware_version ?? a.fw_build ?? a.ver).trim() || null;
        if (!attrHardware && (a.hardware || a.model || a.board))
          attrHardware =
            String(a.hardware ?? a.model ?? a.board).trim() || null;
        if (!attrPublicKey && a.public_key && a.public_key.length > 12)
          attrPublicKey = String(a.public_key).trim() || null;
        if (isSensor && v != null && v !== "unavailable" && v !== "unknown") {
          const base = `sensor.meshcore_${prefix}_`;
          const slug = (metric) =>
            id === `${base}${metric}` || id.startsWith(`${base}${metric}_`);
          const n = parseFloat(v);
          if (!isNaN(n)) {
            if (!sensorFreq && slug("frequency")) sensorFreq = n;
            if (!sensorBw && slug("bandwidth")) sensorBw = n;
            if (!sensorSf && slug("spreading_factor")) sensorSf = n;
            if (!sensorCr && slug("coding_rate")) sensorCr = n;
            if (!sensorTx && slug("tx_power")) sensorTx = n;
            if (!sensorLat && slug("latitude")) sensorLat = n;
            if (!sensorLon && slug("longitude")) sensorLon = n;
          }
        }
      }
    }

    const [entriesR, devicesR] = await Promise.allSettled([
      this._hass.connection.sendMessagePromise({
        type: "config_entries/get",
        domain: "meshcore",
      }),
      this._hass.connection.sendMessagePromise({
        type: "config/device_registry/list",
      }),
    ]);

    // Connection type from config entries
    let connectionType = this._deviceSettings.connectionType;
    if (entriesR.status === "fulfilled") {
      const entries = Array.isArray(entriesR.value)
        ? entriesR.value
        : (entriesR.value?.result ?? []);
      const entryId = this._config.entry_id || this._settings.entry_id;
      const entry = entryId
        ? entries.find((e) => e.entry_id === entryId)
        : (entries.find((e) => e.domain === "meshcore") ?? entries[0]);
      if (entry) {
        const d = entry.data || {};
        if (d.host) connectionType = `TCP — ${d.host}:${d.port ?? 4403}`;
        else if (d.device) connectionType = `USB — ${d.device}`;
        else if (d.address) connectionType = `BLE — ${d.address}`;
        else if (d.connection_type || d.type)
          connectionType = String(d.connection_type ?? d.type);
        else connectionType = entry.title ?? "—";
      }
    }

    const cleanHaName = (s) => {
      if (!s) return null;
      return (
        s
          .replace(/^meshcore\s+/i, "")
          .replace(/\s*\([0-9a-f]{6,}\)\s*$/i, "")
          .trim() || null
      );
    };

    // Device registry — sw_version = firmware, model = hardware, name = device name
    let regFirmware = null,
      regHardware = null,
      regDeviceName = null;
    if (devicesR.status === "fulfilled") {
      const devices =
        devicesR.value?.devices ??
        devicesR.value?.result?.devices ??
        devicesR.value ??
        [];
      const cfgEntries =
        entriesR.status === "fulfilled"
          ? Array.isArray(entriesR.value)
            ? entriesR.value
            : (entriesR.value?.result ?? [])
          : [];
      const entryId = this._config.entry_id || this._settings.entry_id;
      const meshcoreEntryIds = new Set(
        cfgEntries
          .filter((e) => e.domain === "meshcore")
          .map((e) => e.entry_id),
      );
      const dev =
        Array.isArray(devices) &&
        devices.find(
          (d) =>
            (entryId && d.config_entries?.includes(entryId)) ||
            (!entryId &&
              d.config_entries?.some?.((e) => meshcoreEntryIds.has(e))),
        );
      if (dev) {
        regFirmware = dev.sw_version
          ? String(dev.sw_version).trim() || null
          : null;
        regHardware = dev.model ? String(dev.model).trim() || null : null;
        regDeviceName = cleanHaName(String(dev.name_by_user ?? dev.name ?? ""));
      }
    }

    // Config entry title as device name fallback
    const cfgEntryTitle = (() => {
      if (entriesR.status !== "fulfilled") return null;
      const entries = Array.isArray(entriesR.value)
        ? entriesR.value
        : (entriesR.value?.result ?? []);
      const entryId = this._config.entry_id || this._settings.entry_id;
      const entry = entryId
        ? entries.find((e) => e.entry_id === entryId)
        : entries.find((e) => e.domain === "meshcore");
      return cleanHaName(entry?.title ? String(entry.title) : "");
    })();

    // Friendly name from binary_sensor.meshcore_<prefix>_messages
    const sensorFriendlyName = (() => {
      if (!prefix) return null;
      const st = states[`binary_sensor.meshcore_${prefix}_messages`];
      if (!st) return null;
      return cleanHaName(
        (st.attributes?.friendly_name || "").replace(/\s*messages\s*$/i, ""),
      );
    })();

    this._deviceSettings = {
      loading: false,
      deviceName:
        regDeviceName ??
        sensorFriendlyName ??
        cfgEntryTitle ??
        this._deviceSettings.deviceName,
      firmware: regFirmware ?? attrFirmware ?? this._deviceSettings.firmware,
      hardware: regHardware ?? attrHardware ?? this._deviceSettings.hardware,
      publicKey: attrPublicKey ?? this._deviceSettings.publicKey,
      connectionType,
      radioFreq: sensorFreq ?? this._deviceSettings.radioFreq,
      radioBw: sensorBw ?? this._deviceSettings.radioBw,
      radioSf: sensorSf ?? this._deviceSettings.radioSf,
      radioCr: sensorCr ?? this._deviceSettings.radioCr,
      txPower: sensorTx ?? this._deviceSettings.txPower,
      rxGain: this._deviceSettings.rxGain,
      lat: sensorLat ?? this._deviceSettings.lat,
      lon: sensorLon ?? this._deviceSettings.lon,
      pathHashMode: this._deviceSettings.pathHashMode,
    };
    if (this._pane === "settings" && this._settingsTab === "device")
      this._renderSettingsPanel();
  }

  _openSettings(tab) {
    if (tab) this._settingsTab = tab;
    this._setPane("settings");
  }

  _closeSettings() {
    this._setPane("chats");
  }

  _commitSettings() {
    const d = this._draftSettings || {};
    const cleanChannels = (this._draftChannels || [])
      .map((c) => ({
        idx: parseInt(c.idx, 10),
        name: String(c.name || "").trim(),
      }))
      .filter((c) => Number.isInteger(c.idx) && c.idx >= 0 && c.name);
    const cleanContacts = (this._draftContacts || [])
      .map((c) => ({
        pubkey_prefix: String(c.pubkey_prefix || "")
          .trim()
          .toLowerCase(),
        name: String(c.name || "").trim(),
      }))
      .filter((c) => c.pubkey_prefix.length >= 6 && c.name);

    this._settings = {
      node_name: String(d.node_name || "").trim(),
      device_prefix:
        String(d.device_prefix || "")
          .trim()
          .toLowerCase() || undefined,
      entry_id: String(d.entry_id || "").trim() || undefined,
      max_messages: Math.max(
        20,
        Math.min(2000, parseInt(d.max_messages, 10) || 200),
      ),
      history_hours: Math.max(
        1,
        Math.min(720, parseInt(d.history_hours, 10) || 24),
      ),
      default_pane: d.default_pane === "nodes" ? "nodes" : "chats",
      compact: !!d.compact,
      height: String(d.height || "").trim() || undefined,
      show_hops: d.show_hops !== false && d.show_hops !== "false",
      max_repeaters: Math.max(1, Math.min(20, parseInt(d.max_repeaters, 10) || 4)),
      channels: cleanChannels,
      contacts: cleanContacts,
    };
    this._showHops = this._settings.show_hops;
    this._applyHopsVisibility();
    this._saveSettings();
    this._mergeSettingsIntoConfig();
    this._applyHeightVar();

    this._discoverFromHass();
    // Re-render with settings pane still active.
    this._render();
    this._settingsSavedAt = Date.now();
    this._renderSettingsPanel();
    if (this._savedPillTimer) clearTimeout(this._savedPillTimer);
    this._savedPillTimer = setTimeout(() => {
      this._settingsSavedAt = null;
      if (this._pane === "settings") this._renderSettingsPanel();
    }, 4000);
    this._toast("✓ Settings saved", "ok");
  }

  async _commitChannelsToDevice() {
    this._applyStatus = null;
    if (!this._hass || !this._draftChannels) {
      this._applyStatus = { ok: 0, fail: 0, errors: [], skipped: "no draft" };
      return this._applyStatus;
    }

    // Sequential — running set_channel in parallel can race the integration's
    // post-set_channel get_channel refresh and confuse the SDK's ack tracking.
    const status = {
      ok: 0,
      fail: 0,
      invalid: 0,
      unchanged: 0,
      errors: [],
      applied: [],
    };
    let attempted = 0;
    for (const c of this._draftChannels) {
      const rawIdx = c.idx;
      const idx = parseInt(rawIdx, 10);
      const name = String(c.name || "").trim();
      // Distinguish empty/invalid rows from real failures so the heading
      // stays honest. Empty-name rows are the typical "I clicked + Add but
      // didn't type yet" case — flag them so the user knows what's wrong.
      if (!Number.isInteger(idx) || idx < 0 || idx > 255) {
        status.invalid++;
        status.errors.push(
          `row "${c.name || ""}" (idx=${rawIdx ?? "?"}): invalid index — must be an integer 0..255`,
        );
        continue;
      }
      if (!name) {
        status.invalid++;
        status.errors.push(
          `idx ${idx}: name is empty — type a channel name (e.g. #meteo)`,
        );
        continue;
      }
      // "Match" the device list (preferred truth) first, falling back to the
      // card's discovered list. We only skip if BOTH agree the row already
      // matches — a row that's only in _discoveredChannels but missing from
      // get_channels is treated as needing apply (covers freshly-edited rows
      // that haven't propagated yet).
      const onDevice = (this._serviceChannels || []).find((x) => x.idx === idx);
      if (onDevice && onDevice.name === name) {
        status.unchanged++;
        continue;
      }
      const existing = this._discoveredChannels.find((x) => x.idx === idx);
      if (existing && existing.name === name && onDevice) {
        // Already on device with the same name — nothing to do.
        status.unchanged++;
        continue;
      }
      attempted++;
      try {
        const hash = await sha256Hex32(name);
        // shlex.split parses the command in services.py; quote the name so
        // channel names with spaces or shell metacharacters (#, $, etc.)
        // round-trip cleanly. shlex respects double-quoted strings.
        const safeName = `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
        await this._hass.callService(
          "meshcore",
          "execute_command",
          this._svcData({ command: `set_channel ${idx} ${safeName} ${hash}` }),
        );
        status.ok++;
        status.applied.push({ idx, name });
      } catch (err) {
        status.fail++;
        const msg =
          err?.message || err?.error || JSON.stringify(err) || "unknown error";
        status.errors.push(`idx ${idx} "${name}": ${msg}`);
        console.error(
          `meshcore-chat-card: set_channel ${idx} "${name}" failed`,
          err,
        );
      }
    }

    if (attempted === 0) {
      if (status.invalid > 0) {
        status.note = `Nothing to apply — ${status.invalid} row${status.invalid === 1 ? " is" : "s are"} invalid. Fix highlighted row${status.invalid === 1 ? "" : "s"} below.`;
      } else if (status.unchanged > 0) {
        status.note = `Nothing to apply — all ${status.unchanged} row${status.unchanged === 1 ? "" : "s"} already match the device.`;
      } else {
        status.note = "Nothing to apply — no channel rows.";
      }
    }

    if (status.ok) {
      // Poll get_channels until every applied idx shows up — the integration's
      // post-set_channel get_channel + async_set_updated_data is fast but not
      // synchronous, and a single 250 ms wait isn't always enough.
      const wantIdxs = new Set(status.applied.map((a) => a.idx));
      let confirmed = new Set();
      for (let attempt = 0; attempt < 6; attempt++) {
        await new Promise((r) => setTimeout(r, attempt === 0 ? 250 : 500));
        await this._refreshChannelsFromService();
        confirmed = new Set(
          (this._serviceChannels || [])
            .filter((s) => wantIdxs.has(s.idx))
            .map((s) => s.idx),
        );
        if (confirmed.size === wantIdxs.size) break;
      }
      const missing = [...wantIdxs].filter((i) => !confirmed.has(i));
      if (missing.length) {
        for (const i of missing) {
          const a = status.applied.find((x) => x.idx === i);
          status.errors.push(
            `idx ${i} "${a?.name || ""}": set_channel returned but the channel is still not reported by the device after retries (the radio may not have persisted it).`,
          );
          status.fail++;
          status.ok = Math.max(0, status.ok - 1);
        }
      }
    }

    this._applyStatus = status;
    return status;
  }

  _renderSettingsPanel() {
    const root = this.shadowRoot.getElementById("panel-settings");
    if (!root) return;

    const tab = this._settingsTab;
    const d = this._draftSettings || {};

    const TABS = ["general", "device", "channels", "contacts", "about"];
    const tabsHtml = `<div class="modal-tabs">
      ${TABS.map((id) => `<button class="modal-tab${tab === id ? " active" : ""}" data-tab="${id}">${id.charAt(0).toUpperCase() + id.slice(1)}</button>`).join("")}
    </div>`;

    let body = "";
    if (tab === "general") body = this._renderGeneralForm(d);
    else if (tab === "device") body = this._renderDevicePane();
    else if (tab === "channels") body = this._renderChannelsEditor();
    else if (tab === "contacts") body = this._renderContactsEditor();
    else if (tab === "about") body = this._renderAboutPane();

    const footerHtml = `
      <div class="modal-footer">
        ${
          this._settingsSavedAt && Date.now() - this._settingsSavedAt < 4000
            ? `<span class="saved-pill">✓ Saved</span>`
            : ""
        }
        ${
          tab === "channels"
            ? `<button class="modal-btn secondary" data-action="apply-channels-device">Apply to device</button>`
            : ""
        }
        <div class="spacer"></div>
        <button class="modal-btn primary" data-action="save-settings">Save</button>
      </div>`;

    root.innerHTML = `${tabsHtml}<div class="modal-body">${body}</div>${footerHtml}`;

    // Tab switching
    root.querySelector(".modal-tabs").addEventListener("click", (e) => {
      const btn = e.target.closest(".modal-tab");
      if (!btn) return;
      const newTab = btn.dataset.tab;
      if (!newTab || newTab === this._settingsTab) return;
      this._captureFormDraft(root);
      if (newTab !== "channels") this._applyStatus = null;
      if (newTab !== "contacts") this._contactStatus = null;
      this._settingsTab = newTab;
      if (newTab === "contacts") this._refreshContactsFromService();
      if (newTab === "device") this._fetchDeviceSettings();
      this._renderSettingsPanel();
    });

    // Save
    root
      .querySelector('[data-action="save-settings"]')
      .addEventListener("click", () => {
        this._captureFormDraft(root);
        this._commitSettings();
      });

    // Apply channels to device (only when on channels tab)
    const applyBtn = root.querySelector(
      '[data-action="apply-channels-device"]',
    );
    if (applyBtn)
      applyBtn.addEventListener("click", async () => {
        this._captureFormDraft(root);
        applyBtn.disabled = true;
        applyBtn.textContent = "Applying…";
        try {
          await this._commitChannelsToDevice();
        } finally {
          applyBtn.disabled = false;
          applyBtn.textContent = "Apply to device";
          // Re-sync draft against just-refreshed _discoveredChannels and
          // re-render the modal so success/error banner + new names show.
          if (this._applyStatus?.ok) {
            // For successfully-applied rows, mirror them back into the draft so
            // they no longer look "different from device" (avoids re-applying).
            for (const a of this._applyStatus.applied || []) {
              const row = (this._draftChannels || []).find(
                (r) => parseInt(r.idx, 10) === a.idx,
              );
              if (row) row.name = a.name;
            }
            // Also seed any newly-discovered channels into the draft.
            for (const ch of this._discoveredChannels) {
              if (
                !(this._draftChannels || []).find(
                  (r) => parseInt(r.idx, 10) === ch.idx,
                )
              ) {
                this._draftChannels.push({ idx: ch.idx, name: ch.name });
              }
            }
          }
          this._renderSettingsPanel();
        }
      });

    this._wireFormHandlers(root);
  }

  _renderGeneralForm(d) {
    return `
      <div class="form" data-form="general">
        <div class="row">
          <label>Device pubkey prefix
            <input type="text" name="device_prefix" value="${esc(d.device_prefix || "")}" placeholder="auto-detected (6 hex)" maxlength="12" />
            <div class="help">First 6 hex chars of your MeshCore pubkey. Auto-detected from entities.</div>
          </label>
          <label>Entry ID
            <input type="text" name="entry_id" value="${esc(d.entry_id || "")}" placeholder="optional" />
            <div class="help">Only needed with multiple MeshCore devices configured.</div>
          </label>
        </div>
        <hr/>
        <div class="row">
          <label>Default tab
            <select name="default_pane">
              <option value="chats" ${d.default_pane !== "nodes" ? "selected" : ""}>Chats</option>
              <option value="nodes" ${d.default_pane === "nodes" ? "selected" : ""}>Nodes</option>
            </select>
          </label>
          <label>History (hours)
            <input type="number" name="history_hours" min="1" max="720" value="${d.history_hours || 24}" />
            <div class="help">How far back to load from logbook.</div>
          </label>
          <label>Max messages / chat
            <input type="number" name="max_messages" min="20" max="2000" value="${d.max_messages || 200}" />
          </label>
          <label>Max repeater chips
            <input type="number" name="max_repeaters" min="1" max="20" value="${d.max_repeaters ?? 4}" />
            <div class="help">Repeater names shown below messages before +N overflow.</div>
          </label>
        </div>
        <label>Card height
          <input type="text" name="height" value="${esc(d.height || "")}" placeholder="e.g. 700px, 80vh (default 600px)" />
          <div class="help">Any CSS length: <code>800px</code> · <code>80vh</code> · <code>min(80vh,1000px)</code>. Empty = 600px.</div>
        </label>
        <ha-formfield label="Compact row spacing">
          <ha-checkbox name="compact" ${d.compact ? "checked" : ""}></ha-checkbox>
        </ha-formfield>
        <ha-formfield label="Show hops &amp; repeater info under messages">
          <ha-checkbox name="show_hops" ${d.show_hops !== false ? "checked" : ""}></ha-checkbox>
        </ha-formfield>
      </div>`;
  }

  _renderChannelsEditor() {
    // A channel is "stale" only when ALL of these hold:
    //   1. We actually have a device-truth list (get_channels worked).
    //   2. The idx is missing from that list.
    //   3. The idx WAS present in discovery when the modal opened — i.e. it's
    //      an orphan from a prior session, not a row the user just typed in
    //      via "+ Add channel" and is in the middle of editing.
    const haveDeviceList = !!(
      this._serviceChannels && this._serviceChannels.length
    );
    const knownAtOpen = this._knownChannelIdxsAtOpen || new Set();
    const isStale = (idx) => {
      const i = parseInt(idx, 10);
      if (!Number.isInteger(i)) return false;
      if (!haveDeviceList) return false;
      if (!knownAtOpen.has(i)) return false;
      return !this._serviceChannels.find((sc) => sc.idx === i);
    };

    const items = (this._draftChannels || [])
      .map((c, i) => {
        const stale = isStale(c.idx);
        const idxNum = parseInt(c.idx, 10);
        const nameStr = String(c.name || "").trim();
        const idxInvalid =
          !Number.isInteger(idxNum) || idxNum < 0 || idxNum > 255;
        const nameInvalid = !nameStr;
        const cls = [
          stale ? "stale" : "",
          idxInvalid || nameInvalid ? "invalid" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const idxTitle = idxInvalid ? "Index must be 0..255" : "";
        const nameTitle = nameInvalid ? "Name is required (e.g. #meteo)" : "";
        return `
      <div class="item ${cls}" data-row="${i}">
        <input type="number" min="0" max="255" name="idx" value="${c.idx ?? ""}" placeholder="idx"
               class="${idxInvalid ? "field-invalid" : ""}" title="${esc(idxTitle)}" />
        <input type="text" name="name" value="${esc(c.name || "")}" placeholder="#channel-name" maxlength="32"
               class="${nameInvalid ? "field-invalid" : ""}" title="${esc(nameTitle)}" />
        ${stale ? `<span class="stale-pill" title="Not present on the device">stale</span>` : ""}
        <button class="remove" data-remove="${i}" title="Remove from list">×</button>
      </div>`;
      })
      .join("");

    // Stale-entity cleanup section: every channel binary_sensor whose idx
    // isn't reported by get_channels is an orphan in HA's entity registry.
    // The integration doesn't auto-delete these, so offer Hide and Delete.
    let cleanupSection = "";
    if (haveDeviceList && this._devicePrefix) {
      const dev = this._devicePrefix;
      const liveIdxSet = new Set(this._serviceChannels.map((s) => s.idx));
      const orphans = [];
      for (const id of Object.keys(this._hass?.states || {})) {
        const m = id.match(
          new RegExp(`^binary_sensor\\.meshcore_${dev}_ch_(\\d+)_messages$`),
        );
        if (!m) continue;
        const idx = parseInt(m[1], 10);
        if (liveIdxSet.has(idx)) continue;
        const fn = this._hass.states[id]?.attributes?.friendly_name || "";
        const name =
          fn.replace(/\s*Messages\s*$/i, "").trim() || `Channel ${idx}`;
        orphans.push({ idx, name, entity_id: id });
      }
      orphans.sort((a, b) => a.idx - b.idx);
      if (orphans.length) {
        const rows = orphans
          .map(
            (o) => `
          <div class="orphan-row">
            <div>
              <span class="orphan-name">${esc(o.name)}</span>
              <span class="orphan-meta">idx ${o.idx} · ${esc(o.entity_id)}</span>
            </div>
            <div class="orphan-actions">
              <button data-action="hide-orphan" data-key="ch:${o.idx}" title="Hide from this card only">Hide</button>
              <button class="danger" data-action="delete-orphan" data-entity="${esc(o.entity_id)}" data-key="ch:${o.idx}" title="Permanently remove the entity from Home Assistant">Delete entity</button>
            </div>
          </div>`,
          )
          .join("");
        cleanupSection = `
          <hr/>
          <div class="orphan-section">
            <div class="orphan-title">Stale channel entities (${orphans.length})</div>
            <div class="help">
              These <code>binary_sensor.*_messages</code> entities still exist
              in Home Assistant but the matching channel is no longer
              configured on your MeshCore device. <b>Hide</b> just removes the
              row from this card. <b>Delete entity</b> permanently removes it
              from HA's entity registry — irreversible.
            </div>
            <div class="orphan-list">${rows}</div>
          </div>`;
      }
    }

    let banner = "";
    const s = this._applyStatus;
    if (s) {
      const totalProblems = (s.fail || 0) + (s.invalid || 0);
      const cls = totalProblems > 0 ? (s.ok > 0 ? "warn" : "err") : "ok";
      const heading =
        totalProblems > 0
          ? s.ok > 0
            ? `Applied ${s.ok} channel(s); ${totalProblems} not applied.`
            : `Failed to apply (${totalProblems} issue${totalProblems === 1 ? "" : "s"}).`
          : s.ok > 0
            ? `Applied ${s.ok} channel(s) to the device.`
            : s.note || "Nothing to apply.";
      const errList = s.errors?.length
        ? `<ul>${s.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`
        : "";
      banner = `<div class="apply-banner ${cls}"><b>${esc(heading)}</b>${errList}</div>`;
    }

    return `
      <div class="form" data-form="channels">
        ${banner}
        <div class="help">
          Add or rename channels. <b>Save</b> stores the layout in this card.
          <b>Apply to device</b> additionally runs
          <code>set_channel &lt;idx&gt; "&lt;name&gt;" &lt;sha256(name)[:32]&gt;</code>
          on your MeshCore radio (via the <code>meshcore.execute_command</code> service)
          so the channel is created/renamed there too. Make sure the device is
          connected — failures are reported above.
        </div>
        <div class="list-editor" data-list="channels">
          ${items || `<div class="empty">No channels — click below to add one.</div>`}
          <button type="button" class="add-item" data-action="add-channel-row">+ Add channel</button>
        </div>
        ${cleanupSection}
      </div>`;
  }

  _renderContactsEditor() {
    const haveLive = Array.isArray(this._serviceContacts);
    const live = this._serviceContacts || [];
    const onDevice = live
      .filter((c) => c.added_to_node)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    const discovered = live
      .filter((c) => !c.added_to_node)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

    const banner = this._contactStatus
      ? `<div class="apply-banner ${this._contactStatus.cls || "ok"}"><b>${esc(this._contactStatus.text)}</b></div>`
      : "";

    const contactRow = (c, onDevice) => {
      const initials = (c.name[0] || "?").toUpperCase();
      const colour = colorForName(c.name);
      const pk = esc(c.pubkey_prefix || c.pubkey);
      const extraMeta = onDevice
        ? ""
        : ` · ${esc(c.last_advert ? `seen ${relativeTime(c.last_advert * 1000)} ago` : "never seen")}`;
      const btn = onDevice
        ? `<button class="contact-action danger" data-action="remove-contact-device" data-pk="${pk}">Remove</button>`
        : `<button class="contact-action accent" data-action="add-contact-device" data-pk="${pk}">Add</button>`;
      return `<div class="contact-row">
        <div class="contact-avatar" style="${iconStyle(colour)}">${esc(initials)}</div>
        <div class="contact-info">
          <div class="contact-name">${esc(c.name)}</div>
          <div class="contact-meta">${esc(this._nodeTypeLabel(c.type))} · <code>${esc((c.pubkey || c.pubkey_prefix).slice(0, 12))}</code>${extraMeta}</div>
        </div>${btn}</div>`;
    };

    const deviceSection = `
      <div class="contact-section">
        <div class="section-head">
          <span>On device (${onDevice.length})</span>
          <button class="link-btn" data-action="refresh-contacts" title="Re-pull live list from meshcore.get_contacts">Refresh</button>
        </div>
        ${
          onDevice.length
            ? `<div class="contact-list">${onDevice.map((c) => contactRow(c, true)).join("")}</div>`
            : `<div class="empty-list" style="padding:14px">${haveLive ? "No contacts saved on this device yet." : "Loading…"}</div>`
        }
      </div>`;

    const discoveredSection = `
      <div class="contact-section">
        <div class="section-head">
          <span>Discovered (${discovered.length})</span>
          <span class="help" style="font-size:10px">Heard via advertisements but not saved.</span>
        </div>
        ${
          discovered.length
            ? `<div class="contact-list">${discovered.map((c) => contactRow(c, false)).join("")}</div>`
            : `<div class="empty-list" style="padding:14px">No discovered contacts ${haveLive ? "" : "yet"}.</div>`
        }
      </div>`;

    const pinItems = (this._draftContacts || [])
      .map(
        (c, i) => `
      <div class="item contact" data-row="${i}">
        <input type="text" name="pubkey_prefix" value="${esc(c.pubkey_prefix || "")}" placeholder="pubkey prefix" maxlength="64" />
        <input type="text" name="name" value="${esc(c.name || "")}" placeholder="display name override" />
        <button class="remove" data-remove="${i}" title="Remove">×</button>
      </div>`,
      )
      .join("");

    return `
      <div class="form" data-form="contacts">
        ${banner}
        ${deviceSection}
        ${discoveredSection}
        <hr/>
        <div class="help">
          <b>Sidebar pins</b> below let you override a contact's display name in
          this card without touching the device. The pubkey prefix only needs to
          match the first ≥ 6 hex chars of the contact's public key.
        </div>
        <div class="list-editor" data-list="contacts">
          ${pinItems || `<div class="empty">No pinned overrides.</div>`}
          <button type="button" class="add-item" data-action="add-contact-row">+ Add pin</button>
        </div>
      </div>`;
  }

  _renderDevicePane() {
    const ds = this._deviceSettings;
    const loading = ds.loading;
    const dis = loading ? " disabled" : "";

    // ── Info section ─────────────────────────────────────────────────────────
    const infoRows = [
      ["Firmware", ds.firmware ?? (loading ? "…" : "—")],
      ["Hardware", ds.hardware ?? (loading ? "…" : "—")],
      ["Connection", ds.connectionType ?? (loading ? "…" : "—")],
      [
        "Public key",
        ds.publicKey
          ? `<span class="device-pubkey" title="${esc(ds.publicKey)}">${esc(ds.publicKey.slice(0, 24))}…</span>`
          : loading
            ? "…"
            : "—",
      ],
    ]
      .map(
        ([k, v]) =>
          `<div class="kv"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`,
      )
      .join("");

    const infoSection = `
      <div class="device-section">
        <div class="device-section-hdr">
          <span class="device-section-title">Device info</span>
          <button class="link-btn" id="device-refresh-btn"${dis}>↺ Refresh</button>
        </div>
        <div class="dvc-field">
          <div class="dvc-row">
            <label>Device name
              <input type="text" id="device-name-input" value="${esc(ds.deviceName ?? "")}" placeholder="e.g. MyRepeater"${dis} />
            </label>
            <button class="settings-action-btn" id="device-name-apply"${dis}>Apply</button>
          </div>
          <div class="help">Name broadcast in mesh adverts. Max 32 chars.</div>
        </div>
        <div class="device-info-grid">${infoRows}</div>
      </div>`;

    // ── Radio section ────────────────────────────────────────────────────────
    const radioSection = `
      <div class="device-section">
        <div class="device-section-hdr">
          <span class="device-section-title">Radio</span>
        </div>
        <div class="radio-group">
          <label>Freq (MHz)<input type="number" id="radio-freq" step="0.001" value="${ds.radioFreq ?? ""}" placeholder="MHz"${dis} style="width:100px" /></label>
          <label>BW (kHz)<input type="number" id="radio-bw" step="0.1" value="${ds.radioBw ?? ""}" placeholder="kHz"${dis} style="width:90px" /></label>
          <label>SF<input type="number" id="radio-sf" min="5" max="12" value="${ds.radioSf ?? ""}"${dis} style="width:70px" /></label>
          <label>CR<input type="number" id="radio-cr" min="5" max="8" value="${ds.radioCr ?? ""}"${dis} style="width:70px" /></label>
          <button class="settings-action-btn" id="radio-apply"${dis}>Apply</button>
        </div>
        <div class="help">freq MHz · bandwidth kHz · spreading factor 5–12 · coding rate 5–8. Default: 869.525, 250, 11, 5. Requires reboot.</div>
        <div class="dvc-field">
          <div class="dvc-row">
            <label>TX power (dBm)
              <input type="number" id="tx-power" min="1" max="22" value="${ds.txPower ?? ""}" placeholder="1–22 dBm"${dis} />
            </label>
            <button class="settings-action-btn" id="tx-power-apply"${dis}>Apply</button>
          </div>
          <div class="help">LoRa chip TX power. Check your hardware docs.</div>
        </div>
        <div class="dvc-field">
          <div class="dvc-row">
            <label>RX boost gain
              <select id="rx-gain-select"${dis}>
                <option value="on"  ${ds.rxGain === "on" ? "selected" : ""}>on</option>
                <option value="off" ${ds.rxGain !== "on" ? "selected" : ""}>off</option>
              </select>
            </label>
            <button class="settings-action-btn" id="rx-gain-apply"${dis}>Apply</button>
          </div>
          <div class="help">Boosted receive gain (SX1262/SX1268 only).</div>
        </div>
      </div>`;

    // ── Location section ─────────────────────────────────────────────────────
    const locationSection = `
      <div class="device-section">
        <div class="device-section-hdr">
          <span class="device-section-title">Location</span>
        </div>
        <div class="radio-group">
          <label>Latitude<input type="number" id="loc-lat" step="0.000001" value="${ds.lat ?? ""}" placeholder="lat°"${dis} style="width:130px" /></label>
          <label>Longitude<input type="number" id="loc-lon" step="0.000001" value="${ds.lon ?? ""}" placeholder="lon°"${dis} style="width:130px" /></label>
          <button class="settings-action-btn" id="loc-apply"${dis}>Apply</button>
        </div>
        <div class="help">Decimal degrees. Used in mesh adverts and node map. Set to 0,0 to clear.</div>
      </div>`;

    // ── Mesh section ─────────────────────────────────────────────────────────
    const meshSection = `
      <div class="device-section">
        <div class="device-section-hdr">
          <span class="device-section-title">Mesh</span>
        </div>
        <div class="dvc-field">
          <div class="dvc-row">
            <label>Path hash mode
              <select id="path-hash-mode-select"${dis}>
                <option value="0" ${(ds.pathHashMode ?? 0) === 0 ? "selected" : ""}>0 — 1 byte, 256 IDs (default)</option>
                <option value="1" ${ds.pathHashMode === 1 ? "selected" : ""}>1 — 2 bytes, 65 536 IDs (fw ≥ 1.14)</option>
                <option value="2" ${ds.pathHashMode === 2 ? "selected" : ""}>2 — 3 bytes, 16 M IDs (fw ≥ 1.14)</option>
              </select>
            </label>
            <button class="settings-action-btn" id="path-hash-mode-apply"${dis}>Apply</button>
          </div>
          <div class="help">Hash size in advert broadcasts. Modes 1–2 require fw ≥ 1.14 on all repeaters.</div>
        </div>
      </div>`;

    // ── Actions section ──────────────────────────────────────────────────────
    const actionsSection = `
      <div class="device-section">
        <div class="device-section-hdr">
          <span class="device-section-title">Actions</span>
        </div>
        <div class="form-row-actions">
          <button class="settings-action-btn" id="time-sync-btn">⏱ Sync device time</button>
          <div class="help" id="time-sync-status"></div>
        </div>
      </div>`;

    return `<div class="form device-pane">
      ${loading ? `<div class="device-loading">Loading device settings…</div>` : ""}
      ${infoSection}${radioSection}${locationSection}${meshSection}${actionsSection}
    </div>`;
  }

  _renderAboutPane() {
    const dev = this._devicePrefix || "(none detected)";
    const chCount = this._discoveredChannels.length;
    const dmCount = this._discoveredContacts.length;
    const nodeCount = this._discoveredNodes.length;
    return `
      <div class="form">
        <div class="help">
          MeshCore Chat Card — companion UI for the
          <a href="https://meshcore-dev.github.io/meshcore-ha/" target="_blank" style="color:var(--accent)">meshcore-ha</a>
          Home Assistant integration.
        </div>
        ${[
          ["Detected device prefix", esc(dev)],
          ["Discovered channels", chCount],
          ["Discovered DM contacts", dmCount],
          ["Discovered nodes", nodeCount],
          [
            "Settings storage",
            `<span style="word-break:break-all">${esc(this._settingsKey())}</span>`,
          ],
        ]
          .map(
            ([k, v]) =>
              `<div class="kv"><div class="k" style="color:var(--text3);min-width:160px">${k}</div><div class="v" style="color:var(--text)">${v}</div></div>`,
          )
          .join("")}
      </div>`;
  }

  _captureFormDraft(root) {
    if (!this._draftSettings) return;
    const general = root.querySelector('[data-form="general"]');
    if (general) {
      const get = (name) => general.querySelector(`[name="${name}"]`);
      const getVal = (el) => (el ? el.value : undefined);
      const fields = [
        "node_name",
        "device_prefix",
        "entry_id",
        "default_pane",
        "height",
      ];
      for (const f of fields) {
        const el = get(f);
        const v = getVal(el);
        if (v !== undefined) this._draftSettings[f] = v;
      }
      const num = (n) => {
        const el = get(n);
        return el ? Number(el.value) : undefined;
      };
      const mm = num("max_messages");
      if (mm !== undefined) this._draftSettings.max_messages = mm;
      const hh = num("history_hours");
      if (hh !== undefined) this._draftSettings.history_hours = hh;
      const mr = num("max_repeaters");
      if (mr !== undefined) this._draftSettings.max_repeaters = mr;
      const cb = get("compact");
      if (cb)
        this._draftSettings.compact =
          "checked" in cb ? cb.checked : cb.value === "on";
      const sh = get("show_hops");
      if (sh)
        this._draftSettings.show_hops =
          "checked" in sh ? sh.checked : sh.value === "on";
    }
    const chList = root.querySelector('[data-list="channels"]');
    if (chList) {
      const rows = chList.querySelectorAll(".item");
      this._draftChannels = Array.from(rows).map((r) => ({
        idx: r.querySelector('[name="idx"]')?.value,
        name: r.querySelector('[name="name"]')?.value,
      }));
    }
    const ctList = root.querySelector('[data-list="contacts"]');
    if (ctList) {
      const rows = ctList.querySelectorAll(".item");
      this._draftContacts = Array.from(rows).map((r) => ({
        pubkey_prefix: r.querySelector('[name="pubkey_prefix"]')?.value,
        name: r.querySelector('[name="name"]')?.value,
      }));
    }
  }

  _wireFormHandlers(root) {
    // Live-capture every field edit so navigation buttons don't drop typed input.
    root
      .querySelectorAll(
        ".modal-body input, .modal-body ha-checkbox, .modal-body select",
      )
      .forEach((el) => {
        el.addEventListener("input", () => this._captureFormDraft(root));
        el.addEventListener("change", () => this._captureFormDraft(root));
      });
    // Channel/contact row removal
    root.querySelectorAll(".list-editor .remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._captureFormDraft(root);
        const i = parseInt(btn.dataset.remove, 10);
        if (this._settingsTab === "channels" && this._draftChannels) {
          this._draftChannels.splice(i, 1);
        } else if (this._settingsTab === "contacts" && this._draftContacts) {
          this._draftContacts.splice(i, 1);
        }
        this._renderSettingsPanel();
      });
    });
    // Add-row buttons
    const addCh = root.querySelector('[data-action="add-channel-row"]');
    if (addCh)
      addCh.addEventListener("click", () => {
        this._captureFormDraft(root);
        const used = new Set(
          (this._draftChannels || [])
            .map((c) => parseInt(c.idx, 10))
            .filter((n) => !isNaN(n)),
        );
        let nextIdx = 0;
        while (used.has(nextIdx)) nextIdx++;
        this._draftChannels = [
          ...(this._draftChannels || []),
          { idx: nextIdx, name: "" },
        ];
        this._renderSettingsPanel();
      });
    const addCt = root.querySelector('[data-action="add-contact-row"]');
    if (addCt)
      addCt.addEventListener("click", () => {
        this._captureFormDraft(root);
        this._draftContacts = [
          ...(this._draftContacts || []),
          { pubkey_prefix: "", name: "" },
        ];
        this._renderSettingsPanel();
      });

    // Stale-entity cleanup actions (channels tab)
    root.querySelectorAll('[data-action="hide-orphan"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        if (!key) return;
        // Hide via the same _hiddenChats mechanism the sidebar × uses, then
        // also drop the row from the channels draft so the editor reflects it.
        this._hideChat(key);
        if (this._draftChannels) {
          const idx = parseInt(key.split(":")[1], 10);
          this._draftChannels = this._draftChannels.filter(
            (r) => parseInt(r.idx, 10) !== idx,
          );
        }
        this._renderSettingsPanel();
      });
    });
    root.querySelectorAll('[data-action="delete-orphan"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const entityId = btn.dataset.entity;
        const key = btn.dataset.key;
        if (!entityId) return;
        if (
          !confirm(
            `Permanently remove ${entityId} from Home Assistant?\n\nThis cannot be undone. The integration will recreate it only if a new message arrives on that channel.`,
          )
        )
          return;
        btn.disabled = true;
        const prevText = btn.textContent;
        btn.textContent = "Deleting…";
        try {
          await this._deleteEntity(entityId);
          // Also drop the row from the draft and any local state.
          if (this._draftChannels && key) {
            const idx = parseInt(key.split(":")[1], 10);
            this._draftChannels = this._draftChannels.filter(
              (r) => parseInt(r.idx, 10) !== idx,
            );
          }
          if (key) {
            delete this._messages[key];
            delete this._unread[key];
            this._historyLoaded.delete(key);
            // The entity removal will eventually update hass.states; force a
            // rediscovery now so the sidebar stops showing it.
            this._discoverFromHass();
          }
          this._renderSettingsPanel();
          this._renderSidebar();
        } catch (err) {
          alert(`Failed to delete ${entityId}: ${err?.message || err}`);
          btn.disabled = false;
          btn.textContent = prevText;
        }
      });
    });

    // Device contact management — add / remove / refresh
    root
      .querySelectorAll('[data-action="add-contact-device"]')
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const pk = btn.dataset.pk;
          if (!pk) return;
          btn.disabled = true;
          const prev = btn.textContent;
          btn.textContent = "Adding…";
          const res = await this._addContactToDevice(pk);
          if (res.ok) {
            this._contactStatus = {
              cls: "ok",
              text: `Added contact ${pk.slice(0, 12)} to the device.`,
            };
            this._toast(`📇 Contact added`, "ok");
          } else {
            this._contactStatus = {
              cls: "err",
              text: `Failed to add ${pk}: ${res.error}`,
            };
            this._toast(`Add failed: ${res.error}`, "err");
          }
          btn.disabled = false;
          btn.textContent = prev;
          this._renderSettingsPanel();
        });
      });
    root
      .querySelectorAll('[data-action="remove-contact-device"]')
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const pk = btn.dataset.pk;
          if (!pk) return;
          if (
            !confirm(
              `Remove contact ${pk.slice(0, 12)} from the device?\n\nThis removes it from the radio's saved contact list. Discovered advert data is preserved — you can re-add it later if the contact still beacons.`,
            )
          )
            return;
          btn.disabled = true;
          const prev = btn.textContent;
          btn.textContent = "Removing…";
          const res = await this._removeContactFromDevice(pk);
          if (res.ok) {
            this._contactStatus = {
              cls: "ok",
              text: `Removed contact ${pk.slice(0, 12)} from the device.`,
            };
            this._toast(`📇 Contact removed`, "ok");
          } else {
            this._contactStatus = {
              cls: "err",
              text: `Failed to remove ${pk}: ${res.error}`,
            };
            this._toast(`Remove failed: ${res.error}`, "err");
          }
          btn.disabled = false;
          btn.textContent = prev;
          this._renderSettingsPanel();
        });
      });
    const refreshBtn = root.querySelector('[data-action="refresh-contacts"]');
    if (refreshBtn)
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        const prev = refreshBtn.textContent;
        refreshBtn.textContent = "Refreshing…";
        await this._refreshContactsFromService();
        refreshBtn.disabled = false;
        refreshBtn.textContent = prev;
      });

    this._wireDeviceHandlers(root);
  }

  _wireDeviceHandlers(root) {
    if (this._settingsTab !== "device") return;

    const cmd = async (c) =>
      this._hass.callService(
        "meshcore",
        "execute_command",
        this._svcData({ command: c }),
        undefined,
        false,
        true,
      );

    const withBtn = async (btn, label, fn) => {
      if (!btn) return;
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = label;
      try {
        await fn();
      } catch (err) {
        this._toast(`✗ ${err?.message || err}`, "err");
      }
      btn.disabled = false;
      btn.textContent = prev;
    };

    // Refresh
    const refreshBtn = root.querySelector("#device-refresh-btn");
    if (refreshBtn)
      refreshBtn.addEventListener("click", () => this._fetchDeviceSettings());

    // Device name
    root.querySelector("#device-name-apply")?.addEventListener("click", () =>
      withBtn(
        root.querySelector("#device-name-apply"),
        "Applying…",
        async () => {
          const val = root.querySelector("#device-name-input")?.value?.trim();
          if (!val) return;
          await cmd(`set name ${val}`);
          this._deviceSettings.deviceName = val;
          this._toast(`✓ Name set to "${val}"`, "ok");
        },
      ),
    );

    // Public key — click to copy full key
    root.querySelector(".device-pubkey")?.addEventListener("click", () => {
      const pk = this._deviceSettings.publicKey;
      if (pk)
        navigator.clipboard
          .writeText(pk)
          .then(() => this._toast("✓ Public key copied", "ok"))
          .catch(() => {});
    });

    // Radio freq/bw/sf/cr
    root.querySelector("#radio-apply")?.addEventListener("click", () =>
      withBtn(root.querySelector("#radio-apply"), "Applying…", async () => {
        const freq = root.querySelector("#radio-freq")?.value;
        const bw = root.querySelector("#radio-bw")?.value;
        const sf = root.querySelector("#radio-sf")?.value;
        const cr = root.querySelector("#radio-cr")?.value;
        if (!freq || !bw || !sf || !cr) {
          this._toast("Fill all 4 radio fields", "err");
          return;
        }
        await cmd(`set_radio ${freq},${bw},${sf},${cr}`);
        Object.assign(this._deviceSettings, {
          radioFreq: parseFloat(freq),
          radioBw: parseFloat(bw),
          radioSf: parseInt(sf),
          radioCr: parseInt(cr),
        });
        this._toast("✓ Radio params applied — reboot required", "ok");
      }),
    );

    // TX power
    root.querySelector("#tx-power-apply")?.addEventListener("click", () =>
      withBtn(root.querySelector("#tx-power-apply"), "Applying…", async () => {
        const val = root.querySelector("#tx-power")?.value;
        if (!val) return;
        await cmd(`set_tx_power ${val}`);
        this._deviceSettings.txPower = parseInt(val);
        this._toast(`✓ TX power set to ${val} dBm`, "ok");
      }),
    );

    // RX gain
    root.querySelector("#rx-gain-apply")?.addEventListener("click", () =>
      withBtn(root.querySelector("#rx-gain-apply"), "Applying…", async () => {
        const val = root.querySelector("#rx-gain-select")?.value;
        await cmd(`set radio.rxgain ${val}`);
        this._deviceSettings.rxGain = val;
        this._toast(`✓ RX gain set to ${val}`, "ok");
      }),
    );


    // Location
    root.querySelector("#loc-apply")?.addEventListener("click", () =>
      withBtn(root.querySelector("#loc-apply"), "Applying…", async () => {
        const lat = root.querySelector("#loc-lat")?.value;
        const lon = root.querySelector("#loc-lon")?.value;
        if (lat === "" || lon === "") {
          this._toast("Enter both lat and lon", "err");
          return;
        }
        await cmd(`set lat ${lat}`);
        await cmd(`set lon ${lon}`);
        this._deviceSettings.lat = parseFloat(lat);
        this._deviceSettings.lon = parseFloat(lon);
        this._toast("✓ Location updated", "ok");
      }),
    );

    // Path hash mode
    root.querySelector("#path-hash-mode-apply")?.addEventListener("click", () =>
      withBtn(
        root.querySelector("#path-hash-mode-apply"),
        "Applying…",
        async () => {
          const val = parseInt(
            root.querySelector("#path-hash-mode-select")?.value ?? "0",
            10,
          );
          await cmd(`set path.hash.mode ${val}`);
          this._deviceSettings.pathHashMode = val;
          this._toast(`✓ Path hash mode set to ${val}`, "ok");
        },
      ),
    );


    // Time sync
    const timeSyncBtn = root.querySelector("#time-sync-btn");
    const timeSyncStatus = root.querySelector("#time-sync-status");
    timeSyncBtn?.addEventListener("click", () =>
      withBtn(timeSyncBtn, "Syncing…", async () => {
        if (timeSyncStatus) timeSyncStatus.textContent = "";
        const ts = Math.floor(Date.now() / 1000);
        await this._hass.callService(
          "meshcore",
          "execute_command",
          this._svcData({ command: `set_time ${ts}` }),
          undefined,
          false,
          true,
        );
        if (timeSyncStatus) {
          timeSyncStatus.textContent = "✓ Synced";
          timeSyncStatus.style.color = "var(--success-color, #4ade80)";
        }
        this._toast("⏱ Device time synced", "ok");
      }),
    );
  }

  async _deleteEntity(entityId) {
    if (!this._hass || !entityId) throw new Error("not connected");
    return this._hass.connection.sendMessagePromise({
      type: "config/entity_registry/remove",
      entity_id: entityId,
    });
  }

  getCardSize() {
    return 7;
  }

  static getConfigElement() {
    return document.createElement("meshcore-chat-card-editor");
  }

  static getStubConfig() {
    return {
      node_name: "MyNode",
    };
  }
}

customElements.define("meshcore-chat-card", MeshcoreChatCard);

/* ==================================================================== *
 *  Visual editor for the Lovelace UI editor (getConfigElement target)  *
 * ==================================================================== */

const EDITOR_STYLE = `
  :host { display: block; font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; }
  .ed { display: flex; flex-direction: column; gap: 14px; padding: 4px 2px 8px; }
  .ed h4 {
    margin: 8px 0 2px; font-size: 13px; font-weight: 700;
    color: var(--primary-text-color, #1f2937);
    letter-spacing: 0.02em;
  }
  .ed .help {
    font-size: 12px; color: var(--secondary-text-color, #64748b); line-height: 1.4;
    margin-top: -4px;
  }
  .ed label {
    display: flex; flex-direction: column; gap: 4px;
    font-size: 12px; font-weight: 600;
    color: var(--secondary-text-color, #64748b);
  }
  .ed .row { display: flex; gap: 10px; flex-wrap: wrap; }
  .ed .row > label { flex: 1 1 160px; }
  .ed input[type="text"], .ed input[type="number"], .ed select {
    background: var(--card-background-color, #fff);
    border: 1px solid var(--divider-color, #e5e7eb);
    border-radius: 6px;
    padding: 7px 10px;
    color: var(--primary-text-color, #1f2937);
    font-size: 13px;
    outline: none;
    font-family: inherit;
  }
  .ed input:focus, .ed select:focus {
    border-color: var(--primary-color, #03a9f4);
  }
  .ed input[type="checkbox"] {
    accent-color: var(--primary-color, #03a9f4);
    width: 16px; height: 16px;
  }
  .ed .checkbox-row {
    flex-direction: row; align-items: center; gap: 8px;
  }
  .ed hr { border: none; border-top: 1px solid var(--divider-color, #e5e7eb); margin: 4px 0; }
  .ed .list { display: flex; flex-direction: column; gap: 6px; }
  .ed .item {
    display: grid;
    grid-template-columns: 70px 1fr auto;
    gap: 6px;
    align-items: center;
  }
  .ed .item.contact { grid-template-columns: 160px 1fr auto; }
  .ed .item input { width: 100%; }
  .ed .item .x {
    background: none; border: none; color: var(--secondary-text-color, #64748b);
    cursor: pointer; font-size: 18px; padding: 0 6px;
  }
  .ed .item .x:hover { color: #ef4444; }
  .ed .add-row {
    background: var(--card-background-color, #fff);
    border: 1px dashed var(--divider-color, #e5e7eb);
    color: var(--secondary-text-color, #64748b);
    padding: 6px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
  }
  .ed .add-row:hover { color: var(--primary-color, #03a9f4); border-color: var(--primary-color, #03a9f4); }
`;

class MeshcoreChatCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
  }

  setConfig(config) {
    // Preserve `type` (and any other top-level keys we don't manage) so the
    // emitted config-changed event always carries them — Lovelace rejects
    // configs without `type` ("Nie wprowadzono typu." / "No type provided").
    this._originalConfig = config ? { ...config } : {};
    this._config = {
      node_name: config?.node_name || "",
      device_prefix: config?.device_prefix || "",
      entry_id: config?.entry_id || "",
      max_messages: Number(config?.max_messages) || 200,
      history_hours: Number(config?.history_hours) || 24,
      default_pane: config?.default_pane === "nodes" ? "nodes" : "chats",
      compact: !!config?.compact,
      height: config?.height ?? "",
      channels: Array.isArray(config?.channels)
        ? config.channels.map((c) => ({ idx: c.idx, name: c.name || "" }))
        : [],
      contacts: Array.isArray(config?.contacts)
        ? config.contacts.map((c) => ({
            pubkey_prefix: c.pubkey_prefix || "",
            name: c.name || "",
          }))
        : [],
    };
    // Skip re-render when setConfig was triggered by our own emit (dispatchEvent
    // is synchronous, so _emitting is still true when Lovelace calls us back).
    if (!this._emitting) this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _emit() {
    // Strip empty arrays so the YAML stays clean. Start from the ORIGINAL
    // config so we preserve `type` and any other top-level keys (e.g.
    // `view_layout`, `visibility`, `card_mod` overrides) Lovelace expects
    // to round-trip — the editor only owns the fields it explicitly renders.
    const out = {
      ...(this._originalConfig || {}),
      ...this._config,
    };
    // Always force `type` to the canonical card identifier in case the
    // original was missing it (e.g. fresh card insertion).
    out.type =
      (this._originalConfig && this._originalConfig.type) ||
      "custom:meshcore-chat-card";
    out.node_name = String(out.node_name || "").trim();
    out.device_prefix = String(out.device_prefix || "")
      .trim()
      .toLowerCase();
    out.entry_id = String(out.entry_id || "").trim();
    if (!out.node_name) delete out.node_name;
    if (!out.device_prefix) delete out.device_prefix;
    if (!out.entry_id) delete out.entry_id;
    if (!out.compact) delete out.compact;
    if (out.default_pane === "chats") delete out.default_pane;
    if (out.max_messages === 200) delete out.max_messages;
    if (out.history_hours === 24) delete out.history_hours;
    out.height = String(out.height ?? "").trim();
    if (!out.height) delete out.height;

    out.channels = (this._config.channels || [])
      .map((c) => ({
        idx: parseInt(c.idx, 10),
        name: String(c.name || "").trim(),
      }))
      .filter((c) => Number.isInteger(c.idx) && c.idx >= 0 && c.name);
    if (!out.channels.length) delete out.channels;

    out.contacts = (this._config.contacts || [])
      .map((c) => ({
        pubkey_prefix: String(c.pubkey_prefix || "")
          .trim()
          .toLowerCase(),
        name: String(c.name || "").trim(),
      }))
      .filter((c) => c.pubkey_prefix.length >= 6 && c.name);
    if (!out.contacts.length) delete out.contacts;

    this._emitting = true;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: out },
        bubbles: true,
        composed: true,
      }),
    );
    this._emitting = false;
  }

  _capture() {
    const root = this.shadowRoot;
    const get = (n) => root.querySelector(`[name="${n}"]`);
    const tx = ["node_name", "device_prefix", "entry_id", "height"];
    for (const f of tx) {
      const el = get(f);
      if (el) this._config[f] = el.value;
    }
    const sel = get("default_pane");
    if (sel) this._config.default_pane = sel.value;
    const mm = get("max_messages");
    if (mm) this._config.max_messages = Number(mm.value) || 200;
    const hh = get("history_hours");
    if (hh) this._config.history_hours = Number(hh.value) || 24;
    const cb = get("compact");
    if (cb) this._config.compact = cb.checked;

    const chRows = root.querySelectorAll('[data-list="channels"] .item');
    this._config.channels = Array.from(chRows).map((r) => ({
      idx: r.querySelector('[name="idx"]')?.value,
      name: r.querySelector('[name="name"]')?.value,
    }));
    const ctRows = root.querySelectorAll('[data-list="contacts"] .item');
    this._config.contacts = Array.from(ctRows).map((r) => ({
      pubkey_prefix: r.querySelector('[name="pubkey_prefix"]')?.value,
      name: r.querySelector('[name="name"]')?.value,
    }));
  }

  _render() {
    const c = this._config || {};
    const channels = (c.channels || [])
      .map(
        (ch, i) => `
      <div class="item" data-row="${i}">
        <input type="number" name="idx" min="0" max="255" value="${ch.idx ?? ""}" placeholder="idx" />
        <input type="text" name="name" value="${esc(ch.name || "")}" placeholder="#channel-name" maxlength="32" />
        <button class="x" data-rm-ch="${i}" title="Remove">×</button>
      </div>`,
      )
      .join("");
    const contacts = (c.contacts || [])
      .map(
        (ct, i) => `
      <div class="item contact" data-row="${i}">
        <input type="text" name="pubkey_prefix" value="${esc(ct.pubkey_prefix || "")}" placeholder="pubkey prefix" maxlength="64" />
        <input type="text" name="name" value="${esc(ct.name || "")}" placeholder="display name" />
        <button class="x" data-rm-ct="${i}" title="Remove">×</button>
      </div>`,
      )
      .join("");

    this.shadowRoot.innerHTML = `
      <style>${EDITOR_STYLE}</style>
      <div class="ed">
        <h4>Identity</h4>
        <div class="row">
          <label>Device pubkey prefix
            <input type="text" name="device_prefix" value="${esc(c.device_prefix || "")}" placeholder="auto-detect" maxlength="12" />
          </label>
          <label>Entry ID
            <input type="text" name="entry_id" value="${esc(c.entry_id || "")}" placeholder="optional" />
          </label>
        </div>
        <div class="help">All three fields auto-detect when left blank. Entry ID is only needed if multiple MeshCore devices are configured.</div>

        <hr/>
        <h4>Display</h4>
        <div class="row">
          <label>Default tab
            <select name="default_pane">
              <option value="chats" ${c.default_pane !== "nodes" ? "selected" : ""}>Chats</option>
              <option value="nodes" ${c.default_pane === "nodes" ? "selected" : ""}>Nodes</option>
            </select>
          </label>
          <label>History (hours)
            <input type="number" name="history_hours" min="1" max="720" value="${c.history_hours || 24}" />
          </label>
          <label>Max messages / chat
            <input type="number" name="max_messages" min="20" max="2000" value="${c.max_messages || 200}" />
          </label>
        </div>
        <label>Card height
          <input type="text" name="height" value="${esc(c.height ?? "")}" placeholder="e.g. 800, 80vh, 100% (default 600px)" />
        </label>
        <div class="help">Number = pixels. Or any CSS length: <code>800px</code>, <code>80vh</code>, <code>100%</code>, <code>min(80vh, 1000px)</code>. Empty = 600&nbsp;px.</div>
        <label class="checkbox-row">
          <input type="checkbox" name="compact" ${c.compact ? "checked" : ""} />
          Compact row spacing
        </label>

        <hr/>
        <h4>Channels</h4>
        <div class="help">
          List channels you want to pin. The card discovers channels from binary
          sensors automatically — these entries override / pin display names.
          To create a new channel on the device, use the gear → Channels tab
          inside the card and click <b>Apply to device</b>.
        </div>
        <div class="list" data-list="channels">
          ${channels}
          <button type="button" class="add-row" data-action="add-ch">+ Add channel</button>
        </div>

        <hr/>
        <h4>Pinned contacts</h4>
        <div class="help">Pin DM contacts in the sidebar with a chosen display name.</div>
        <div class="list" data-list="contacts">
          ${contacts}
          <button type="button" class="add-row" data-action="add-ct">+ Add contact</button>
        </div>
      </div>
    `;

    const root = this.shadowRoot;
    root.querySelectorAll("input, select").forEach((el) => {
      const ev = el.type === "checkbox" ? "change" : "input";
      el.addEventListener(ev, () => {
        this._capture();
        this._emit();
      });
    });
    root.querySelectorAll("[data-rm-ch]").forEach((b) =>
      b.addEventListener("click", () => {
        this._capture();
        this._config.channels.splice(parseInt(b.dataset.rmCh, 10), 1);
        this._render();
        this._emit();
      }),
    );
    root.querySelectorAll("[data-rm-ct]").forEach((b) =>
      b.addEventListener("click", () => {
        this._capture();
        this._config.contacts.splice(parseInt(b.dataset.rmCt, 10), 1);
        this._render();
        this._emit();
      }),
    );
    root
      .querySelector('[data-action="add-ch"]')
      ?.addEventListener("click", () => {
        this._capture();
        const used = new Set(
          (this._config.channels || [])
            .map((c) => parseInt(c.idx, 10))
            .filter((n) => !isNaN(n)),
        );
        let next = 0;
        while (used.has(next)) next++;
        this._config.channels = [
          ...(this._config.channels || []),
          { idx: next, name: "" },
        ];
        this._render();
        this._emit();
      });
    root
      .querySelector('[data-action="add-ct"]')
      ?.addEventListener("click", () => {
        this._capture();
        this._config.contacts = [
          ...(this._config.contacts || []),
          { pubkey_prefix: "", name: "" },
        ];
        this._render();
        this._emit();
      });
  }
}

customElements.define("meshcore-chat-card-editor", MeshcoreChatCardEditor);

// Register with HACS/Lovelace
window.customCards = window.customCards || [];
window.customCards.push({
  type: "meshcore-chat-card",
  name: "MeshCore Chat",
  description: "Chat & node browser for MeshCore mesh radio networks",
  preview: false,
  version: CHAT_CARD_VERSION,
  documentationURL: "https://github.com/meshcore-dev/meshcore-ha-cards",
});

/**
 * MeshCore Repeater Card for Home Assistant
 *
 * Companion to meshcore-chat-card.js — shows live stats and time-series
 * sparklines for a single MeshCore repeater (battery, RSSI, SNR, airtime,
 * message counts, queue length, etc.). Auto-discovers repeaters from the
 * `sensor.meshcore_<pubkey10>_*` entities created by the meshcore-ha
 * integration.
 *
 * Installation:
 *   1. Copy this file to /config/www/meshcore-repeater-card.js
 *   2. Add to Lovelace resources:
 *        url: /local/meshcore-repeater-card.js
 *        type: module
 *
 * Card YAML config (everything optional except a repeater selector):
 *   type: custom:meshcore-repeater-card
 *   repeater: b8f68f1234        # 10-hex pubkey prefix used in entity IDs
 *                                 # OR friendly name. Omitted → first one found.
 *   title: ""                    # optional override (default: repeater name)
 *   hours: 24                    # history window for charts (default 24)
 *   charts:                      # optional list — defaults below
 *     - battery_percentage
 *     - last_rssi
 *     - last_snr
 *     - airtime
 *     - tx_queue_len
 *     - noise_floor
 *
 *   stats:                       # optional override of stat-tile order
 *     - battery_percentage
 *     - bat
 *     - uptime
 *     - last_rssi
 *     - last_snr
 *     - tx_queue_len
 *
 *   entry_id: ""               # MeshCore config-entry ID — needed only for the
 *                                 # CLI Console if auto-detection fails. Find it
 *                                 # in Settings → Devices & services → MeshCore →
 *                                 # click the integration → copy the ID from the
 *                                 # URL: /config/integrations/integration/meshcore#<ID>
 *
 * Visual editor: configurable through the Lovelace UI editor as
 * `meshcore-repeater-card`.
 */

const REPEATER_CARD_VERSION = "1.0.0";
console.info(
  `%c MESHCORE-REPEATER-CARD %c v${REPEATER_CARD_VERSION} `,
  "color:#fff;background:#1976d2;font-weight:700;padding:2px 4px;border-radius:3px 0 0 3px",
  "color:#1976d2;background:#e3f2fd;font-weight:700;padding:2px 4px;border-radius:0 3px 3px 0"
);

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STAT_META = {
  battery_percentage: { label: "Battery", unit: "%", icon: "🔋" },
  bat: { label: "Voltage", unit: "V", icon: "🔋" },
  uptime: { label: "Uptime", unit: "", icon: "⏱" },
  airtime: { label: "Airtime", unit: "min", icon: "📡" },
  last_rssi: { label: "RSSI", unit: "dBm", icon: "📶" },
  last_snr: { label: "SNR", unit: "dB", icon: "📶" },
  tx_queue_len: { label: "TX queue", unit: "", icon: "📥" },
  noise_floor: { label: "Noise floor", unit: "dBm", icon: "🌊" },
  nb_sent: { label: "Packets sent", unit: "", icon: "↑" },
  nb_recv: { label: "Packets recv", unit: "", icon: "↓" },
  sent_flood: { label: "Flood sent", unit: "", icon: "↑" },
  sent_direct: { label: "Direct sent", unit: "", icon: "↑" },
  recv_flood: { label: "Flood recv", unit: "", icon: "↓" },
  recv_direct: { label: "Direct recv", unit: "", icon: "↓" },
  full_evts: { label: "Full events", unit: "", icon: "⚠" },
  direct_dups: { label: "Direct dups", unit: "", icon: "♻" },
};

const DEFAULT_STAT_KEYS = [
  "battery_percentage",
  "bat",
  "uptime",
  "last_rssi",
  "last_snr",
  "tx_queue_len",
];

const DEFAULT_CHART_KEYS = [
  "battery_percentage",
  "last_rssi",
  "last_snr",
  "airtime",
];

const STYLE = `
  :host {
    --bg: var(--card-background-color, #161a1d);
    --bg2: rgba(255,255,255,0.04);
    --border: var(--divider-color, #2a3038);
    --text: var(--primary-text-color, #e2e8f0);
    --text2: var(--secondary-text-color, #94a3b8);
    --text3: rgba(148,163,184,0.6);
    --accent: var(--primary-color, #38bdf8);
    --online: #4ade80;
    --offline: #475569;
    --warn: #f97316;
    --danger: #ef4444;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    display: block;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .card {
    background: var(--bg);
    border-radius: 12px;
    border: 1px solid var(--border);
    overflow: hidden;
  }

  .header {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg2);
  }
  .icon {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: rgba(56,189,248,0.15);
    color: var(--accent);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 800;
    flex-shrink: 0;
    position: relative;
  }
  .icon .dot {
    position: absolute;
    bottom: 0; right: 0;
    width: 12px; height: 12px;
    border-radius: 50%;
    background: var(--offline);
    border: 2px solid var(--bg);
  }
  .icon .dot.online { background: var(--online); }
  .meta { flex: 1; min-width: 0; }
  .meta .name {
    color: var(--text); font-size: 15px; font-weight: 700;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .meta .sub {
    color: var(--text3); font-size: 11px; margin-top: 2px;
    font-family: ui-monospace, "JetBrains Mono", monospace;
  }
  .selector {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-size: 12px;
    font-family: inherit;
    padding: 5px 8px;
    cursor: pointer;
    outline: none;
  }
  .selector:focus { border-color: var(--accent); }

  /* Stats grid */
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 8px;
    padding: 12px;
  }
  .stat {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .stat .label {
    color: var(--text3);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    display: flex; align-items: center; gap: 4px;
  }
  .stat .value {
    color: var(--text);
    font-size: 18px;
    font-weight: 700;
    line-height: 1.1;
  }
  .stat .unit {
    color: var(--text3);
    font-size: 11px;
    font-weight: 500;
    margin-left: 2px;
  }
  .stat.unavail .value { color: var(--text3); }
  .stat.warn .value { color: var(--warn); }
  .stat.danger .value { color: var(--danger); }

  /* Charts */
  .charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 8px;
    padding: 0 12px 12px;
  }
  .chart {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .chart .head {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 6px;
  }
  .chart .head .label {
    color: var(--text2); font-size: 11px; font-weight: 700;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  .chart .head .last {
    color: var(--text); font-size: 13px; font-weight: 700;
  }
  .chart { position: relative; }
  .chart svg { width: 100%; height: 60px; display: block; cursor: crosshair; }
  .chart .axis {
    display: flex; justify-content: space-between;
    color: var(--text3); font-size: 10px; margin-top: 3px;
  }
  .chart.empty {
    color: var(--text3); font-size: 12px;
    display: flex; align-items: center; justify-content: center;
    min-height: 84px;
  }
  .chart-tip {
    position: absolute;
    background: var(--bg, #161a1d);
    border: 1px solid var(--border, #2a3038);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px; font-weight: 600;
    color: var(--text, #e2e8f0);
    pointer-events: none;
    white-space: nowrap;
    z-index: 20;
    display: none;
    box-shadow: 0 2px 8px rgba(0,0,0,.4);
  }
  .chart-tip .tip-time { color: var(--text3); font-weight: 400; margin-left: 5px; font-size: 10px; }

  /* Empty + error states */
  .placeholder {
    padding: 28px 16px;
    text-align: center;
    color: var(--text3);
    font-size: 13px;
    line-height: 1.5;
  }
  .placeholder code {
    background: var(--bg2); padding: 1px 4px; border-radius: 3px;
    color: var(--text);
  }

  /* Neighbor map */
  .nbr-wrap {
    margin: 0 12px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .nbr-title {
    font-size: 10px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase;
    color: var(--text3);
    padding: 5px 10px 4px;
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
  }
  .nbr-map-container { height: 280px; position: relative; }
  .nbr-map-container ha-map { display: block; height: 100%; }
  .nbr-empty {
    padding: 14px; font-size: 12px; color: var(--text3);
    text-align: center; line-height: 1.6; background: var(--bg2);
  }

  /* CLI console */
  .console-wrap {
    margin: 0 12px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .console-title {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 10px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase;
    color: var(--text3);
    padding: 5px 10px 4px;
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    user-select: none;
  }
  .console-title .toggle { font-size: 12px; color: var(--text2); }
  .console-body { display: none; }
  .console-body.open { display: flex; flex-direction: column; }
  .console-log {
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.5;
    padding: 8px 10px;
    background: var(--bg);
    max-height: 200px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .console-log .cl-sent { color: var(--text2); }
  .console-log .cl-recv { color: var(--online, #4ade80); }
  .console-log .cl-err  { color: var(--danger, #ef4444); }
  .console-log .cl-info { color: var(--text3); }
  .console-input {
    display: flex;
    border-top: 1px solid var(--border);
    padding: 6px 8px;
    gap: 6px;
    background: var(--bg2);
    align-items: center;
  }
  .console-input input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 12px;
    padding: 4px 8px;
    outline: none;
  }
  .console-input input:focus { border-color: var(--accent); }
  .console-input button {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 4px 12px;
    font-size: 12px;
    cursor: pointer;
    font-weight: 600;
    white-space: nowrap;
  }
  .console-input button:disabled { opacity: 0.5; cursor: default; }

`;

function fmtUptime(days) {
  if (days == null || isNaN(days)) return "—";
  const totalMin = Math.max(0, Math.round(days * 24 * 60));
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const rm = totalMin % 60;
  if (h < 24) return `${h}h ${rm}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d ${rh}h`;
}

function pickFmt(key, val) {
  if (val == null || val === "" || val === "unavailable" || val === "unknown") {
    return { value: "—", unit: "", cls: "unavail" };
  }
  const meta = STAT_META[key] || { label: key, unit: "" };
  let v = val;
  let cls = "";

  if (key === "uptime") return { value: fmtUptime(parseFloat(v)), unit: "", cls };
  if (key === "battery_percentage") {
    const n = parseFloat(v);
    cls = n <= 15 ? "danger" : n <= 30 ? "warn" : "";
    return { value: n.toFixed(0), unit: meta.unit, cls };
  }
  if (key === "bat") {
    return { value: parseFloat(v).toFixed(2), unit: meta.unit, cls };
  }
  if (key === "last_rssi") {
    const n = parseFloat(v);
    cls = n < -110 ? "danger" : n < -100 ? "warn" : "";
    return { value: n.toFixed(0), unit: meta.unit, cls };
  }
  if (key === "last_snr") {
    const n = parseFloat(v);
    cls = n < -5 ? "danger" : n < 0 ? "warn" : "";
    return { value: n.toFixed(1), unit: meta.unit, cls };
  }
  if (key === "noise_floor") {
    return { value: parseFloat(v).toFixed(0), unit: meta.unit, cls };
  }
  if (key === "airtime") {
    return { value: parseFloat(v).toFixed(1), unit: meta.unit, cls };
  }
  // Counters / queue / generic
  const n = Number(v);
  if (!isNaN(n)) v = n.toLocaleString();
  return { value: String(v), unit: meta.unit, cls };
}

class MeshcoreRepeaterCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = {};
    this._repeaters = [];          // [{pubkey10, name, online, sensorEntries:{key:entity_id}, online_entity}]
    this._selectedPubkey = null;
    this._history = {};            // { entity_id: [{ts, v}] }
    this._historyLoadedFor = null; // pubkey10 we loaded for
    this._historyInProgress = false;
    this._refreshTimer = null;
    this._consoleLog = [];
    this._consoleOpen = false;
    this._consoleUnsub = null;
  }

  setConfig(config) {
    this._config = {
      repeater: config?.repeater || null,
      title: config?.title || "",
      hours: Math.max(1, Math.min(720, Number(config?.hours) || 24)),
      charts: Array.isArray(config?.charts) && config.charts.length
        ? config.charts.slice() : DEFAULT_CHART_KEYS.slice(),
      stats: Array.isArray(config?.stats) && config.stats.length
        ? config.stats.slice() : DEFAULT_STAT_KEYS.slice(),
      entry_id: config?.entry_id || null,
    };
    if (this._config.repeater) this._selectedPubkey = String(this._config.repeater).toLowerCase();
    this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this._discover();
    if (first) {
      this._render();
      // Refresh history every 5 minutes; live values come from hass.states.
      this._refreshTimer = setInterval(() => this._loadHistory(true), 5 * 60 * 1000);
      // Defer history fetch slightly to let the rest of the dashboard load.
      setTimeout(() => this._loadHistory(false), 200);
      this._subscribeConsole();
    } else {
      this._renderStats();
      this._renderHeader();
      this._renderNeighborMap();
    }
  }

  disconnectedCallback() {
    if (this._refreshTimer) { clearInterval(this._refreshTimer); this._refreshTimer = null; }
    if (this._consoleUnsub) { this._consoleUnsub(); this._consoleUnsub = null; }
  }

  // ── Discovery ─────────────────────────────────────────────────────
  // Repeater entities are created as `sensor.meshcore_<pubkey10>_<key>_<safename>`,
  // attached to a per-repeater device with model "Mesh Repeater". We scan
  // hass.states for the prefix and group by the 10-hex pubkey segment.
  _discover() {
    if (!this._hass?.states) return;
    const states = this._hass.states;
    const groups = new Map(); // pubkey10 → { sensorEntries:{key:eid}, name }

    const re = /^sensor\.meshcore_([a-f0-9]{10})_([a-z0-9_]+?)(?:_([a-z0-9_]+))?$/i;
    for (const id of Object.keys(states)) {
      const m = id.match(re);
      if (!m) continue;
      const pubkey10 = m[1].toLowerCase();
      // Only count entities that look like repeater stats — must be one of
      // the known stat keys to avoid catching e.g. main-device sensors that
      // happen to share the prefix pattern.
      const statKey = this._matchStatKey(m[2] + (m[3] ? `_${m[3]}` : ""));
      if (!statKey) continue;
      let entry = groups.get(pubkey10);
      if (!entry) {
        entry = { pubkey10, sensorEntries: {}, name: "", online: null, online_entity: null };
        groups.set(pubkey10, entry);
      }
      // Prefer the canonical entity_id (longest match) per stat key.
      if (!entry.sensorEntries[statKey] || id.length > entry.sensorEntries[statKey].length) {
        entry.sensorEntries[statKey] = id;
      }
      // Pull the repeater name from the friendly_name's device prefix
      // ("MeshCore Repeater: NAME (xxxxxx) <Stat>") or from the device
      // registry attribute, falling back to a humanised stat suffix.
      const fn = states[id]?.attributes?.friendly_name || "";
      const nameMatch = fn.match(/MeshCore Repeater:\s*(.+?)\s*\([a-f0-9]{1,12}\)/i);
      if (nameMatch) entry.name = nameMatch[1].trim();
    }

    // Pull online status from the binary sensor (device-online) per repeater.
    const onRe = /^binary_sensor\.meshcore_([a-f0-9]{10})_online_/i;
    for (const id of Object.keys(states)) {
      const m = id.match(onRe);
      if (!m) continue;
      const entry = groups.get(m[1].toLowerCase());
      if (!entry) continue;
      entry.online_entity = id;
      entry.online = states[id].state === "on";
    }

    // Build sorted list (online first, then by name).
    const list = Array.from(groups.values())
      .filter(g => Object.keys(g.sensorEntries).length > 0)
      .map(g => ({
        ...g,
        name: g.name || `Repeater ${g.pubkey10.slice(0, 6)}`,
      }))
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    this._repeaters = list;

    // Pick a default selection if needed.
    if (this._selectedPubkey) {
      // Allow selecting by pubkey prefix OR by friendly name match.
      const want = this._selectedPubkey;
      const found = list.find(r =>
        r.pubkey10.startsWith(want) ||
        want.startsWith(r.pubkey10) ||
        r.name.toLowerCase() === want.toLowerCase()
      );
      if (found) this._selectedPubkey = found.pubkey10;
      else if (!list.find(r => r.pubkey10 === this._selectedPubkey)) {
        this._selectedPubkey = list[0]?.pubkey10 || null;
      }
    } else if (list.length) {
      this._selectedPubkey = list[0].pubkey10;
    }
  }

  // Map an entity-id stat slug to a known REPEATER_SENSORS key. The slug is
  // `<stat_key>_<safe_name>`, so we strip the suffix by trying every known
  // stat key as a prefix.
  _matchStatKey(slug) {
    const keys = Object.keys(STAT_META);
    let best = null;
    for (const k of keys) {
      if (slug === k || slug.startsWith(k + "_")) {
        if (!best || k.length > best.length) best = k;
      }
    }
    return best;
  }

  _selected() {
    if (!this._selectedPubkey) return null;
    return this._repeaters.find(r => r.pubkey10 === this._selectedPubkey) || null;
  }

  // ── History ───────────────────────────────────────────────────────
  async _loadHistory(refresh) {
    const r = this._selected();
    if (!r || !this._hass) return;
    if (this._historyInProgress) return;
    if (!refresh && this._historyLoadedFor === r.pubkey10) return;
    this._historyInProgress = true;

    const entityIds = this._config.charts
      .map(k => r.sensorEntries[k])
      .filter(Boolean);
    if (!entityIds.length) {
      this._historyInProgress = false;
      this._renderCharts();
      return;
    }

    const start = new Date(Date.now() - this._config.hours * 3600 * 1000).toISOString();
    try {
      // history/history_during_period: returns
      //   { "<entity_id>": [{s: state, lu: epoch_seconds}, ...] }
      // with minimal_response/no_attributes set.
      const resp = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: start,
        entity_ids: entityIds,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      const next = {};
      for (const eid of entityIds) {
        const series = resp?.[eid];
        if (!Array.isArray(series)) { next[eid] = []; continue; }
        const points = [];
        for (const p of series) {
          const v = p.s ?? p.state;
          const ts = (p.lu ?? p.last_updated_ts) * 1000 || Date.parse(p.last_updated || "");
          if (!isFinite(ts)) continue;
          if (v == null || v === "" || v === "unavailable" || v === "unknown") continue;
          const num = parseFloat(v);
          if (!isFinite(num)) continue;
          points.push({ ts, v: num });
        }
        next[eid] = points;
      }
      this._history = next;
      this._historyLoadedFor = r.pubkey10;
    } catch (err) {
      console.warn("meshcore-repeater-card: history fetch failed", err);
    } finally {
      this._historyInProgress = false;
      this._renderCharts();
    }
  }

  // ── Render ────────────────────────────────────────────────────────
  _render() {
    const root = this.shadowRoot;
    root.innerHTML = `<style>${STYLE}</style>
      <div class="card">
        <div class="header" id="hdr"></div>
        <div class="stats" id="stats"></div>
        <div id="neighbors"></div>
        <div id="console"></div>
        <div class="charts" id="charts"></div>
      </div>`;
    this._renderHeader();
    this._renderStats();
    this._renderNeighborMap();
    this._renderConsole();
    this._renderCharts();
  }

  _renderHeader() {
    const el = this.shadowRoot.getElementById("hdr");
    if (!el) return;
    if (!this._repeaters.length) {
      el.outerHTML = `<div class="placeholder">No MeshCore repeaters found.<br>
        Configure at least one repeater in the integration's
        <code>Configure → Tracked repeaters</code> dialog.</div>`;
      // Hide stats/charts containers
      const stats = this.shadowRoot.getElementById("stats"); if (stats) stats.remove();
      const charts = this.shadowRoot.getElementById("charts"); if (charts) charts.remove();
      return;
    }
    const r = this._selected();
    if (!r) return;
    const initial = (r.name[0] || "?").toUpperCase();
    const onlineDot = `<div class="dot ${r.online ? "online" : ""}"></div>`;
    const title = this._config.title || r.name;
    const selector = this._repeaters.length > 1
      ? `<select class="selector" id="rep-select" title="Switch repeater">
           ${this._repeaters.map(rr =>
             `<option value="${rr.pubkey10}" ${rr.pubkey10 === r.pubkey10 ? "selected" : ""}>${esc(rr.name)} (${rr.pubkey10.slice(0,6)})</option>`
           ).join("")}
         </select>`
      : "";
    el.innerHTML = `
      <div class="icon">${esc(initial)}${onlineDot}</div>
      <div class="meta">
        <div class="name">${esc(title)}</div>
        <div class="sub">${r.pubkey10} · ${r.online ? "online" : "offline"}</div>
      </div>
      ${selector}`;

    const sel = el.querySelector("#rep-select");
    if (sel) sel.addEventListener("change", () => {
      this._selectedPubkey = sel.value;
      this._historyLoadedFor = null;
      this._consoleLog = [];
      this._renderHeader();
      this._renderStats();
      this._renderNeighborMap();
      this._renderConsole();
      this._renderCharts();
      this._loadHistory(false);
    });
  }

  _renderStats() {
    const el = this.shadowRoot.getElementById("stats");
    if (!el) return;
    const r = this._selected();
    if (!r) { el.innerHTML = ""; return; }

    const html = this._config.stats.map(key => {
      const eid = r.sensorEntries[key];
      const meta = STAT_META[key] || { label: key, unit: "" };
      if (!eid) {
        return `
          <div class="stat unavail">
            <div class="label">${meta.icon ? `<span>${meta.icon}</span>` : ""}${esc(meta.label)}</div>
            <div class="value">—</div>
          </div>`;
      }
      const st = this._hass?.states?.[eid];
      const fmt = pickFmt(key, st?.state);
      return `
        <div class="stat ${fmt.cls}" title="${esc(eid)}">
          <div class="label">${meta.icon ? `<span>${meta.icon}</span>` : ""}${esc(meta.label)}</div>
          <div class="value">${esc(fmt.value)}${fmt.unit ? `<span class="unit">${esc(fmt.unit)}</span>` : ""}</div>
        </div>`;
    }).join("");
    el.innerHTML = html;
  }

  _getNeighbors() {
    if (!this._hass?.states || !this._selectedPubkey) return [];
    const repPrefix = this._selectedPubkey.toLowerCase(); // 10 chars
    const neighbors = [];
    for (const [id, st] of Object.entries(this._hass.states)) {
      if (!id.startsWith(`sensor.meshcore_${repPrefix}_neighbor_`)) continue;
      if (id.endsWith("_seen")) continue;
      const snr = parseFloat(st.state);
      if (isNaN(snr)) continue;
      const neighborPk = st.attributes?.pubkey_prefix || "";
      const seenSt = this._hass.states[`${id}_seen`];
      const seen48h = seenSt ? parseInt(seenSt.state, 10) : null;
      // Look up neighbor GPS from their contact binary_sensor.
      let lat = null, lon = null;
      if (neighborPk) {
        const prefix6 = neighborPk.slice(0, 6).toLowerCase();
        for (const [cid, cst] of Object.entries(this._hass.states)) {
          if (!cid.endsWith("_contact")) continue;
          const pk = (cst.attributes?.public_key || "").toLowerCase();
          if (pk.startsWith(prefix6)) {
            lat = cst.attributes?.latitude || cst.attributes?.adv_lat || null;
            lon = cst.attributes?.longitude || cst.attributes?.adv_lon || null;
            if (lat && lon) break;
          }
        }
      }
      neighbors.push({
        pubkey: neighborPk,
        name: st.attributes?.resolved_name || neighborPk.slice(0, 6) || "?",
        snr,
        lastSeen: st.attributes?.last_seen || "",
        seen48h: isNaN(seen48h) ? null : seen48h,
        lat: (lat && lat !== 0) ? lat : null,
        lon: (lon && lon !== 0) ? lon : null,
      });
    }
    return neighbors;
  }

  _snrColor(snr) {
    if (snr >= 0)   return "#4ade80";
    if (snr >= -5)  return "#a3e635";
    if (snr >= -12) return "#facc15";
    if (snr >= -20) return "#fb923c";
    return "#f87171";
  }

  // Resolve the binary_sensor.*_contact entity ID for a given pubkey 6-char prefix.
  _contactEntityFor(prefix6) {
    for (const [id, st] of Object.entries(this._hass.states)) {
      if (!id.endsWith("_contact")) continue;
      const pk = (st.attributes?.public_key || "").toLowerCase();
      if (pk.startsWith(prefix6)) return id;
    }
    return null;
  }

  async _renderNeighborMap() {
    const el = this.shadowRoot.getElementById("neighbors");
    if (!el) return;
    if (!this._selectedPubkey || !this._hass?.states) { el.innerHTML = ""; return; }

    const neighbors = this._getNeighbors();
    if (!neighbors.length) {
      el.innerHTML = `<div class="nbr-wrap"><div class="nbr-empty">No neighbor data.<br>Enable repeater neighbor tracking in integration settings.</div></div>`;
      return;
    }

    // Find repeater's own contact entity and GPS.
    const rep6 = this._selectedPubkey.slice(0, 6).toLowerCase();
    const selfEntityId = this._contactEntityFor(rep6);
    const selfSt = selfEntityId ? this._hass.states[selfEntityId] : null;
    const selfLat = selfSt?.attributes?.latitude || selfSt?.attributes?.adv_lat || null;
    const selfLon = selfSt?.attributes?.longitude || selfSt?.attributes?.adv_lon || null;

    // Build entity list and paths for ha-map.
    const entities = [];
    const paths = [];
    if (selfEntityId) entities.push({ entity_id: selfEntityId, color: "#38bdf8" });

    for (const n of neighbors) {
      const color = this._snrColor(n.snr);
      const nEntityId = n.pubkey ? this._contactEntityFor(n.pubkey.slice(0, 6).toLowerCase()) : null;
      if (nEntityId) entities.push({ entity_id: nEntityId, color });
      if (selfLat && selfLon && n.lat && n.lon) {
        paths.push({
          points: [{ latitude: selfLat, longitude: selfLon }, { latitude: n.lat, longitude: n.lon }],
          color,
          radius: 2,
          line: true,
        });
      }
    }

    const withGps = neighbors.filter((n) => n.lat && n.lon).length;
    const title = `Neighbors (${neighbors.length}${withGps < neighbors.length ? `, ${withGps} on map` : ""})`;
    const newKey = `${this._selectedPubkey}|${neighbors.map((n) => `${n.pubkey}:${n.snr}`).join(",")}`;

    // If ha-map already exists and data key is unchanged, just refresh hass.
    const existing = el.querySelector("ha-map");
    if (existing && el.dataset.mapKey === newKey) {
      existing.hass = this._hass;
      return;
    }
    el.dataset.mapKey = newKey;

    // ha-map is lazy-loaded by HA. Trigger loading via loadCardHelpers → map card,
    // which pulls in the same module that registers ha-map as a side-effect.
    if (!customElements.get("ha-map")) {
      try {
        if (typeof window.loadCardHelpers === "function") {
          const helpers = await window.loadCardHelpers();
          // createCardElement("map") triggers the dynamic import of hui-map-card,
          // which statically imports ha-map and registers the custom element.
          await helpers.createCardElement({ type: "map", entities: [] });
        }
        await Promise.race([
          customElements.whenDefined("ha-map"),
          new Promise((_, rej) => setTimeout(() => rej(), 10000)),
        ]);
      } catch {
        el.innerHTML = `<div class="nbr-wrap"><div class="nbr-empty">Could not load ha-map.</div></div>`;
        return;
      }
    }

    // Build the DOM: title bar + ha-map inside a fixed-height container.
    const wrap = document.createElement("div");
    wrap.className = "nbr-wrap";
    wrap.innerHTML = `<div class="nbr-title">${esc(title)}</div>`;

    const container = document.createElement("div");
    container.className = "nbr-map-container";
    wrap.appendChild(container);

    const haMap = document.createElement("ha-map");
    haMap.hass = this._hass;
    haMap.entities = entities;
    haMap.paths = paths;
    if (selfLat && selfLon) {
      haMap.centerLatLng = [selfLat, selfLon];
      haMap.zoom = 9;
    }
    container.appendChild(haMap);

    el.innerHTML = "";
    el.appendChild(wrap);
  }

  _renderCharts() {
    const el = this.shadowRoot.getElementById("charts");
    if (!el) return;
    const r = this._selected();
    if (!r) { el.innerHTML = ""; return; }

    const cards = this._config.charts.map((key, idx) => {
      const eid = r.sensorEntries[key];
      const meta = STAT_META[key] || { label: key, unit: "" };
      const live = eid ? this._hass?.states?.[eid]?.state : null;
      const fmt = pickFmt(key, live);
      const points = (eid && this._history[eid]) || [];
      const svg = points.length >= 2 ? this._sparkline(points, key) : "";
      const empty = points.length < 2;
      return `
        <div class="chart ${empty ? "empty" : ""}" data-chart-idx="${idx}">
          ${empty ? `<div>No history yet for ${esc(meta.label.toLowerCase())}.</div>` : `
            <div class="head">
              <span class="label">${meta.icon ? `${meta.icon} ` : ""}${esc(meta.label)}</span>
              <span class="last" data-live>${esc(fmt.value)}${fmt.unit ? ` <small style="color:var(--text3)">${esc(fmt.unit)}</small>` : ""}</span>
            </div>
            ${svg}
            <div class="chart-tip"></div>
            <div class="axis">
              <span>−${this._config.hours}h</span>
              <span>now</span>
            </div>`}
        </div>`;
    }).join("");
    el.innerHTML = cards;
    this._wireChartHover(el, r);
  }

  _wireChartHover(el, r) {
    el.querySelectorAll(".chart:not(.empty)").forEach((chartEl) => {
      const idx = parseInt(chartEl.dataset.chartIdx, 10);
      const key = this._config.charts[idx];
      if (!key) return;
      const eid = r.sensorEntries[key];
      const allPts = (eid && this._history[eid]) || [];
      const meta = STAT_META[key] || { label: key, unit: "" };
      const now = Date.now();
      const xMin = now - this._config.hours * 3600 * 1000;
      const pts = allPts.filter(p => p.ts >= xMin);
      if (pts.length < 2) return;

      const svgEl = chartEl.querySelector("svg");
      const tip = chartEl.querySelector(".chart-tip");
      const liveEl = chartEl.querySelector("[data-live]");
      const cursorLine = svgEl?.querySelector(".hc");
      const dot = svgEl?.querySelector(".hd");
      if (!svgEl || !tip || !cursorLine || !dot) return;

      const W = 240, H = 60, PAD = 4;
      const xMax = now;
      const ys = pts.map(p => p.v);
      let yMin = Math.min(...ys), yMax = Math.max(...ys);
      if (yMin === yMax) { yMin -= 1; yMax += 1; }
      if (key === "battery_percentage") { yMin = Math.min(0, yMin); yMax = Math.max(100, yMax); }
      const yScale = v => H - PAD - ((v - yMin) / (yMax - yMin)) * (H - 2 * PAD);

      // Store the live label text so we can restore it on mouseleave.
      const liveText = liveEl ? liveEl.innerHTML : "";

      svgEl.addEventListener("mousemove", (e) => {
        const rect = svgEl.getBoundingClientRect();
        const xFrac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const ts = xMin + xFrac * (xMax - xMin);

        // Nearest point by timestamp.
        let nearest = pts[0];
        let best = Math.abs(pts[0].ts - ts);
        for (const p of pts) {
          const d = Math.abs(p.ts - ts);
          if (d < best) { best = d; nearest = p; }
        }

        // Update SVG cursor + dot.
        const svgX = (PAD + xFrac * (W - 2 * PAD)).toFixed(1);
        const svgY = yScale(nearest.v).toFixed(1);
        cursorLine.setAttribute("x1", svgX); cursorLine.setAttribute("x2", svgX);
        dot.setAttribute("cx", svgX); dot.setAttribute("cy", svgY);
        cursorLine.style.display = ""; dot.style.display = "";

        // Tooltip content.
        const fmt = pickFmt(key, nearest.v);
        const d = new Date(nearest.ts);
        const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric" });
        tip.innerHTML = `${esc(fmt.value)}${fmt.unit ? `<span style="color:var(--text3);margin-left:2px;font-size:10px">${esc(fmt.unit)}</span>` : ""}<span class="tip-time">${esc(dateStr)} ${esc(timeStr)}</span>`;
        tip.style.display = "block";

        // Position tooltip: keep it inside the chart horizontally.
        const chartRect = chartEl.getBoundingClientRect();
        const svgTop = rect.top - chartRect.top;
        const rawLeft = e.clientX - chartRect.left;
        const tipW = tip.offsetWidth || 140;
        tip.style.top = `${Math.max(0, svgTop - 28)}px`;
        tip.style.left = `${Math.max(0, Math.min(rawLeft - tipW / 2, chartRect.width - tipW))}px`;

        // Show hovered value in the header instead of live value.
        if (liveEl) liveEl.innerHTML = tip.innerHTML;
      });

      svgEl.addEventListener("mouseleave", () => {
        cursorLine.style.display = "none";
        dot.style.display = "none";
        tip.style.display = "none";
        if (liveEl) liveEl.innerHTML = liveText;
      });
    });
  }

  // Build a sparkline polyline + smooth fill underneath for a series of
  // {ts, v} points spanning the configured `hours` window.
  _sparkline(points, key) {
    const W = 240, H = 60, PAD = 4;
    const now = Date.now();
    const start = now - this._config.hours * 3600 * 1000;
    // Clamp to the visible window.
    const pts = points.filter(p => p.ts >= start);
    if (pts.length < 2) return "";

    const xs = pts.map(p => p.ts);
    const ys = pts.map(p => p.v);
    const xMin = start, xMax = now;
    let yMin = Math.min(...ys), yMax = Math.max(...ys);
    // For series with no variance, pad ±1 so the line doesn't collapse.
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    // For percentages, lock to 0..100 for clearer interpretation.
    if (key === "battery_percentage") { yMin = Math.min(0, yMin); yMax = Math.max(100, yMax); }

    const xScale = (t) => PAD + ((t - xMin) / (xMax - xMin || 1)) * (W - 2 * PAD);
    const yScale = (v) => H - PAD - ((v - yMin) / (yMax - yMin || 1)) * (H - 2 * PAD);

    const linePath = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.ts).toFixed(1)},${yScale(p.v).toFixed(1)}`)
      .join(" ");
    const areaPath = `${linePath} L${xScale(pts[pts.length - 1].ts).toFixed(1)},${H - PAD} L${xScale(pts[0].ts).toFixed(1)},${H - PAD} Z`;

    const colour = "var(--accent)";
    return `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${colour}" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="${colour}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#g)" stroke="none"/>
        <path d="${linePath}" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <line class="hc" x1="0" y1="${PAD}" x2="0" y2="${H - PAD}" stroke="var(--text3,#64748b)" stroke-width="1" stroke-dasharray="3 2" style="display:none" pointer-events="none"/>
        <circle class="hd" cx="0" cy="0" r="3" fill="${colour}" stroke="var(--bg,#161a1d)" stroke-width="1.5" style="display:none" pointer-events="none"/>
      </svg>`;
  }

  // ── CLI Console ───────────────────────────────────────────────────

  async _resolveEntryId() {
    if (this._config.entry_id) return this._config.entry_id;
    const r = this._selected();
    if (!r) return null;
    const eid = r.online_entity || Object.values(r.sensorEntries)[0];
    if (!eid) return null;
    // hass.entities is available in HA 2022.6+ and has config_entry_id directly.
    const fromReg = this._hass?.entities?.[eid]?.config_entry_id;
    if (fromReg) return fromReg;
    // Fallback: query entity registry via WebSocket.
    try {
      const entry = await this._hass.callWS({
        type: "config/entity_registry/get",
        entity_id: eid,
      });
      return entry?.config_entry_id || null;
    } catch {
      return null;
    }
  }

  async _subscribeConsole() {
    if (this._consoleUnsub || !this._hass?.connection) return;
    try {
      this._consoleUnsub = await this._hass.connection.subscribeEvents(
        (event) => this._onConsoleEvent(event),
        "meshcore_message"
      );
    } catch (err) {
      console.warn("meshcore-repeater-card: console event subscription failed", err);
    }
  }

  _onConsoleEvent(event) {
    const d = event.data;
    if (d?.message_type !== "direct") return;
    const r = this._selected();
    if (!r) return;
    const senderName = (d.sender_name || "").toLowerCase();
    const rName = r.name.toLowerCase();
    if (senderName !== rName) return;
    this._consoleLog.push({ cls: "cl-recv", text: `← ${d.message || ""}` });
    this._appendConsoleLog();
  }

  async _execConsoleCmd(cmd) {
    if (!cmd.trim()) return;
    const r = this._selected();
    const entryId = await this._resolveEntryId();
    if (!r) {
      this._consoleLog.push({ cls: "cl-err", text: "No repeater selected." });
      this._appendConsoleLog();
      return;
    }
    if (!entryId) {
      this._consoleLog.push({ cls: "cl-err", text: "entry_id unknown — add entry_id: <id> to card config." });
      this._appendConsoleLog();
      return;
    }
    this._consoleLog.push({ cls: "cl-sent", text: `→ ${cmd}` });
    this._appendConsoleLog();
    try {
      await this._hass.callService("meshcore", "execute_command", {
        entry_id: entryId,
        command: `send_login "${r.name}"`,
      });
      await this._hass.callService("meshcore", "execute_command", {
        entry_id: entryId,
        command: `send_cmd "${r.name}" "${cmd}"`,
      });
    } catch (err) {
      this._consoleLog.push({ cls: "cl-err", text: `Error: ${err?.message || String(err)}` });
      this._appendConsoleLog();
    }
  }

  _renderConsole() {
    const el = this.shadowRoot.getElementById("console");
    if (!el) return;
    const logHtml = this._consoleLog.map(e =>
      `<div class="${esc(e.cls)}">${esc(e.text)}</div>`
    ).join("");
    el.innerHTML = `
      <div class="console-wrap">
        <div class="console-title" id="console-toggle">
          CLI Console
          <span class="toggle">${this._consoleOpen ? "▲" : "▼"}</span>
        </div>
        <div class="console-body${this._consoleOpen ? " open" : ""}">
          <div class="console-log" id="console-log">${logHtml}</div>
          <div class="console-input">
            <input type="text" id="console-input" placeholder="ver / reboot / clkreboot ..." autocomplete="off" spellcheck="false"/>
            <button id="console-send">Send</button>
          </div>
        </div>
      </div>`;
    el.querySelector("#console-toggle").addEventListener("click", () => {
      this._consoleOpen = !this._consoleOpen;
      this._renderConsole();
    });
    const input = el.querySelector("#console-input");
    const send = el.querySelector("#console-send");
    const logEl = el.querySelector("#console-log");
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const cmd = input.value.trim();
        if (cmd) { input.value = ""; this._execConsoleCmd(cmd); }
      }
    });
    send.addEventListener("click", () => {
      const cmd = input.value.trim();
      if (cmd) { input.value = ""; this._execConsoleCmd(cmd); }
    });
  }

  _appendConsoleLog() {
    const logEl = this.shadowRoot.getElementById("console-log");
    if (logEl) {
      const last = this._consoleLog[this._consoleLog.length - 1];
      const div = document.createElement("div");
      div.className = last.cls;
      div.textContent = last.text;
      logEl.appendChild(div);
      logEl.scrollTop = logEl.scrollHeight;
    } else {
      this._renderConsole();
    }
  }

  getCardSize() { return 5; }
  static getConfigElement() { return document.createElement("meshcore-repeater-card-editor"); }
  static getStubConfig() { return {}; }
}

customElements.define("meshcore-repeater-card", MeshcoreRepeaterCard);


/* ───────────────────────── Visual editor ───────────────────────── */

const EDITOR_STYLE = `
  :host { display: block; font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; }
  .ed { display: flex; flex-direction: column; gap: 12px; padding: 4px 2px 8px; }
  .ed h4 {
    margin: 4px 0 -2px; font-size: 13px; font-weight: 700;
    color: var(--primary-text-color, #1f2937);
  }
  .ed label {
    display: flex; flex-direction: column; gap: 4px;
    font-size: 12px; font-weight: 600;
    color: var(--secondary-text-color, #64748b);
  }
  .ed .row { display: flex; gap: 10px; flex-wrap: wrap; }
  .ed .row > label { flex: 1 1 160px; }
  .ed input, .ed select {
    background: var(--card-background-color, #fff);
    border: 1px solid var(--divider-color, #e5e7eb);
    border-radius: 6px;
    padding: 7px 10px;
    color: var(--primary-text-color, #1f2937);
    font-size: 13px;
    outline: none; font-family: inherit;
  }
  .ed input:focus, .ed select:focus { border-color: var(--primary-color, #03a9f4); }
  .ed .help { font-size: 11px; color: var(--secondary-text-color, #64748b); margin-top: -4px; }
  .ed .checks {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 6px;
  }
  .ed .checks label {
    flex-direction: row; align-items: center; gap: 6px; font-weight: 500;
  }
  .ed .checks input { width: 16px; height: 16px; accent-color: var(--primary-color, #03a9f4); }
`;

class MeshcoreRepeaterCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._discovered = [];
  }

  set hass(hass) { this._hass = hass; this._discover(); this._render(); }

  setConfig(config) {
    // Preserve `type` and any other top-level keys we don't manage so the
    // emitted config-changed event always carries them — Lovelace rejects
    // configs without `type` ("Nie wprowadzono typu." / "No type provided").
    this._originalConfig = config ? { ...config } : {};
    this._config = {
      repeater: config?.repeater || "",
      title: config?.title || "",
      hours: Number(config?.hours) || 24,
      charts: Array.isArray(config?.charts) ? config.charts.slice() : DEFAULT_CHART_KEYS.slice(),
      stats: Array.isArray(config?.stats) ? config.stats.slice() : DEFAULT_STAT_KEYS.slice(),
      entry_id: config?.entry_id || "",
    };
    if (!this._emitting) this._render();
  }

  _discover() {
    if (!this._hass?.states) return;
    const re = /^sensor\.meshcore_([a-f0-9]{10})_/i;
    const seen = new Map();
    for (const id of Object.keys(this._hass.states)) {
      const m = id.match(re);
      if (!m) continue;
      const pk = m[1].toLowerCase();
      const fn = this._hass.states[id]?.attributes?.friendly_name || "";
      const nm = fn.match(/MeshCore Repeater:\s*(.+?)\s*\(/i);
      if (!seen.has(pk)) seen.set(pk, nm ? nm[1].trim() : `Repeater ${pk.slice(0,6)}`);
    }
    this._discovered = Array.from(seen.entries()).map(([pubkey10, name]) => ({ pubkey10, name }));
    this._discovered.sort((a, b) => a.name.localeCompare(b.name));
  }

  _emit() {
    // Start from the ORIGINAL config so we preserve `type` and any other
    // top-level keys (view_layout, visibility, card_mod overrides …) the
    // Lovelace round-trip expects. Then layer our managed fields on top.
    const out = { ...(this._originalConfig || {}) };
    out.type = (this._originalConfig && this._originalConfig.type) || "custom:meshcore-repeater-card";

    // Reset the keys we manage (so removing a value clears the YAML field).
    delete out.repeater; delete out.title; delete out.hours;
    delete out.stats; delete out.charts; delete out.entry_id;

    if (this._config.repeater) out.repeater = String(this._config.repeater).toLowerCase();
    if (this._config.title) out.title = this._config.title;
    if (this._config.hours && this._config.hours !== 24) out.hours = Number(this._config.hours);
    if (this._config.entry_id) out.entry_id = this._config.entry_id;
    const stats = (this._config.stats || []).filter(Boolean);
    if (stats.length && stats.join(",") !== DEFAULT_STAT_KEYS.join(",")) out.stats = stats;
    const charts = (this._config.charts || []).filter(Boolean);
    if (charts.length && charts.join(",") !== DEFAULT_CHART_KEYS.join(",")) out.charts = charts;
    this._emitting = true;
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: out }, bubbles: true, composed: true,
    }));
    this._emitting = false;
  }

  _capture() {
    const root = this.shadowRoot;
    const get = (n) => root.querySelector(`[name="${n}"]`);
    this._config.repeater = get("repeater")?.value || "";
    this._config.title = get("title")?.value || "";
    this._config.hours = Number(get("hours")?.value) || 24;
    this._config.entry_id = get("entry_id")?.value.trim() || "";
    this._config.charts = Array.from(root.querySelectorAll('input[data-charts]:checked'))
      .map(cb => cb.value);
    this._config.stats = Array.from(root.querySelectorAll('input[data-stats]:checked'))
      .map(cb => cb.value);
  }

  _render() {
    const c = this._config;
    const repOptions = `
      <option value="">— auto-detect —</option>
      ${this._discovered.map(r =>
        `<option value="${r.pubkey10}" ${r.pubkey10 === c.repeater ? "selected" : ""}>${esc(r.name)} (${r.pubkey10.slice(0,6)})</option>`
      ).join("")}`;
    const allKeys = Object.keys(STAT_META);
    const statSet = new Set(c.stats || []);
    const chartSet = new Set(c.charts || []);
    const statChecks = allKeys.map(k => `
      <label><input type="checkbox" data-stats value="${k}" ${statSet.has(k) ? "checked" : ""}/> ${esc(STAT_META[k].label)} <small style="color:var(--secondary-text-color)">${k}</small></label>
    `).join("");
    const chartChecks = allKeys.map(k => `
      <label><input type="checkbox" data-charts value="${k}" ${chartSet.has(k) ? "checked" : ""}/> ${esc(STAT_META[k].label)} <small style="color:var(--secondary-text-color)">${k}</small></label>
    `).join("");

    this.shadowRoot.innerHTML = `
      <style>${EDITOR_STYLE}</style>
      <div class="ed">
        <h4>Repeater</h4>
        <div class="row">
          <label>Repeater
            <select name="repeater">${repOptions}</select>
          </label>
          <label>Title (optional)
            <input type="text" name="title" value="${esc(c.title || "")}" placeholder="defaults to repeater name"/>
          </label>
          <label>History window (hours)
            <input type="number" name="hours" min="1" max="720" value="${c.hours || 24}"/>
          </label>
        </div>
        <div class="help">Auto-detect picks the first repeater found in HA's entity registry.</div>

        <h4>CLI Console</h4>
        <div class="row">
          <label>Entry ID (optional)
            <input type="text" name="entry_id" value="${esc(c.entry_id || "")}" placeholder="auto-detected"/>
          </label>
        </div>
        <div class="help">Only needed if auto-detection fails. Find it in Settings → Devices &amp; services → MeshCore → open the integration → copy the ID from the URL.</div>

        <h4>Stat tiles</h4>
        <div class="checks">${statChecks}</div>

        <h4>Charts</h4>
        <div class="checks">${chartChecks}</div>
      </div>`;

    const root = this.shadowRoot;
    root.querySelectorAll("input, select").forEach(el => {
      const ev = el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input";
      el.addEventListener(ev, () => { this._capture(); this._emit(); });
    });
  }

}

customElements.define("meshcore-repeater-card-editor", MeshcoreRepeaterCardEditor);


// Register with HACS / Lovelace card picker.
window.customCards = window.customCards || [];
window.customCards.push({
  type: "meshcore-repeater-card",
  name: "MeshCore Repeater",
  description: "Live stats and history charts for a single MeshCore repeater",
  preview: false,
  version: REPEATER_CARD_VERSION,
  documentationURL: "https://github.com/meshcore-dev/meshcore-ha-cards",
});

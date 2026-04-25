// netlify/functions/state.js v2.0
// GodsEye State Store — current state + permanent archive + user input log
// Blob keys:
//   "current"          — live state (signal values, alerts, history_log)
//   "archive:YYYY-MM-DD" — daily permanent record (never trimmed)
//   "user-inputs"       — all analyst corrections/overrides (never trimmed)
//   "weekly:YYYY-WNN"   — weekly analysis summaries

const { getStore } = require("@netlify/blobs");

exports.handler = async function(event, context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const store = getStore("godseye-state");

    // === GET: Read state ===
    if (event.httpMethod === "GET") {
      const params = event.queryStringParameters || {};

      // GET ?type=archive&date=2026-04-05 — retrieve daily archive
      if (params.type === "archive" && params.date) {
        try {
          const raw = await store.get("archive:" + params.date);
          if (raw) return { statusCode: 200, headers, body: raw };
        } catch (e) {}
        return { statusCode: 200, headers, body: JSON.stringify({ error: "No archive for " + params.date }) };
      }

      // GET ?type=user-inputs — retrieve all analyst corrections
      if (params.type === "user-inputs") {
        try {
          const raw = await store.get("user-inputs");
          if (raw) return { statusCode: 200, headers, body: raw };
        } catch (e) {}
        return { statusCode: 200, headers, body: JSON.stringify({ inputs: [] }) };
      }

      // GET ?type=weekly&week=2026-W15 — retrieve weekly analysis
      if (params.type === "weekly" && params.week) {
        try {
          const raw = await store.get("weekly:" + params.week);
          if (raw) return { statusCode: 200, headers, body: raw };
        } catch (e) {}
        return { statusCode: 200, headers, body: JSON.stringify({ error: "No weekly for " + params.week }) };
      }

      // GET ?type=news_archive — retrieve headlines archive
      if (params.type === "news_archive") {
        try {
          const raw = await store.get("headlines_archive");
          if (raw) return { statusCode: 200, headers, body: raw };
        } catch (e) {}
        return { statusCode: 200, headers, body: JSON.stringify([]) };
      }

      // GET ?type=meta_intel — retrieve meta-intelligence findings
      if (params.type === "meta_intel") {
        try {
          const raw = await store.get("meta_intel");
          if (raw) return { statusCode: 200, headers, body: raw };
        } catch (e) {}
        return { statusCode: 200, headers, body: JSON.stringify([]) };
      }

      // Default: return current state
      let state = null;
      try {
        const raw = await store.get("current");
        if (raw) state = JSON.parse(raw);
      } catch (e) {}

      if (!state) {
        return { statusCode: 200, headers, body: JSON.stringify({ source: "seed", state: null }) };
      }

      return { statusCode: 200, headers, body: JSON.stringify({ source: "blob", state, ts: Date.now() }) };
    }

    // === POST: Write state ===
    if (event.httpMethod === "POST") {
      const updates = JSON.parse(event.body);

      // --- USER INPUT LOG ---
      if (updates.type === "user_input") {
        let inputs = [];
        try {
          const raw = await store.get("user-inputs");
          if (raw) inputs = JSON.parse(raw);
          if (!Array.isArray(inputs)) inputs = [];
        } catch (e) {}

        inputs.push({
          ts: new Date().toISOString(),
          action: updates.action, // "override", "slider", "custom_watch", "dismiss", "scenario_adjust"
          detail: updates.detail, // { signal: "S35", from: 80, to: 100 } or { slider: "leakage", value: 20 }
        });

        // User inputs never trimmed — permanent record
        await store.set("user-inputs", JSON.stringify(inputs));

        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, logged: inputs.length }) };
      }

      // --- DAILY ARCHIVE SNAPSHOT ---
      if (updates.type === "daily_archive") {
        const today = new Date().toISOString().split("T")[0];
        const snapshot = {
          date: today,
          ts: new Date().toISOString(),
          signal_values: updates.signal_values || {},
          scenario_probs: updates.scenario_probs || {},
          events_active: updates.events_active || 0,
          events_total: updates.events_total || 0,
          gmsi: updates.gmsi,
          mode: updates.mode,
          sources_active: updates.sources_active || 0,
          headlines_processed: updates.headlines_processed || 0,
          auto_applies: updates.auto_applies || 0,
          user_overrides: updates.user_overrides || 0,
          history_log: updates.history_log || [],
        };

        await store.set("archive:" + today, JSON.stringify(snapshot));
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, archived: today }) };
      }

      // --- WEEKLY ANALYSIS ---
      if (updates.type === "weekly_analysis") {
        const weekKey = updates.week; // "2026-W15"
        await store.set("weekly:" + weekKey, JSON.stringify(updates.analysis));
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, week: weekKey }) };
      }

      // --- STANDARD STATE UPDATE ---
      let state = null;
      try {
        const raw = await store.get("current");
        if (raw) state = JSON.parse(raw);
      } catch (e) {}

      if (!state) {
        state = {
          _meta: updates._meta || { version: "auto", updated: new Date().toISOString() },
          signal_values: {},
          scenario_probs: {},
          alerts: [],
          history_log: [],
        };
      }

      // Apply signal updates
      if (updates.signals) {
        for (const [sid, val] of Object.entries(updates.signals)) {
          const old = state.signal_values[sid];
          state.signal_values[sid] = val;
          state.history_log.push({
            ts: new Date().toISOString(),
            signal: sid,
            from: old || null,
            to: val,
            source: updates.source || "analyze",
            reason: updates.reasons ? updates.reasons[sid] : null,
          });
        }
      }

      // Apply scenario updates
      if (updates.scenarios) {
        state.scenario_probs = { ...state.scenario_probs, ...updates.scenarios };
      }

      // Apply alerts
      if (updates.alerts) {
        updates.alerts.forEach(a => {
          if (!state.alerts.some(ea => ea.text === a.text)) state.alerts.unshift(a);
        });
        if (state.alerts.length > 30) state.alerts.length = 30;
      }

      // Cap history_log at 200 (increased from 150)
      if (state.history_log.length > 200) state.history_log = state.history_log.slice(-200);

      state._meta = state._meta || {};
      state._meta.updated = new Date().toISOString();
      state._meta.version = "auto-" + Date.now();

      await store.set("current", JSON.stringify(state));

      // === AUTO-ARCHIVE: save daily snapshot at each write ===
      try {
        const today = new Date().toISOString().split("T")[0];
        const existing = await store.get("archive:" + today).catch(() => null);
        if (!existing) {
          // First write of the day — create daily archive
          await store.set("archive:" + today, JSON.stringify({
            date: today,
            ts: new Date().toISOString(),
            signal_values: { ...state.signal_values },
            scenario_probs: { ...state.scenario_probs },
            history_log_count: state.history_log.length,
            alerts_count: state.alerts.length,
          }));
        }
      } catch (e) {}

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, updates_applied: Object.keys(updates.signals || {}).length, ts: Date.now() }),
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  } catch (err) {
    console.error("State error:", err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ source: "error", error: err.message }) };
  }
};

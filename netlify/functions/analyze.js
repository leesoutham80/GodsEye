// netlify/functions/analyze.js
// GodsEye Signal Analysis Engine
// Takes news headlines + current signal state → Claude Haiku → structured signal impacts
// Auto-applies major impacts to Netlify Blobs state store
// Requires ANTHROPIC_API_KEY in Netlify env vars

const { getStore } = require("@netlify/blobs");

exports.handler = async function(event, context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers, body: JSON.stringify({ ts: Date.now(), source: "none", impacts: [], error: "ANTHROPIC_API_KEY not set" }) };
  }

  try {
    const { headlines, signals, crisisDay, gmsi, mode, scenarios } = JSON.parse(event.body);

    if (!headlines || headlines.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ ts: Date.now(), source: "none", impacts: [] }) };
    }

    // === READ RECENT HISTORY FOR CONTEXT ===
    let historyContext = "";
    try {
      const store = getStore("godseye-state");
      const raw = await store.get("current");
      if (raw) {
        const state = JSON.parse(raw);
        if (state.history_log && state.history_log.length > 0) {
          // Last 24 hours of changes
          const cutoff = Date.now() - 24 * 3600 * 1000;
          const recent = state.history_log.filter(e => new Date(e.ts).getTime() > cutoff);
          if (recent.length > 0) {
            historyContext = "\n\nRECENT SYSTEM HISTORY (last 24hrs — what you assessed previously):\n" +
              recent.slice(-15).map(e =>
                `${e.ts?.substring(11,16)||"?"} ${e.signal}: ${e.from||"?"}→${e.to} [${e.source}] ${e.reason||""}`
              ).join("\n") +
              "\n\nUse this history to: (1) avoid suggesting changes you already suggested, (2) notice trends building across multiple cycles, (3) calibrate — if a suggestion was overridden, your threshold may have been too aggressive.";
          }
        }
      }
    } catch (e) { /* no history yet — first run */ }

    const signalDefs = `Key signals to assess against (current values):
S1 Strike Tempo (${signals.S1 || 100}) - military strike intensity
S1b Theatre Utilisation (${signals.S1b || 68}) - force output vs capacity  
S1c Global Force Commit (${signals.S1c || 28}) - theatre vs total deployable
S1d Escalation Tier (${signals.S1d || 38}) - weapon class ceiling (T1=0-20 standoff, T2=20-40 penetration, T3=40-60 MOP, T4=60-80 tac nuke discussion, T5=80-100)
S1e Civilian Target Index (${signals.S1e || 22}) - civilian vs military strike ratio
S3 Transit Count (${signals.S3 || 20}) - commercial Hormuz transit
S6 Insurance Extension (${signals.S6 || 80}) - Lloyd's JWC war risk pricing
S7 Brent Curve (${signals.S7 || 100}) - crude curve stress
S10 Narrative Softening (${signals.S10 || 60}) - diplomatic language shift
S12 Mediator Framework (${signals.S12 || 60}) - backchannel activity
S15 Convoy Normalisation (${signals.S15 || 20}) - commercial transit resumption
S23 Naval Escort (${signals.S23 || 40}) - escort formation signals
S35 Infra War Escalation (${signals.S35 || 100}) - infrastructure targeting
S80a Perishable Food (${signals.S80a || 80}) - food security stress
S82 Desalination Risk (${signals.S82 || 80}) - water infrastructure
S83 IRGC Degradation (${signals.S83 || 45}) - Iranian military capability
S91 Nuclear Seizure Risk (${signals.S91 || 60}) - nuclear site operations

Scenario paths: A=Prolonged Closure(${scenarios.A}%), B=Managed Escort(${scenarios.B}%), C=Diplomatic(${scenarios.C}%), D=Reflexive Fade(${scenarios.D}%), E=Extreme Escalation(${scenarios.E}%), F=SAR Cascade(${scenarios.F}%)

TACO framework: Trump's price management pattern. Cycles between threat/pivot. Smokescreen mode uses expected pivot as military cover.

CEASEFIRE RULES: Headlines tagged [ceasefire] are the highest-priority signal. A ceasefire should push S10 sharply up, S12 sharply up, S1 sharply down (strikes stopping), and suggest Path C (Diplomatic) probability increase. Do not treat ceasefire headlines as minor.`;

    const prompt = `You are the GodsEye signal analysis engine. Hormuz crisis Day ${crisisDay}. GMSI ${gmsi}. Mode: ${mode}.

${signalDefs}${historyContext}

Analyze these headlines for signal impacts. For each headline that affects one or more signals, return the impact. Ignore headlines with no signal relevance. Do NOT repeat suggestions you already made in the history above unless conditions have materially changed.

Headlines:
${headlines.map((h, i) => `${i + 1}. [${h.tag}${h.intensity ? "/I"+h.intensity : ""}] ${h.text}`).join("\n")}

Respond ONLY with a JSON array. No markdown, no backticks, no preamble. Each object:
{"headline_index": number, "signals": [{"id": "S35", "direction": "up"|"down"|"stable", "magnitude": "major"|"moderate"|"minor", "suggested_value": number_or_null, "reason": "brief explanation"}], "taco_phase": "THREAT"|"PIVOT"|"SMOKESCREEN"|"NORMAL"|null, "scenario_impact": {"path": "A"|"B"|"C"|"D"|"E"|"F"|null, "direction": "up"|"down"|null, "reason": "brief"} }

If no headlines have signal relevance, return []. Maximum 6 impacts. Focus on the most significant.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return { statusCode: 200, headers, body: JSON.stringify({ ts: Date.now(), source: "error", impacts: [], error: "API " + response.status }) };
    }

    const data = await response.json();
    const text = data.content.map(c => c.text || "").join("");
    
    // Parse JSON response
    let impacts = [];
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      impacts = JSON.parse(clean);
      if (!Array.isArray(impacts)) impacts = [];
    } catch (e) {
      console.error("Parse error:", e.message, "Raw:", text.substring(0, 200));
      impacts = [];
    }

    // === AUTO-APPLY: write signal updates when threshold met ===
    // Criteria: magnitude "major" + suggested_value present
    const autoApply = {};
    const reasons = {};
    const autoAlerts = [];

    for (const imp of impacts) {
      if (!imp.signals) continue;
      for (const sig of imp.signals) {
        if (sig.magnitude === "major" && sig.suggested_value != null) {
          autoApply[sig.id] = sig.suggested_value;
          reasons[sig.id] = sig.reason;
          autoAlerts.push({
            priority: "WARNING",
            text: `AUTO: ${sig.id} updated to ${sig.suggested_value} (was ${signals[sig.id] || "?"}) — ${sig.reason}`
          });
        }
      }
      // Auto-apply scenario shifts for major impacts
      if (imp.scenario_impact && imp.scenario_impact.path && imp.scenario_impact.direction) {
        // Don't auto-apply scenario changes — too consequential. Flag only.
      }
    }

    // Write to Netlify Blobs if there are auto-applies
    let applied = 0;
    if (Object.keys(autoApply).length > 0) {
      try {
        const store = getStore("godseye-state");
        let state = null;
        try {
          const raw = await store.get("current");
          if (raw) state = JSON.parse(raw);
        } catch (e) {}

        if (!state) {
          state = { _meta: {}, signal_values: {}, scenario_probs: {}, alerts: [], history_log: [] };
        }

        for (const [sid, val] of Object.entries(autoApply)) {
          const old = state.signal_values[sid];
          state.signal_values[sid] = val;
          state.history_log.push({
            ts: new Date().toISOString(),
            signal: sid,
            from: old || null,
            to: val,
            source: "auto-analyze",
            reason: reasons[sid],
          });
        }

        autoAlerts.forEach(a => {
          if (!state.alerts.some(ea => ea.text === a.text)) state.alerts.unshift(a);
        });
        if (state.alerts.length > 20) state.alerts.length = 20;
        if (state.history_log.length > 100) state.history_log = state.history_log.slice(-100);

        state._meta.updated = new Date().toISOString();
        state._meta.version = "auto-" + Date.now();
        await store.set("current", JSON.stringify(state));
        applied = Object.keys(autoApply).length;
        console.log("[ANALYZE] Auto-applied", applied, "signal updates:", Object.keys(autoApply).join(", "));
      } catch (e) {
        console.error("[ANALYZE] Auto-apply blob write failed:", e.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ts: Date.now(), source: "haiku", impacts, auto_applied: autoApply, applied_count: applied, cost_estimate: "$0.001" }),
    };

  } catch (err) {
    console.error("Analyze error:", err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ ts: Date.now(), source: "error", impacts: [], error: err.message }) };
  }
};

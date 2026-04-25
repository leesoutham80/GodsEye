// netlify/functions/weekly.js
// GodsEye Weekly Analysis — scheduled Sunday 00:00 UTC
// Reads daily archives, user inputs, compares signal trajectories
// Generates trend report + self-assessment via Haiku
// Stores result as weekly:YYYY-WNN in blob store

const { schedule } = require("@netlify/functions");
const { getStore } = require("@netlify/blobs");

module.exports.handler = schedule("0 0 * * 0", async (event) => {
  console.log("[WEEKLY] Running weekly analysis", new Date().toISOString());

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.warn("[WEEKLY] No ANTHROPIC_API_KEY");
    return { statusCode: 200 };
  }

  try {
    const store = getStore("Godseye_Blobs");

    // === STEP 1: Collect last 7 days of daily archives ===
    const dailySnapshots = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 86400000);
      const key = "archive:" + d.toISOString().split("T")[0];
      try {
        const raw = await store.get(key);
        if (raw) dailySnapshots.push(JSON.parse(raw));
      } catch (e) {}
    }
    dailySnapshots.reverse(); // oldest first

    if (dailySnapshots.length === 0) {
      console.log("[WEEKLY] No daily archives found");
      return { statusCode: 200 };
    }

    // === STEP 2: Collect user inputs from the week ===
    let userInputs = [];
    try {
      const raw = await store.get("user-inputs");
      if (raw) {
        const all = JSON.parse(raw);
        const weekAgo = Date.now() - 7 * 86400000;
        userInputs = all.filter(inp => new Date(inp.ts).getTime() > weekAgo);
      }
    } catch (e) {}

    // === STEP 3: Read current state for history_log ===
    let historyLog = [];
    try {
      const raw = await store.get("current");
      if (raw) {
        const state = JSON.parse(raw);
        const weekAgo = Date.now() - 7 * 86400000;
        historyLog = (state.history_log || []).filter(e => new Date(e.ts).getTime() > weekAgo);
      }
    } catch (e) {}

    // === STEP 4: Build signal trajectory summary ===
    const signalTrajectories = {};
    dailySnapshots.forEach(snap => {
      if (!snap.signal_values) return;
      for (const [sid, val] of Object.entries(snap.signal_values)) {
        if (!signalTrajectories[sid]) signalTrajectories[sid] = [];
        signalTrajectories[sid].push({ date: snap.date, value: val });
      }
    });

    // Find biggest movers
    const movers = [];
    for (const [sid, trajectory] of Object.entries(signalTrajectories)) {
      if (trajectory.length < 2) continue;
      const first = trajectory[0].value;
      const last = trajectory[trajectory.length - 1].value;
      const delta = last - first;
      if (Math.abs(delta) >= 5) {
        movers.push({ signal: sid, start: first, end: last, delta, trajectory: trajectory.map(t => t.value).join("→") });
      }
    }
    movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    // === STEP 5: Categorise user inputs ===
    const inputSummary = {
      overrides: userInputs.filter(i => i.action === "override").length,
      slider_changes: userInputs.filter(i => i.action === "slider").length,
      custom_watches: userInputs.filter(i => i.action === "custom_watch_add").length,
      alerts_dismissed: userInputs.filter(i => i.action === "dismiss_alert").length,
      total: userInputs.length,
    };

    // Count auto-applies vs analyst overrides
    const autoApplies = historyLog.filter(e => e.source === "watchdog" || e.source === "auto-analyze" || e.source?.startsWith("monitor:")).length;
    const manualChanges = historyLog.filter(e => e.source === "manual" || e.source === "seed").length;

    // === STEP 6: Generate analysis via Haiku ===
    const crisisDay = Math.floor((Date.now() - new Date("2026-02-28").getTime()) / 86400000);

    const weekPrompt = `You are GodsEye's weekly self-assessment engine. Hormuz crisis Day ${crisisDay}. Generate a weekly intelligence review.

SIGNAL TRAJECTORIES THIS WEEK (${dailySnapshots.length} days of data):
${movers.slice(0, 15).map(m => `${m.signal}: ${m.start}→${m.end} (${m.delta > 0 ? "+" : ""}${m.delta}) trajectory: ${m.trajectory}`).join("\n")}
${movers.length === 0 ? "No significant signal movement this week." : ""}

SYSTEM ACTIVITY:
- Auto-applied signal changes: ${autoApplies}
- Total history entries: ${historyLog.length}
- Daily archives collected: ${dailySnapshots.length}

ANALYST ACTIVITY:
- Total inputs: ${inputSummary.total}
- Slider adjustments: ${inputSummary.slider_changes}
- Custom watches added: ${inputSummary.custom_watches}
- Alerts dismissed: ${inputSummary.alerts_dismissed}
${userInputs.slice(0, 10).map(i => `  ${i.ts?.substring(0,16)} ${i.action}: ${JSON.stringify(i.detail).substring(0, 80)}`).join("\n")}

Generate a structured weekly analysis with these sections:
1. WEEK SUMMARY (2-3 sentences: what happened, what mattered)
2. SIGNAL TRENDS (which signals moved most, what the trajectories mean, any patterns)
3. SYSTEM PERFORMANCE (what the auto-analysis caught, what it missed based on analyst corrections)
4. SELF-CALIBRATION (if the analyst overrode suggestions, what does that tell us about thresholds — should we be more or less aggressive?)
5. WATCH ITEMS FOR NEXT WEEK (based on trajectories, what should we be monitoring)
6. CP ECHO ASSESSMENT (is the propagation chain compressing or decompressing? which nodes are lagging?)

Respond in plain text, no JSON. This will be read by the analyst as a weekly digest.`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: weekPrompt }],
      }),
    });

    if (!aiResponse.ok) {
      console.error("[WEEKLY] Haiku error:", aiResponse.status);
      return { statusCode: 200 };
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.content.map(c => c.text || "").join("");

    // === STEP 7: Store weekly analysis ===
    const weekNum = getWeekNumber(new Date());
    const weekKey = new Date().getFullYear() + "-W" + String(weekNum).padStart(2, "0");

    const weeklyReport = {
      week: weekKey,
      generated: new Date().toISOString(),
      crisis_day: crisisDay,
      days_of_data: dailySnapshots.length,
      signal_movers: movers.slice(0, 20),
      analyst_inputs: inputSummary,
      auto_applies: autoApplies,
      history_entries: historyLog.length,
      analysis: analysisText,
    };

    await store.set("weekly:" + weekKey, JSON.stringify(weeklyReport));

    // Add alert to current state
    try {
      const raw = await store.get("current");
      if (raw) {
        const state = JSON.parse(raw);
        state.alerts.unshift({
          priority: "INFO",
          text: `WEEKLY: ${weekKey} analysis generated. ${movers.length} signal movers, ${inputSummary.total} analyst inputs logged.`,
        });
        if (state.alerts.length > 30) state.alerts.length = 30;
        await store.set("current", JSON.stringify(state));
      }
    } catch (e) {}

    // Push notification
    const ntfyTopic = process.env.NTFY_TOPIC || "godseye-alerts";
    try {
      await fetch(`https://ntfy.sh/${ntfyTopic}`, {
        method: "POST",
        headers: { "Title": "GodsEye Weekly Analysis", "Priority": "default", "Tags": "chart_with_upwards_trend" },
        body: `Week ${weekKey} analysis ready.\n${movers.length} signal movers, ${inputSummary.total} analyst inputs.\nTop mover: ${movers[0]?.signal || "none"} (${movers[0]?.delta > 0 ? "+" : ""}${movers[0]?.delta || 0})`,
      });
    } catch (e) {}

    console.log("[WEEKLY] Complete. Week:", weekKey, "Movers:", movers.length, "Inputs:", inputSummary.total);
    return { statusCode: 200 };

  } catch (err) {
    console.error("[WEEKLY] Error:", err.message);
    return { statusCode: 200 };
  }
});

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

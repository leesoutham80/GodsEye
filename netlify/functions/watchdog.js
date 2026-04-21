// netlify/functions/watchdog.js
// GodsEye Watchdog — scheduled every 15 minutes
// Fetches news, runs analysis, auto-applies major impacts
// Works independently of dashboard — the system never sleeps

const { schedule } = require("@netlify/functions");
const { getStore } = require("@netlify/blobs");
const { classifyHeadline } = require("./godseye-classifier");

module.exports.handler = schedule("*/15 * * * *", async (event, context) => {
  console.log("[WATCHDOG] Running scheduled analysis", new Date().toISOString());

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const newsKey = process.env.NEWSAPI_KEY;

  if (!anthropicKey) {
    console.warn("[WATCHDOG] No ANTHROPIC_API_KEY");
    return { statusCode: 200 };
  }

  try {
    // === STEP 1: Fetch from multiple sources in parallel ===
    let headlines = [];

    // Generic RSS fetcher
    async function fetchRSS(url, name, max) {
      const items = [];
      try {
        const r = await fetch(url, { headers: { "User-Agent": "GodsEye/2.0" }, signal: AbortSignal.timeout(5000) });
        if (!r.ok) return items;
        const xml = await r.text();
        const matches = xml.match(/<item>[\s\S]*?<\/item>/g) || xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
        matches.slice(0, max || 6).forEach(item => {
          const tm = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title[^>]*>(.*?)<\/title>/);
          if (tm) { const t = tm[1].replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").substring(0, 150); if (t && t.length > 15) items.push({ text: t, origin: name }); }
        });
      } catch (e) {}
      return items;
    }

    // NewsAPI
    async function fetchNewsAPI() {
      if (!newsKey) return [];
      const items = [];
      const queries = ["Iran+war+Hormuz", "oil+price+crude", "Iran+ceasefire"];
      for (const q of queries) {
        try {
          const r = await fetch(`https://newsapi.org/v2/everything?q=${q}&sortBy=publishedAt&pageSize=5&language=en&apiKey=${newsKey}`);
          if (r.ok) { const d = await r.json(); if (d.articles) d.articles.forEach(a => { const t = a.title?.replace(/\s*[-–—|]\s*[^-–—|]+$/, "").substring(0, 140); if (t) items.push({ text: t, origin: "newsapi" }); }); }
        } catch (e) {}
      }
      return items;
    }

    // Reddit
    async function fetchReddit() {
      const items = [];
      for (const sub of ["worldnews", "geopolitics", "energy"]) {
        try {
          const r = await fetch(`https://www.reddit.com/r/${sub}/search.json?q=iran+OR+hormuz+OR+ceasefire&sort=new&t=day&limit=8`, { headers: { "User-Agent": "GodsEye/2.0" }, signal: AbortSignal.timeout(4000) });
          if (!r.ok) continue;
          const d = await r.json();
          (d?.data?.children || []).forEach(p => { const t = p.data?.title?.substring(0, 140); if (t && (p.data?.score || 0) > 3) items.push({ text: t, origin: "reddit" }); });
        } catch (e) {}
      }
      return items;
    }

    // Fetch key RSS feeds + aggregators in parallel
    const results = await Promise.all([
      fetchRSS("https://www.aljazeera.com/xml/rss/all.xml", "aljazeera", 8),
      fetchRSS("https://feeds.bbci.co.uk/news/world/rss.xml", "bbc", 6),
      fetchRSS("https://www.iranintl.com/en/feed", "iran_intl", 6),
      fetchRSS("https://www.thedrive.com/the-war-zone/feed", "warzone", 5),
      fetchRSS("https://www.middleeasteye.net/rss", "middleeasteye", 5),
      fetchRSS("https://gcaptain.com/feed/", "gcaptain", 4),
      fetchRSS("https://news.google.com/rss/search?q=Iran+war+Hormuz&hl=en&gl=US&ceid=US:en", "google", 8),
      fetchRSS("https://news.google.com/rss/search?q=Iran+ceasefire+peace&hl=en&gl=US&ceid=US:en", "gn_ceasefire", 5),
      fetchNewsAPI().catch(() => []),
      fetchReddit().catch(() => []),
    ].map(p => p.catch ? p : p.catch(() => [])));

    const all = results.flat();
    all.forEach(a => { const c = classifyHeadline(a.text); a.tag = c.tag; a.intensity = c.intensity; });

    // Deduplicate
    const seen = new Set();
    headlines = all.filter(h => {
      const key = h.text.substring(0, 35).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 25);

    const activeSources = results.filter(r => r.length > 0).length;
    console.log("[WATCHDOG] " + activeSources + "/10 sources active, " + all.length + " raw → " + headlines.length + " unique");

    if (headlines.length === 0) {
      console.log("[WATCHDOG] No headlines found");
      return { statusCode: 200 };
    }

    console.log("[WATCHDOG]", headlines.length, "headlines to analyze");

    // === STEP 2: Read current state ===
    // DIAGNOSTIC: what's actually available at runtime
    console.log("[WATCHDOG-DEBUG] context keys:", context ? Object.keys(context) : "NO CONTEXT");
    console.log("[WATCHDOG-DEBUG] context.siteId:", context?.siteId || "undefined");
    console.log("[WATCHDOG-DEBUG] context.token:", context?.token ? "present" : "undefined");
    console.log("[WATCHDOG-DEBUG] env SITE_ID:", process.env.SITE_ID ? "present" : "undefined");
    console.log("[WATCHDOG-DEBUG] env NETLIFY_BLOBS_TOKEN:", process.env.NETLIFY_BLOBS_TOKEN ? "present" : "undefined");
    console.log("[WATCHDOG-DEBUG] env NETLIFY_BLOBS_CONTEXT:", process.env.NETLIFY_BLOBS_CONTEXT ? "present" : "undefined");
    console.log("[WATCHDOG-DEBUG] env NETLIFY_SITE_ID:", process.env.NETLIFY_SITE_ID ? "present" : "undefined");
    
    const store = getStore({name:"godseye-state",siteID:process.env.NETLIFY_SITE_ID,token:process.env.GogdsEye_Blobs});
    let state = null;
    try {
      const raw = await store.get("current");
      if (raw) state = JSON.parse(raw);
    } catch (e) {}

    if (!state) {
      state = { _meta: {}, signal_values: {}, scenario_probs: {}, alerts: [], history_log: [] };
    }

    // === STEP 3: Run analysis via Claude Haiku ===
    const crisisDay = Math.floor((Date.now() - new Date("2026-02-28").getTime()) / 86400000);
    const sigState = state.signal_values || {};

    // Build history context from recent changes
    let historyBlock = "";
    if (state.history_log && state.history_log.length > 0) {
      const cutoff = Date.now() - 24 * 3600 * 1000;
      const recent = state.history_log.filter(e => new Date(e.ts).getTime() > cutoff);
      if (recent.length > 0) {
        historyBlock = "\n\nRECENT HISTORY (last 24hrs):\n" +
          recent.slice(-12).map(e =>
            `${e.ts?.substring(11,16)||"?"} ${e.signal}: ${e.from||"?"}→${e.to} [${e.source}] ${e.reason||""}`
          ).join("\n") +
          "\nDo NOT repeat suggestions already made. Notice trends building across cycles. If a suggestion was overridden, be less aggressive on that signal.";
      }
    }

    const prompt = `You are the GodsEye signal analysis engine. Hormuz crisis Day ${crisisDay}. Mode: HOLD.

Key signals: S1 Strike Tempo(${sigState.S1||100}), S1b Theatre Util(${sigState.S1b||75}), S1d Escalation Tier(${sigState.S1d||38}), S1e Civilian Target(${sigState.S1e||22}), S3 Transit(${sigState.S3||20}), S6 Insurance(${sigState.S6||80}), S7 Brent Curve(${sigState.S7||100}), S10 Narrative(${sigState.S10||60}), S12 Mediator(${sigState.S12||60}), S15 Convoy(${sigState.S15||20}), S35 Infra War(${sigState.S35||100}), S80a Food(${sigState.S80a||80}), S82 Desal(${sigState.S82||80}), S83 IRGC Degrad(${sigState.S83||40}), S91 Nuclear(${sigState.S91||60}), S110 Helium Supply(${sigState.S110||85}), S111 Fertiliser(${sigState.S111||70}).

TACO: Trump price management. Cycles threat/pivot. 48hr ultimatum active — energy infra targeting threatened.
WSO rescued Apr 5. Path F partially invalidated but precedent set. Path E now live at 15%.${historyBlock}

Analyze these headlines. Return ONLY a JSON array. No markdown. Each object: {"headline_index":N,"signals":[{"id":"S35","direction":"up"|"down","magnitude":"major"|"moderate"|"minor","suggested_value":N_or_null,"reason":"brief"}],"taco_phase":"THREAT"|"PIVOT"|null}

Headlines:
${headlines.map((h, i) => `${i + 1}. [${h.tag}${h.intensity ? "/"+h.intensity : ""}] ${h.text}`).join("\n")}`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      console.error("[WATCHDOG] Haiku error:", aiResponse.status);
      return { statusCode: 200 };
    }

    const aiData = await aiResponse.json();
    const text = aiData.content.map(c => c.text || "").join("");
    let impacts = [];
    try {
      impacts = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (!Array.isArray(impacts)) impacts = [];
    } catch (e) {
      console.error("[WATCHDOG] Parse error:", e.message);
      return { statusCode: 200 };
    }

    // === STEP 4: Auto-apply major impacts ===
    let applied = 0;
    const notifications = [];

    for (const imp of impacts) {
      if (!imp.signals) continue;
      for (const sig of imp.signals) {
        if (sig.magnitude === "major" && sig.suggested_value != null) {
          const old = state.signal_values[sig.id];
          state.signal_values[sig.id] = sig.suggested_value;
          state.history_log.push({
            ts: new Date().toISOString(),
            signal: sig.id,
            from: old || null,
            to: sig.suggested_value,
            source: "watchdog",
            reason: sig.reason,
          });
          state.alerts.unshift({
            priority: "WARNING",
            text: `AUTO: ${sig.id} → ${sig.suggested_value} (was ${old || "?"}) — ${sig.reason}`,
          });
          notifications.push(`${sig.id}: ${old || "?"}→${sig.suggested_value} (${sig.reason})`);
          applied++;
        }
      }
    }

    // Trim
    if (state.alerts.length > 20) state.alerts.length = 20;
    if (state.history_log.length > 100) state.history_log = state.history_log.slice(-100);
    
    // === PERSIST NEWS ITEMS FOR DASHBOARD ===
    // Convert headlines to dashboard-compatible format
    const newsForDashboard = headlines.slice(0, 30).map(h => {
      const txt = (h.text || "").toLowerCase();
      let genre = "diplomatic";
      if (/strike|missile|attack|military|war|killed|wounded|drone|fighter|tank/.test(txt)) genre = "kinetic";
      else if (/oil|brent|price|market|futures|trade|stock|equity|barrel/.test(txt)) genre = "market";
      else if (/ship|tanker|port|vessel|freight|shipping|cargo|maritime/.test(txt)) genre = "shipping";
      else if (/talk|meeting|agreement|deal|ceasefire|negotiat|diplomat|minister/.test(txt)) genre = "diplomatic";
      else if (/sanction|ukraine|russia|yemen|houthi|gaza|conflict/.test(txt)) genre = "conflict";
      return {
        g: genre,
        x: h.text.substring(0, 180),
        o: h.origin || "rss",
        created: new Date().toISOString().substring(0, 10)
      };
    });
    state.news_items = newsForDashboard;
    
    state._meta.updated = new Date().toISOString();
    state._meta.version = "watchdog-" + Date.now();

    // Write state
    await store.set("current", JSON.stringify(state));

    // === STEP 5: Push notification if anything was auto-applied ===
    if (notifications.length > 0) {
      const ntfyTopic = process.env.NTFY_TOPIC || "godseye-alerts";
      try {
        await fetch(`https://ntfy.sh/${ntfyTopic}`, {
          method: "POST",
          headers: { "Title": "GodsEye Auto-Update", "Priority": "high", "Tags": "warning" },
          body: `${applied} signal(s) auto-updated:\n${notifications.join("\n")}`,
        });
        console.log("[WATCHDOG] Push notification sent to ntfy.sh/" + ntfyTopic);
      } catch (e) {
        console.warn("[WATCHDOG] Push notification failed:", e.message);
      }
    }

    console.log("[WATCHDOG] Complete.", headlines.length, "headlines,", impacts.length, "impacts,", applied, "auto-applied");

    // === STEP 6: Institutional Source Monitor — check specific pages for changes ===
    await monitorSources(store, anthropicKey, state, notifications);

    return { statusCode: 200 };

  } catch (err) {
    console.error("[WATCHDOG] Error:", err.message);
    return { statusCode: 200 };
  }
});

// ═══ INSTITUTIONAL SOURCE MONITOR ═══
// Actively checks key institutional pages for changes
// Hashes content, compares to stored hash, sends changes to Haiku

const MONITORED_SOURCES = [
  // Insurance/Shipping
  { id: "ukmto", url: "https://www.ukmto.org/", signals: ["S6","S30"], category: "shipping",
    extract: "title,advisory", interval: 15, note: "UK Maritime Trade Operations — threat advisories" },
  // Military
  { id: "centcom", url: "https://www.centcom.mil/MEDIA/PRESS-RELEASES/", signals: ["S1","S1b","S83"], category: "military",
    extract: "headlines", interval: 15, note: "CENTCOM press releases — strike reports, force updates" },
  { id: "uk_mod", url: "https://www.gov.uk/government/organisations/ministry-of-defence", signals: ["S1","S23"], category: "military",
    extract: "headlines", interval: 60, note: "UK MOD — RAF Lakenheath unit updates, escort ops" },
  { id: "idf", url: "https://www.idf.il/en/mini-sites/press-releases/", signals: ["S1","S83"], category: "military",
    extract: "headlines", interval: 30, note: "IDF spokesperson — joint strike operations" },
  { id: "presstv", url: "https://www.presstv.ir/", signals: ["S83","S10","S1"], category: "conflict",
    extract: "headlines", interval: 15, note: "PressTV — Iranian state perspective, IRGC claims" },
  // === WHITE HOUSE SCHEDULE & DIPLOMATIC CALENDARS ===
  { id: "wh_statements", url: "https://www.whitehouse.gov/briefing-room/statements-releases/", signals: ["S10","S12","S19"], category: "diplomatic",
    extract: "headlines", interval: 30, note: "White House statements — ceasefire, diplomatic moves" },
  { id: "wh_schedule", url: "https://www.whitehouse.gov/briefing-room/presidential-actions/", signals: ["S10","S12"], category: "schedule",
    extract: "headlines", interval: 30, note: "White House presidential actions — executive orders, proclamations, schedule signals" },
  { id: "factbase", url: "https://factba.se/biden/calendar", signals: ["S10","S12"], category: "schedule",
    extract: "schedule", interval: 60, note: "Factbase presidential calendar — meetings, calls, dinners, travel. Predictive for announcements." },
  { id: "state_dept", url: "https://www.state.gov/press-releases/", signals: ["S10","S19","S20"], category: "diplomatic",
    extract: "headlines", interval: 30, note: "State Department — sanctions, diplomatic statements" },
  { id: "state_travel", url: "https://www.state.gov/secretary-travel/", signals: ["S10","S19"], category: "schedule",
    extract: "headlines", interval: 60, note: "Secretary of State travel schedule — where Rubio goes = where diplomacy is active" },
  // Regional diplomatic
  { id: "iran_mfa", url: "https://en.mfa.gov.ir/portal/newsview/", signals: ["S10","S12"], category: "diplomatic",
    extract: "headlines", interval: 30, note: "Iran MFA — diplomatic position, negotiations" },
  { id: "pakistan_mfa", url: "https://mofa.gov.pk/press-releases/", signals: ["S12"], category: "diplomatic",
    extract: "headlines", interval: 30, note: "Pakistan MFA — mediation updates, Islamabad talks" },
  { id: "oman_news", url: "https://omannews.gov.om/en/home", signals: ["S12","S10"], category: "diplomatic",
    extract: "headlines", interval: 60, note: "Oman News Agency — backchannel host, mediation updates" },
  { id: "china_mfa", url: "https://www.fmprc.gov.cn/mfa_eng/xwfw_665399/s2510_665401/", signals: ["S10","S12","S79"], category: "diplomatic",
    extract: "headlines", interval: 60, note: "China MFA spokesperson — yuan mechanism, dual posture" },
  { id: "kremlin", url: "http://en.kremlin.ru/events/president/news", signals: ["S10","S20"], category: "diplomatic",
    extract: "headlines", interval: 120, note: "Kremlin — Russia position, UNSC veto signals" },
  // Nuclear
  { id: "iaea", url: "https://www.iaea.org/newscenter/pressreleases", signals: ["S91"], category: "nuclear",
    extract: "headlines", interval: 60, note: "IAEA press releases — nuclear compliance, Bushehr" },
  // Market
  { id: "opec", url: "https://www.opec.org/opec_web/en/press_room/702.htm", signals: ["S7","S24"], category: "market",
    extract: "headlines", interval: 120, note: "OPEC press releases — production decisions" },
  { id: "eia_weekly", url: "https://www.eia.gov/petroleum/supply/weekly/", signals: ["S7","S24"], category: "market",
    extract: "summary", interval: 120, note: "EIA weekly petroleum status — inventory draws/builds" },
  { id: "iea", url: "https://www.iea.org/news", signals: ["S7","S24","S92"], category: "market",
    extract: "headlines", interval: 120, note: "IEA — oil market reports, emergency response" },
  // Shipping
  // === UKRAINE THEATRE ===
  { id: "marcom", url: "https://mc.nato.int/media-centre/news", signals: ["U6","U5"], category: "military",
    extract: "headlines", interval: 60, note: "NATO MARCOM \u2014 maritime command, Atlantic sub activity, exercises" },
  { id: "uk_sub_threat", url: "https://www.gov.uk/search/news-and-communications?organisations%5B%5D=ministry-of-defence&keywords=submarine", signals: ["U6"], category: "military",
    extract: "headlines", interval: 60, note: "UK MOD submarine news \u2014 Faslane approaches, Russian sub incursions, Type 26 status" },
  { id: "hisutton", url: "http://www.hisutton.com/", signals: ["U6","U5"], category: "specialist",
    extract: "headlines", interval: 120, note: "HI Sutton Covert Shores \u2014 OSINT submarine tracking, the gold standard" },
  { id: "navalnews", url: "https://www.navalnews.com/feed/", signals: ["U6","U5","S23"], category: "specialist",
    extract: "headlines", interval: 60, note: "Naval News \u2014 cross-theatre maritime/sub coverage" },
  { id: "ukr_mfa", url: "https://mfa.gov.ua/en/news", signals: ["U7","U9"], category: "diplomatic",
    extract: "headlines", interval: 30, note: "Ukraine MFA — diplomatic position, ceasefire signals" },
  { id: "ukr_mod", url: "https://www.mil.gov.ua/en/news/", signals: ["U1","U10"], category: "military",
    extract: "headlines", interval: 30, note: "Ukraine MOD — frontline reports, air defence status" },
  { id: "rus_mod", url: "https://eng.mil.ru/en/news_page.htm", signals: ["U1","U5"], category: "military",
    extract: "headlines", interval: 60, note: "Russian MOD — claimed advances, strike reports" },
  { id: "isw_daily", url: "https://www.understandingwar.org/", signals: ["U1","U10"], category: "specialist",
    extract: "headlines", interval: 60, note: "ISW daily campaign assessment — frontline tempo" },
  { id: "imo", url: "https://www.imo.org/en/MediaCentre/PressBriefings/Pages/default.aspx", signals: ["S6","S30"], category: "shipping",
    extract: "headlines", interval: 120, note: "IMO — maritime safety, corridor proposals" },
  { id: "suez_auth", url: "https://www.suezcanal.gov.eg/English/Navigation/Pages/NavigationStatistics.aspx", signals: ["S97","S14"], category: "shipping",
    extract: "stats", interval: 120, note: "Suez Canal Authority — daily transit stats" },
];

// Simple content hash
function simpleHash(str) {
  let hash = 0;
  const s = str.substring(0, 5000); // hash first 5K chars only
  for (let i = 0; i < s.length; i++) {
    const chr = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

// Extract text content from HTML
function extractText(html, maxLen) {
  // Strip tags, scripts, styles
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.substring(0, maxLen || 2000);
}

async function monitorSources(store, anthropicKey, state, notifications) {
  // Load stored hashes
  let hashes = {};
  try {
    const raw = await store.get("source-hashes");
    if (raw) hashes = JSON.parse(raw);
  } catch (e) {}

  let changedSources = [];
  let checkedCount = 0;

  for (const src of MONITORED_SOURCES) {
    // Check interval — only fetch if enough time has passed
    const lastCheck = hashes[src.id]?.ts || 0;
    const intervalMs = (src.interval || 30) * 60 * 1000;
    if (Date.now() - lastCheck < intervalMs) continue;

    checkedCount++;
    try {
      const r = await fetch(src.url, {
        headers: { "User-Agent": "GodsEye/1.0 (intelligence monitor)" },
        signal: AbortSignal.timeout(8000), // 8s timeout
      });
      if (!r.ok) continue;

      const html = await r.text();
      const content = extractText(html, 3000);
      const hash = simpleHash(content);

      const oldHash = hashes[src.id]?.hash;
      hashes[src.id] = { hash, ts: Date.now() };

      if (oldHash && hash !== oldHash) {
        // Content changed!
        changedSources.push({
          id: src.id,
          note: src.note,
          signals: src.signals,
          category: src.category,
          content: content.substring(0, 1500), // truncate for Haiku
        });
        console.log("[MONITOR] Change detected:", src.id, "-", src.note);
      }
    } catch (e) {
      // Timeout or fetch error — skip silently
    }
  }

  // Save updated hashes
  try {
    await store.set("source-hashes", JSON.stringify(hashes));
  } catch (e) {}

  if (changedSources.length === 0) {
    if (checkedCount > 0) console.log("[MONITOR] Checked", checkedCount, "sources, no changes");
    return;
  }

  console.log("[MONITOR]", changedSources.length, "sources changed out of", checkedCount, "checked");

  // Send changed content to Haiku for analysis
  if (!anthropicKey) return;

  const crisisDay = Math.floor((Date.now() - new Date("2026-02-28").getTime()) / 86400000);

  // Build history context
  let monHistoryBlock = "";
  if (state.history_log && state.history_log.length > 0) {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const recent = state.history_log.filter(e => new Date(e.ts).getTime() > cutoff);
    if (recent.length > 0) {
      monHistoryBlock = "\n\nRECENT SYSTEM CHANGES (last 24hrs):\n" +
        recent.slice(-10).map(e => `${e.signal}: ${e.from||"?"}→${e.to} [${e.source}]`).join("\n") +
        "\nAvoid redundant suggestions.";
    }
  }

  const sourcePrompt = `You are the GodsEye institutional source monitor. Hormuz crisis Day ${crisisDay}.

The following institutional sources have updated content. Assess each for signal impacts.${monHistoryBlock}

${changedSources.map((s, i) => `SOURCE ${i + 1}: ${s.note} [${s.category}] (signals: ${s.signals.join(",")})
Content excerpt: ${s.content.substring(0, 500)}`).join("\n\n")}

Return ONLY a JSON array. No markdown. Each object:
{"source_id":"id","signals":[{"id":"S6","direction":"up"|"down","magnitude":"major"|"moderate"|"minor","suggested_value":N_or_null,"reason":"brief"}],"summary":"one sentence summary","calendar_event":{"date":"YYYY-MM-DD","label":"description","who":"participants","type":"summit|deadline|schedule"}|null}

IMPORTANT: For schedule-category sources (White House schedule, State travel, factbase), extract any upcoming meetings, calls, dinners, or travel that relate to Iran, Hormuz, Gulf, Pakistan, Oman, China, or energy. Return these as calendar_event objects. Presidential dinner schedules overlapping with crisis deadlines are high-priority signals.

If no signal impact, return [].`;

  try {
    const aiR = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: sourcePrompt }],
      }),
    });

    if (!aiR.ok) return;
    const aiData = await aiR.json();
    const aiText = aiData.content.map(c => c.text || "").join("");
    let sourceImpacts = [];
    try {
      sourceImpacts = JSON.parse(aiText.replace(/```json|```/g, "").trim());
      if (!Array.isArray(sourceImpacts)) sourceImpacts = [];
    } catch (e) { return; }

    // Auto-apply major impacts from institutional sources
    for (const imp of sourceImpacts) {
      if (!imp.signals) continue;
      for (const sig of imp.signals) {
        if (sig.magnitude === "major" && sig.suggested_value != null) {
          const old = state.signal_values[sig.id];
          state.signal_values[sig.id] = sig.suggested_value;
          state.history_log.push({
            ts: new Date().toISOString(),
            signal: sig.id,
            from: old || null,
            to: sig.suggested_value,
            source: "monitor:" + (imp.source_id || "unknown"),
            reason: sig.reason,
          });
          state.alerts.unshift({
            priority: "CRITICAL",
            text: `MONITOR: ${imp.source_id || "source"} — ${sig.id} → ${sig.suggested_value} (was ${old || "?"}) — ${sig.reason}`,
          });
          notifications.push(`[${imp.source_id}] ${sig.id}: ${old || "?"}→${sig.suggested_value}`);
        }
      }
      // Log summary as alert even if no auto-apply
      if (imp.summary) {
        state.alerts.unshift({
          priority: "INFO",
          text: `MONITOR: ${imp.source_id || "source"} updated — ${imp.summary}`,
        });
      }
      // Calendar event detected from schedule sources
      if (imp.calendar_event && imp.calendar_event.date && imp.calendar_event.label) {
        const ce = imp.calendar_event;
        state.alerts.unshift({
          priority: "WARNING",
          text: `SCHEDULE: ${ce.date} — ${ce.label} (${ce.who || "?"}) [from ${imp.source_id}]`,
        });
        notifications.push(`[CALENDAR] ${ce.date}: ${ce.label}`);
        console.log("[MONITOR] Calendar event detected:", ce.date, ce.label);
      }
    }

    // Trim and save
    if (state.alerts.length > 30) state.alerts.length = 30;
    if (state.history_log.length > 200) state.history_log = state.history_log.slice(-200);
    state._meta.updated = new Date().toISOString();
    await store.set("current", JSON.stringify(state));

    console.log("[MONITOR] Analysis complete.", sourceImpacts.length, "impacts from", changedSources.length, "sources");

  } catch (e) {
    console.warn("[MONITOR] Analysis failed:", e.message);
  }
}

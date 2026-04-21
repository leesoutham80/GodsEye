// netlify/functions/watchdog.js
// DUAL MODE: Runs every 15min on schedule + can be called manually via HTTP
const { schedule } = require("@netlify/functions");
const { getStore } = require("@netlify/blobs");
const { classifyHeadline } = require("./godseye-classifier");
const { SIGNAL_CLASSIFIER_CONFIG, determineDirection, calculateMagnitude } = require("./classifier-config");

// Core watchdog logic
async function runWatchdog(triggerSource) {
  console.log(`[WATCHDOG] Running ${triggerSource} analysis`, new Date().toISOString());

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const newsKey = process.env.NEWSAPI_KEY;

  if (!anthropicKey) {
    console.warn("[WATCHDOG] No ANTHROPIC_API_KEY");
    return { statusCode: 200 };
  }

  try {
    // Fetch news
    let headlines = [];

    async function fetchRSS(url, name, max) {
      const items = [];
      try {
        const r = await fetch(url, { headers: { "User-Agent": "GodsEye/2.0" }, signal: AbortSignal.timeout(5000) });
        if (!r.ok) return items;
        const xml = await r.text();
        const matches = xml.match(/<item>[\s\S]*?<\/item>/g) || xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
        matches.slice(0, max || 6).forEach(item => {
          const tm = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title[^>]*>(.*?)<\/title>/);
          if (tm) { 
            const t = tm[1].replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").substring(0, 150); 
            if (t && t.length > 15) items.push({ text: t, origin: name }); 
          }
        });
      } catch (e) {}
      return items;
    }

    async function fetchNewsAPI() {
      if (!newsKey) return [];
      const items = [];
      const queries = ["Iran+war+Hormuz", "oil+price+crude", "Iran+ceasefire"];
      for (const q of queries) {
        try {
          const r = await fetch(`https://newsapi.org/v2/everything?q=${q}&sortBy=publishedAt&pageSize=5&language=en&apiKey=${newsKey}`);
          if (r.ok) { 
            const d = await r.json(); 
            if (d.articles) d.articles.forEach(a => { 
              const t = a.title?.replace(/\s*[-–—|]\s*[^-–—|]+$/, "").substring(0, 140); 
              if (t) items.push({ text: t, origin: "newsapi" }); 
            }); 
          }
        } catch (e) {}
      }
      return items;
    }

    async function fetchReddit() {
      const items = [];
      for (const sub of ["worldnews", "geopolitics", "energy"]) {
        try {
          const r = await fetch(`https://www.reddit.com/r/${sub}/search.json?q=iran+OR+hormuz+OR+ceasefire&sort=new&t=day&limit=8`, { headers: { "User-Agent": "GodsEye/2.0" }, signal: AbortSignal.timeout(4000) });
          if (!r.ok) continue;
          const d = await r.json();
          (d?.data?.children || []).forEach(p => { 
            const t = p.data?.title?.substring(0, 140); 
            if (t && (p.data?.score || 0) > 3) items.push({ text: t, origin: "reddit" }); 
          });
        } catch (e) {}
      }
      return items;
    }

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
    ]);

    const all = results.flat();
    all.forEach(a => { const c = classifyHeadline(a.text); a.tag = c.tag; a.intensity = c.intensity; });

    const seen = new Set();
    headlines = all.filter(h => {
      const key = h.text.substring(0, 35).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 30);

    const activeSources = results.filter(r => r.length > 0).length;
    console.log(`[WATCHDOG] ${activeSources}/10 sources active, ${all.length} raw → ${headlines.length} unique`);

    if (headlines.length === 0) {
      console.log("[WATCHDOG] No headlines found");
      return { statusCode: 200, body: JSON.stringify({ message: "No headlines" }) };
    }

    // Match headlines to signals
    const detectedSignals = [];
    
    for (const headline of headlines) {
      const headlineLower = headline.text.toLowerCase();
      
      for (const [signalId, config] of Object.entries(SIGNAL_CLASSIFIER_CONFIG)) {
        if (config.auto_calculated) continue;
        
        const keywordMatch = config.keywords?.some(kw => headlineLower.includes(kw.toLowerCase()));
        if (!keywordMatch) continue;
        
        const direction = determineDirection(signalId, headline.text);
        if (!direction || direction === 'mixed') continue;
        
        const magnitude = calculateMagnitude(signalId, headline.text, 1.0, {});
        
        detectedSignals.push({ headline: headline.text, signal: signalId, direction, magnitude, config });
      }
    }

    console.log(`[WATCHDOG] Detected ${detectedSignals.length} signal impacts from ${headlines.length} headlines`);

    if (detectedSignals.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: "No signal impacts detected", headlines: headlines.length }) };
    }

    // Read state
    const store = getStore({
      name: "godseye-state",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.GogdsEye_Blobs
    });
    let state = null;
    try {
      const raw = await store.get("current");
      if (raw) state = JSON.parse(raw);
    } catch (e) {}

    if (!state) {
      state = { _meta: {}, signal_values: {}, scenario_probs: {}, alerts: [], history_log: [] };
    }

    // Apply changes
    let appliedCount = 0;
    const notifications = [];

    for (const detection of detectedSignals) {
      const config = detection.config;
      const currentValue = state.signal_values[detection.signal] || 50;
      
      let delta = detection.magnitude;
      if (detection.direction === 'down') delta = -delta;
      
      let newValue = Math.max(0, Math.min(100, currentValue + delta));
      
      if (Math.abs(newValue - currentValue) >= 5 && config.auto_apply) {
        state.signal_values[detection.signal] = Math.round(newValue);
        
        state.history_log.push({
          ts: new Date().toISOString(),
          signal: detection.signal,
          from: currentValue,
          to: Math.round(newValue),
          source: `watchdog-${triggerSource}`,
          reason: detection.headline.substring(0, 100)
        });
        
        state.alerts.unshift({
          priority: "AUTO",
          text: `${detection.signal} ${detection.direction === 'up' ? '↑' : '↓'} ${currentValue}→${Math.round(newValue)} — ${detection.headline.substring(0, 80)}`
        });
        
        notifications.push(`${detection.signal}: ${currentValue}→${Math.round(newValue)}`);
        appliedCount++;
        
        console.log(`[WATCHDOG] AUTO-APPLIED ${detection.signal}: ${currentValue}→${Math.round(newValue)}`);
      }
    }

    if (state.alerts.length > 50) state.alerts.length = 50;
    if (state.history_log.length > 300) state.history_log = state.history_log.slice(-300);
    
    state._meta.updated = new Date().toISOString();
    state._meta.watchdog_last_run = new Date().toISOString();
    state._meta.watchdog_trigger = triggerSource;

    try {
      await store.set("current", JSON.stringify(state));
      console.log(`[WATCHDOG] State saved. Applied ${appliedCount} auto-updates`);
    } catch (e) {
      console.error("[WATCHDOG] Failed to save state:", e.message);
    }

    if (appliedCount > 0 && notifications.length > 0) {
      const notifyText = `GodsEye Watchdog (${triggerSource}): ${appliedCount} signals\n${notifications.slice(0, 5).join('\n')}`;
      
      try {
        await fetch("https://ntfy.sh/godseye-alerts", {
          method: "POST",
          headers: { "Title": "Signal Updates", "Priority": "default" },
          body: notifyText
        });
      } catch (e) {}
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        trigger: triggerSource,
        headlines: headlines.length,
        detected: detectedSignals.length,
        applied: appliedCount,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error("[WATCHDOG] Fatal error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}

// Scheduled version - runs every 15 minutes
exports.handler = schedule("*/15 * * * *", async (event) => {
  return await runWatchdog("scheduled");
});

// Manual HTTP version - call anytime via /.netlify/functions/watchdog
exports.handler = async (event, context) => {
  // If called via HTTP, run as manual trigger
  if (event.httpMethod) {
    return await runWatchdog("manual");
  }
  // Otherwise it's the scheduled cron trigger
  return await runWatchdog("scheduled");
};

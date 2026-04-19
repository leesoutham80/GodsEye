// netlify/functions/news.js
// GodsEye Multi-Source Intelligence Feed v2.0
// 20+ direct RSS feeds + NewsAPI + Google News + Reddit + Telegram
// All free. All classified with intensity scoring.

const { classifyHeadline } = require("./godseye-classifier");

function cleanTitle(t) {
  if (!t) return null;
  return t.replace(/\s*[-–—|]\s*[^-–—|]+$/, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").substring(0, 160).trim();
}

// === RSS FEED DEFINITIONS ===
const RSS_FEEDS = [
  // ESSENTIAL — major wire services and global outlets
  { id: "aljazeera",     url: "https://www.aljazeera.com/xml/rss/all.xml",                    name: "Al Jazeera",       cat: "essential", max: 10 },
  { id: "reuters_world", url: "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best",  name: "Reuters",          cat: "essential", max: 8 },
  { id: "bbc_world",     url: "https://feeds.bbci.co.uk/news/world/rss.xml",                  name: "BBC World",        cat: "essential", max: 8 },
  { id: "ap_topnews",    url: "https://rsshub.app/apnews/topics/world-news",                  name: "AP News",          cat: "essential", max: 8 },
  { id: "france24",      url: "https://www.france24.com/en/rss",                               name: "France24",         cat: "essential", max: 6 },

  // REGIONAL — Middle East / Gulf specific
  { id: "iran_intl",     url: "https://www.iranintl.com/en/feed",                              name: "Iran International", cat: "regional", max: 8 },
  { id: "middleeasteye", url: "https://www.middleeasteye.net/rss",                             name: "Middle East Eye",    cat: "regional", max: 6 },
  { id: "the_national",  url: "https://www.thenationalnews.com/arc/outboundfeeds/rss/",        name: "The National",       cat: "regional", max: 6 },
  { id: "times_israel",  url: "https://www.timesofisrael.com/feed/",                           name: "Times of Israel",    cat: "regional", max: 6 },
  { id: "arab_news",     url: "https://www.arabnews.com/rss.xml",                              name: "Arab News",          cat: "regional", max: 6 },

  // SPECIALIST — military, shipping, oil, OSINT
  { id: "warzone",       url: "https://www.thedrive.com/the-war-zone/feed",                    name: "The War Zone",       cat: "specialist", max: 6 },
  { id: "gcaptain",      url: "https://gcaptain.com/feed/",                                    name: "gCaptain",           cat: "specialist", max: 6 },
  { id: "splash247",     url: "https://splash247.com/feed/",                                   name: "Splash247",          cat: "specialist", max: 5 },
  { id: "oilprice",      url: "https://oilprice.com/rss/main",                                 name: "OilPrice",           cat: "specialist", max: 5 },
  { id: "hellenicship",  url: "https://www.hellenicshippingnews.com/feed/",                    name: "Hellenic Shipping",  cat: "specialist", max: 5 },
  { id: "seanews",       url: "https://www.seanews.com.tr/rss.xml",                            name: "SeaNews",            cat: "specialist", max: 4 },
  { id: "bellingcat",    url: "https://www.bellingcat.com/feed/",                               name: "Bellingcat",         cat: "specialist", max: 4 },

  // UKRAINE THEATRE
  { id: "kyiv_indep",   url: "https://kyivindependent.com/feed/",                                  name: "Kyiv Independent",   cat: "regional", max: 6 },
  { id: "ukrainska_pr", url: "https://www.pravda.com.ua/eng/rss/",                                 name: "Ukrainska Pravda",   cat: "regional", max: 5 },
  { id: "meduza",       url: "https://meduza.io/rss/en/all",                                       name: "Meduza",             cat: "regional", max: 5 },
  { id: "isw",          url: "https://www.understandingwar.org/rss.xml",                           name: "ISW",                cat: "specialist", max: 4 },

  // GOOGLE NEWS — targeted search queries
  { id: "gn_hormuz",     url: "https://news.google.com/rss/search?q=Iran+war+Hormuz+strait&hl=en&gl=US&ceid=US:en", name: "GN:Hormuz", cat: "aggregator", max: 8 },
  { id: "gn_oil",        url: "https://news.google.com/rss/search?q=oil+price+Brent+crude+2026&hl=en&gl=US&ceid=US:en", name: "GN:Oil", cat: "aggregator", max: 6 },
  { id: "gn_ceasefire",  url: "https://news.google.com/rss/search?q=Iran+ceasefire+peace+talks&hl=en&gl=US&ceid=US:en", name: "GN:Ceasefire", cat: "aggregator", max: 6 },
  { id: "gn_shipping",   url: "https://news.google.com/rss/search?q=shipping+tanker+hormuz+strait&hl=en&gl=US&ceid=US:en", name: "GN:Shipping", cat: "aggregator", max: 5 },
  { id: "gn_military",   url: "https://news.google.com/rss/search?q=Iran+strike+military+CENTCOM&hl=en&gl=US&ceid=US:en", name: "GN:Military", cat: "aggregator", max: 5 },
];

// === GENERIC RSS PARSER ===
async function fetchRSS(feed) {
  const articles = [];
  try {
    const r = await fetch(feed.url, {
      headers: { "User-Agent": "GodsEye/2.0 (intelligence dashboard)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return articles;
    const xml = await r.text();

    // Parse items from RSS/Atom
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    items.slice(0, feed.max || 8).forEach(item => {
      // Title extraction — try CDATA first, then plain
      const titleMatch =
        item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
        item.match(/<title[^>]*>(.*?)<\/title>/);
      // Date extraction
      const dateMatch =
        item.match(/<pubDate>(.*?)<\/pubDate>/) ||
        item.match(/<published>(.*?)<\/published>/) ||
        item.match(/<updated>(.*?)<\/updated>/);

      if (titleMatch) {
        const title = cleanTitle(titleMatch[1]);
        if (title && title.length > 15) {
          articles.push({
            text: title,
            source: feed.name,
            ts: dateMatch ? dateMatch[1] : null,
            origin: feed.id,
            cat: feed.cat,
          });
        }
      }
    });
  } catch (e) {
    // Timeout or parse error — skip silently
  }
  return articles;
}

// === SOURCE: NewsAPI ===
async function fetchNewsAPI(apiKey) {
  if (!apiKey) return [];
  const articles = [];
  const queries = ["Iran+war+Hormuz", "oil+price+crude+Brent", "shipping+strait+tanker", "Iran+ceasefire+negotiations"];
  for (const q of queries) {
    try {
      const r = await fetch(`https://newsapi.org/v2/everything?q=${q}&sortBy=publishedAt&pageSize=5&language=en&apiKey=${apiKey}`);
      if (r.ok) {
        const d = await r.json();
        if (d.articles) d.articles.forEach(a => {
          const title = cleanTitle(a.title);
          if (title) articles.push({ text: title, source: a.source?.name || "NewsAPI", ts: a.publishedAt, origin: "newsapi", cat: "aggregator" });
        });
      }
    } catch (e) {}
  }
  return articles;
}

// === SOURCE: Reddit ===
async function fetchReddit() {
  const articles = [];
  const subs = [
    { sub: "worldnews", q: "iran+OR+hormuz+OR+ceasefire" },
    { sub: "geopolitics", q: "iran+OR+hormuz+OR+strait" },
    { sub: "energy", q: "oil+OR+brent+OR+hormuz" },
    { sub: "shipping", q: "hormuz+OR+tanker+OR+strait" },
  ];
  for (const s of subs) {
    try {
      const r = await fetch(`https://www.reddit.com/r/${s.sub}/search.json?q=${s.q}&sort=new&t=day&limit=8`, {
        headers: { "User-Agent": "GodsEye/2.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) continue;
      const d = await r.json();
      (d?.data?.children || []).forEach(p => {
        const t = cleanTitle(p.data?.title);
        const sc = p.data?.score || 0;
        if (t && sc > 3) articles.push({ text: t, source: `r/${s.sub}`, ts: p.data.created_utc ? new Date(p.data.created_utc * 1000).toISOString() : null, origin: "reddit", cat: "social" });
      });
    } catch (e) {}
  }
  return articles;
}

// === SOURCE: Telegram public channels ===
async function fetchTelegram() {
  const articles = [];
  const channels = ["s/inikiforova", "s/Middle_East_Spec", "s/sentdefender"];
  for (const ch of channels) {
    try {
      const r = await fetch(`https://t.me/${ch}`, {
        headers: { "User-Agent": "GodsEye/2.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) continue;
      const html = await r.text();
      const msgs = html.match(/class="tgme_widget_message_text"[^>]*>(.*?)<\/div>/gs) || [];
      msgs.slice(0, 5).forEach(msg => {
        const text = msg.replace(/<[^>]+>/g, "").trim();
        const clean = cleanTitle(text);
        if (clean && clean.length > 20) {
          const lower = clean.toLowerCase();
          if (lower.includes("iran") || lower.includes("hormuz") || lower.includes("strike") || lower.includes("oil") || lower.includes("ceasefire") || lower.includes("irgc") || lower.includes("brent") || lower.includes("tanker") || lower.includes("pilot") || lower.includes("rescue") || lower.includes("nuclear") || lower.includes("shipping")) {
            articles.push({ text: clean, source: "Telegram", ts: new Date().toISOString(), origin: "telegram", cat: "osint" });
          }
        }
      });
    } catch (e) {}
  }
  return articles;
}

// === MAIN HANDLER ===
exports.handler = async function(event, context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=120",
  };

  try {
    const apiKey = process.env.NEWSAPI_KEY;

    // Fetch ALL sources in parallel — batch RSS feeds
    const rssPromises = RSS_FEEDS.map(feed => fetchRSS(feed).catch(() => []));
    const otherPromises = [
      fetchNewsAPI(apiKey).catch(() => []),
      fetchReddit().catch(() => []),
      fetchTelegram().catch(() => []),
    ];

    const results = await Promise.all([...rssPromises, ...otherPromises]);

    // Flatten all results
    let all = results.flat();

    // Deduplicate by title similarity (first 40 chars lowercase, stripped)
    const seen = new Set();
    all = all.filter(a => {
      const key = a.text.substring(0, 40).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by timestamp (newest first)
    all.sort((a, b) => {
      const ta = a.ts ? new Date(a.ts).getTime() : 0;
      const tb = b.ts ? new Date(b.ts).getTime() : 0;
      return tb - ta;
    });

    // Take top 30
    const top = all.slice(0, 30);

    // Classify each with full intensity framework
    const news = top.map(a => {
      const c = classifyHeadline(a.text);
      return {
        tag: c.tag,
        intensity: c.intensity,
        text: a.text,
        source: a.source || "",
        ts: a.ts,
        origin: a.origin,
        cat: a.cat,
      };
    });

    // Source counts
    const sourceCounts = {};
    results.forEach((r, i) => {
      const id = i < RSS_FEEDS.length ? RSS_FEEDS[i].id : ["newsapi", "reddit", "telegram"][i - RSS_FEEDS.length];
      if (r.length > 0) sourceCounts[id] = r.length;
    });

    const totalRaw = all.length + (results.flat().length - all.length); // before dedup
    console.log("[NEWS] " + Object.keys(sourceCounts).length + " active sources, " + all.length + " unique headlines, " + news.length + " returned");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ts: Date.now(),
        source: "multi-v2",
        active_sources: Object.keys(sourceCounts).length,
        total_feeds: RSS_FEEDS.length + 3,
        sources: sourceCounts,
        news,
      }),
    };

  } catch (err) {
    console.error("News fetch error:", err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ts: Date.now(), source: "error", news: [], error: err.message }),
    };
  }
};

// LEBANON FEEDS (manual splice point not found — append):
// ,
// // === LEBANON SUB-CLUSTER FEEDS ===
// {name:"L'Orient Today",url:"https://today.lorientlejour.com/feed",type:"rss",tags:["lebanon"],weight:1.0},
// {name:"Naharnet",url:"https://www.naharnet.com/rss.xml",type:"rss",tags:["lebanon"],weight:0.9},
// {name:"Al-Akhbar Lebanon",url:"https://al-akhbar.com/rss.xml",type:"rss",tags:["lebanon"],weight:0.8},
// {name:"ToI Northern Desk",url:"https://www.timesofisrael.com/topic/northern-front/feed/",type:"rss",tags:["lebanon","conflict"],weight:1.0},
// {name:"Al-Manar",url:"https://english.almanar.com.lb/feed",type:"rss",tags:["lebanon"],weight:0.7},
// {name:"UNIFIL Press",url:"https://unifil.unmissions.org/news/feed",type:"rss",tags:["lebanon"],weight:1.2},
// === GAZA SUB-CLUSTER FEEDS (Al Jazeera already in main feeds — tags gaza via classifier) ===

{name:"Al Jazeera Arabic",url:"https://www.aljazeera.net/feed/rss2",type:"rss",tags:["gaza","lebanon","conflict"],weight:1.1},{name:"OCHA OPT",url:"https://www.ochaopt.org/rss.xml",type:"rss",tags:["gaza"],weight:1.2},
{name:"UNRWA Updates",url:"https://www.unrwa.org/newsroom/rss.xml",type:"rss",tags:["gaza"],weight:1.1},
{name:"Euro-Med Monitor",url:"https://euromedmonitor.org/en/feed",type:"rss",tags:["gaza"],weight:0.9},
// === ISRAEL SUB-CLUSTER FEEDS ===
{name:"Times of Israel Main",url:"https://www.timesofisrael.com/feed/",type:"rss",tags:["israel","conflict"],weight:1.0},
{name:"Ynet English",url:"https://www.ynetnews.com/RSS/",type:"rss",tags:["israel"],weight:0.9},
{name:"Jerusalem Post",url:"https://www.jpost.com/rss/rssfeedsfrontpage.aspx",type:"rss",tags:["israel"],weight:0.9},
{name:"Haaretz English",url:"https://www.haaretz.com/cmlink/1.4565867",type:"rss",tags:["israel"],weight:1.0},
{name:"IDF Spokesperson",url:"https://www.idf.il/en/mini-sites/press-releases/rss/",type:"rss",tags:["israel","conflict"],weight:1.1}
// netlify/functions/prices.js
// Live price feed for GodsEye dashboard
// Proxies Yahoo Finance — no API key required
// Falls back gracefully on any failure

const SYMBOL_MAP = {
  // Commodities
  "BRENT":    { yf: "BZ=F",       fmt: "$",  dec: 2 },
  "WTI":      { yf: "CL=F",       fmt: "$",  dec: 2 },
  "TTF":      { yf: "TTF=F",      fmt: "€",  dec: 2 },
  "GOLD":     { yf: "GC=F",       fmt: "$",  dec: 0 },
  "NAT GAS":  { yf: "NG=F",       fmt: "$",  dec: 2 },
  "COPPER":   { yf: "HG=F",       fmt: "$",  dec: 0 },
  "WHEAT":    { yf: "ZW=F",       fmt: "$",  dec: 0 },

  // Crypto
  "BTC":      { yf: "BTC-USD",    fmt: "$",  dec: 0 },

  // Forex
  "DXY":      { yf: "DX-Y.NYB",   fmt: "",   dec: 2 },
  "EUR/USD":  { yf: "EURUSD=X",   fmt: "",   dec: 4 },
  "GBP/USD":  { yf: "GBPUSD=X",   fmt: "",   dec: 4 },
  "USD/JPY":  { yf: "JPY=X",      fmt: "",   dec: 1 },
  "USD/CNY":  { yf: "CNY=X",      fmt: "",   dec: 2 },

  // Equities
  "BA.L":     { yf: "BA.L",       fmt: "",   dec: 0, suf: "p" },
  "OCDO.L":   { yf: "OCDO.L",     fmt: "",   dec: 0, suf: "p" },
  "S&P 500":  { yf: "^GSPC",      fmt: "",   dec: 0 },
  "FTSE 100": { yf: "^FTSE",      fmt: "",   dec: 0 },
  "STOXX 600": { yf: "^STOXX",    fmt: "",   dec: 0 },
  "NIKKEI":   { yf: "^N225",      fmt: "",   dec: 0 },
  "SSE COMP": { yf: "000001.SS",  fmt: "",   dec: 0 },
  "VIX":      { yf: "^VIX",       fmt: "",   dec: 1 },
  "USO":      { yf: "USO",        fmt: "$",  dec: 2 },
  "XLE":      { yf: "XLE",        fmt: "$",  dec: 2 },
  "EQNR":     { yf: "EQNR",       fmt: "$",  dec: 2 },
  "SHEL":     { yf: "SHEL",       fmt: "$",  dec: 2 },
  "BP":       { yf: "BP",         fmt: "$",  dec: 2 },
  "STNG":     { yf: "STNG",       fmt: "$",  dec: 2 },
  "FRO":      { yf: "FRO",        fmt: "$",  dec: 2 },
};

// No mapping for VLCC TD3C — kept cached in dashboard

exports.handler = async function(event, context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=30",
  };

  try {
    const symbols = Object.values(SYMBOL_MAP).map(s => s.yf).join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;

    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GodsEye/1.0)",
      },
    });

    if (!resp.ok) {
      // Try v8 chart fallback for individual symbols
      return await fallbackIndividual(headers);
    }

    const data = await resp.json();
    const quotes = data?.quoteResponse?.result || [];

    // Build reverse lookup: yf symbol -> dashboard name
    const yfToName = {};
    for (const [name, cfg] of Object.entries(SYMBOL_MAP)) {
      yfToName[cfg.yf] = name;
    }

    const result = { ts: Date.now(), source: "yahoo", prices: {} };

    for (const q of quotes) {
      const name = yfToName[q.symbol];
      if (!name) continue;
      const cfg = SYMBOL_MAP[name];

      const price = q.regularMarketPrice;
      const chg = q.regularMarketChangePercent;
      if (price == null || chg == null) continue;

      // Format price
      let pStr;
      if (cfg.dec === 0) {
        pStr = cfg.fmt + price.toLocaleString("en-US", { maximumFractionDigits: 0 });
      } else {
        pStr = cfg.fmt + price.toFixed(cfg.dec);
      }
      if (cfg.suf) pStr += cfg.suf;

      // Format change
      const sign = chg >= 0 ? "+" : "";
      const cStr = sign + chg.toFixed(2) + "%";

      result.prices[name] = {
        p: pStr,
        c: cStr,
        u: chg >= 0 ? 1 : 0,
        raw: price,
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (err) {
    console.error("Price fetch error:", err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ts: Date.now(), source: "error", prices: {}, error: err.message }),
    };
  }
};

// Fallback: fetch top-priority symbols individually via v8 chart API
async function fallbackIndividual(headers) {
  const priority = ["BRENT", "WTI", "GOLD", "BTC", "DXY", "VIX", "S&P 500"];
  const result = { ts: Date.now(), source: "yahoo-fallback", prices: {} };

  const fetches = priority.map(async (name) => {
    const cfg = SYMBOL_MAP[name];
    if (!cfg) return;
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cfg.yf)}?range=1d&interval=1d`;
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GodsEye/1.0)" },
      });
      if (!r.ok) return;
      const d = await r.json();
      const meta = d?.chart?.result?.[0]?.meta;
      if (!meta) return;

      const price = meta.regularMarketPrice;
      const prev = meta.chartPreviousClose || meta.previousClose;
      if (!price) return;

      const chgPct = prev ? ((price - prev) / prev) * 100 : 0;
      let pStr;
      if (cfg.dec === 0) {
        pStr = cfg.fmt + Math.round(price).toLocaleString("en-US");
      } else {
        pStr = cfg.fmt + price.toFixed(cfg.dec);
      }
      if (cfg.suf) pStr += cfg.suf;

      result.prices[name] = {
        p: pStr,
        c: (chgPct >= 0 ? "+" : "") + chgPct.toFixed(2) + "%",
        u: chgPct >= 0 ? 1 : 0,
        raw: price,
      };
    } catch (e) { /* skip */ }
  });

  await Promise.all(fetches);
  return { statusCode: 200, headers, body: JSON.stringify(result) };
}

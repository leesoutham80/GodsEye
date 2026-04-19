// netlify/functions/maritime.js
// GodsEye Maritime Intelligence Feed
// FREE: Global Fishing Watch API, VesselFinder public scrape, OSINT transit counts
// PAID SLOT: Datalastic, MarineTraffic, Spire (activate with env vars)
// Feeds: S3 Transit Count, S14 Anchorage, S17 Route Plotting, S32 AIS Hesitation,
//        S46 Cape Diversion, S51 Dark Shipping, S84 Fishing Denial

const { getStore } = require("@netlify/blobs");

// === Hormuz bounding box ===
const HORMUZ = { latMin: 25.5, latMax: 27.5, lonMin: 55.5, lonMax: 57.5 };
const FUJAIRAH = { latMin: 24.5, latMax: 25.8, lonMin: 56.0, lonMax: 56.8 };
const CAPE = { latMin: -35.5, latMax: -33.0, lonMin: 17.0, lonMax: 21.0 };

// === SOURCE 1: Global Fishing Watch (FREE) ===
// Tracks fishing vessel activity — directly feeds S84
async function fetchGFW() {
  const token = process.env.GFW_TOKEN; // Free registration at globalfishingwatch.org/apis
  if (!token) return { source: "gfw", available: false, data: null };

  try {
    // Query fishing activity in Gulf/Hormuz region last 30 days
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    const url = `https://gateway.api.globalfishingwatch.org/v3/4wings/report?datasets[0]=public-global-fishing-effort:latest&date-range=${startDate},${endDate}&spatial-resolution=low&temporal-resolution=monthly&group-by=flag&region-source=user-json&region-id=hormuz`;

    const r = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!r.ok) {
      // Try simpler fishing hours endpoint
      const simpleUrl = `https://gateway.api.globalfishingwatch.org/v3/4wings/report?datasets[0]=public-global-fishing-effort:latest&date-range=${startDate},${endDate}&spatial-resolution=low&temporal-resolution=monthly`;
      const r2 = await fetch(simpleUrl, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!r2.ok) return { source: "gfw", available: true, error: "API " + r2.status, data: null };
      const d2 = await r2.json();
      return { source: "gfw", available: true, data: d2 };
    }

    const data = await r.json();
    return { source: "gfw", available: true, data };
  } catch (e) {
    return { source: "gfw", available: true, error: e.message, data: null };
  }
}

// === SOURCE 2: VesselFinder Public Density (FREE, scrape) ===
async function fetchVesselDensity() {
  try {
    // VesselFinder public vessel count from their density page
    const url = "https://www.vesselfinder.com/api/pub/vesselsonmap?bbox=55.0,25.0,58.0,28.0&zoom=8&mmsi=0&show_names=0";
    const r = await fetch(url, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.vesselfinder.com/",
      },
    });

    if (!r.ok) {
      // Fallback — try the public map page for vessel count
      return { source: "vesselfinder", available: false, error: "API blocked", data: null };
    }

    const data = await r.json();
    const vessels = Array.isArray(data) ? data : [];
    
    // Count by type in Hormuz area
    let tankers = 0, cargo = 0, military = 0, other = 0;
    vessels.forEach(v => {
      const lat = v[0] || v.LAT || 0;
      const lon = v[1] || v.LON || 0;
      const type = v[4] || v.TYPE || 0;
      if (lat >= HORMUZ.latMin && lat <= HORMUZ.latMax && lon >= HORMUZ.lonMin && lon <= HORMUZ.lonMax) {
        if (type >= 80 && type <= 89) tankers++;
        else if (type >= 70 && type <= 79) cargo++;
        else if (type >= 35 && type <= 39) military++;
        else other++;
      }
    });

    return {
      source: "vesselfinder",
      available: true,
      data: {
        hormuz_total: tankers + cargo + military + other,
        tankers, cargo, military, other,
        total_region: vessels.length,
      },
    };
  } catch (e) {
    return { source: "vesselfinder", available: false, error: e.message, data: null };
  }
}

// === SOURCE 3: PAID SLOT — Datalastic ===
async function fetchDatalastic() {
  const apiKey = process.env.DATALASTIC_KEY;
  if (!apiKey) return { source: "datalastic", available: false, tier: "paid", data: null };

  try {
    // Vessel positions in Hormuz area
    const url = `https://api.datalastic.com/api/v0/vessel_find?api-key=${apiKey}&lat_min=${HORMUZ.latMin}&lat_max=${HORMUZ.latMax}&lon_min=${HORMUZ.lonMin}&lon_max=${HORMUZ.lonMax}`;
    const r = await fetch(url);
    if (!r.ok) return { source: "datalastic", available: true, error: "API " + r.status, data: null };
    const data = await r.json();
    return { source: "datalastic", available: true, tier: "paid", data };
  } catch (e) {
    return { source: "datalastic", available: true, error: e.message, data: null };
  }
}

// === SOURCE 4: PAID SLOT — MarineTraffic ===
async function fetchMarineTraffic() {
  const apiKey = process.env.MARINETRAFFIC_KEY;
  if (!apiKey) return { source: "marinetraffic", available: false, tier: "paid", data: null };

  try {
    const url = `https://services.marinetraffic.com/api/exportvessels/v:8/${apiKey}/MINLAT:${HORMUZ.latMin}/MAXLAT:${HORMUZ.latMax}/MINLON:${HORMUZ.lonMin}/MAXLON:${HORMUZ.lonMax}/protocol:jsono`;
    const r = await fetch(url);
    if (!r.ok) return { source: "marinetraffic", available: true, error: "API " + r.status, data: null };
    const data = await r.json();
    return { source: "marinetraffic", available: true, tier: "paid", data };
  } catch (e) {
    return { source: "marinetraffic", available: true, error: e.message, data: null };
  }
}

// === SIGNAL CALCULATOR ===
function calculateSignals(sources) {
  const signals = {};

  // S84 Fishing Ground Denial — from GFW
  const gfw = sources.find(s => s.source === "gfw");
  if (gfw && gfw.data) {
    // If fishing effort data is available, compare current vs pre-crisis
    signals.S84 = { available: true, source: "gfw", note: "Global Fishing Watch data loaded" };
  }

  // S3 Transit Count — from vessel density
  const vf = sources.find(s => s.source === "vesselfinder");
  if (vf && vf.data) {
    const total = vf.data.hormuz_total || 0;
    // Pre-crisis Hormuz had ~50-80 vessels visible at any time
    // Current closure should show near-zero commercial
    const s3val = Math.min(100, Math.max(0, Math.round((total / 60) * 100)));
    signals.S3 = { value: s3val, source: "vesselfinder", vessels: total, detail: vf.data };
  }

  // Paid sources override free
  const dl = sources.find(s => s.source === "datalastic");
  if (dl && dl.data) {
    const vessels = dl.data.data?.length || 0;
    signals.S3 = { value: Math.min(100, Math.round((vessels / 60) * 100)), source: "datalastic", vessels, detail: dl.data };
  }

  const mt = sources.find(s => s.source === "marinetraffic");
  if (mt && mt.data) {
    const vessels = mt.data.length || 0;
    signals.S3 = { value: Math.min(100, Math.round((vessels / 60) * 100)), source: "marinetraffic", vessels, detail: mt.data };
  }

  return signals;
}

// === MAIN HANDLER ===
exports.handler = async function(event, context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=300",
  };

  try {
    // Fetch all sources in parallel
    const sources = await Promise.all([
      fetchGFW().catch(e => ({ source: "gfw", available: false, error: e.message })),
      fetchVesselDensity().catch(e => ({ source: "vesselfinder", available: false, error: e.message })),
      fetchDatalastic().catch(e => ({ source: "datalastic", available: false, error: e.message })),
      fetchMarineTraffic().catch(e => ({ source: "marinetraffic", available: false, error: e.message })),
    ]);

    const signals = calculateSignals(sources);

    // Source status summary
    const status = sources.map(s => ({
      source: s.source,
      available: s.available,
      tier: s.tier || "free",
      hasData: !!s.data,
      error: s.error || null,
    }));

    console.log("[MARITIME] Sources:", status.map(s => s.source + ":" + (s.hasData ? "OK" : s.error || "no-key")).join(", "));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ts: Date.now(),
        sources: status,
        signals,
        paid_slots: {
          datalastic: !process.env.DATALASTIC_KEY ? "Add DATALASTIC_KEY to activate ($50/mo)" : "active",
          marinetraffic: !process.env.MARINETRAFFIC_KEY ? "Add MARINETRAFFIC_KEY to activate ($500/mo)" : "active",
        },
      }),
    };

  } catch (err) {
    console.error("[MARITIME] Error:", err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ts: Date.now(), sources: [], signals: {}, error: err.message }),
    };
  }
};

// GodsEye vessels — live Hormuz-box vessel positions via TankerMap open API
// Proxies + caches (15 min) so the dashboard never hammers their server.
// Fail-soft: on upstream failure serves last cached snapshot with stale flag.

// uses built-in fetch (Node 18+); node-fetch is NOT a declared dependency

const BBOX = 'lat_min=23.0&lat_max=30.8&lon_min=47.0&lon_max=60.5';
const CACHE_KEY = 'vessels-cache';
const TTL_MS = 15 * 60 * 1000;

function getBlobStore() {
  try {
    const { getStore } = require('@netlify/blobs');
    return getStore({
      name: 'godseye-state',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.Godseye_Blobs
    });
  } catch (e) { console.warn('[blobs]', e.message); return null; }
}

exports.handler = async () => {
  const store = getBlobStore();
  let cached = null;

  if (store) {
    try { cached = await store.get(CACHE_KEY, { type: 'json' }); } catch (e) {}
    if (cached && Date.now() - cached.cached_at < TTL_MS) {
      return ok({ ...cached.payload, cache: 'hit' });
    }
  }

  try {
    const res = await fetch(`https://tankermap.com/api/vessels/bbox?${BBOX}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (GodsEye monitor)' }, signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) throw new Error(`upstream HTTP ${res.status}`);
    const raw = await res.json();
    const vessels = (Array.isArray(raw) ? raw : raw.vessels || []).map(v => ({
      name: v.name, imo: v.imo, flag: v.flag, type: v.vessel_type,
      dwt: v.deadweight, lat: v.latitude, lon: v.longitude,
      sog: v.speed_knots, cog: v.cog_degrees, nav: v.nav_status,
      draught: v.draught_meters, draught_age_h: v.draught_age_hours,
      dest: v.destination, sanctioned: v.sanctions_status === 'SANCTIONED',
      cargo: v.cargo_state, seen: v.observed_at
    }));

    const anchored = vessels.filter(v => (v.sog || 0) <= 1).length;
    const payload = {
      success: true,
      count: vessels.length,
      moving: vessels.length - anchored,
      anchored,
      sanctioned: vessels.filter(v => v.sanctioned).length,
      laden: vessels.filter(v => v.cargo === 'loaded').length,
      ballast: vessels.filter(v => v.cargo === 'ballast').length,
      vlcc_stationary: vessels.filter(v => (v.dwt || 0) > 250000 && (v.sog || 0) <= 1).length,
      caveat: 'AIS-only; dark vessels absent by definition',
      vessels,
      timestamp: new Date().toISOString()
    };

    if (store) {
      try { await store.setJSON(CACHE_KEY, { cached_at: Date.now(), payload }); } catch (e) {}
    }
    return ok({ ...payload, cache: 'miss' });
  } catch (e) {
    console.warn('[vessels]', e.message);
    if (cached) return ok({ ...cached.payload, cache: 'stale', stale_since: new Date(cached.cached_at).toISOString() });
    return ok({ success: false, count: 0, vessels: [], error: e.message, timestamp: new Date().toISOString() });
  }
};

function ok(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body)
  };
}

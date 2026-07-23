// GodsEye · sentinel.js
// On-demand Sentinel-2 scene renders via Sentinel Hub Process API.
// Query: ?bbox=W,S,E,N (EPSG:4326) &date=YYYY-MM-DD &mode=truecolor|swir &w=1024&h=1024
// Returns image/png. Credentials from env (SH_CLIENT_ID / SH_CLIENT_SECRET) — never client-side.
// Matches classic function style used by the rest of the repo (firms.js, vessels.js).

let tokenCache = { tok: null, exp: 0 };

async function getToken() {
  if (tokenCache.tok && Date.now() < tokenCache.exp - 60000) return tokenCache.tok;
  const res = await fetch('https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&client_id=' + encodeURIComponent(process.env.SH_CLIENT_ID) +
          '&client_secret=' + encodeURIComponent(process.env.SH_CLIENT_SECRET)
  });
  if (!res.ok) throw new Error('SH auth ' + res.status);
  const d = await res.json();
  tokenCache = { tok: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return tokenCache.tok;
}

const EVALS = {
  truecolor: `//VERSION=3
function setup(){return{input:["B02","B03","B04"],output:{bands:3}}}
function evaluatePixel(s){return[2.5*s.B04,2.5*s.B03,2.5*s.B02]}`,
  swir: `//VERSION=3
function setup(){return{input:["B12","B8A","B04"],output:{bands:3}}}
function evaluatePixel(s){return[2.5*s.B12,2.5*s.B8A,2.5*s.B04]}`
};

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const mode = (q.mode === 'swir') ? 'swir' : 'truecolor';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.date || '') ? q.date : null;
  const bbox = (q.bbox || '').split(',').map(Number);
  const w = Math.min(parseInt(q.w || '1024', 10) || 1024, 2048);
  const h = Math.min(parseInt(q.h || '1024', 10) || 1024, 2048);

  if (!date || bbox.length !== 4 || bbox.some(isNaN)) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'need bbox=W,S,E,N and date=YYYY-MM-DD' }) };
  }
  if (!process.env.SH_CLIENT_ID || !process.env.SH_CLIENT_SECRET) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'SH credentials not set' }) };
  }

  try {
    const tok = await getToken();
    const body = {
      input: {
        bounds: { bbox, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
        data: [{
          type: 'sentinel-2-l2a',
          dataFilter: {
            timeRange: { from: date + 'T00:00:00Z', to: date + 'T23:59:59Z' },
            mosaickingOrder: 'mostRecent'
          }
        }]
      },
      output: { width: w, height: h, responses: [{ identifier: 'default', format: { type: 'image/png' } }] },
      evalscript: EVALS[mode]
    };
    const res = await fetch('https://services.sentinel-hub.com/api/v1/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok, 'Accept': 'image/png' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000)
    });
    if (!res.ok) {
      const txt = await res.text();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'SH process ' + res.status, detail: txt.slice(0, 300) }) };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
      body: buf.toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: String(e.message || e) }) };
  }
};

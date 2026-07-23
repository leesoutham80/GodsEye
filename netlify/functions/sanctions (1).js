// GodsEye · sanctions.js
// Multi-source vessel sanctions cross-check from primary sources:
//   OFAC SDN (US) · UK OFSI · EU consolidated · UN Security Council
// Returns { success, as_of, cached, sources:{...counts}, imos:{ "IMO": {lists:[...], names:[...], programs:[...]} } }
// Each IMO carries WHICH authorities list it — divergence is the signal.
// Cached 24h in godseye-state.

const { getStore } = require('@netlify/blobs');

const SRC = {
  ofac: 'https://sanctionslistservice.ofac.treas.gov/api/download/sdn.csv',
  ofsi: 'https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv',
  eu:   'https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw',
  un:   'https://scsanctions.un.org/resources/xml/en/consolidated.xml'
};
const CACHE_KEY = 'sanctions:multi:vessels';
const TTL_MS = 24 * 60 * 60 * 1000;
const UA = { 'User-Agent': 'Mozilla/5.0 (GodsEye monitor)' };

function add(map, imo, list, name, prog) {
  if (!/^\d{7}$/.test(imo)) return;
  const e = map[imo] || (map[imo] = { lists: [], names: [], programs: [] });
  if (e.lists.indexOf(list) === -1) e.lists.push(list);
  if (name && e.names.indexOf(name) === -1) e.names.push(name);
  if (prog && e.programs.indexOf(prog) === -1) e.programs.push(prog);
}

function csvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
  }
  out.push(cur); return out;
}

async function grab(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(r.status);
  return r.text();
}

function parseOFAC(txt, map) {
  let n = 0;
  for (const line of txt.split('\n')) {
    if (line.indexOf('vessel') === -1) continue;
    const f = csvLine(line);
    if ((f[2] || '').trim() !== 'vessel') continue;
    const hits = (f[11] || '').match(/IMO (\d{7})/g) || [];
    for (const h of hits) { add(map, h.slice(4), 'OFAC', (f[1]||'').trim(), (f[3]||'').trim()); n++; }
  }
  return n;
}
function parseOFSI(txt, map) {
  // OFSI ship rows carry the IMO only as "IMO number):NNNNNNN" — other 7-digit
  // strings in the row are UNSC resolution numbers (2371 etc.), NOT IMOs. Match exactly.
  const seen = new Set();
  for (const line of txt.split('\n')) {
    const m = line.match(/IMO number\):?\s*(\d{7})/);
    if (!m) continue;
    const name = (csvLine(line)[0] || '').trim().slice(0, 60);
    add(map, m[1], 'UK-OFSI', name, 'UK'); seen.add(m[1]);
  }
  return seen.size;
}
function parseEU(txt, map) {
  // EU carries the IMO specifically as "IMO) Number: NNNNNNN" inside the remark prose.
  // A bare 7-digit grabs UN designation dates / other ids — anchor to the label.
  let n = 0;
  const hits = txt.match(/IMO\)?\s?Number:?\s*(\d{7})/g) || [];
  for (const h of hits) { const d = h.match(/(\d{7})/)[1]; add(map, d, 'EU', '', 'EU'); n++; }
  return n;
}
function parseUN(txt, map) {
  // UN vessel IMOs appear in COMMENTS prose ("IMO NNNNNNN"); lower structural confidence
  let n = 0;
  const hits = txt.match(/IMO\s?(\d{7})/g) || [];
  for (const h of hits) { add(map, h.replace(/\D/g, ''), 'UN', '', 'UN'); n++; }
  return n;
}

exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' };
  let store = null;
  try { store = getStore({ name: 'godseye-state', siteID: process.env.NETLIFY_SITE_ID, token: process.env.Godseye_Blobs }); } catch (e) {}

  if (store) {
    try {
      const hit = await store.get(CACHE_KEY, { type: 'json' });
      if (hit && hit.ts && (Date.now() - hit.ts) < TTL_MS && hit.imos)
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, cached: true, as_of: hit.as_of, sources: hit.sources, count: Object.keys(hit.imos).length, imos: hit.imos }) };
    } catch (e) {}
  }

  const map = {}; const sources = {};
  const jobs = [
    ['ofac', parseOFAC], ['ofsi', parseOFSI], ['eu', parseEU], ['un', parseUN]
  ].map(async ([k, fn]) => {
    try { const t = await grab(SRC[k]); sources[k] = fn(t, map); }
    catch (e) { sources[k] = 'error:' + (e.message || e); }
  });
  await Promise.all(jobs);

  const as_of = new Date().toISOString();
  if (store && Object.keys(map).length) {
    try { await store.setJSON(CACHE_KEY, { ts: Date.now(), as_of, sources, imos: map }); } catch (e) {}
  }
  const ok = Object.keys(map).length > 0;
  return { statusCode: 200, headers, body: JSON.stringify({
    success: ok, cached: false, as_of, sources, count: Object.keys(map).length,
    imos: map, note: ok ? undefined : 'all sources failed' }) };
};

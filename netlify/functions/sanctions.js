// GodsEye · sanctions.js
// Independent multi-source sanctions cross-check from primary lists:
//   OFAC SDN (US) · EU FSF consolidated · UK OFSI consolidated · UN Security Council
// Merges vessel entries into one IMO lookup, each carrying which lists name it.
// Returns { success, count, as_of, cached, sources:{...counts}, imos:{ "IMO": {n, lists:[{src,prog}]} } }
// Cached 24h in godseye-state.

const { getStore } = require('@netlify/blobs');

const SRC = {
  ofac: 'https://sanctionslistservice.ofac.treas.gov/api/download/sdn.csv',
  eu:   'https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw',
  uk:   'https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv',
  un:   'https://scsanctions.un.org/resources/xml/en/consolidated.xml'
};
const CACHE_KEY = 'sanctions:multi:vessels';
const TTL_MS = 24 * 60 * 60 * 1000;

function parseCSVLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
  }
  out.push(cur); return out;
}

function add(imos, imo, name, src, prog) {
  if (!/^\d{7}$/.test(imo)) return;
  if (!imos[imo]) imos[imo] = { n: name || null, lists: [] };
  if (!imos[imo].lists.some(function(l){ return l.src === src; }))
    imos[imo].lists.push({ src: src, prog: (prog || '').trim() || null });
  if (!imos[imo].n && name) imos[imo].n = name;
}

function parseOFAC(csv, imos) {
  let n = 0;
  for (const line of csv.split('\n')) {
    if (line.indexOf('vessel') === -1) continue;
    const f = parseCSVLine(line);
    if ((f[2] || '').trim() !== 'vessel') continue;
    const m = (f[11] || '').match(/IMO (\d{7})/g) || [];
    for (const hit of m) { add(imos, hit.slice(4), (f[1]||'').trim(), 'OFAC', f[3]); n++; }
  }
  return n;
}
function parseEU(csv, imos) {
  let n = 0;
  // EU is ';'-delimited; IMO appears as "IMO ... Number: NNNNNNN" in remark fields
  const re = /IMO(?:\)?\s*Number)?[:\s]+(\d{7})/gi;
  for (const line of csv.split('\n')) {
    let m;
    while ((m = re.exec(line)) !== null) {
      const nameM = line.match(/;([^;]{2,60});[^;]*?IMO/i);
      add(imos, m[1], nameM ? nameM[1].trim() : null, 'EU', 'EU designation');
      n++;
    }
  }
  return n;
}
function parseUK(csv, imos) {
  let n = 0;
  for (const line of csv.split('\n')) {
    const isShip = /(^|,)"?Ship"?(,|$)/.test(line) || /,Ship,/.test(line);
    const labelled = line.match(/IMO(?:\s*number)?[:\s]+(\d{7})/gi);
    if (labelled) {
      const f = parseCSVLine(line);
      labelled.forEach(function(hit){
        const imo = hit.match(/(\d{7})/)[1];
        add(imos, imo, (f[0]||'').replace(/,+$/,'').trim(), 'UK', 'UK OFSI'); n++;
      });
    } else if (isShip) {
      const f = parseCSVLine(line);
      const m = line.match(/\b(\d{7})\b/g) || [];
      for (const imo of m) { add(imos, imo, (f[0]||'').replace(/,+$/,'').trim(), 'UK', 'UK OFSI'); n++; }
    }
  }
  return n;
}
function parseUN(xml, imos) {
  let n = 0;
  const re = /IMO(?:\s*number)?[:\s]+(\d{7})/gi; let m;
  while ((m = re.exec(xml)) !== null) { add(imos, m[1], null, 'UN', 'UNSC'); n++; }
  return n;
}

async function pull(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(res.status);
  return res.text();
}

exports.handler = async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600'
  };

  let store = null;
  try {
    store = getStore({ name: 'godseye-state', siteID: process.env.NETLIFY_SITE_ID, token: process.env.Godseye_Blobs });
  } catch (e) { store = null; }

  if (store) {
    try {
      const hit = await store.get(CACHE_KEY, { type: 'json' });
      if (hit && hit.ts && (Date.now() - hit.ts) < TTL_MS && hit.imos) {
        return { statusCode: 200, headers, body: JSON.stringify({
          success: true, cached: true, as_of: hit.as_of, sources: hit.sources,
          count: Object.keys(hit.imos).length, imos: hit.imos }) };
      }
    } catch (e) {}
  }

  const imos = {};
  const sources = {};
  const parsers = [
    ['ofac', parseOFAC], ['eu', parseEU], ['uk', parseUK], ['un', parseUN]
  ];
  // fetch all in parallel, tolerate individual failures
  const results = await Promise.allSettled(parsers.map(function(p){ return pull(SRC[p[0]]); }));
  results.forEach(function(r, i){
    const key = parsers[i][0], fn = parsers[i][1];
    if (r.status === 'fulfilled') {
      try { sources[key] = fn(r.value, imos); } catch (e) { sources[key] = 'parse_error'; }
    } else { sources[key] = 'unreachable'; }
  });

  const anyOk = Object.values(sources).some(function(v){ return typeof v === 'number' && v > 0; });
  if (!anyOk) {
    if (store) {
      try {
        const stale = await store.get(CACHE_KEY, { type: 'json' });
        if (stale && stale.imos)
          return { statusCode: 200, headers, body: JSON.stringify({
            success: true, cached: true, stale: true, as_of: stale.as_of, sources: stale.sources,
            count: Object.keys(stale.imos).length, imos: stale.imos }) };
      } catch (e) {}
    }
    return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'all sources unreachable', sources, imos: {} }) };
  }

  const as_of = new Date().toISOString();
  if (store) { try { await store.setJSON(CACHE_KEY, { ts: Date.now(), as_of, sources, imos }); } catch (e) {} }
  return { statusCode: 200, headers, body: JSON.stringify({
    success: true, cached: false, as_of, sources, count: Object.keys(imos).length, imos }) };
};


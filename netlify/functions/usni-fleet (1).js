// GodsEye usni-fleet — weekly US naval posture from USNI Fleet & Marine Tracker
// Warships are AIS-dark by doctrine; this is the free structured source for posture.
// Positions are region-level approximations — exactly what USNI itself publishes.
// Feeds: main RSS (current, tracker scrolls out fast) -> category RSS (deep, CDN-stale)
// -> last blob -> SEED. Cron: Tuesdays 06:00 UTC (USNI publishes Mondays ~17:00 UTC).

// uses built-in fetch (Node 18+); node-fetch is NOT a declared dependency

const CACHE_KEY = 'usni-fleet';
const REGION_COORDS = {
  'Philippine Sea': [20.0, 130.0], 'South China Sea': [12.0, 115.0],
  'Arabian Sea': [20.5, 63.5], 'Red Sea': [19.0, 39.0],
  'Eastern Mediterranean': [34.0, 30.0], 'Mediterranean Sea': [35.5, 18.0],
  'Indian Ocean': [8.0, 68.0], 'Gulf of Oman': [24.3, 58.8],
  'North Sea': [56.0, 4.0], 'English Channel': [50.2, -0.5],
  'Caribbean Sea': [15.0, -70.0], 'Eastern Pacific': [25.0, -125.0],
  'Western Atlantic': [33.0, -74.0], 'Western Pacific': [18.0, 135.0],
  'Pearl Harbor, Hawaii': [21.35, -157.97], 'Singapore': [1.29, 103.85],
  'Japan': [35.3, 139.65], 'Okinawa, Japan': [26.3, 127.8],
  'CENTCOM': [22.0, 60.0]
};
const CAPITAL = { CVN: 'carrier', LHD: 'big-deck amphib', LHA: 'big-deck amphib', LCC: 'command ship' };

// Seed: parsed from the June 29, 2026 tracker (verified this session)
const SEED = {
  as_of: '2026-06-29',
  source: 'USNI News Fleet and Marine Tracker: June 29, 2026 (seed)',
  battle_force: { total: 292, deployed: 101, underway: 80 },
  regions: [
    { region: 'Arabian Sea', lat: 20.5, lon: 63.5, ships: [
      { name: 'Abraham Lincoln', hull: 'CVN-72', cls: 'carrier', note: 'CSG-3, Operation Epic Fury' },
      { name: 'George H.W. Bush', hull: 'CVN-77', cls: 'carrier', note: 'CSG-10' },
      { name: 'Tripoli', hull: 'LHA-7', cls: 'big-deck amphib', note: 'ARG w/ New Orleans LPD-18, 31st MEU elems' },
      { name: 'Spruance', hull: 'DDG-111', cls: 'escort' }, { name: 'Mason', hull: 'DDG-87', cls: 'escort' },
      { name: 'Donald Cook', hull: 'DDG-75', cls: 'escort' }, { name: 'Ross', hull: 'DDG-71', cls: 'escort' },
      { name: 'Princeton', hull: 'CG-59', cls: 'escort' },
      { name: '+9 independent DDG', hull: '', cls: 'escort', note: 'Milius, Delbert D. Black, Michael Murphy, John Finn, Higgins, McFaul, Rafael Peralta, Truxtun, Frank E. Petersen Jr.' },
      { name: 'Comstock', hull: 'LSD-45', cls: 'amphib', note: 'detached to 5th Fleet' }
    ]},
    { region: 'Red Sea', lat: 19.0, lon: 39.0, ships: [
      { name: 'Thomas Hudner', hull: 'DDG-116', cls: 'escort' },
      { name: 'Gonzalez', hull: 'DDG-66', cls: 'escort' }
    ]},
    { region: 'Indian Ocean', lat: 8.0, lon: 68.0, ships: [
      { name: 'Boxer', hull: 'LHD-4', cls: 'big-deck amphib', note: 'ARG w/ Portland LPD-27, 11th MEU; Rushmore LSD-47 in region' },
      { name: 'Tulsa', hull: 'LCS-16', cls: 'small combatant' },
      { name: 'Mustin', hull: 'DDG-89', cls: 'escort' },
      { name: 'John L. Canley', hull: 'ESB-6', cls: 'expeditionary base' }
    ]},
    { region: 'Eastern Mediterranean', lat: 34.0, lon: 30.0, ships: [
      { name: 'Arleigh Burke', hull: 'DDG-51', cls: 'escort' },
      { name: 'Roosevelt', hull: 'DDG-80', cls: 'escort' }
    ]},
    { region: 'Philippine Sea', lat: 20.0, lon: 130.0, ships: [
      { name: 'George Washington', hull: 'CVN-73', cls: 'carrier', note: 'CVW-5; Valiant Shield 2026' }
    ]},
    { region: 'Western Atlantic', lat: 33.0, lon: -74.0, ships: [
      { name: 'Dwight D. Eisenhower', hull: 'CVN-69', cls: 'carrier', note: 'departed Norfolk 17 Jun — destination unconfirmed' }
    ]}
  ]
};

function getBlobStore() {
  try {
    const { getStore } = require('@netlify/blobs');
    return getStore({ name: 'godseye-state', siteID: process.env.NETLIFY_SITE_ID, token: process.env.Godseye_Blobs });
  } catch (e) { return null; }
}

function parseTracker(xml) {
  // find newest Fleet and Marine Tracker item
  const items = [...xml.matchAll(/<item>(.*?)<\/item>/gs)].map(m => m[1]);
  let best = null, bestDate = 0;
  for (const it of items) {
    const t = (it.match(/<title>(.*?)<\/title>/s) || [])[1] || '';
    if (!/Fleet and Marine Tracker/i.test(t)) continue;
    const d = new Date(((it.match(/<pubDate>(.*?)<\/pubDate>/s) || [])[1] || '').trim()).getTime() || 0;
    if (d > bestDate) { bestDate = d; best = it; }
  }
  if (!best) return null;
  const cdata = (best.match(/<content:encoded><!\[CDATA\[(.*?)\]\]><\/content:encoded>/s) || [])[1];
  if (!cdata) return null;

  const text = cdata
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, "'");

  // battle force topline
  const bf = text.match(/(\d{3})\s*\(USS[\s\S]{0,40}?(\d{2,3})\s*\(USS/);

  // split by region headers
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const regions = [];
  let cur = null;
  for (const l of lines) {
    const rh = l.match(/^In (?:the )?([A-Z][A-Za-z.,' \-]{2,42})$/);
    if (rh) {
      const rname = rh[1].replace(/\s+$/, '');
      cur = { region: rname, ships: [] };
      const key = Object.keys(REGION_COORDS).find(k => rname.includes(k) || k.includes(rname));
      const c = REGION_COORDS[key] || null;
      if (c) { cur.lat = c[0]; cur.lon = c[1]; }
      regions.push(cur);
      continue;
    }
    if (!cur) continue;
    for (const sm of l.matchAll(/USS\s+([A-Za-z.'\- ]+?)\s*\((CVN|LHD|LHA|LCC|LPD|LSD|CG|DDG|LCS|ESB|MCM)-(\d+)\)/g)) {
      const hull = `${sm[2]}-${sm[3]}`;
      if (cur.ships.some(s => s.hull === hull)) continue;
      cur.ships.push({ name: sm[1].trim(), hull, cls: CAPITAL[sm[2]] || (sm[2] === 'DDG' || sm[2] === 'CG' ? 'escort' : sm[2] === 'LCS' || sm[2] === 'MCM' ? 'small combatant' : sm[2] === 'ESB' ? 'expeditionary base' : 'amphib') });
    }
  }
  const kept = regions.filter(r => r.ships.length && r.lat != null);
  if (!kept.length) return null;
  const title = (best.match(/<title>(.*?)<\/title>/s) || [])[1] || 'USNI Fleet Tracker';
  return {
    as_of: new Date(bestDate).toISOString().slice(0, 10),
    source: title.trim(),
    battle_force: bf ? { total: +bf[1], deployed: +bf[2] } : null,
    regions: kept
  };
}

exports.handler = async () => {
  const store = getBlobStore();
  let fleet = null;

  for (const url of ['https://news.usni.org/feed', 'https://news.usni.org/category/fleet-tracker/feed']) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (GodsEye monitor)' }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const parsed = parseTracker(await res.text());
      if (parsed && (!fleet || parsed.as_of > fleet.as_of)) fleet = parsed;
    } catch (e) { console.warn('[usni]', url, e.message); }
  }

  if (store) {
    try {
      const prev = await store.get(CACHE_KEY, { type: 'json' });
      if (prev && (!fleet || prev.as_of > fleet.as_of)) fleet = prev;
    } catch (e) {}
  }
  if (!fleet || SEED.as_of > fleet.as_of) fleet = SEED;

  if (store && fleet !== SEED) {
    try { await store.setJSON(CACHE_KEY, fleet); } catch (e) {}
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ ...fleet, caveat: 'region-level approximate positions per USNI; warships are AIS-dark by doctrine' })
  };
};

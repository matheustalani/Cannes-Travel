// api/flights.js — Vercel
// Env var: SERPAPI_KEY

const BASE = 'https://serpapi.com/search.json';
const IDA_DATES   = ['2026-06-13','2026-06-14','2026-06-15','2026-06-16','2026-06-17'];
const VOLTA_DATES = ['2026-06-25','2026-06-26','2026-06-27','2026-06-28'];

async function fetchFlight(departure_id, arrival_id, outbound_date, type, return_date) {
  const p = {
    engine: 'google_flights',
    departure_id, arrival_id, outbound_date, type,
    currency: 'BRL', hl: 'pt', gl: 'us', adults: '1',
    api_key: process.env.SERPAPI_KEY,
  };
  if (return_date) p.return_date = return_date;
  const r = await fetch(BASE + '?' + new URLSearchParams(p));
  const d = await r.json().catch(() => ({}));
  if (d.error) throw new Error(d.error);
  return d;
}

function parse(data, date, extra) {
  const all  = [...(data.best_flights || []), ...(data.other_flights || [])];
  const top  = all[0];
  if (!top || !top.price) return null;
  const legs = top.flights || [];
  const dep  = legs[0];
  const arr  = legs[legs.length - 1];
  const mins = top.total_duration || 0;
  return {
    date, price: top.price, currency: 'BRL',
    airline: dep?.airline || '—',
    dep: (dep?.departure_airport?.time || '').slice(11,16) || '—',
    arr: (arr?.arrival_airport?.time   || '').slice(11,16) || '—',
    stops: Math.max(0, legs.length - 1),
    dur: `${Math.floor(mins/60)}h${String(mins%60).padStart(2,'0')}m`,
    ...extra,
  };
}

async function doSearch(departure_id, arrival_id, date, type, return_date) {
  try {
    const data  = await fetchFlight(departure_id, arrival_id, date, type, return_date);
    const offer = parse(data, date, {});
    return { offer, error: null, counts: [(data.best_flights||[]).length, (data.other_flights||[]).length] };
  } catch(e) {
    return { offer: null, error: e.message, counts: [0,0] };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SERPAPI_KEY) return res.status(500).json({ error: 'SERPAPI_KEY não configurada.' });

  const roundTrip   = [];
  const openJaw     = [];
  const roundTripRT = [];
  const errors      = [];

  // Roda todas as buscas em paralelo num único Promise.all flat
  const searches = [
    ...IDA_DATES.map(d   => ({ key: 'ida-'+d,   args: ['GRU','CDG', d, '2', null] })),
    ...VOLTA_DATES.map(d => ({ key: 'volta-'+d,  args: ['NCE','GRU', d, '2', null] })),
    ...IDA_DATES.map(d   => ({ key: 'rt-'+d,     args: ['GRU','CDG', d, '1', '2026-06-28'] })),
  ];

  const results = await Promise.all(
    searches.map(s => doSearch(...s.args).then(r => ({ ...r, key: s.key })))
  );

  for (const r of results) {
    const [, routeType, ...dateParts] = r.key.split('-');
    // key format: "ida-2026-06-17" or "volta-2026-06-25" or "rt-2026-06-13"
    const keyParts = r.key.split('-');
    const prefix   = keyParts[0]; // "ida", "volta", "rt"
    const date     = keyParts.slice(1).join('-'); // "2026-06-17"

    if (r.error) {
      errors.push(prefix + ' ' + date + ': ' + r.error);
      continue;
    }
    if (!r.offer) {
      errors.push(prefix + ' ' + date + ': sem resultados (best=' + r.counts[0] + ' other=' + r.counts[1] + ')');
      continue;
    }

    if (prefix === 'ida')   roundTrip.push({ ...r.offer, type: 'one_way_ida' });
    if (prefix === 'volta') openJaw.push({ ...r.offer, type: 'open_jaw' });
    if (prefix === 'rt')    roundTripRT.push({ ...r.offer, type: 'round_trip_total', voltaDate: '2026-06-28', isPackage: true });
  }

  return res.status(200).json({ roundTrip, openJaw, roundTripRT, errors, fetchedAt: new Date().toISOString() });
}

export const config = { maxDuration: 60 };

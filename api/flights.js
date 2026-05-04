// api/flights.js — Vercel
// Env var: SERPAPI_KEY

const BASE = 'https://serpapi.com/search.json';

async function searchFlight(departure_id, arrival_id, outbound_date, type, return_date) {
  const params = {
    engine: 'google_flights',
    departure_id, arrival_id, outbound_date, type,
    currency: 'BRL', hl: 'pt', gl: 'us', adults: '1',
    api_key: process.env.SERPAPI_KEY,
  };
  if (return_date) params.return_date = return_date;
  const r = await fetch(BASE + '?' + new URLSearchParams(params));
  const d = await r.json().catch(() => ({}));
  if (d.error) throw new Error(d.error);
  return d;
}

function parseOffer(data, date, extra) {
  const all = [...(data.best_flights || []), ...(data.other_flights || [])];
  if (!all.length) return null;
  const f = all[0];
  if (!f || !f.price) return null;
  const legs = f.flights || [];
  const dep  = legs[0];
  const arr  = legs[legs.length - 1];
  const mins = f.total_duration || 0;
  return {
    date,
    price:    f.price,
    currency: 'BRL',
    airline:  dep?.airline || '—',
    dep:      (dep?.departure_airport?.time || '').slice(11, 16) || '—',
    arr:      (arr?.arrival_airport?.time   || '').slice(11, 16) || '—',
    stops:    Math.max(0, legs.length - 1),
    dur:      `${Math.floor(mins/60)}h${String(mins%60).padStart(2,'0')}m`,
    ...extra,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SERPAPI_KEY) return res.status(500).json({ error: 'SERPAPI_KEY não configurada.' });

  const IDA_DATES   = ['2026-06-13','2026-06-14','2026-06-15','2026-06-16','2026-06-17'];
  const VOLTA_DATES = ['2026-06-25','2026-06-26','2026-06-27','2026-06-28'];

  const roundTrip   = [];
  const openJaw     = [];
  const roundTripRT = [];
  const errors      = [];

  // Busca todas as rotas em paralelo, cada grupo separado
  const [idaResults, voltaResults, rtResults] = await Promise.all([
    // Idas one-way GRU→CDG
    Promise.all(IDA_DATES.map(async d => {
      try {
        const data = await searchFlight('GRU', 'CDG', d, '2');
        return { date: d, data, error: null };
      } catch(e) { return { date: d, data: null, error: e.message }; }
    })),
    // Voltas one-way NCE→GRU
    Promise.all(VOLTA_DATES.map(async d => {
      try {
        const data = await searchFlight('NCE', 'GRU', d, '2');
        return { date: d, data, error: null };
      } catch(e) { return { date: d, data: null, error: e.message }; }
    })),
    // Round-trip GRU↔CDG (ida+volta no mesmo bilhete)
    Promise.all(IDA_DATES.map(async d => {
      try {
        const data = await searchFlight('GRU', 'CDG', d, '1', '2026-06-28');
        return { date: d, data, error: null };
      } catch(e) { return { date: d, data: null, error: e.message }; }
    })),
  ]);

  for (const r of idaResults) {
    if (r.error) { errors.push('GRU-CDG ida ' + r.date + ': ' + r.error); continue; }
    const offer = parseOffer(r.data, r.date, { type: 'one_way_ida' });
    if (offer) roundTrip.push(offer);
    else errors.push('GRU-CDG ida ' + r.date + ': sem resultados (' + (r.data?.best_flights?.length||0) + ' best, ' + (r.data?.other_flights?.length||0) + ' other)');
  }

  for (const r of voltaResults) {
    if (r.error) { errors.push('NCE-GRU ' + r.date + ': ' + r.error); continue; }
    const offer = parseOffer(r.data, r.date, { type: 'open_jaw' });
    if (offer) openJaw.push(offer);
    else errors.push('NCE-GRU ' + r.date + ': sem resultados (' + (r.data?.best_flights?.length||0) + ' best, ' + (r.data?.other_flights?.length||0) + ' other)');
  }

  for (const r of rtResults) {
    if (r.error) { errors.push('GRU-CDG RT ' + r.date + ': ' + r.error); continue; }
    const offer = parseOffer(r.data, r.date, { type: 'round_trip_total', voltaDate: '2026-06-28', isPackage: true });
    if (offer) roundTripRT.push(offer);
    else errors.push('GRU-CDG RT ' + r.date + ': sem resultados (' + (r.data?.best_flights?.length||0) + ' best, ' + (r.data?.other_flights?.length||0) + ' other)');
  }

  return res.status(200).json({
    roundTrip, openJaw, roundTripRT, errors,
    fetchedAt: new Date().toISOString(),
  });
}

export const config = { maxDuration: 60 };

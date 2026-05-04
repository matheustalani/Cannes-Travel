// api/flights.js — Vercel Serverless Function
// Env var: SERPAPI_KEY

const BASE = 'https://serpapi.com/search.json';
const IDA_DATES   = ['2026-06-13','2026-06-14','2026-06-15','2026-06-16','2026-06-17'];
const VOLTA_DATES = ['2026-06-25','2026-06-26','2026-06-27','2026-06-28'];

async function search(departure_id, arrival_id, outbound_date, type, return_date) {
  const params = {
    engine: 'google_flights',
    departure_id, arrival_id, outbound_date, type,
    currency: 'BRL', hl: 'pt', gl: 'us', adults: '1',
    api_key: process.env.SERPAPI_KEY,
  };
  if (return_date) params.return_date = return_date;
  const p = new URLSearchParams(params);
  const res = await fetch(BASE + '?' + p);
  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error('SerpApi: ' + data.error);
  if (!res.ok) throw new Error('SerpApi HTTP ' + res.status);
  return data;
}

function parseBest(data, date, extra) {
  const all = [...(data.best_flights || []), ...(data.other_flights || [])];
  if (!all.length) return null;
  const top = all[0];
  if (!top || !top.price) return null;
  const legs  = top.flights || [];
  const first = legs[0] || {};
  const last  = legs[legs.length - 1] || {};
  const min   = top.total_duration || 0;
  return {
    date, price: top.price, currency: 'BRL',
    airline: first.airline || '—',
    dep: (first.departure_airport?.time || '').slice(11,16) || '—',
    arr: (last.arrival_airport?.time   || '').slice(11,16) || '—',
    stops: Math.max(0, legs.length - 1),
    dur:   `${Math.floor(min/60)}h${String(min%60).padStart(2,'0')}m`,
    ...extra,
  };
}

const delay = () => new Promise(r => setTimeout(r, 400));

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SERPAPI_KEY) return res.status(500).json({ error: 'SERPAPI_KEY não configurada.' });

  const results = { roundTrip: [], openJaw: [], roundTripRT: [], errors: [], fetchedAt: new Date().toISOString() };

  // 1. GRU→CDG one-way por data
  for (const ida of IDA_DATES) {
    try {
      const data  = await search('GRU', 'CDG', ida, '2');
      const offer = parseBest(data, ida, { type: 'one_way_ida' });
      if (offer) results.roundTrip.push(offer);
      else results.errors.push('GRU-CDG one-way ' + ida + ': sem resultados (best_flights=' + (data.best_flights||[]).length + ' other=' + (data.other_flights||[]).length + ')');
    } catch(e) { results.errors.push('GRU-CDG one-way ' + ida + ': ' + e.message); }
    await delay();
  }

  // 2. NCE→GRU one-way por data
  for (const volta of VOLTA_DATES) {
    try {
      const data  = await search('NCE', 'GRU', volta, '2');
      const offer = parseBest(data, volta, { type: 'open_jaw' });
      if (offer) results.openJaw.push(offer);
      else results.errors.push('NCE-GRU ' + volta + ': sem resultados (best_flights=' + (data.best_flights||[]).length + ' other=' + (data.other_flights||[]).length + ')');
    } catch(e) { results.errors.push('NCE-GRU ' + volta + ': ' + e.message); }
    await delay();
  }

  // 3. GRU↔CDG round-trip (pacote, mais barato) — com return_date obrigatório
  for (const ida of IDA_DATES) {
    try {
      const data  = await search('GRU', 'CDG', ida, '1', '2026-06-28');
      const offer = parseBest(data, ida, { type: 'round_trip_total', voltaDate: '2026-06-28', isPackage: true, note: 'Pacote ida+volta GRU↔CDG · volta 28 Jun' });
      if (offer) results.roundTripRT.push(offer);
      else results.errors.push('GRU-CDG round-trip ' + ida + ': sem resultados');
    } catch(e) { results.errors.push('GRU-CDG round-trip ' + ida + ': ' + e.message); }
    await delay();
  }

  return res.status(200).json(results);
}

export const config = { maxDuration: 60 };

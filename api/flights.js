// api/flights.js — Vercel Serverless Function
// Env var: SERPAPI_KEY

const BASE = 'https://serpapi.com/search.json';
const IDA_DATES   = ['2026-06-13','2026-06-14','2026-06-15','2026-06-16','2026-06-17'];
const VOLTA_DATES = ['2026-06-25','2026-06-26','2026-06-27','2026-06-28'];
const VOLTA_RT    = '2026-06-28'; // data de volta para round-trip

async function search(departure_id, arrival_id, outbound_date, type, return_date) {
  const params = {
    engine: 'google_flights',
    departure_id, arrival_id, outbound_date, type,
    currency: 'BRL', hl: 'pt', gl: 'us', adults: '1',
    api_key: process.env.SERPAPI_KEY,
  };
  if (return_date) params.return_date = return_date;
  const res = await fetch(BASE + '?' + new URLSearchParams(params));
  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error('SerpApi: ' + data.error);
  if (!res.ok)    throw new Error('SerpApi HTTP ' + res.status);
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
    date,
    price:    top.price,
    currency: 'BRL',
    airline:  first.airline || '—',
    dep:      (first.departure_airport?.time || '').slice(11, 16) || '—',
    arr:      (last.arrival_airport?.time   || '').slice(11, 16) || '—',
    stops:    Math.max(0, legs.length - 1),
    dur:      `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}m`,
    ...extra,
  };
}

async function safeSearch(label, ...args) {
  try {
    const data  = await search(...args);
    const count = (data.best_flights||[]).length + (data.other_flights||[]).length;
    return { data, count, label, error: null };
  } catch(e) {
    return { data: null, count: 0, label, error: e.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SERPAPI_KEY) return res.status(500).json({ error: 'SERPAPI_KEY não configurada.' });

  const results = { roundTrip: [], openJaw: [], roundTripRT: [], errors: [], fetchedAt: new Date().toISOString() };

  // Todas as buscas em paralelo — muito mais rápido
  const tasks = [
    // one-way ida GRU→CDG
    ...IDA_DATES.map(d => safeSearch('ida-' + d,   'GRU', 'CDG', d, '2')),
    // one-way volta NCE→GRU
    ...VOLTA_DATES.map(d => safeSearch('volta-' + d, 'NCE', 'GRU', d, '2')),
    // round-trip GRU↔CDG (pacote ida+volta)
    ...IDA_DATES.map(d => safeSearch('rt-' + d,    'GRU', 'CDG', d, '1', VOLTA_RT)),
  ];

  const responses = await Promise.all(tasks);

  for (const r of responses) {
    if (r.error) {
      results.errors.push(r.label + ': ' + r.error);
      continue;
    }
    if (r.count === 0) {
      results.errors.push(r.label + ': sem resultados');
      continue;
    }

    const date = r.label.split('-').slice(1).join('-'); // extrai a data do label

    if (r.label.startsWith('ida-')) {
      const offer = parseBest(r.data, date, { type: 'one_way_ida' });
      if (offer) results.roundTrip.push(offer);
    } else if (r.label.startsWith('volta-')) {
      const offer = parseBest(r.data, date, { type: 'open_jaw' });
      if (offer) results.openJaw.push(offer);
    } else if (r.label.startsWith('rt-')) {
      const offer = parseBest(r.data, date, { type: 'round_trip_total', voltaDate: VOLTA_RT, isPackage: true });
      if (offer) results.roundTripRT.push(offer);
    }
  }

  return res.status(200).json(results);
}

export const config = { maxDuration: 60 };

// api/flights.js — versão minimal de debug
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!process.env.SERPAPI_KEY) return res.status(500).json({ error: 'SERPAPI_KEY não configurada.' });

  // UMA busca só — igual ao test.js que funciona
  try {
    const url = 'https://serpapi.com/search.json?' + new URLSearchParams({
      engine: 'google_flights',
      departure_id: 'GRU',
      arrival_id: 'CDG',
      outbound_date: '2026-06-17',
      type: '2',
      currency: 'BRL',
      hl: 'pt',
      gl: 'us',
      adults: '1',
      api_key: process.env.SERPAPI_KEY,
    });

    const r    = await fetch(url);
    const data = await r.json();

    const all  = [...(data.best_flights || []), ...(data.other_flights || [])];
    const top  = all[0];
    const legs = top?.flights || [];
    const dep  = legs[0];
    const arr  = legs[legs.length - 1];
    const mins = top?.total_duration || 0;

    const offer = top ? {
      date:     '2026-06-17',
      price:    top.price,
      currency: 'BRL',
      airline:  dep?.airline || '—',
      dep:      (dep?.departure_airport?.time || '').slice(11,16) || '—',
      arr:      (arr?.arrival_airport?.time   || '').slice(11,16) || '—',
      stops:    Math.max(0, legs.length - 1),
      dur:      `${Math.floor(mins/60)}h${String(mins%60).padStart(2,'0')}m`,
      type:     'one_way_ida',
    } : null;

    return res.status(200).json({
      roundTrip:   offer ? [offer] : [],
      openJaw:     [],
      roundTripRT: [],
      errors:      offer ? [] : ['GRU-CDG 17Jun: sem resultados (best=' + (data.best_flights||[]).length + ' other=' + (data.other_flights||[]).length + ' error=' + (data.error||'none') + ')'],
      fetchedAt:   new Date().toISOString(),
      debug:       { status: r.status, ok: r.ok },
    });
  } catch(e) {
    return res.status(200).json({
      roundTrip: [], openJaw: [], roundTripRT: [],
      errors: ['CRASH: ' + e.message],
      fetchedAt: new Date().toISOString(),
    });
  }
}

export const config = { maxDuration: 30 };

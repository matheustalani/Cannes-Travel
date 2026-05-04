// api/test.js — Vercel — diagnóstico, apagar depois
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const key = process.env.SERPAPI_KEY;

  if (!key) {
    return res.status(200).json({
      status: 'ERRO',
      problema: 'SERPAPI_KEY não está configurada nas env vars da Vercel',
      solucao: 'Vercel → projeto → Settings → Environment Variables → adicionar SERPAPI_KEY'
    });
  }

  // Testa 1 busca real
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
      api_key: key,
    });

    const r = await fetch(url);
    const data = await r.json();

    return res.status(200).json({
      status: r.ok ? 'OK' : 'ERRO HTTP ' + r.status,
      key_presente: true,
      key_prefixo: key.slice(0, 8) + '...',
      serpapi_error: data.error || null,
      best_flights: (data.best_flights || []).length,
      other_flights: (data.other_flights || []).length,
      primeiro_voo: data.best_flights?.[0] ? {
        airline: data.best_flights[0].flights?.[0]?.airline,
        price: data.best_flights[0].price,
      } : null,
    });
  } catch(e) {
    return res.status(200).json({
      status: 'ERRO',
      problema: e.message,
    });
  }
}

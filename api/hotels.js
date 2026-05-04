// api/hotels.js — Vercel Serverless Function
// Env var: RAPIDAPI_KEY

const DEST_IDS = { paris: '-1456928', nice: '-1300715' };

async function searchHotels({ city, checkin, checkout, category }) {
  const destId = DEST_IDS[city.toLowerCase()];
  if (!destId) throw new Error('Cidade não suportada: ' + city);

  const starFilters = { hostel: '', mid: '&categories_filter_ids=class%3A3', luxury: '&categories_filter_ids=class%3A4%2Cclass%3A5' };
  const filter = starFilters[category] || '';

  const url = 'https://booking-com.p.rapidapi.com/v1/hotels/search'
    + '?dest_id=' + destId + '&dest_type=city'
    + '&checkin_date=' + checkin + '&checkout_date=' + checkout
    + '&adults_number=1&room_number=1&currency=BRL&order_by=price&filter_by_currency=BRL&locale=pt-br&units=metric' + filter;

  const res = await fetch(url, {
    headers: { 'X-RapidAPI-Key': process.env.RAPIDAPI_KEY, 'X-RapidAPI-Host': 'booking-com.p.rapidapi.com' },
  });

  if (!res.ok) throw new Error('RapidAPI HTTP ' + res.status);
  const data = await res.json();
  const hotels = data.result || [];
  const nights = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);

  return hotels.slice(0, 3).map(h => ({
    name:         h.hotel_name || '—',
    price:        h.min_total_price || 0,
    pricePerNight: Math.round((h.min_total_price || 0) / nights),
    currency:     'BRL',
    stars:        h.class || 0,
    review:       h.review_score || null,
    nights,
    url: h.url ? 'https://www.booking.com' + h.url
               : 'https://www.booking.com/searchresults.pt-br.html?ss=' + encodeURIComponent(city) + '&checkin=' + checkin + '&checkout=' + checkout + '&group_adults=1',
  }));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.RAPIDAPI_KEY) return res.status(500).json({ error: 'RAPIDAPI_KEY não configurada.' });

  const { searches } = req.body || {};
  if (!Array.isArray(searches)) return res.status(400).json({ error: 'searches deve ser array' });

  const results = [];
  for (const s of searches) {
    try {
      const hotels = await searchHotels(s);
      results.push({ ...s, hotels, error: null });
    } catch(e) {
      results.push({ ...s, hotels: [], error: e.message });
    }
    await new Promise(r => setTimeout(r, 300));
  }

  return res.status(200).json({ results, fetchedAt: new Date().toISOString() });
}

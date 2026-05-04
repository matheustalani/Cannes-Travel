// api/flights.js - Vercel Serverless Function
// Env var: SERPAPI_KEY

const BASE = 'https://serpapi.com/search.json';
const IDA_DATES = ['2026-06-13','2026-06-14','2026-06-15','2026-06-16','2026-06-17'];
const VOLTA_DATES = ['2026-06-25','2026-06-26','2026-06-27','2026-06-28'];

async function fetchFlight(dep, arr, date, type, retDate) {
  const p = new URLSearchParams({
    engine: 'google_flights',
    departure_id: dep,
    arrival_id: arr,
    outbound_date: date,
    type: type,
    currency: 'BRL',
    hl: 'pt',
    gl: 'us',
    adults: '1',
    api_key: process.env.SERPAPI_KEY,
  });
  if (retDate) p.set('return_date', retDate);
  const r = await fetch(BASE + '?' + p.toString());
  const d = await r.json().catch(function(){ return {}; });
  if (d.error) throw new Error(d.error);
  return d;
}

function parseOffer(data, date, extra) {
  var bf = data.best_flights || [];
  var of2 = data.other_flights || [];
  var all = bf.concat(of2);
  if (!all.length) return null;
  var top = all[0];
  if (!top || !top.price) return null;
  var flights = top.flights || [];
  var dep = flights[0] || {};
  var arr = flights[flights.length - 1] || {};
  var mins = top.total_duration || 0;
  var depTime = dep.departure_airport ? dep.departure_airport.time || '' : '';
  var arrTime = arr.arrival_airport ? arr.arrival_airport.time || '' : '';
  var result = {
    date: date,
    price: top.price,
    currency: 'BRL',
    airline: dep.airline || 'Unknown',
    dep: depTime.slice(11, 16) || '--:--',
    arr: arrTime.slice(11, 16) || '--:--',
    stops: Math.max(0, flights.length - 1),
    dur: Math.floor(mins / 60) + 'h' + String(mins % 60).padStart(2, '0') + 'm',
  };
  var keys = Object.keys(extra);
  for (var i = 0; i < keys.length; i++) {
    result[keys[i]] = extra[keys[i]];
  }
  return result;
}

async function doSearch(dep, arr, date, type, retDate) {
  try {
    var data = await fetchFlight(dep, arr, date, type, retDate);
    var bf = (data.best_flights || []).length;
    var of2 = (data.other_flights || []).length;
    var offer = parseOffer(data, date, {});
    return { offer: offer, error: null, bf: bf, of: of2 };
  } catch(e) {
    return { offer: null, error: e.message, bf: 0, of: 0 };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SERPAPI_KEY) return res.status(500).json({ error: 'SERPAPI_KEY nao configurada.' });

  var roundTrip = [];
  var openJaw = [];
  var roundTripRT = [];
  var errors = [];

  var idaPromises = IDA_DATES.map(function(d) { return doSearch('GRU', 'CDG', d, '2', null); });
  var voltaPromises = VOLTA_DATES.map(function(d) { return doSearch('NCE', 'GRU', d, '2', null); });
  var rtPromises = IDA_DATES.map(function(d) { return doSearch('GRU', 'CDG', d, '1', '2026-06-28'); });

  var allPromises = idaPromises.concat(voltaPromises).concat(rtPromises);
  var allResults = await Promise.all(allPromises);

  var idaResults = allResults.slice(0, IDA_DATES.length);
  var voltaResults = allResults.slice(IDA_DATES.length, IDA_DATES.length + VOLTA_DATES.length);
  var rtResults = allResults.slice(IDA_DATES.length + VOLTA_DATES.length);

  for (var i = 0; i < idaResults.length; i++) {
    var r = idaResults[i];
    var d = IDA_DATES[i];
    if (r.error) { errors.push('ida ' + d + ': ' + r.error); continue; }
    if (!r.offer) { errors.push('ida ' + d + ': 0 resultados (bf=' + r.bf + ' of=' + r.of + ')'); continue; }
    r.offer.type = 'one_way_ida';
    roundTrip.push(r.offer);
  }

  for (var j = 0; j < voltaResults.length; j++) {
    var rv = voltaResults[j];
    var dv = VOLTA_DATES[j];
    if (rv.error) { errors.push('volta ' + dv + ': ' + rv.error); continue; }
    if (!rv.offer) { errors.push('volta ' + dv + ': 0 resultados (bf=' + rv.bf + ' of=' + rv.of + ')'); continue; }
    rv.offer.type = 'open_jaw';
    openJaw.push(rv.offer);
  }

  for (var k = 0; k < rtResults.length; k++) {
    var rrt = rtResults[k];
    var drt = IDA_DATES[k];
    if (rrt.error) { errors.push('rt ' + drt + ': ' + rrt.error); continue; }
    if (!rrt.offer) { errors.push('rt ' + drt + ': 0 resultados (bf=' + rrt.bf + ' of=' + rrt.of + ')'); continue; }
    rrt.offer.type = 'round_trip_total';
    rrt.offer.voltaDate = '2026-06-28';
    rrt.offer.isPackage = true;
    roundTripRT.push(rrt.offer);
  }

  return res.status(200).json({
    roundTrip: roundTrip,
    openJaw: openJaw,
    roundTripRT: roundTripRT,
    errors: errors,
    fetchedAt: new Date().toISOString(),
  });
}

export const config = { maxDuration: 60 };

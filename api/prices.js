// api/prices.js — Vercel
// Retorna vazio — histórico fica no localStorage do browser
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(200).json({ hasData: false, latest: null, history: {} });
}

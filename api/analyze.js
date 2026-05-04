// api/analyze.js — Vercel Serverless Function
// Env var: GROQ_API_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY não configurada.' });

  const { flightData, hotelEstimates } = req.body || {};

  const prompt = `Você é um especialista em viagens. Recebi os seguintes dados REAIS de preços de voos buscados agora no Google Flights.

DATA FIXA INEGOCIÁVEL: 24 de junho de 2026 em Cannes (Cannes Lions Festival).
Origem: São Paulo (GRU). Destino base: Paris (CDG).
Câmbio atual: 1 EUR = R$5,75.
Custo trem Nice→Paris (para quem volta por CDG): R$345.
Custo trem Nice→Cannes ida+volta (dia 24): R$35.

DADOS REAIS DE VOOS (preços em BRL):

ONE-WAY IDA GRU→CDG (para estratégia open jaw):
${JSON.stringify(flightData?.roundTrip, null, 2)}

ONE-WAY VOLTA NCE→GRU (para estratégia open jaw):
${JSON.stringify(flightData?.openJaw, null, 2)}

ROUND-TRIP GRU↔CDG COMPRADO JUNTO (preço total ida+volta no mesmo bilhete, volta 28 Jun):
${JSON.stringify(flightData?.roundTripRT, null, 2)}

IMPORTANTE sobre estratégias de voo:
- Open jaw: GRU→CDG one-way + NCE→GRU one-way separados. Some os dois preços.
- Round-trip pacote: GRU↔CDG no mesmo bilhete. Preço JÁ inclui ida e volta para Paris. Para ir a Cannes no dia 24 pega trem Nice→Paris (R$345) ou vai de Nice de trem (R$35 i+v).
- Compare as duas e escolha a mais barata para cada plano.

ESTIMATIVAS DE HOTEL (total da estadia em BRL):
${JSON.stringify(hotelEstimates, null, 2)}

Monte EXATAMENTE 3 estratégias com base nos dados reais:
1. BUDGET: menor custo total
2. CUSTO-BENEFÍCIO: melhor relação custo/conforto
3. QUASE LUXO: melhor experiência

Para cada estratégia: dia 24 DEVE ser em Cannes. Duração máx 14 dias. Some TODOS os custos.

Responda APENAS com JSON válido, sem markdown:
{
  "strategies": {
    "budget": {
      "nome": "Menor custo",
      "subtitulo": "descricao curta",
      "diasTotal": 12,
      "chegada": "YYYY-MM-DD",
      "partida": "YYYY-MM-DD",
      "vooIda":   { "date": "YYYY-MM-DD", "price": 0, "airline": "", "dep": "", "arr": "", "stops": 0, "dur": "", "route": "GRU->CDG" },
      "vooVolta": { "date": "YYYY-MM-DD", "price": 0, "airline": "", "dep": "", "arr": "", "stops": 0, "dur": "", "route": "NCE->GRU", "tipo": "open_jaw", "trainCost": 0 },
      "hotelParis": { "noites": 4, "ppn": 150, "total": 600, "categoria": "Hostel" },
      "hotelNice":  { "noites": 7, "ppn": 130, "total": 910, "categoria": "Hostel" },
      "trens": 144, "alimentacao": 2070, "transporte": 213, "totalGrand": 0,
      "roteiro": ["17/06: Chegada Paris", "24/06: Cannes Lions"],
      "justificativa": "por que esta e a melhor opcao budget",
      "kayakUrl": "https://www.kayak.com.br/flights/GRU-CDG/2026-06-17?sort=price_a",
      "economia": "quanto economiza vs o mais caro"
    },
    "custoBeneficio": {
      "nome": "Custo-Beneficio", "subtitulo": "descricao curta",
      "diasTotal": 12, "chegada": "YYYY-MM-DD", "partida": "YYYY-MM-DD",
      "vooIda":   { "date": "YYYY-MM-DD", "price": 0, "airline": "", "dep": "", "arr": "", "stops": 0, "dur": "", "route": "GRU->CDG" },
      "vooVolta": { "date": "YYYY-MM-DD", "price": 0, "airline": "", "dep": "", "arr": "", "stops": 0, "dur": "", "route": "NCE->GRU", "tipo": "open_jaw", "trainCost": 0 },
      "hotelParis": { "noites": 5, "ppn": 420, "total": 2100, "categoria": "Hotel 3 estrelas" },
      "hotelNice":  { "noites": 7, "ppn": 370, "total": 2590, "categoria": "Hotel 3 estrelas" },
      "trens": 294, "alimentacao": 3795, "transporte": 518, "totalGrand": 0,
      "roteiro": ["16/06: Chegada Paris", "24/06: Cannes Lions"],
      "justificativa": "por que esta e a melhor opcao custo-beneficio",
      "kayakUrl": "https://www.kayak.com.br/flights/GRU-CDG/2026-06-16?sort=price_a",
      "economia": ""
    },
    "quaseLuxo": {
      "nome": "Quase Luxo", "subtitulo": "descricao curta",
      "diasTotal": 13, "chegada": "YYYY-MM-DD", "partida": "YYYY-MM-DD",
      "vooIda":   { "date": "YYYY-MM-DD", "price": 0, "airline": "", "dep": "", "arr": "", "stops": 0, "dur": "", "route": "GRU->CDG" },
      "vooVolta": { "date": "YYYY-MM-DD", "price": 0, "airline": "", "dep": "", "arr": "", "stops": 0, "dur": "", "route": "NCE->GRU", "tipo": "open_jaw", "trainCost": 0 },
      "hotelParis": { "noites": 6, "ppn": 890, "total": 5340, "categoria": "Hotel 4 estrelas" },
      "hotelNice":  { "noites": 6, "ppn": 835, "total": 5010, "categoria": "Hotel 4 estrelas" },
      "trens": 857, "alimentacao": 7475, "transporte": 1150, "totalGrand": 0,
      "roteiro": ["14/06: Chegada Paris", "24/06: Cannes Lions"],
      "justificativa": "por que esta e a melhor experiencia premium",
      "kayakUrl": "https://www.kayak.com.br/flights/GRU-CDG/2026-06-14?sort=price_a",
      "economia": ""
    }
  },
  "analise": "paragrafo explicando a logica geral com base nos precos reais"
}`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.GROQ_API_KEY },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      throw new Error('Groq API: ' + (err.error?.message || groqRes.status));
    }

    const groqData = await groqRes.json();
    const text = groqData.choices?.[0]?.message?.content;
    if (!text) throw new Error('Groq não retornou resposta.');

    return res.status(200).json(JSON.parse(text));
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 30 };

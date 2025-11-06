const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ====================== PostgreSQL (Neon) ======================
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ====================== Gemini ======================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-2.0-flash" });

// ====================== Utilidades ======================
function normalize(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function similarity(a, b) {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1[i - 1] !== s2[j - 1]) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// ====================== CSV ======================
let listaDeAlimentos = [];

async function carregarAlimentos() {
  const res = await db.query('SELECT nome_alimento FROM alimentos');
  listaDeAlimentos = res.rows.map(r => r.nome_alimento);
}

// ====================== ROTA PRINCIPAL ======================
app.post('/analisar-refeicao', async (req, res) => {
  try {
    await carregarAlimentos();
    const { texto } = req.body;
    if (!texto) return res.status(400).json({ erro: "Texto obrigatório" });

    console.log('Texto recebido:', texto);

    const prompt = `
Você é uma IA de análise nutricional que transforma textos de refeições em alimentos exatos do banco de dados.

# LISTA DE ALIMENTOS DISPONÍVEIS
${listaDeAlimentos}

# TAREFA
Retorne um JSON onde cada item tem:
{ "alimento": "NOME EXATO DO BANCO", "quantidade": valor_em_gramas }

⚠️ Retorne apenas JSON, sem explicações.
"${texto}"
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    let geminiText = result.response.text();
    console.log("Resposta bruta Gemini:", geminiText);

    const cleanText = geminiText.replace(/```json/gi, "").replace(/```/g, "").trim();

    let itensInterpretados;
    try {
      itensInterpretados = JSON.parse(cleanText);
    } catch {
      // fallback: se for array de strings simples, transforma em objetos
      try {
        const arr = JSON.parse(cleanText.replace(/[\[\]]/g, "").split(",").map(s => `"${s.trim()}"`));
        itensInterpretados = arr.map(a => ({ alimento: a, quantidade: 100 }));
      } catch (err) {
        return res.status(500).json({ erro: "JSON inválido retornado pela IA", raw: geminiText });
      }
    }

    console.log("Itens interpretados:", itensInterpretados);

    const itens = [];

    for (const item of itensInterpretados) {
      const nomeIA = normalize(item.alimento);
      const quantidade = item.quantidade || 100;

      let melhorMatch = null;
      let melhorScore = 0;

      for (const nome of listaDeAlimentos) {
        const score = similarity(nomeIA, normalize(nome));
        if (score > melhorScore) {
          melhorScore = score;
          melhorMatch = nome;
        }
   }   

      console.log(`🔎 "${item.alimento}" → "${melhorMatch}" (score: ${melhorScore.toFixed(2)})`);

      if (melhorMatch && melhorScore > 0.35) {
        const result = await db.query(
          `SELECT * FROM alimentos WHERE LOWER(nome_alimento) LIKE $1 LIMIT 1`,
          [`%${normalize(melhorMatch)}%`]
        );

        if (result.rows.length > 0) {
          const a = result.rows[0];
          itens.push({
            alimento: a.nome_alimento,
            quantidade,
            kcal: (a.calorias * quantidade) / 100,
            proteina: (a.proteina * quantidade) / 100,
            carbo: (a.carboidrato * quantidade) / 100,
            gordura: (a.gordura * quantidade) / 100
          });
          continue;
        }
      }

      itens.push({
        alimento: item.alimento,
        quantidade,
        kcal: 0,
        proteina: 0,
        carbo: 0,
        gordura: 0,
        aviso: "Alimento não encontrado no banco"
      });
    }

    const totais = itens.reduce(
      (acc, i) => ({
        kcal: acc.kcal + i.kcal,
        proteina: acc.proteina + i.proteina,
        carbo: acc.carbo + i.carbo,
        gordura: acc.gordura + i.gordura
      }),
      { kcal: 0, proteina: 0, carbo: 0, gordura: 0 }
    );

    res.json({ itens, totais });

  } catch (erro) {
    console.error('Erro no servidor:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));

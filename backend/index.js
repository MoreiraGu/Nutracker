const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ====================== MySQL ======================
const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT
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

const csv = fs.readFileSync('C:/Users/santo/OneDrive/Área de Trabalho/Nutracker/alimentos_filtrados.csv', 'utf8');
// Lê o CSV, ignora cabeçalho e usa ; como separador
const linhas = csv
  .split('\n')
  .slice(1) // remove o cabeçalho
  .map(l => l.split(';')[0].trim()) // pega apenas a primeira coluna (descrição)
  .filter(l => l && !l.toLowerCase().includes('descrição dos alimentos'));

const listaDeAlimentos = linhas.join('\n');

// ====================== ROTA PRINCIPAL ======================
app.post('/analisar-refeicao', async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto) return res.status(400).json({ erro: "Texto obrigatório" });

    console.log('Texto recebido:', texto);

const prompt = `
Você é uma IA de análise nutricional que transforma textos de refeições em alimentos exatos do banco de dados.

# LISTA DE ALIMENTOS DISPONÍVEIS
Abaixo está a lista completa dos alimentos válidos (nomes oficiais do banco de dados):
${listaDeAlimentos}

# TAREFA
Sua tarefa é retornar um JSON onde cada "alimento" é exatamente igual a um nome da lista acima.
Você deve procurar o nome mais próximo na lista e usá-lo como está escrito, sem alterar letras, maiúsculas, vírgulas ou acentos.

# REGRAS
✅ Use apenas nomes da lista.  
✅ Se houver várias versões parecidas (ex: banana prata / banana nanica), escolha a mais semelhante ao texto do usuário.  
✅ Converta unidades para gramas (g):
   - 1 colher de sopa = 15g  
   - 1 colher de chá = 5g  
   - 1 xícara = 240g  
   - 1 unidade = peso médio estimado (ex: banana = 70g, ovo = 50g, etc.)
✅ Formato de saída:
[
  { "alimento": "NOME EXATO DO BANCO", "quantidade": número_em_gramas }
]
⚠️ Retorne apenas JSON puro, sem explicações nem comentários.

# Exemplo
Entrada:
"Ovos cozidos — 200 g, Banana nanica — 140 g, Aveia em flocos — 30 g"

Saída:
[
  { "alimento": "Ovo, galinha, cozido", "quantidade": 200 },
  { "alimento": "Banana, nanica, crua", "quantidade": 140 },
  { "alimento": "Aveia, flocos, crua", "quantidade": 30 }
]

Agora processe o seguinte texto do usuário:
"${texto}"
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    let geminiText = result.response.text();
    console.log("Resposta bruta Gemini:", geminiText);

    const cleanText = geminiText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let itensInterpretados;
    try {
      itensInterpretados = JSON.parse(cleanText);
    } catch (err) {
      return res.status(500).json({ erro: "JSON inválido retornado pela IA", raw: geminiText });
    }

    console.log("Itens interpretados:", itensInterpretados);

    const itens = [];

    for (const item of itensInterpretados) {
      const nomeIA = normalize(item.alimento);

      // 🧠 Busca a correspondência mais parecida no CSV
      let melhorMatch = null;
      let melhorScore = 0;

      for (const nome of linhas) {
        const score = similarity(nomeIA, normalize(nome));
        if (score > melhorScore) {
          melhorScore = score;
          melhorMatch = nome;
        }
      }

      console.log(`🔎 "${item.alimento}" → "${melhorMatch}" (score: ${melhorScore.toFixed(2)})`);

      if (melhorMatch && melhorScore > 0.35) {
        const [rows] = await db.query(
          `SELECT * FROM alimentos WHERE LOWER(nome_alimento) LIKE ? LIMIT 1`,
          [`%${normalize(melhorMatch)}%`]
        );

        if (rows.length > 0) {
          const a = rows[0];
          itens.push({
            alimento: a.nome_alimento,
            quantidade: item.quantidade,
            kcal: (a.calorias * item.quantidade) / 100,
            proteina: (a.proteina * item.quantidade) / 100,
            carbo: (a.carboidrato * item.quantidade) / 100,
            gordura: (a.gordura * item.quantidade) / 100
          });
          continue;
        }
      }

      itens.push({
        alimento: item.alimento,
        quantidade: item.quantidade,
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

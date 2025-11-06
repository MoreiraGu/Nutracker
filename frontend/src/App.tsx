import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const analisar = async () => {
    if (!texto.trim()) {
      setErro("Digite uma refeição para analisar!");
      return;
    }

    try {
      setErro('');
      setLoading(true);
      setResultado(null);

      const res = await axios.post('https://nutracker-1.onrender.com/analisar-refeicao', { texto });
      setResultado(res.data);
    } catch (err) {
      console.error(err);
      setErro("Erro ao consultar API. Tente novamente!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1 className="title">🥗 NutriAI Tracker</h1>
      <p className="subtitle">Cole sua refeição e descubra os macros automaticamente</p>

      <textarea
        className="input"
        rows={4}
        value={texto}
        onChange={e => setTexto(e.target.value)}
        placeholder="Ex: 100g arroz, 200g feijão, 100g frango"
      />

      {erro && <p className="error">⚠ {erro}</p>}

      <button onClick={analisar} className="btn" disabled={loading}>
        {loading ? "Analisando..." : "Analisar refeição"}
      </button>

      {resultado && (
        <div className="result-box">
          <h2 className="section-title">🍽 Itens</h2>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Alimento</th><th>Qtd (g)</th><th>Kcal</th><th>Prot</th><th>Carb</th><th>Gord</th>
                </tr>
              </thead>
              <tbody>
                {resultado.itens.map((i: any, idx: number) => (
                  <tr key={idx}>
                    <td>{i.alimento}</td>
                    <td>{i.quantidade}</td>
                    <td>{Number(i.kcal).toFixed(1)}</td>
                    <td>{Number(i.proteina).toFixed(1)}</td>
                    <td>{Number(i.carbo).toFixed(1)}</td>
                    <td>{Number(i.gordura).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="totals">
            <div className="card"><span>🔥 Calorias</span><strong>{resultado.totais.kcal.toFixed(1)}</strong></div>
            <div className="card"><span>🥩 Proteína</span><strong>{resultado.totais.proteina.toFixed(1)}g</strong></div>
            <div className="card"><span>🍚 Carbo</span><strong>{resultado.totais.carbo.toFixed(1)}g</strong></div>
            <div className="card"><span>🥑 Gordura</span><strong>{resultado.totais.gordura.toFixed(1)}g</strong></div>
          </div>

        </div>
      )}
    </div>
  );
}

export default App;

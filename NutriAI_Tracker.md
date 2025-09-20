# 📄 Relatório 1 – NutriAI Tracker
### 1. Objetivo do Projeto  
Criar um sistema web para **controle de dieta e macros** (calorias, proteínas, carboidratos e gorduras) com ajuda de **IA**. A ideia é que o usuário consiga inserir refeições de forma manual ou em linguagem natural, e o sistema organize os dados automaticamente.  

### 2. Público-Alvo  
- Pessoas que fazem dieta para emagrecimento, hipertrofia ou manutenção.  
- Usuários que querem praticidade em calcular macros sem usar planilhas manuais.  

### 3. Funcionalidades  
#### **MVP (versão inicial):**  
- Inserção manual de refeições (alimento + quantidade).  
- Cálculo automático dos macros a partir de banco de dados nutricional (ex: TACO).  
- Exibição dos totais por refeição e por dia.  

#### **Versão Avançada:**  
- Inserção de refeições por texto livre (ex: “almoço: 100g arroz, 150g frango, 10ml azeite”).  
- IA interpreta os alimentos, consulta no banco e soma macros.  
- Histórico diário e semanal de refeições.  
- Gráficos com consumo de macros e calorias (Chart.js ou Recharts).  
- Relatórios exportáveis em PDF.  
- Sugestões automáticas de ajustes (“faltam 20g de proteína hoje”).  

### 4. Diferencial  
O uso de **IA** para interpretar refeições em linguagem natural e **organizar os dados automaticamente**, tornando a experiência muito mais simples que usar Excel ou apps complexos.  

### 5. Tecnologias  
- **Frontend:** React + TypeScript + Tailwind CSS (ou CSS puro).  
- **Backend:** Node.js + Express.  
- **Banco de Dados:** PostgreSQL (ou SQLite no MVP).  
- **IA:** OpenAI API no início; possibilidade de usar Ollama local no futuro.  
- **Extras:**  
  - Chart.js/Recharts para gráficos.  
  - JWT para autenticação (multiusuário).  
  - Docker para containerização.  

### 6. Futuras Evoluções  
- Planejamento automático de dietas semanais.  
- Integração com wearables (ex: smartwatch).  
- Dashboard de evolução de peso e composição corporal.  

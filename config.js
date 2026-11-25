// ============================================================
//  janelAI — configuração
//  Cole aqui os links "Publicar na web" (formato CSV) de cada aba.
//  Enquanto o link estiver vazio, o site mostra os dados de exemplo
//  da pasta /dados, com um aviso no topo.
// ============================================================

export default {
  fontes: {
    pos: {
      // Planilha "Monitor de editais de pós-graduação", aba "Editais de pós"
      url: '',
      exemplo: 'dados/exemplo-pos.csv',
    },
    vagas: {
      // Planilha "Monitor de vagas e seleções", aba "Vagas e seleções"
      url: '',
      exemplo: 'dados/exemplo-vagas.csv',
    },
  },

  // Prazos que vencem em até X dias recebem destaque vermelho.
  diasUrgente: 3,

  // Período usado no resumo "encerram nos próximos X dias".
  diasEmBreve: 7,

  // Tempo máximo (ms) para esperar cada planilha antes de mostrar erro.
  tempoLimite: 15000,
};

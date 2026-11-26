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
      url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzrADG-QP7cm3-JIL-vx6ruryQVPHul9AN2Egz_3DUj7ZgStjdD-6V1akWUUWSqBz2uIsMDQ_N4kfz/pub?gid=1602070785&single=true&output=csv',
      exemplo: 'dados/exemplo-pos.csv',
    },
    vagas: {
      // Planilha "Monitor de vagas e seleções", aba "Vagas e seleções"
      url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTqEmrQmC-9eK_uUlp0ImjVpmlRhYwHfne-UjQE7lnJ3f2JK2hzXqHK_SFsRWnpvdPGRc61s4uINi6u/pub?gid=1759819961&single=true&output=csv',
      exemplo: 'dados/exemplo-vagas.csv',
    },
  },

  // Prazos que vencem em até X dias recebem destaque vermelho.
  diasUrgente: 3,

  // Período usado no resumo "encerram nos próximos X dias".
  diasEmBreve: 7,

  // Tempo máximo (ms) para esperar cada planilha antes de mostrar erro.
  tempoLimite: 15000,

  // Endereço do Google Apps Script (ver README → "Sites monitorados").
  // Com ele, o site mostra a lista de sites da aba "Sites monitorados" e o
  // formulário "Adicionar site" grava direto na planilha. Vazio = só leitura.
  scriptUrl: '',

  // Filtro por área. Cada item vira uma opção do filtro "Área".
  // "palavras" são começos de palavra procurados no título e na situação,
  // sem acento e sem diferença de maiúsculas: "eletric" pega elétrica, elétrico, eletricista.
  // Um edital pode cair em mais de uma área. Adicione, remova ou ajuste à vontade.
  areas: [
    { id: 'ti', nome: 'TI e computação', palavras: ['computa', 'informatica', 'software', 'dados', 'inteligencia artificial', 'ia', 'ai', 'tecnologia da informacao', 'ti', 'sistemas de informacao', 'desenvolvedor', 'programacao', 'programador', 'front end', 'back end', 'fullstack', 'appsec', 'seguranca da informacao', 'ciberseg', 'redes de computadores', 'jogos digitais', 'teste de software', 'flutter', 'webrtc', 'cloud', 'devops', 'machine learning'] },
    { id: 'eletrica', nome: 'Elétrica e eletrônica', palavras: ['eletric', 'eletronic', 'eletrotecnic', 'automacao', 'telecomunica', 'energ', 'robotic', 'sistemas embarcados', 'controle e automacao', 'mecatronic'] },
    { id: 'engenharias', nome: 'Engenharias', palavras: ['engenharia', 'engenheir', 'civil', 'mecanic', 'engenharia de producao', 'ciencia dos materiais', 'estruturas'] },
    { id: 'saude', nome: 'Saúde', palavras: ['saude', 'enfermag', 'medicin', 'residencia', 'hospital', 'farmac', 'nutric', 'odontolog', 'fisioterap', 'psicolog', 'biomedic', 'butantan', 'fiocruz'] },
    { id: 'educacao', nome: 'Educação e ensino', palavras: ['educa', 'ensino', 'docencia', 'professor', 'pedagog', 'licenciatura', 'formacao de professores', 'libras', 'surdos', 'material didatico', 'mediador pedagogic', 'inclusiv'] },
    { id: 'gestao', nome: 'Gestão e negócios', palavras: ['gestao', 'administra', 'negocio', 'mba', 'contab', 'econom', 'marketing', 'inovacao', 'empreend', 'financ', 'logistic', 'recursos humanos'] },
    { id: 'exatas', nome: 'Ciências exatas', palavras: ['matematic', 'fisica', 'estatistic', 'quimica', 'ciencias exatas'] },
    { id: 'humanas', nome: 'Humanas, letras e comunicação', palavras: ['letras', 'sociolog', 'histori', 'filosof', 'comunica', 'jornalis', 'politicas publicas', 'cultura', 'artes', 'design', 'tradutor', 'direito', 'juridic'] },
    { id: 'agrarias', nome: 'Agrárias e ambiente', palavras: ['agro', 'agronom', 'ambient', 'viticultura', 'zootecn', 'veterinar', 'florest', 'sociobiodiversidade', 'gastronom', 'alimentos', 'aquicultura'] },
  ],
};

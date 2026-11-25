/**
 * janelAI: lista de sites monitorados + formulário "Adicionar site".
 *
 * Cole este arquivo no Apps Script da planilha "Monitor de editais de pós-graduação"
 * (Extensões → Apps Script) e publique como app da Web. Passo a passo no README.
 *
 * GET  → devolve a aba "Sites monitorados" em JSON (o janelAI mostra a lista).
 * POST → acrescenta um site enviado pelo formulário do janelAI.
 */

const ABA = 'Sites monitorados';
const CABECALHO = ['Adicionado em', 'Nome', 'Endereço', 'Tipo', 'Observação', 'Origem'];
const TIPOS = { pos: 'Pós-graduação', vagas: 'Vagas e seleções' };
const LIMITE_POR_DIA = 20; // proteção simples contra envio em massa
const FUSO = 'America/Sao_Paulo';

function doGet() {
  const linhas = aba_().getDataRange().getDisplayValues().slice(1);
  const sites = linhas
    .filter((l) => l[1] || l[2])
    .map((l) => ({ adicionado: l[0], nome: l[1], url: l[2], tipo: l[3], obs: l[4], origem: l[5] }));
  return json_({ ok: true, sites: sites });
}

function doPost(e) {
  let dados;
  try {
    dados = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, erro: 'formato' });
  }

  // Campo invisível do formulário: só robôs preenchem.
  if (dados.site_web) return json_({ ok: true });

  const nome = limpar_(dados.nome, 80);
  const url = limpar_(dados.url, 300);
  const obs = limpar_(dados.obs, 300);
  const tipo = TIPOS[dados.tipo] || TIPOS.pos;
  if (!nome || !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(url)) return json_({ ok: false, erro: 'dados' });

  const cache = CacheService.getScriptCache();
  const hoje = Utilities.formatDate(new Date(), FUSO, 'yyyyMMdd');
  const enviados = Number(cache.get('envios-' + hoje) || 0);
  if (enviados >= LIMITE_POR_DIA) return json_({ ok: false, erro: 'limite' });

  const trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    const sh = aba_();
    const existentes = sh.getRange(1, 3, Math.max(sh.getLastRow(), 1), 1).getDisplayValues().map((l) => normalizarUrl_(l[0]));
    if (existentes.indexOf(normalizarUrl_(url)) !== -1) return json_({ ok: false, erro: 'duplicado' });

    sh.appendRow([
      "'" + Utilities.formatDate(new Date(), FUSO, 'dd/MM/yyyy'),
      nome, url, tipo, obs, 'Formulário do janelAI',
    ]);
    cache.put('envios-' + hoje, String(enviados + 1), 21600);
  } finally {
    trava.releaseLock();
  }
  return json_({ ok: true });
}

// ---------- auxiliares ----------

function aba_() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  let sh = planilha.getSheetByName(ABA);
  if (!sh) {
    sh = planilha.insertSheet(ABA);
    sh.appendRow(CABECALHO);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Corta o tamanho e impede que o texto vire fórmula na planilha. */
function limpar_(valor, max) {
  let s = String(valor == null ? '' : valor).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function normalizarUrl_(u) {
  return String(u || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

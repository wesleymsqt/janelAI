// ============================================================
//  janelAI: leitura e interpretação das planilhas (sem DOM)
// ============================================================

/** Remove acentos e baixa a caixa, para comparar textos. */
export function normalizar(txt) {
  return String(txt ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Parser de CSV (RFC 4180): aspas, vírgulas e quebras de linha dentro de campos. */
export function lerCSV(texto) {
  const linhas = [];
  let linha = [];
  let campo = '';
  let emAspas = false;
  const t = String(texto).replace(/^﻿/, '');

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (emAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; }
        else emAspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') emAspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((v) => v.trim() !== ''));
}

const RE_DATA = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;

/** "dd/mm/aaaa" → Date (meia-noite local) ou null. */
export function lerData(txt) {
  const m = RE_DATA.exec(String(txt ?? ''));
  if (!m) return null;
  let [, d, mes, a] = m.map(Number);
  if (a < 100) a += 2000;
  const data = new Date(a, mes - 1, d);
  if (data.getMonth() !== mes - 1 || data.getDate() !== d) return null;
  return data;
}

export function inicioDoDia(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function diasEntre(a, b) {
  return Math.round((inicioDoDia(b) - inicioDoDia(a)) / 86400000);
}

/** Descobre o índice de cada coluna pelo cabeçalho; cai para a ordem padrão. */
function mapearColunas(cabecalho) {
  const n = cabecalho.map(normalizar);
  const achar = (...chaves) => n.findIndex((h) => chaves.some((k) => h.includes(k)));
  const mapa = {
    data: achar('data'),
    site: achar('site', 'instituic', 'orgao'),
    titulo: achar('titulo', 'nome'),
    situacao: achar('situac', 'status', 'detalhe'),
    link: achar('link', 'url', 'endereco'),
  };
  const padrao = { data: 0, site: 1, titulo: 2, situacao: 3, link: 4 };
  for (const k of Object.keys(mapa)) if (mapa[k] < 0) mapa[k] = padrao[k];
  return mapa;
}

/** Interpreta a coluna "Situação / detalhe". */
export function analisarSituacao(texto, hoje = inicioDoDia()) {
  const bruto = String(texto ?? '').trim();
  const t = normalizar(bruto);
  let status;

  if (/^(inscricoes abertas|inscricao aberta|vagas? abertas?|aberto|aberta)/.test(t)) status = 'aberto';
  else if (/^em andamento/.test(t)) status = 'andamento';
  else if (/^encerrad/.test(t)) status = 'encerrado';
  else if (/^atualizac/.test(t)) status = 'atualizacao';
  else if (/inscricoes abertas|vaga aberta/.test(t)) status = 'aberto';
  else if (/encerrad/.test(t)) status = 'encerrado';
  else status = 'atualizacao';

  // Prazo: data após "até"; se não houver, a primeira data num texto de inscrições abertas.
  const mAte = /at[eé]\s*(?:o dia\s*)?(\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(bruto);
  let prazo = mAte ? lerData(mAte[1]) : null;
  if (!prazo && status === 'aberto') prazo = lerData(bruto);

  let vencido = false;
  if (prazo && status === 'aberto' && prazo < hoje) { status = 'encerrado'; vencido = true; }

  // Detalhe extra: o que sobra além do padrão (só mostramos se acrescenta algo).
  let detalhe = bruto
    .replace(/^(inscri[cç][oõ]es abertas|vagas? abertas?|em andamento|encerrad[oa]s?)\s*/i, '')
    .replace(/^atualiza[cç][aã]o\s*:?\s*/i, '')
    .replace(/^at[eé]\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*/i, '')
    .replace(/^[\s.,;:—–-]+/, '')
    .trim();
  if (detalhe.length < 3) detalhe = '';
  if (detalhe) detalhe = detalhe[0].toUpperCase() + detalhe.slice(1);

  return { status, prazo, vencido, detalhe };
}

/** EaD / presencial / híbrido / nd, a partir do título e da situação. */
export function detectarModalidade(...textos) {
  const t = normalizar(textos.join(' '));
  if (/semipresencial|semi-presencial|hibrid/.test(t)) return 'hibrido';
  if (/\bead\b|\ba distancia\b|\bensino remoto\b|\b100% online\b/.test(t)) return 'ead';
  if (/presencial/.test(t)) return 'presencial';
  return 'nd';
}

/**
 * Nível do curso, pelo título: doutorado, mestrado ou especialização (o resto da pós:
 * especialização, MBA, residência…). "Mestrado e Doutorado em X" entra nas duas abas.
 */
export function detectarNiveis(titulo) {
  const t = normalizar(titulo);
  const niveis = [];
  if (/doutorado|\bphd\b/.test(t)) niveis.push('doutorado');
  if (/mestrado/.test(t)) niveis.push('mestrado');
  if (!niveis.length) niveis.push('especializacao');
  return niveis;
}

/** Exibe a instituição: se vier uma URL, mostra só o domínio. */
function nomeInstituicao(site) {
  const s = String(site ?? '').trim();
  if (/^https?:\/\//i.test(s)) {
    try { return new URL(s).hostname.replace(/^www\./, ''); } catch { /* segue */ }
  }
  return s || 'Instituição não informada';
}

function linkSeguro(url) {
  const u = String(url ?? '').trim();
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:' ? p.href : '';
  } catch { return ''; }
}

function chave(item) {
  const base = `${item.link}|${normalizar(item.titulo)}|${normalizar(item.site)}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0;
  return 'j' + (h >>> 0).toString(36);
}

/** CSV bruto → lista de itens prontos para a interface. */
export function montarItens(textoCSV, hoje = inicioDoDia()) {
  const linhas = lerCSV(textoCSV);
  if (!linhas.length) return [];

  let inicio = 0;
  let mapa = { data: 0, site: 1, titulo: 2, situacao: 3, link: 4 };
  if (!lerData(linhas[0][0])) { mapa = mapearColunas(linhas[0]); inicio = 1; }

  const itens = [];
  const vistos = new Set();
  for (const l of linhas.slice(inicio)) {
    // Linhas de referência interna nunca aparecem.
    if (l.some((v) => normalizar(v).includes('linha de corte'))) continue;

    const titulo = (l[mapa.titulo] ?? '').trim();
    const situacaoTexto = (l[mapa.situacao] ?? '').trim();
    if (!titulo && !situacaoTexto) continue;

    const site = (l[mapa.site] ?? '').trim();
    const sit = analisarSituacao(situacaoTexto, hoje);
    const item = {
      titulo: titulo || 'Sem título',
      site,
      instituicao: nomeInstituicao(site),
      situacaoTexto,
      ...sit,
      encontrado: lerData(l[mapa.data]),
      link: linkSeguro(l[mapa.link]),
      modalidade: detectarModalidade(titulo, situacaoTexto),
      niveis: detectarNiveis(titulo),
    };
    item.diasRestantes = item.prazo ? diasEntre(hoje, item.prazo) : null;
    item.id = chave(item);
    if (vistos.has(item.id)) continue;
    vistos.add(item.id);
    item.busca = normalizar(`${item.titulo} ${item.instituicao} ${item.site} ${item.situacaoTexto}`);
    itens.push(item);
  }
  return itens;
}

const ORDEM_STATUS = { aberto: 0, andamento: 1, atualizacao: 2, encerrado: 3 };

/** Abertos por prazo mais próximo; depois andamento, atualização, encerrados. */
export function ordenar(itens) {
  const tempo = (d, vazio) => (d ? d.getTime() : vazio);
  return [...itens].sort((a, b) => {
    const s = ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status];
    if (s) return s;
    if (a.status === 'aberto') {
      const p = tempo(a.prazo, Infinity) - tempo(b.prazo, Infinity);
      if (p) return p;
    }
    if (a.status === 'encerrado') {
      const p = tempo(b.prazo, -Infinity) - tempo(a.prazo, -Infinity);
      if (p && Number.isFinite(p)) return p;
    }
    return tempo(b.encontrado, 0) - tempo(a.encontrado, 0);
  });
}

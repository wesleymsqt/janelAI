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

// Período "dd/mm[/aaaa] a dd/mm/aaaa" (também "até", "-", "–"): o prazo é a data final.
const RE_FAIXA = /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*(?:a|à|at[eé]|-|–|—)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i;
const RE_FAIXA_INICIO = /^(de\s*)?\d{1,2}\/\d{1,2}(\/\d{2,4})?\s*(a|à|at[eé]|-|–|—)\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*/i;
const RE_ATE = /at[eé]\s*(?:o dia\s*|dia\s*)?(\d{1,2}\/\d{1,2}\/\d{2,4})/i;

/** Interpreta a coluna "Situação / detalhe". */
export function analisarSituacao(texto, hoje = inicioDoDia()) {
  const bruto = String(texto ?? '').trim();
  const t = normalizar(bruto).replace(/^["“”']+/, '');
  let status;

  // A ordem importa: "Em andamento (inscrições encerradas)" é andamento, "Sem vagas abertas" é encerrado.
  if (/^em andamento/.test(t)) status = 'andamento';
  else if (/^atualizac/.test(t)) status = 'atualizacao';
  else if (/^(sem vagas?|nenhuma vaga|encerrad)|inscricoes encerradas/.test(t)) status = 'encerrado';
  else if (/^((inscricoes abertas|inscricao aberta|vagas? abertas?|aberto|aberta)\b|inscricoes (ate |de )?\d)/.test(t)) status = 'aberto';
  else if (/^(em breve|matricula|resultado)|chamada para matricula/.test(t)) status = 'andamento';
  else if (/inscricoes abertas|vaga aberta/.test(t)) status = 'aberto';
  else if (/encerrad/.test(t)) status = 'encerrado';
  else status = 'atualizacao';

  // Prazo: o fim de um período ("18/11/2026 a 18/01/2027", "03/11 a 13/12/2026")
  // ou a data depois de "até" — o que aparecer primeiro no texto.
  const mFaixa = RE_FAIXA.exec(bruto);
  const mAte = RE_ATE.exec(bruto);
  const candidatos = [
    mFaixa && { pos: mFaixa.index, data: lerData(mFaixa[2]) },
    mAte && { pos: mAte.index, data: lerData(mAte[1]) },
  ].filter((c) => c && c.data).sort((a, b) => a.pos - b.pos);
  const prazo = candidatos[0]?.data ?? null;

  let vencido = false;
  if (prazo && status === 'aberto' && prazo < hoje) { status = 'encerrado'; vencido = true; }

  // Detalhe extra: o que sobra além do padrão (só mostramos se acrescenta algo).
  let detalhe = bruto
    .replace(/^["“”']([^"“”']*)["“”']/, '$1')
    .replace(/^["“”']+/, '')
    .replace(/^(inscri[cç][oõ]es( abertas)?|inscri[cç][aã]o aberta|vagas? abertas?|abert[oa]|em andamento|encerrad[oa]s?)\s*/i, '')
    .replace(/^atualiza[cç][aã]o\s*:?\s*/i, '')
    .replace(RE_FAIXA_INICIO, '')
    .replace(/^at[eé]\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*/i, '')
    .replace(/^[\s.,;:—–-]+/, '')
    .trim()
    .replace(/^\((.*)\)$/, '$1');
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

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Prepara a lista de áreas do config.js: cada palavra vira "começo de palavra". */
export function prepararAreas(areas = []) {
  return areas.map((a) => ({
    id: a.id,
    nome: a.nome,
    // Palavras de até 3 letras ("ti", "ia", "mba") só valem inteiras, para "ti" não pegar "tipo".
    re: new RegExp(`(^|[^a-z0-9])(${a.palavras.map((p) => {
      const n = escaparRegex(normalizar(p));
      return n.length <= 3 ? `${n}(?![a-z0-9])` : n;
    }).join('|')})`),
  }));
}

/** Áreas de um edital (pode ser mais de uma), a partir do título e da situação. */
export function detectarAreas(areasPreparadas, ...textos) {
  const t = normalizar(textos.join(' '));
  return areasPreparadas.filter((a) => a.re.test(t)).map((a) => a.id);
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
export function montarItens(textoCSV, hoje = inicioDoDia(), areas = []) {
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
      areas: detectarAreas(areas, titulo, situacaoTexto),
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

/**
 * Sites que aparecem na planilha, inclusive nas linhas de "linha de corte"
 * (a tarefa grava uma por site a cada busca). Devolve nome, página mais citada,
 * última data em que o site apareceu e quantos editais/vagas ele tem.
 */
export function extrairSites(textoCSV) {
  const linhas = lerCSV(textoCSV);
  if (!linhas.length) return [];
  let inicio = 0;
  let mapa = { data: 0, site: 1, titulo: 2, situacao: 3, link: 4 };
  if (!lerData(linhas[0][0])) { mapa = mapearColunas(linhas[0]); inicio = 1; }

  const sites = new Map();
  for (const l of linhas.slice(inicio)) {
    const nome = (l[mapa.site] ?? '').trim();
    if (!nome || normalizar(nome) === 'linha de corte') continue;
    const chaveSite = normalizar(nome);
    const s = sites.get(chaveSite) || { nome: nomeInstituicao(nome), links: new Map(), ultima: null, itens: 0 };
    const link = linkSeguro(l[mapa.link]);
    if (link) s.links.set(link, (s.links.get(link) || 0) + 1);
    const data = lerData(l[mapa.data]);
    if (data && (!s.ultima || data > s.ultima)) s.ultima = data;
    if (!l.some((v) => normalizar(v).includes('linha de corte'))) s.itens++;
    sites.set(chaveSite, s);
  }
  return [...sites.values()].map((s) => ({
    nome: s.nome,
    url: [...s.links.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    ultima: s.ultima,
    itens: s.itens,
  }));
}

const ORDEM_STATUS ={ aberto: 0, andamento: 1, atualizacao: 2, encerrado: 3 };

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

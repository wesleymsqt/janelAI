// ============================================================
//  janelAI: interface
// ============================================================
import CONFIG from '../config.js';
import { montarItens, ordenar, normalizar, inicioDoDia } from './dados.js';

const DIAS_URGENTE = CONFIG.diasUrgente ?? 3;
const DIAS_BREVE = CONFIG.diasEmBreve ?? 7;
const ABAS = ['pos', 'vagas'];
const NOME_ABA = { pos: 'Pós-graduação', vagas: 'Vagas e seleções' };

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtLonga = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icone = (id) => `<svg aria-hidden="true" focusable="false"><use href="#i-${id}"/></svg>`;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// ---------- armazenamento seguro ----------
const armazem = {
  ler(area, k) { try { return window[area].getItem(k); } catch { return null; } },
  gravar(area, k, v) { try { window[area].setItem(k, v); } catch { /* modo privado */ } },
};

// ---------- estado ----------
const filtroPadrao = () => ({ q: '', status: 'todos', inst: '', mod: '', novos: false, semana: false });

const estado = {
  hoje: inicioDoDia(),
  aba: ABAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : (armazem.ler('localStorage', 'janela:aba') || 'pos'),
  fontes: Object.fromEntries(ABAS.map((a) => [a, { estado: 'carregando', itens: [], erro: null }])),
  filtros: Object.fromEntries(ABAS.map((a) => [a, filtroPadrao()])),
  encerradosAbertos: { pos: false, vagas: false },
  ultimaVisita: null,
  atualizadoEm: null,
};
if (!ABAS.includes(estado.aba)) estado.aba = 'pos';

// Última visita: o valor de antes desta sessão vira a base do "novo",
// assim recarregar a página não apaga as novidades.
(function prepararVisita() {
  const K_VISITA = 'janela:ultimaVisita';
  const K_BASE = 'janela:baseDaSessao';
  let base = armazem.ler('sessionStorage', K_BASE);
  if (base === null) {
    base = armazem.ler('localStorage', K_VISITA) || '';
    armazem.gravar('sessionStorage', K_BASE, base);
  }
  armazem.gravar('localStorage', K_VISITA, new Date().toISOString());
  const d = base ? new Date(base) : null;
  estado.ultimaVisita = d && !isNaN(d) ? d : null;
})();

const ehNovo = (it) => !!(estado.ultimaVisita && it.encontrado && it.encontrado > inicioDoDia(estado.ultimaVisita));
const venceEmBreve = (it, dias) => it.status !== 'encerrado' && it.diasRestantes !== null && it.diasRestantes >= 0 && it.diasRestantes <= dias;

// ---------- carregamento ----------
class ErroFonte extends Error {
  constructor(tipo, detalhe) { super(tipo); this.tipo = tipo; this.detalhe = detalhe; }
}

const MENSAGENS = {
  rede: 'Não foi possível conectar à planilha. Confira sua internet e se a aba continua publicada na web.',
  tempo: 'A planilha demorou demais para responder. Pode ser instabilidade do Google; tente de novo em instantes.',
  http: (s) => s === 404 || s === 400
    ? `O link da planilha não foi encontrado (erro ${s}). Confira o endereço em config.js.`
    : `O Google respondeu com erro ${s}. Tente de novo em instantes.`,
  html: 'O link abriu uma página em vez de um arquivo CSV. Em “Publicar na web”, escolha o formato “Valores separados por vírgula (.csv)”.',
  vazio: 'O arquivo veio vazio. Confira se a aba certa foi publicada.',
};
const mensagemDe = (e) => (e.tipo === 'http' ? MENSAGENS.http(e.detalhe) : MENSAGENS[e.tipo] || MENSAGENS.rede);

async function baixar(aba) {
  const cfg = CONFIG.fontes[aba];
  const real = (cfg.url || '').trim();
  const url = real || cfg.exemplo;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.tempoLimite || 15000);
  try {
    let resp;
    try { resp = await fetch(url, { cache: 'no-store', signal: ctrl.signal }); }
    catch (e) { throw new ErroFonte(e.name === 'AbortError' ? 'tempo' : 'rede'); }
    if (!resp.ok) throw new ErroFonte('http', resp.status);
    const texto = await resp.text();
    if (/^\s*<(!doctype|html)/i.test(texto)) throw new ErroFonte('html');
    if (!texto.trim()) throw new ErroFonte('vazio');
    if (real) armazem.gravar('localStorage', `janela:cache:${aba}`, JSON.stringify({ texto, em: new Date().toISOString() }));
    return { itens: ordenar(montarItens(texto, estado.hoje)), exemplo: !real };
  } finally { clearTimeout(timer); }
}

async function carregar(aba) {
  const f = estado.fontes[aba];
  f.estado = 'carregando'; f.erro = null; f.cache = null;
  if (aba === estado.aba) renderPainel();
  try {
    const r = await baixar(aba);
    Object.assign(f, { estado: 'ok', itens: r.itens, exemplo: r.exemplo });
  } catch (e) {
    const erro = e instanceof ErroFonte ? e : new ErroFonte('rede');
    let salvo = null;
    try { salvo = JSON.parse(armazem.ler('localStorage', `janela:cache:${aba}`) || 'null'); } catch { /* ignora */ }
    if (salvo?.texto) {
      Object.assign(f, { estado: 'ok', itens: ordenar(montarItens(salvo.texto, estado.hoje)), cache: new Date(salvo.em), erro });
    } else {
      Object.assign(f, { estado: 'erro', itens: [], erro });
    }
  }
  estado.atualizadoEm = new Date();
  renderTudo();
}

async function carregarTudo() {
  const botao = $('#recarregar');
  botao.setAttribute('aria-busy', 'true');
  botao.disabled = true;
  $('#atualizado').textContent = 'Carregando planilhas…';
  $('#stats').setAttribute('aria-busy', 'true');
  await Promise.allSettled(ABAS.map(carregar));
  botao.removeAttribute('aria-busy');
  botao.disabled = false;
  $('#stats').setAttribute('aria-busy', 'false');
  renderCabecalho();
}

// ---------- cabeçalho e resumo ----------
function renderCabecalho() {
  $('#hoje').textContent = fmtLonga.format(new Date());
  const fs = ABAS.map((a) => estado.fontes[a]);
  const at = $('#atualizado');
  if (fs.some((f) => f.estado === 'carregando')) at.textContent = 'Carregando planilhas…';
  else if (fs.every((f) => f.estado === 'erro')) at.textContent = 'Sem dados no momento';
  else if (fs.some((f) => f.cache)) at.textContent = 'Mostrando dados salvos';
  else if (fs.some((f) => f.estado === 'erro')) at.textContent = `Uma das planilhas não carregou · ${fmtHora.format(estado.atualizadoEm || new Date())}`;
  else at.textContent = `Atualizado às ${fmtHora.format(estado.atualizadoEm || new Date())}`;
  $('#aviso-exemplo').hidden = !fs.some((f) => f.exemplo);
}

function renderResumo() {
  const prontas = ABAS.filter((a) => estado.fontes[a].estado === 'ok');
  if (!prontas.length && ABAS.some((a) => estado.fontes[a].estado === 'carregando')) return;

  const conta = (fn) => Object.fromEntries(ABAS.map((a) => [a, estado.fontes[a].itens.filter(fn).length]));
  const soma = (o) => o.pos + o.vagas;
  const ok = (a) => estado.fontes[a].estado === 'ok';
  const detalhar = (o) => `${ok('pos') ? o.pos : '—'} pós · ${ok('vagas') ? o.vagas : '—'} vagas`;

  const abertos = conta((it) => it.status === 'aberto');
  const semana = conta((it) => venceEmBreve(it, DIAS_BREVE));
  const urgentes = soma(conta((it) => venceEmBreve(it, DIAS_URGENTE)));
  const novos = conta(ehNovo);

  const num = (id, v) => { const el = $(id); el.textContent = v; el.classList.toggle('tem-valor', v !== '—' && v > 0); };
  num('#st-abertos', soma(abertos));
  $('#st-abertos-sub').textContent = detalhar(abertos);

  $('#st-semana-rotulo').textContent = `Encerram em ${DIAS_BREVE} dias`;
  num('#st-semana', soma(semana));
  $('#st-semana-sub').textContent = urgentes
    ? `${plural(urgentes, 'vence', 'vencem')} em até ${DIAS_URGENTE} dias`
    : 'Nenhum vence nos próximos dias';

  if (estado.ultimaVisita) {
    num('#st-novos', soma(novos));
    $('#st-novos-sub').textContent = `Desde ${fmtCurta.format(estado.ultimaVisita)}, sua última visita`;
  } else {
    num('#st-novos', '—');
    $('#st-novos-sub').textContent = 'Primeira visita: a partir da próxima, marcamos o que é novo';
  }

  for (const a of ABAS) {
    const f = estado.fontes[a];
    const el = $(`#cont-${a}`);
    el.innerHTML = f.estado === 'ok' ? `${abertos[a]}<span class="sr-only"> ${abertos[a] === 1 ? 'aberto' : 'abertos'}</span>` : '';
  }
}

// ---------- abas ----------
function trocarAba(aba, focar = false) {
  if (!ABAS.includes(aba)) return;
  estado.aba = aba;
  armazem.gravar('localStorage', 'janela:aba', aba);
  history.replaceState(null, '', `#${aba}`);
  for (const b of document.querySelectorAll('[role="tab"]')) {
    const sel = b.dataset.aba === aba;
    b.setAttribute('aria-selected', String(sel));
    b.tabIndex = sel ? 0 : -1;
    if (sel && focar) b.focus();
  }
  $('#painel').setAttribute('aria-labelledby', `aba-${aba}`);
  preencherFormulario();
  renderPainel();
}

// ---------- filtros ----------
const form = () => $('#filtros');

function preencherFormulario() {
  const f = estado.filtros[estado.aba];
  const el = form().elements;
  el.q.value = f.q;
  for (const r of el.status) r.checked = r.value === f.status;
  el.mod.value = f.mod;
  el.novos.checked = f.novos;
  el.semana.checked = f.semana;
  const ehPos = estado.aba === 'pos';
  $('#campo-mod').hidden = !ehPos;
  $('.filtros-grade').classList.toggle('uma-coluna', !ehPos);
  $('#f-semana-rotulo').textContent = `Vencem em até ${DIAS_BREVE} dias`;
  // Na primeira visita ainda não há base para "novo": o filtro some em vez de ficar desativado.
  $('#f-novos').closest('.toggle').hidden = !estado.ultimaVisita;
}

function lerFormulario() {
  const el = form().elements;
  const f = estado.filtros[estado.aba];
  f.q = el.q.value;
  f.status = el.status.value || 'todos';
  f.inst = el.inst.value;
  f.mod = estado.aba === 'pos' ? el.mod.value : '';
  f.novos = el.novos.checked;
  f.semana = el.semana.checked;
}

const filtroAtivo = (f) => f.q.trim() || f.status !== 'todos' || f.inst || f.mod || f.novos || f.semana;

function atualizarInstituicoes(itens) {
  const sel = $('#f-inst');
  const f = estado.filtros[estado.aba];
  const contagem = new Map();
  for (const it of itens) contagem.set(it.instituicao, (contagem.get(it.instituicao) || 0) + 1);
  const nomes = [...contagem.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (f.inst && !contagem.has(f.inst)) f.inst = '';
  sel.innerHTML = `<option value="">Todas (${contagem.size})</option>` +
    nomes.map((n) => `<option value="${esc(n)}">${esc(n)} (${contagem.get(n)})</option>`).join('');
  sel.value = f.inst;
}

function aplicarFiltros(itens, f) {
  const termos = normalizar(f.q).split(/\s+/).filter(Boolean);
  return itens.filter((it) => {
    if (f.status !== 'todos' && it.status !== f.status) return false;
    if (f.inst && it.instituicao !== f.inst) return false;
    if (f.mod && it.modalidade !== f.mod) return false;
    if (f.novos && !ehNovo(it)) return false;
    if (f.semana && !venceEmBreve(it, DIAS_BREVE)) return false;
    if (termos.length && !termos.every((t) => it.busca.includes(t))) return false;
    return true;
  });
}

// ---------- cards ----------
const SELO = {
  aberto: ['Aberto', 'aberto'],
  andamento: ['Em andamento', 'andamento'],
  atualizacao: ['Atualização', 'atualizacao'],
  encerrado: ['Encerrado', 'encerrado'],
};
const MODALIDADE = { ead: 'EaD', presencial: 'Presencial', hibrido: 'Semipresencial' };

function textoFalta(d) {
  if (d === 0) return 'Vence hoje';
  if (d === 1) return 'Vence amanhã';
  if (d <= DIAS_URGENTE) return `Vence em ${d} dias`;
  return `Faltam ${d} dias`;
}

function blocoPrazo(it) {
  if (it.vencido && it.prazo) {
    return `<p class="prazo prazo--vencido">${icone('calendario')}<span>Prazo encerrado em <time datetime="${iso(it.prazo)}">${fmtData.format(it.prazo)}</time></span></p>`;
  }
  if (it.status === 'encerrado') return '';
  if (!it.prazo) {
    return it.status === 'aberto'
      ? `<p class="prazo">${icone('calendario')}<span>Prazo não informado</span></p>`
      : '';
  }
  const d = it.diasRestantes;
  const urgente = d >= 0 && d <= DIAS_URGENTE;
  const rotulo = it.status === 'aberto' ? 'Inscrições até' : 'Prazo até';
  return `<p class="prazo${urgente ? ' prazo--urgente' : ''}">${icone(urgente ? 'alerta' : 'calendario')}` +
    `<span>${rotulo} <strong><time datetime="${iso(it.prazo)}">${fmtData.format(it.prazo)}</time></strong></span>` +
    `<span class="falta">${textoFalta(d)}</span></p>`;
}

function card(it) {
  const [rotulo, cls] = SELO[it.status];
  const urgente = venceEmBreve(it, DIAS_URGENTE);
  const idTitulo = `t-${it.id}`;
  const tags = [];
  if (ehNovo(it)) tags.push('<span class="tag tag--novo">Novo</span>');
  if (estado.aba === 'pos' && MODALIDADE[it.modalidade]) tags.push(`<span class="tag">${MODALIDADE[it.modalidade]}</span>`);

  const botao = it.link
    ? `<a class="botao" href="${esc(it.link)}" target="_blank" rel="noopener noreferrer">Ver edital${icone('externo')}<span class="sr-only">: ${esc(it.titulo)} (abre em nova aba)</span></a>`
    : '<span class="botao" aria-disabled="true">Sem link</span>';

  return `<li><article class="card${urgente ? ' is-urgente' : ''}${it.status === 'encerrado' ? ' is-encerrado' : ''}" aria-labelledby="${idTitulo}">
    <div class="card-topo"><span class="selo selo--${cls}">${icone(cls)}${rotulo}</span>${tags.join('')}</div>
    <h3 class="card-titulo" id="${idTitulo}">${esc(it.titulo)}</h3>
    <p class="card-inst">${esc(it.instituicao)}</p>
    ${blocoPrazo(it)}
    ${it.detalhe ? `<p class="card-detalhe">${esc(it.detalhe)}</p>` : ''}
    <div class="card-rodape">
      <span class="encontrado">${it.encontrado ? `Encontrado em <time datetime="${iso(it.encontrado)}">${fmtData.format(it.encontrado)}</time>` : ''}</span>
      ${botao}
    </div>
  </article></li>`;
}

const grupoHTML = (titulo, itens) => !itens.length ? '' :
  `<section class="grupo" aria-label="${esc(titulo)}"><h2 class="grupo-titulo">${esc(titulo)} <span class="qtd">${itens.length}</span></h2>
   <ul class="cards">${itens.map(card).join('')}</ul></section>`;

// ---------- painel ----------
function skeleton(n = 6) {
  const um = `<li><div class="card card--sk" aria-hidden="true">
    <span class="sk sk-selo"></span><span class="sk sk-titulo"></span><span class="sk sk-titulo curto"></span>
    <span class="sk sk-linha" style="width:40%"></span><span class="sk sk-prazo"></span>
    <div class="card-rodape"><span class="sk sk-linha" style="width:35%"></span><span class="sk sk-botao"></span></div>
  </div></li>`;
  return `<span class="sr-only">Carregando ${NOME_ABA[estado.aba]}…</span><div class="grupo"><span class="sk sk-linha" style="width:180px;height:20px;margin-bottom:14px"></span><ul class="cards">${um.repeat(n)}</ul></div>`;
}

function estadoHTML({ icone: ic = 'vazio', titulo, texto, acao = '', erro = false, extra = '' }) {
  return `<div class="estado${erro ? ' estado--erro' : ''}"${erro ? ' role="alert"' : ''}>${icone(ic)}<h3>${titulo}</h3><p>${texto}</p>${acao}${extra}</div>`;
}

function sincronizarAtalhos() {
  const f = estado.filtros[estado.aba];
  const ligado = { aberto: f.status === 'aberto', semana: f.semana, novos: f.novos };
  for (const b of document.querySelectorAll('.stat[data-atalho]')) b.setAttribute('aria-pressed', String(!!ligado[b.dataset.atalho]));
  $('.stat[data-atalho="novos"]').disabled = !estado.ultimaVisita;
  const extras = [f.inst, f.mod, f.novos, f.semana].filter(Boolean).length;
  $('#filtros-ativos').textContent = extras ? String(extras) : '';
}

function renderPainel() {
  const aba = estado.aba;
  sincronizarAtalhos();
  const fonte = estado.fontes[aba];
  const lista = $('#lista');
  const contador = $('#contador');
  form().hidden = fonte.estado === 'erro';

  if (fonte.estado === 'carregando') {
    lista.setAttribute('aria-busy', 'true');
    contador.textContent = '';
    lista.innerHTML = skeleton();
    return;
  }
  lista.setAttribute('aria-busy', 'false');

  if (fonte.estado === 'erro') {
    contador.textContent = '';
    lista.innerHTML = estadoHTML({
      erro: true, icone: 'alerta',
      titulo: `Não deu para carregar ${NOME_ABA[aba].toLowerCase()}`,
      texto: esc(mensagemDe(fonte.erro)),
      acao: `<button type="button" class="botao" data-acao="tentar" data-aba="${aba}">${icone('recarregar')}Tentar de novo</button>`,
    });
    return;
  }

  atualizarInstituicoes(fonte.itens);
  const f = estado.filtros[aba];
  $('#limpar').hidden = !filtroAtivo(f);

  const avisoCache = fonte.cache
    ? `<div class="aviso" role="status"><strong>Não deu para atualizar agora.</strong> Mostrando a versão salva em ${fmtData.format(fonte.cache)} às ${fmtHora.format(fonte.cache)}. <button type="button" class="link-botao" data-acao="tentar" data-aba="${aba}">Tentar de novo</button></div>`
    : '';

  if (!fonte.itens.length) {
    contador.textContent = '';
    lista.innerHTML = avisoCache + estadoHTML({
      titulo: 'Nada por aqui ainda',
      texto: 'A planilha ainda não tem itens. Quando a busca diária encontrar algo, aparece aqui.',
    });
    return;
  }

  const filtrados = aplicarFiltros(fonte.itens, f);
  const total = fonte.itens.length;
  contador.textContent = filtrados.length === total
    ? plural(total, 'item', 'itens')
    : `Mostrando ${filtrados.length} de ${plural(total, 'item', 'itens')}`;

  if (!filtrados.length) {
    lista.innerHTML = avisoCache + estadoHTML({
      icone: 'busca',
      titulo: 'Nenhum resultado com esses filtros',
      texto: f.q.trim() ? `Nada encontrado para “${esc(f.q.trim())}”. Tente outra palavra ou afrouxe os filtros.` : 'Tente afrouxar os filtros para ver mais itens.',
      acao: '<button type="button" class="botao botao--secundario" data-acao="limpar">Limpar filtros</button>',
    });
    return;
  }

  const por = (s) => filtrados.filter((it) => it.status === s);
  const encerrados = por('encerrado');
  let html = avisoCache;

  if (f.status === 'encerrado') {
    html += grupoHTML('Encerrados', encerrados);
  } else {
    const ativos = filtrados.length - encerrados.length;
    html += grupoHTML(aba === 'pos' ? 'Inscrições abertas' : 'Abertas', por('aberto'));
    html += grupoHTML('Em andamento', por('andamento'));
    html += grupoHTML('Atualizações', por('atualizacao'));
    if (encerrados.length) {
      const auto = !estado.encerradosAbertos[aba] && ativos === 0;
      const aberto = estado.encerradosAbertos[aba] || auto;
      html += `<details class="recolhido" id="encerrados"${aberto ? ' open' : ''}${auto ? ' data-auto="1"' : ''}>
        <summary>Encerrados <span class="qtd">${encerrados.length}</span><span class="dica" aria-hidden="true">${aberto ? 'Recolher' : 'Mostrar'}</span></summary>
        <ul class="cards">${encerrados.map(card).join('')}</ul></details>`;
    }
  }
  lista.innerHTML = html;

  const det = $('#encerrados');
  if (det) det.addEventListener('toggle', () => {
    // Abertura automática (só há encerrados no resultado) não vira preferência.
    if (det.dataset.auto) delete det.dataset.auto;
    else estado.encerradosAbertos[aba] = det.open;
    det.querySelector('.dica').textContent = det.open ? 'Recolher' : 'Mostrar';
  });
}

function renderTudo() {
  renderCabecalho();
  renderResumo();
  renderPainel();
}

// ---------- eventos ----------
function ligarEventos() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  for (const t of tabs) {
    t.addEventListener('click', () => trocarAba(t.dataset.aba));
    t.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(t);
      let alvo = null;
      if (e.key === 'ArrowRight') alvo = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') alvo = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') alvo = tabs[0];
      else if (e.key === 'End') alvo = tabs[tabs.length - 1];
      if (alvo) { e.preventDefault(); trocarAba(alvo.dataset.aba, true); }
    });
  }

  let espera;
  form().addEventListener('input', (e) => {
    clearTimeout(espera);
    const rodar = () => { lerFormulario(); renderPainel(); };
    if (e.target.type === 'search') espera = setTimeout(rodar, 140);
    else rodar();
  });
  form().addEventListener('change', (e) => { if (e.target.type !== 'search') { lerFormulario(); renderPainel(); } });

  const limpar = () => {
    estado.filtros[estado.aba] = filtroPadrao();
    preencherFormulario();
    renderPainel();
    $('#f-busca').focus();
  };
  $('#limpar').addEventListener('click', limpar);

  $('#lista').addEventListener('click', (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    if (b.dataset.acao === 'limpar') limpar();
    if (b.dataset.acao === 'tentar') {
      // Depois de tentar de novo, o foco volta ao painel (o botão some com o re-render).
      carregar(b.dataset.aba).then(() => $('#painel').focus());
    }
  });

  $('#recarregar').addEventListener('click', carregarTudo);

  // "Mais filtros" (só aparece no celular)
  $('#mais-filtros').addEventListener('click', (e) => {
    const aberto = e.currentTarget.getAttribute('aria-expanded') !== 'true';
    e.currentTarget.setAttribute('aria-expanded', String(aberto));
    $('#filtros-extra').classList.toggle('aberto', aberto);
  });

  // Números do resumo funcionam como atalhos de filtro na aba atual.
  for (const b of document.querySelectorAll('.stat[data-atalho]')) {
    b.addEventListener('click', () => {
      const f = estado.filtros[estado.aba];
      const ligado = b.getAttribute('aria-pressed') === 'true';
      if (b.dataset.atalho === 'aberto') f.status = ligado ? 'todos' : 'aberto';
      if (b.dataset.atalho === 'semana') f.semana = !ligado;
      if (b.dataset.atalho === 'novos') f.novos = !ligado;
      preencherFormulario();
      renderPainel();
      const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
      $('.abas').scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' });
    });
  }
  window.addEventListener('hashchange', () => trocarAba(location.hash.slice(1)));
  // Atalho: "/" foca a busca.
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/input|select|textarea/i.test(document.activeElement?.tagName || '')) {
      e.preventDefault(); $('#f-busca').focus();
    }
  });
}

// ---------- início ----------
ligarEventos();
trocarAba(estado.aba);
renderCabecalho();
carregarTudo();

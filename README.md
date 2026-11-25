<p><img src="assets/logo/logo-horizontal.svg" alt="janelAI" width="300"></p>

> Editais de pós-graduação, bolsas, estágios e seleções, garimpados com IA e com o prazo sempre à vista.

O nome junta **janela** (de *janela de inscrição*, o intervalo em que ainda dá tempo) com **AI**,
a busca otimizada por IA que alimenta as planilhas todos os dias. O site lê
as duas planilhas de monitoramento (atualizadas todo dia por uma tarefa automática)
e mostra só o que importa: o que está aberto, o que vence logo e o que é novo desde a sua última visita.

Feito em HTML, CSS e JavaScript puro, sem build, sem backend e sem dependências.

## Estrutura

```
.
├── index.html          página única
├── config.js           ← links dos CSVs (o único arquivo que você precisa editar)
├── favicon.svg
├── assets/
│   ├── logo/           símbolo e logo horizontal (fundo claro e escuro)
│   ├── app.js          interface: abas, filtros, cards, resumo, tema, compartilhar
│   ├── dados.js        leitura do CSV e interpretação da coluna "Situação"
│   └── estilos.css     tema claro/escuro, layout mobile-first
└── dados/
    ├── exemplo-pos.csv     usados enquanto o config.js estiver sem links
    └── exemplo-vagas.csv
```

## 1. Publicar as planilhas como CSV

Faça isto para cada planilha:

1. Abra a planilha no Google Sheets.
2. **Arquivo → Compartilhar → Publicar na web**.
3. Em "Link", escolha **a aba certa** ("Editais de pós" ou "Vagas e seleções"), não "Documento inteiro".
4. No formato, escolha **Valores separados por vírgula (.csv)**.
5. Clique em **Publicar** e copie o link. Ele termina em `output=csv`.

## 2. Trocar os links

Abra `config.js` e cole cada link no campo `url`:

```js
fontes: {
  pos:   { url: 'https://docs.google.com/spreadsheets/d/e/…/pub?gid=0&single=true&output=csv', … },
  vagas: { url: 'https://docs.google.com/spreadsheets/d/e/…/pub?gid=123&single=true&output=csv', … },
},
```

Enquanto um `url` estiver vazio, o site mostra os dados de exemplo daquela seção, com um aviso no topo.
No mesmo arquivo você também ajusta quantos dias contam como "urgente" (`diasUrgente`, padrão 3)
e a janela do resumo (`diasEmBreve`, padrão 7).

> O Google pode levar até uns 5 minutos para refletir mudanças da planilha no CSV publicado.

Depois de editar `config.js` (pode ser direto no GitHub, pelo lápis do arquivo), faça commit:
o site em https://wesleymsqt.github.io/janelAI/ se atualiza sozinho em cerca de um minuto.

> Atenção: o link "Publicar na web" é público para quem tiver o endereço, e ele fica visível
> no `config.js`. Não publique abas com dados que você não queira expor.

## Rodar localmente

Os módulos JavaScript não funcionam abrindo o `index.html` direto do disco (`file://`). Use um servidor simples:

```powershell
python -m http.server 5173
```

e abra `http://localhost:5173`.

## Abas

| Aba | De onde vem | Regra |
|---|---|---|
| **Doutorado** | planilha de pós | título contém "doutorado" |
| **Mestrado** | planilha de pós | título contém "mestrado" (inclui mestrado profissional) |
| **Pós/Especialização** | planilha de pós | todo o resto: especialização, MBA, residência… |
| **Vagas** | planilha de vagas | tudo: estágios, bolsas, seleções |

Um título como "Mestrado e Doutorado em X" aparece nas duas abas. Cada aba guarda os
próprios filtros, e o número ao lado do nome é a quantidade de inscrições abertas.

## Como os dados são interpretados

| Coluna "Situação" começa com… | Selo | Observação |
|---|---|---|
| `Inscrições abertas até dd/mm/aaaa` | Aberto | o prazo é extraído; se já passou, vira **Encerrado** ("Prazo encerrado em…") |
| `Vaga aberta` | Aberto | sem data, mostra "Prazo não informado" |
| `Em andamento` | Em andamento | |
| `Encerrado` | Encerrado | fica no grupo recolhido no fim da lista |
| `Atualização: …` | Atualização | se houver "até dd/mm/aaaa" no texto, vira prazo |

- Qualquer linha que contenha **"linha de corte"** em qualquer coluna é ignorada.
- O texto que sobra além do padrão (ex.: "Exige projeto de pesquisa") aparece como detalhe no card.
- **Modalidade** (só na pós) é detectada no título e na situação: "EaD", "a distância",
  "ensino remoto" → EaD; "semipresencial", "híbrido" → Semipresencial; "presencial" → Presencial.
- Se a coluna "Site" for uma URL, o card mostra só o domínio.
- As colunas são encontradas pelo nome do cabeçalho; se não houver cabeçalho, vale a ordem
  Data | Site | Título | Situação | Link.

### "Novo desde a última visita"

A data da última visita fica no `localStorage` do navegador (`janela:ultimaVisita`).
Um item é "novo" quando a **Data encontrada** é posterior ao dia da sua visita anterior.
Recarregar a página na mesma sessão não apaga as novidades. Na primeira visita não há base
de comparação, então o contador mostra "—" e o filtro "Só novidades" fica oculto.

### Sem conexão

Cada carregamento bem-sucedido fica salvo no navegador. Se uma planilha falhar depois,
o site mostra a última versão salva com um aviso e um botão "Tentar de novo". Se não houver
nada salvo, aparece uma mensagem explicando o erro (sem internet, link errado, formato
que não é CSV, demora) com o mesmo botão.

## Tema e compartilhamento

- **Tema:** o primeiro botão do topo escolhe entre *Automático* (segue o sistema),
  *Claro*, em tons de creme e marrom, mais suave que branco e preto, e *Escuro*.
  A escolha fica salva no navegador.
- **Compartilhar:** cada card tem um botão de compartilhar. No celular ele abre a folha de
  compartilhamento do sistema (WhatsApp, e-mail…); no computador copia o link do edital.
  No topo, o botão "Compartilhar" faz o mesmo com o endereço do janelAI.

## Logo

- `favicon.svg` / `assets/logo/simbolo.svg`: símbolo em bloco escuro, funciona em qualquer fundo.
- `assets/logo/logo-horizontal.svg` e `logo-horizontal-escuro.svg`: símbolo + nome.

O símbolo é uma janela em arco com quatro painéis: o painel de cima à direita está aceso
em verde (a mesma cor de "inscrições abertas" no site) e traz a faísca de quatro pontas da IA.
No site, o logo do cabeçalho é desenhado em SVG embutido e acompanha o tema claro/escuro.

## Acessibilidade

- Contraste AA nos dois temas (texto ≥ 5,6:1; bordas de controles ≥ 3:1).
- Selos de status sempre com ícone **e** texto; urgência indicada por texto ("Vence amanhã") além da cor.
- Navegação completa por teclado: abas com setas/Home/End, foco visível, link "Pular para a lista",
  atalho `/` para a busca.
- Alvos de toque com 44 px; respeita `prefers-reduced-motion` e modo de alto contraste.

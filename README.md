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
├── apps-script/
│   └── Codigo.gs       script do Google: lista de sites e formulário "Adicionar site"
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

## 3. Sites monitorados e "Adicionar site"

A planilha **Monitor de editais de pós-graduação** tem a aba **Sites monitorados**
(Adicionado em | Nome | Endereço | Tipo | Observação | Origem), com os sites que a busca visita.
O janelAI mostra essa lista no fim da página, e o botão **Adicionar site** grava uma linha nova nela.
Para isso funcionar, publique o script uma vez:

1. Abra a planilha **Monitor de editais de pós-graduação** → **Extensões → Apps Script**.
2. Apague o conteúdo do arquivo `Código.gs` e cole o conteúdo de [`apps-script/Codigo.gs`](apps-script/Codigo.gs). Salve.
3. **Implantar → Nova implantação** → tipo **App da Web**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
4. Autorize o acesso à planilha quando o Google pedir e copie o **URL do app da Web** (termina em `/exec`).
5. Cole esse endereço em `scriptUrl`, no `config.js`, e faça commit.

Sem o `scriptUrl`, a seção ainda aparece, montada a partir dos sites que aparecem nas planilhas,
mas o formulário fica desligado.

> O endereço do script fica público no `config.js`: qualquer pessoa com o link do site pode
> adicionar uma linha. O script aceita no máximo 20 envios por dia, recusa endereços repetidos,
> ignora robôs (campo escondido) e impede que o texto vire fórmula. Se aparecer algo estranho,
> é só apagar a linha na planilha.

### Instrução para a tarefa automática

A tarefa que preenche as planilhas precisa ler essa aba para buscar os sites novos.
Cole no fim das instruções dela:

```text
Antes de buscar, leia a aba "Sites monitorados" da planilha "Monitor de editais de pós-graduação".
Visite todos os endereços da coluna "Endereço", inclusive os que foram adicionados depois.
- Tipo "Pós-graduação": registre na aba "Editais de pós" da planilha "Monitor de editais de pós-graduação".
- Tipo "Vagas e seleções": registre na aba "Vagas e seleções" da planilha "Monitor de vagas e seleções".
Use o valor da coluna "Nome" na coluna "Site". Se houver "Observação", siga-a como filtro
(ex.: "só mestrado em computação"). Para um site sem nenhuma linha ainda, registre tudo o que
estiver aberto e depois grave a linha de corte, como já faz com os outros.
Não altere a aba "Sites monitorados".
```

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

## Filtro por área

O filtro **Área** (em "Mais filtros" no celular) procura palavras no título e na situação.
As áreas e as palavras ficam em `config.js`, na lista `areas`: dá para criar uma área nova
ou acrescentar palavras sem mexer no resto do código.

```js
{ id: 'eletrica', nome: 'Elétrica e eletrônica', palavras: ['eletric', 'eletronic', 'automacao', 'telecomunica'] },
```

- Cada palavra vale como **começo de palavra**, sem acento: `eletric` pega elétrica, elétrico, eletricista.
- Palavras de até 3 letras (`ti`, `ia`, `mba`) só valem inteiras, para `ti` não pegar "tipo".
- Um edital pode estar em mais de uma área. Os que não batem com nenhuma aparecem em
  "Sem área identificada": se algum deveria ter entrado, acrescente a palavra que falta.

## Como os dados são interpretados

| Coluna "Situação" começa com… | Selo | Observação |
|---|---|---|
| `Inscrições abertas até dd/mm/aaaa`, `Inscrições abertas 18/11/2026 a 18/01/2027`, `Inscrições 03/11 a 13/12/2026`, `Aberto` | Aberto | o prazo é a data depois de "até" ou o fim do período; se já passou, vira **Encerrado** ("Prazo encerrado em…") |
| `Vaga aberta (…)` | Aberto | sem data, mostra "Prazo não informado" |
| `Em andamento (…)`, `Matrícula …`, `2ª chamada para matrícula`, `"Em breve"` | Em andamento | |
| `Encerrado`, `Inscrições encerradas`, `Sem vagas abertas` | Encerrado | fica no grupo recolhido no fim da lista |
| `Atualização: …` e qualquer outro texto | Atualização | se houver "até dd/mm/aaaa" no texto, vira prazo |

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

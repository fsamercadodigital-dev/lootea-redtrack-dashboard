# Lootea · Criativos Meta

Painel para decidir se um criativo do Meta deve **escalar**, **continuar em teste** ou ser **descartado**. A meta é o primeiro depósito (FTD). Os números vêm do RedTrack. A tela está em português.

Na Vercel, importe o repositório. Não precisa de `vercel.json`.

## Variável de ambiente

| Nome | Onde | Para quê |
| --- | --- | --- |
| `REDTRACK_API_KEY` | só no servidor | chave da API do RedTrack |

Não use o prefixo `NEXT_PUBLIC_`. A chave não vai para o navegador e o código não a escreve em log.

O painel é aberto: quem tiver o endereço vê os números. A página pede para os buscadores não indexarem.

Para rodar na máquina:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Preencha `REDTRACK_API_KEY` em `.env.local`.

## De onde vêm os números

Cada atualização pede **um** relatório dos últimos 30 dias, anúncio por dia:

`GET https://api.redtrack.io/report/v2` com `source_id` do Meta, fuso `America/Mexico_City` e, se escolher um gestor, o `campaign_id` dele. A resposta é paginada (`per=1000`) até acabar. O resultado fica em cache cerca de 10 minutos. **Atualizar** ignora o cache e consulta de novo. Trocar o período não consulta de novo.

Não usamos `roas`, `profit`, `cpa` nem `total_revenue` do RedTrack. Esses campos somam depósito mais de uma vez e misturam saque.

A chave do criativo é `rt_ad_id`. O mesmo anúncio pode repetir no dia quando o conjunto muda de nome: as linhas são somadas. O nome na tabela é o `rt_ad` mais recente.

### Período escolhido (Hoje, Ontem, 3, 7 ou 14 dias)

- Gasto = `cost`
- FTDs = `convtype4`
- CPA FTD = gasto ÷ FTDs
- ROAS = `revenuetype2` ÷ gasto (receita de todos os depósitos)
- Redeposits = `convtype7`
- AOV = `revenuetype2` ÷ `convtype2`
- CPS = gasto ÷ `convtype3` (custo por cadastro)
- Cadastros = `convtype3`
- Cliques = `clicks`

Os cartões somam a conta do período (gasto total ÷ FTDs totais). Não é a média do ROAS de cada linha.

O dia 1 é o lançamento: o primeiro dia, dentro de 30 dias, com custo. A idade conta esse dia como 1, na Cidade do México. Criativo mais velho que a janela aparece mais novo do que é. ROAS D1 a D4 é a receita de depósitos daquele dia dividida pelo gasto do dia.

O custo por anúncio é aproximado, porque o RedTrack ainda reparte o custo do conjunto.

## Coorte

O log traz `external_id` e os tipos FTD, Deposit e Redeposit, mas a receita da coorte por anúncio não fechou (os depósitos não amarraram no primeiro FTD). Por isso o painel avisa `coorte indisponível – usando o rastreamento do anúncio`: ROAS é `revenuetype2 ÷ gasto` e o RPR fica 100% se houve redeposit, senão 0%. Top cliente e legado ficam vazios.

## Decisão

Só entra na conta o conjunto cujo nome começa com `[E]`, `[F]` ou `[D]` e uma data. O resto fica **Sem veredito**. Os padrões estão em `lib/config.ts` e podem ser mudados em Critérios.

1. D1: descartar com gasto ≥ $10 sem registro, ou ≥ $15 sem depósito. Super Winner (ROAS de depósito ≥ 2, FTD ≥ 15 e CPA ≤ $7,50) escala no mesmo dia.
2. D2 e D3: manter. Não descartar por um dia ruim.
3. D4 a D7: pode subir budget no ABO se o ROAS ≥ 1,2 e FTD ≥ 8. Descartar se o CPA FTD for ≥ 2× a média e não houver redepósito.
4. D8 em diante: escalar se o ROAS for ≥ média geral × 1,2 e FTD ≥ 15. Descartar se o ROAS for < 0,8. Senão, manter com budget baixo.

Enquanto a coorte não fecha, o ROAS é receita de depósito ÷ gasto. RPR, baleia, legacy e o alerta de amostra não entram nessa conta.

Alertas (não mudam a ação): baleia acima de 50% da receita, menos de 15 FTDs, legado acima de 40%. A média usa os criativos com gasto, salvo quando Critérios exige a marcação do conjunto.

`npm test` confere essas contas. `npx tsc --noEmit` e `npm run build` conferem o projeto.

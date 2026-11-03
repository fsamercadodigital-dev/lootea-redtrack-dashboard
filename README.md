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

`GET https://api.redtrack.io/report/v2` com `source_id` do Meta, fuso `America/Mexico_City` e, se escolher um comprador, o `campaign_id` dele. A resposta é paginada (`per=1000`) até acabar. O resultado fica em cache cerca de 10 minutos. **Atualizar** ignora o cache e consulta de novo. Trocar o período não consulta de novo.

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

### Idade, ROAS D1, ROAS até D4 e escala

O D1 é o primeiro dia, **dentro de 30 dias**, com custo ou cliques. O número do dia é quantos dias se passaram desde essa data até hoje na Cidade do México, mais 1. Um criativo mais velho que a janela aparece mais novo do que é.

**ROAS D1** usa só esse primeiro dia.

**ROAS até D4** é o acumulado do D1 ao D4: receita de depósitos desses dias ÷ custo desses dias. Não é o ROAS só dos dias 3 e 4. Se o criativo ainda não chegou no D4, entra o que já teve.

A escala olha os 30 dias: maior gasto de um dia (passe o mouse no gasto) e ROAS dos dias em que o gasto passou do valor em Critérios.

O custo por anúncio é aproximado, porque o RedTrack ainda reparte o custo do conjunto.

## Decisão

Os padrões estão em `lib/config.ts`. Em **Critérios** dá para mudar, e o navegador guarda. Campo opcional vazio = **não configurado**, e esse critério fica de fora.

Ordem, em `lib/decision.ts`:

1. **Descartar** se o CPA FTD passa do limite com pelo menos 1 FTD, ou o gasto sem FTD passa de 2× o limite, ou há mais redeposits que FTDs, ou o CPS passa do limite (quando configurado).
2. **Escalar** se o CPA FTD fica abaixo do limite, e (ROAS D1 ou o acumulado até D4 atinge o mínimo), e há mais FTDs que redeposits, e o AOV passa se estiver configurado, e o ROAS dos dias caros passa se o gasto de escala estiver configurado.
3. **Manter** se o dia ainda está na janela e não caiu nos casos acima. Com FTDs abaixo do mínimo, o motivo é `janela de teste, volume baixo`.
4. Senão, **descartar**: `não atingiu critérios até o D3`.

Exemplos com o padrão (CPA máximo $10, ROAS D1 1,40, ROAS até D4 2, avaliar até o D3):

- D2, gasto $40, 5 FTDs (CPA $8), ROAS D1 1,50, 1 redeposit → Escalar.
- D1, gasto $20,01 e nenhum FTD → Descartar. Gasto de $20,00 no D1 → Manter.
- D4 sem fechar a escala → Descartar por prazo. Se a escala fecha, ainda pode Escalar depois do D3.

`npm test` confere essas contas. `npx tsc --noEmit` e `npm run build` conferem o projeto.

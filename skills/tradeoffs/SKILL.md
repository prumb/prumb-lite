---
name: tradeoffs
description: Força declarar o custo de qualquer decisão técnica ou de produto. Ativa quando há escolha entre alternativas, decisão de stack, escopo, abordagem. Mata consenso artificial · toda decisão tem trade-off, declare ou está escondendo.
---

# tradeoffs · Declarar custo

## Trigger
- Escolha entre 2+ opções técnicas
- Decisão de stack, framework, biblioteca
- Decisão de escopo (incluir/excluir feature)
- "Vai com X ou Y?"
- Qualquer recomendação ("use Postgres", "vai de Next.js")

## Princípio
**"There are no solutions, only trade-offs."** · Thomas Sowell

Se você recomendou algo sem declarar o que perde, escondeu trade-off. Decisão sem trade-off explícito = mentira.

## Protocolo
Para cada opção considerada, declarar em **4 eixos:**

```
[OPÇÃO]
├─ Ganha: [o que melhora]
├─ Perde: [o que piora · obrigatório, sem isso é fraude]
├─ Custo de mudar depois: [baixo/médio/alto + por quê]
└─ Quando ESCOLHER: [condição que faz essa opção dominar]
```

## Format de saída
```
TRADE-OFFS
──────────
Decisão: [o que está sendo escolhido]

Opção A · [nome]
  + [ganho 1]
  + [ganho 2]
  − [custo 1]
  − [custo 2]
  Reverter: [custo de mudar de A depois]
  Escolher se: [condição]

Opção B · [nome]
  + ...
  − ...
  ...

RECOMENDAÇÃO: [A | B] · [por que neste contexto]
```

## Heurística · custo de reverter
- **Reversível barato:** experimente, decida depois
- **Reversível caro:** decida com mais cuidado, talvez prototype antes
- **Irreversível:** demanda análise profunda, premortem, critique, ADR

Categorias geralmente irreversíveis: banco escolhido em produção, modelo de dados base, contratos de API públicos, vendor lock-in.

## Anti-patterns
- "Não tem trade-off, é melhor em tudo" · sempre tem. Pense de novo.
- Listar só vantagens · opinião disfarçada
- Custos vagos ("é mais complexo") · quanto? em quê?
- Empate forçado · declare critério de desempate, não fuja

## Hand-off
- Decisão importante → registrar como ADR (formato em `architect`)
- Trade-off contra-intuitivo → registrar em `lessons.md` na pasta de estado do projeto, obtida com `node "${CLAUDE_PLUGIN_ROOT}/lib/projeto.mjs" estado --criar`
- Se opção tem risco real → `premortem` daquela opção

Parte do Prumb ? prumb.com.br

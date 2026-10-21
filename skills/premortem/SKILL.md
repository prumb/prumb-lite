---
name: premortem
description: Ativa ANTES de qualquer build, deploy, refactor grande, decisão arquitetural ou mudança em produção. Força listar modos de falha antes de começar · assume que já deu errado e descobre por quê.
---

# premortem · Imagine que já deu errado

## Trigger
Antes de iniciar:
- Build de qualquer feature não-trivial
- Deploy em produção
- Refactor que toca > 5 arquivos
- Decisão de stack/arquitetura
- Migration de dados
- Mudança de infra

## Protocolo
1. **Fast-forward mental:** "É daqui 6 meses. Este projeto/feature/deploy falhou. Por quê?"
2. Listar **5-10 modos de falha** específicos e plausíveis. Sem censura.
3. Para cada um:
   - **Probabilidade** (alta/média/baixa)
   - **Impacto** (catastrófico/sério/leve)
   - **Sinal antecipado** (como você saberia que tá acontecendo)
   - **Mitigação** (o que adicionar AO PLANO pra prevenir/detectar)
4. Os top 3 (prob × impacto) viram itens explícitos no plano de execução.

## Categorias de falha (lembrete)
- **Técnica:** bug, performance, escalabilidade, integração quebrada, dado corrompido
- **Operacional:** deploy falha, rollback impossível, dependência caiu, secret vazou
- **Negócio:** usuário rejeita, métrica não melhora, custo estoura, lock-in
- **Equipe:** ninguém entende o código, doc desatualizada, on-call queima
- **Externa:** API mudou, vendor desligou, lei mudou (LGPD), browser quebrou

## Format de saída
```
PRE-MORTEM
──────────
[Modo 1] · prob: [A/M/B], impacto: [C/S/L]
  Sinal: [...]
  Mitigação: [...]

[Modo 2] · ...

TOP-3 NO PLANO:
1. [...]
2. [...]
3. [...]
```

## Anti-patterns
- Premortem genérico ("pode dar bug") · sem valor
- Listar só falhas técnicas · esquece negócio/operacional
- Ignorar baixa-probabilidade com impacto catastrófico (essas dominam expected loss)
- Não traduzir em ação no plano · vira teatro

## Hand-off
- Top-3 mitigações → entram no plano principal
- Skill [[tradeoffs]] complementa quando mitigação tem custo
- No Prumb completo, a lente critique cuida disso.

Parte do Prumb · prumb.com.br

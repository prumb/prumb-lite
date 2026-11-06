---
name: quality-bar
description: Definição verificável de pronto por tipo de entregável. Use antes de dizer "terminei", ao revisar trabalho de terceiro e ao escrever a condição de parada de /goal ou loop.
---

# quality-bar · pronto demonstrável

Usar antes de declarar uma entrega pronta e na revisão de trabalho de terceiro. Marcar apenas o que outra pessoa consegue reproduzir ou inspecionar.

## Site ou landing page

- [ ] Fluxo principal executado no ambiente publicado, do acesso ao resultado esperado.
- [ ] Layout verificado em 375, 768, 1024 e 1440 px, sem overflow, corte ou sobreposição.
- [ ] Navegação por teclado, foco visível, nomes acessíveis e contraste AA verificados.
- [ ] Entrada, progresso e conversão aparecem na ferramenta de diagnóstico do tracking.
- [ ] HTTPS válido; publicação e rollback documentados e reproduzíveis.

## API ou endpoint

- [ ] Contrato registra entrada, saída, códigos HTTP, autenticação e versão.
- [ ] Erros seguem um formato único e preservam causa útil sem expor segredo.
- [ ] Validação de entrada, autorização, limite de uso e timeout foram exercitados.
- [ ] Logs estruturados permitem ligar uma requisição ao erro correspondente.
- [ ] Teste de integração cobre caminho feliz, entrada inválida e falha de dependência.

## Componente de UI

- [ ] Props, eventos e estados públicos estão tipados; exemplo executável mostra o uso.
- [ ] Mouse, toque e teclado completam a mesma ação; foco e nome acessível são observáveis.
- [ ] Repouso, sobre, foco, ativo, carregando, erro e desabilitado existem quando aplicáveis.
- [ ] O componente foi verificado no menor e no maior container suportado.
- [ ] Toda dependência adicionada é necessária e aparece no manifesto e no bundle esperado.

## Feature de produto

- [ ] Critérios de aceite são demonstrados de ponta a ponta.
- [ ] Caminho feliz, edge cases principais e falhas recuperáveis têm teste ou roteiro reproduzível.
- [ ] Autorização, dados sensíveis e abuso previsível receberam proteção proporcional.
- [ ] A métrica de sucesso é emitida e pode ser consultada.
- [ ] Código, flags, telas e documentação substituídos foram removidos ou migrados.

## Script ou automação

- [ ] Entrada, saída, pré-condições e forma de execução estão documentadas.
- [ ] Sucesso retorna zero; falha retorna código não zero e mensagem acionável.
- [ ] Reexecução é idempotente ou o efeito duplicado é bloqueado e explicado.
- [ ] Timeout, retry e falha de dependência foram exercitados sem silenciar erro.
- [ ] Execução em fixture, sandbox ou dry-run prova o caminho principal sem afetar produção.
- [ ] Logs não expõem segredos; agendamento, alerta e recuperação estão documentados quando aplicáveis.

Rejeitar erro silenciado, deploy manual frágil, dependência sem justificativa, feature sem métrica e “melhorar depois” sem registro verificável.

Se um item não pode ser demonstrado, ele não está pronto: está declarado pronto. São coisas diferentes.

## Condição de parada (/goal ou loop)

- [ ] A condição exige prova impressa na conversa (saída de teste, contagem ou status), porque o juiz de /goal só lê a conversa.
- [ ] Tem critério observável, nunca "ficou bom".
- [ ] Tem teto de turnos ou de tempo.
- [ ] Diz o que fazer se travar: parar e relatar, não insistir.

## Métrica

Percentual de entregas revisadas com 100% dos itens aplicáveis demonstrados e evidência registrada.

Parte do Prumb · prumb.com.br

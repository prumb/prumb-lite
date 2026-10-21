#!/usr/bin/env node
// Bloqueia comandos Git que descartam trabalho não salvo ou entradas do stash.

import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Só as formas que DESCARTAM a árvore de trabalho.
//
// Fora daqui de propósito:
//   `git checkout <branch>` e `git checkout -b`  · trocam de branch, não apagam nada
//   `git restore --staged` sozinho               · tira do indice, o arquivo continua la
//   Com --source ou --worktree, restore entra na guarda: pode apagar trabalho.
//   `git stash`                                  · esconde, mas e recuperavel com pop
//   drop e clear sao tratados a parte: so passam com a lista de stash vazia.
const DESCARTA = [
  /\bgit\s+checkout\s+(-{2}|\.)/,              // git checkout -- <path> | git checkout .
  /\bgit\s+checkout\s+\S+\s+--(?:\s|$)/,     // git checkout <ref> -- <path>, inclui HEAD
  /\bgit\s+checkout\s+HEAD\s+\./,             // git checkout HEAD . tambem restaura arquivos
  /\bgit\s+checkout\b.*\s(?:-f|--force)(?:\s|$)/, // checkout forcado descarta alteracoes
  /\bgit\s+restore\s+(?!.*--staged)/,         // git restore <path>
  /\bgit\s+restore\b.*\s--source(?:=|\s)/,    // restore de outra origem, mesmo com staged
  /\bgit\s+restore\b.*\s--worktree(?:\s|$)/,  // restore da arvore, mesmo com staged
  /\bgit\s+switch\b.*\s(?:--discard-changes|-f|--force)(?:\s|$)/, // switch forcado
  /\bgit\s+reset\s+--hard\b/,                  // apaga a árvore inteira
  /\bgit\s+clean\s+-[a-z]*f/,                  // apaga arquivo não rastreado
];

function negar(reason) {
  return { permissionDecision: 'deny', permissionDecisionReason: reason };
}

function stashes(cwd) {
  try {
    return execFileSync('git', ['stash', 'list'], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000, windowsHide: true,
    }).trim().split('\n').filter(Boolean);
  } catch {
    return null; // Nao deu para conferir: deixa passar.
  }
}

function sujo(cwd) {
  try {
    const saida = execFileSync('git', ['status', '--porcelain'], {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
      windowsHide: true,
    });
    return saida.trim().split('\n').filter(Boolean);
  } catch {
    return null; // não é repositório, git ausente, timeout: nada a afirmar
  }
}

export function avaliarDescarte(payload) {
  let cmd = '';
  let cwd = '';
  try {
    const entrada = payload?.tool_input ?? {};
    cmd = String(entrada.command ?? '');
    cwd = String(payload?.cwd ?? entrada.cwd ?? '');
  } catch {
    return null;
  }
  if (!cmd.trim()) return null;
  let alterados;
  // Cada git tem seu cwd: -C relativo parte do payload, inclusive em comando composto.
  const comandos = cmd.matchAll(/\bgit\s+((?:-C\s+(?:"[^"]*"|'[^']*'|[^\s;&|]+)\s+)*)[^;&|\r\n]*/g);
  for (const trecho of comandos) {
    let alvo = cwd || process.cwd();
    for (const pasta of trecho[1].matchAll(/-C\s+(?:"([^"]*)"|'([^']*)'|([^\s]+))/g)) {
      alvo = resolve(alvo, pasta[1] ?? pasta[2] ?? pasta[3]);
    }
    const comando = `git ${trecho[0].replace(/^git\s+/, '').slice(trecho[1].length)}`;
    if (/\bgit\s+stash\s+(drop|clear)\b/.test(comando)) {
      const entradas = stashes(alvo);
      if (entradas?.length) {
        return negar(`Trava do Prumb: existem ${entradas.length} entrada(s) no stash deste repositório. `
          + 'O stash apagado não volta com pop. Peça confirmação explícita ao dono antes de apagar.');
      }
      continue;
    }
    if (!DESCARTA.some(rx => rx.test(comando))) continue;
    const arquivos = sujo(alvo);
    if (arquivos === null) continue;   // não deu para conferir: deixa passar
    if (arquivos.length === 0) continue; // árvore limpa: não há o que perder
    alterados = arquivos;
    break;
  }
  if (!alterados) return null;

  const lista = alterados.slice(0, 8).map((l) => `  ${l}`).join('\n');
  const resto = alterados.length > 8 ? `\n  ...e mais ${alterados.length - 8}` : '';

  return negar(
    `Trava do Prumb: este comando descarta trabalho não commitado.\n\n`
    + `${alterados.length} arquivo(s) com alteração não commitada:\n${lista}${resto}\n\n`
    + `Se a intenção é desfazer uma quebra proposital de teste, restaure de uma CÓPIA, `
    + `não do git: copie o arquivo antes de quebrá-lo e devolva com "mv". `
    + `Se a intenção é mesmo jogar fora o que está aí, commite primeiro numa branch `
    + `descartável, ou peça confirmação explícita ao usuário dizendo o que se perde.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => {
    buf += c;
  });
  process.stdin.on('end', () => {
    try {
      const resultado = avaliarDescarte(JSON.parse(buf));
      if (resultado) process.stdout.write(`${JSON.stringify({ hookSpecificOutput: {
        hookEventName: 'PreToolUse', ...resultado,
      } })}\n`);
    } catch (error) {
      // Falha aberta, de propósito: o comando segue. Só o debug explícito mostra o erro.
      if (process.env.PRUMB_HOOK_DEBUG === '1') process.stderr.write(`${error.stack || error}\n`);
    }
  });
}

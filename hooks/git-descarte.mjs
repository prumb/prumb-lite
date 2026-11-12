#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) · barra o comando que DESCARTA trabalho não commitado.
//
// Comandos de descarte restauram a versão gravada e podem apagar trabalho local.
// Por isso a guarda bloqueia as formas reconhecidas quando detecta alterações.
// Uma instrução passiva pode ser ignorada; o bloqueio impede a execução reconhecida.
//
// FALHA PARA O LADO PERMISSIVO. Git ausente, diretório que não é repositório, saída
// ilegível ou exceção deixam passar: um hook de segurança que trava o trabalho por
// engano é pior que o problema que ele resolve, e seria desligado na primeira vez que
// atrapalhasse. Única exceção: diretório dinâmico (cd "$X") antes de um descarte pede
// confirmação, porque liberar pelo status do cwd errado seria falso verde.
//
// Fora daqui de propósito:
//   `git checkout <branch>` e `git checkout -b`  · trocam de branch, não apagam nada
//   `git restore --staged` sozinho               · tira do índice, o arquivo continua lá
//   `git stash`                                  · esconde, mas é recuperável com pop
//   drop e clear são tratados à parte: só passam com a lista de stash vazia.
//
// Pro e Lite carregam este arquivo idêntico; só PREFIXO muda.

import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PREFIXO = 'Trava do Prumb';

// O lexer preserva caminhos Windows e separa comandos somente fora de aspas.
function tokenizar(texto) {
  const comandos = [];
  let tokens = [], valor = '', ativo = false, aspas = '', dinamico = false;
  const fechar = () => {
    if (ativo) tokens.push({ valor, dinamico });
    valor = ''; ativo = false; dinamico = false;
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === aspas) aspas = '';
      else { valor += c; if (aspas === '"' && /[$`]/.test(c)) dinamico = true; }
      continue;
    }
    if (c === '"' || c === "'") { aspas = c; ativo = true; continue; }
    if (/[;&|\r\n(){}]/.test(c)) {
      if (c === '(' && valor.endsWith('$')) dinamico = true;
      fechar(); if (tokens.length) comandos.push(tokens); tokens = []; continue;
    }
    if (/\s/.test(c)) { fechar(); continue; }
    ativo = true; valor += c;
    if (/[$`]/.test(c)) dinamico = true;
  }
  fechar(); if (tokens.length) comandos.push(tokens);
  return comandos;
}

function consultar(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000, windowsHide: true,
    }).trim().split('\n').filter(Boolean);
  } catch { return null; } // Git ausente, timeout ou fora de repo: sem evidência de perda.
}

// Prefixos que só repassam o comando, e intérpretes que recebem o comando como texto.
const PREFIXOS = ['env', 'command', 'sudo', 'nohup', 'time', 'exec', 'nice', 'builtin'];
const INTERPRETES = { sh: '-c', bash: '-c', zsh: '-c', dash: '-c', cmd: '/c', pwsh: '-command', powershell: '-command' };

export function avaliarDescarte(payload, herdado = false) {
  const entrada = payload?.tool_input ?? {};
  const cmd = String(entrada.command ?? '');
  let cwd = resolve(String(payload?.cwd ?? entrada.cwd ?? process.cwd()) || process.cwd());
  let incerto = herdado;
  const pilha = [];
  const decisao = (tipo, motivo) => ({ permissionDecision: tipo, permissionDecisionReason: `${PREFIXO}: ${motivo}` });
  for (let tokens of tokenizar(cmd)) {
    while (tokens.length > 1 && (PREFIXOS.includes(tokens[0].valor.toLowerCase()) || /^[A-Za-z_]\w*=/.test(tokens[0].valor))) tokens = tokens.slice(1);
    const nome = tokens[0].valor.toLowerCase().replace(/\.exe$/, '').replace(/^.*[\\/]/, '');
    const flag = INTERPRETES[nome];
    const n = nome === 'eval' ? 0 : flag ? tokens.findIndex((t, k) => k > 0 && [flag, '-c'].includes(t.valor.toLowerCase())) : -1;
    if (n >= 0 && tokens.length > n + 1) {
      const interno = avaliarDescarte({ cwd, tool_input: { command: tokens.slice(n + 1).map(t => t.valor).join(' ') } }, incerto);
      if (interno) return interno;
      continue;
    }
    if (['cd', 'pushd', 'set-location', 'sl', 'chdir'].includes(nome)) {
      if (nome === 'pushd') pilha.push({ cwd, incerto });
      const caminhos = tokens.slice(1).filter(t => !['/d', '-path', '-literalpath'].includes(t.valor.toLowerCase()));
      if (caminhos.length !== 1 || caminhos[0].dinamico || caminhos[0].valor.startsWith('~')) incerto = true;
      else cwd = resolve(cwd, caminhos[0].valor);
      continue;
    }
    if (nome === 'popd' || nome === 'pop-location') {
      const anterior = pilha.pop();
      if (anterior) ({ cwd, incerto } = anterior); else incerto = true;
      continue;
    }
    if (!/(?:^|[\\/])git(?:\.exe)?$/i.test(tokens[0].valor)) continue;
    let alvo = cwd, ambiguo = incerto, i = 1;
    const globais = [];
    while (i < tokens.length && tokens[i].valor.startsWith('-')) {
      const t = tokens[i++];
      const opcao = t.valor;
      if (['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--super-prefix'].includes(opcao)) {
        const v = tokens[i++];
        if (!v) { ambiguo = true; break; }
        if (opcao === '-C') { alvo = resolve(alvo, v.valor); ambiguo ||= v.dinamico; }
        else if (opcao === '--work-tree') { alvo = resolve(alvo, v.valor); ambiguo ||= v.dinamico; globais.push(`--work-tree=${alvo}`); }
        else { globais.push(opcao, v.valor); ambiguo ||= v.dinamico; }
      } else if (opcao.startsWith('--work-tree=')) {
        alvo = resolve(alvo, opcao.slice(12)); ambiguo ||= t.dinamico; globais.push(`--work-tree=${alvo}`);
      } else globais.push(opcao);
    }
    const sub = tokens[i++]?.valor;
    const args = tokens.slice(i).map(t => t.valor);
    const opcoes = args.slice(0, args.indexOf('--') < 0 ? args.length : args.indexOf('--'));
    const tem = (...valores) => valores.some(v => opcoes.includes(v));
    const stash = sub === 'stash' && ['drop', 'clear'].includes(args.find(v => !v.startsWith('-')));
    const clean = sub === 'clean' && (tem('--force') || opcoes.some(v => /^-[^-]*f/.test(v)));
    const descarta = stash || clean || (sub === 'reset' && tem('--hard'))
      || (sub === 'checkout' && (args.includes('--') || args.includes('.') || tem('-f', '--force')))
      || (sub === 'restore' && (!tem('--staged', '-S') || tem('--worktree', '-W') || opcoes.some(v => /^--source(?:=|$)/.test(v))))
      || (sub === 'switch' && tem('-f', '--force', '--discard-changes'));
    if (!descarta) continue;
    if (ambiguo) return decisao('ask', 'não foi possível resolver literalmente o diretório do descarte. Confirme o alvo e a perda antes de executar.');
    // A prévia preserva seleção e caminhos, retirando somente opções de execução.
    const previa = args.flatMap((v, n) => {
      const separador = args.indexOf('--');
      if (separador >= 0 && n >= separador) return [v];
      if (v.startsWith('-e') || args[n - 1] === '-e' || args[n - 1] === '--exclude') return [v];
      if (v === '--force' || v === '--dry-run') return [];
      if (/^-[^-]/.test(v) && !['-e'].includes(v) && args[n - 1] !== '-e' && args[n - 1] !== '--exclude') {
        const restante = v.replace(/[fn]/g, ''); return restante === '-' ? [] : [restante];
      }
      return [v];
    });
    const arquivos = consultar(alvo, [...globais, ...(stash ? ['stash', 'list'] : clean ? ['clean', '-n', ...previa] : ['status', '--porcelain'])]);
    if (!arquivos?.length) continue;
    if (stash) return decisao('deny', `existem ${arquivos.length} entrada(s) no stash deste repositório. O stash apagado não volta com pop. Peça confirmação explícita ao dono antes de apagar.`);
    const lista = arquivos.slice(0, 10).map(l => `  ${l}`).join('\n');
    return decisao('deny', `este comando descarta trabalho não commitado.\n\n${arquivos.length} arquivo(s):\n${lista}`
      + (arquivos.length > 10 ? `\n  ...e mais ${arquivos.length - 10}` : '')
      + '\nRestaure de uma CÓPIA antes de quebrar testes, ou peça confirmação explícita ao usuário dizendo o que se perde.');
  }
  return null;
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

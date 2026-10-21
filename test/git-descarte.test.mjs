// Casos de descarte portados de scripts/hooks-test.mjs do Prumb para node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('Regressão do hook de descarte', async (t) => {
const root = mkdtempSync(join(tmpdir(), 'prumb-lite-test-'));
const repo = join(root, 'repo-descarte');
const clean = join(root, 'repo-limpo');
const hook = fileURLToPath(new URL('../hooks/git-descarte.mjs', import.meta.url));
t.after(() => rmSync(root, { recursive: true, force: true }));
const git = (...args) => execFileSync('git', args, {
  cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
mkdirSync(repo); mkdirSync(clean);
git('init', '-q', '-b', 'main');
git('config', 'user.name', 'Teste');
git('config', 'user.email', 'teste@exemplo.invalid');
writeFileSync(join(repo, 'a.txt'), 'original\n');
git('add', '-A'); git('commit', '-q', '-m', 'Base de teste');
execFileSync('git', ['init', '-q', clean], { windowsHide: true });

function call(command, cwd = repo, tool = 'Bash') {
  const result = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ tool_name: tool, tool_input: { command }, cwd }),
    encoding: 'utf8', windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return result.stdout ? JSON.parse(result.stdout).hookSpecificOutput : null;
}
function check(name, command, deny, cwd = repo) {
  return t.test(name, () => {
    const result = call(command, cwd);
    if (deny) {
      assert.equal(result?.hookEventName, 'PreToolUse');
      assert.equal(result?.permissionDecision, 'deny');
      assert.match(result.permissionDecisionReason, /^Trava do Prumb:/);
    } else assert.equal(result, null);
  });
}

// Cada fase aguarda seus testes antes de alterar a fixture.
await t.test('Árvore limpa permite descarte', async () => {
  for (const command of ['git checkout -- a.txt', 'git reset --hard', 'git clean -fd']) {
    assert.equal(call(command), null, command);
  }
});
writeFileSync(join(repo, 'a.txt'), 'original\ntrabalho não salvo\n');
const destructive = [
  'git checkout -- a.txt', 'git checkout .', 'git checkout HEAD -- a.txt',
  'git restore a.txt', 'git reset --hard', 'git clean -fdx',
  'git checkout HEAD .', 'git checkout main -- a.txt', 'git checkout v1.0 -- a.txt',
  'git checkout -f main', 'git checkout main --force',
  'git restore --source HEAD a.txt', 'git restore --source=HEAD --staged a.txt',
  'git restore --worktree a.txt', 'git restore --staged --worktree a.txt',
  'git switch --discard-changes main', 'git switch -f main', 'git switch main --force',
  'git checkout -- x',
];
for (const command of destructive) await check(`Suja, bloqueia: ${command}`, command, true);
for (const command of [
  'git checkout main', 'git checkout -b feature/nova', 'git switch develop',
  'git restore --staged a.txt', 'git restore --staged f', 'git restore --staged x',
  'git stash', 'git status -s', 'git status', 'git add -A',
  'git commit -m "x"', 'git diff', 'npm test', 'git stash drop', 'git stash clear',
]) await check(`Suja, permite: ${command}`, command, false);
await check('-C absoluto consulta alvo sujo', `git -C "${repo}" checkout -- a.txt`, true, clean);
await check('-C relativo consulta alvo sujo', 'git -C ../repo-descarte checkout -- a.txt', true, clean);
await check('-C com aspas simples', "git -C '../repo-descarte' checkout -- a.txt", true, clean);
await check('-C repetido', 'git -C .. -C repo-descarte checkout -- a.txt', true, clean);
await check('Espaços antes de -C', 'git   -C ../repo-descarte checkout -- a.txt', true, clean);
await check('-C limpo permite apesar do cwd sujo', `git -C "${clean}" checkout -- a.txt`, false);
await check('Comando composto consulta cwd correto', `git -C "${clean}" status && git checkout -- x`, true);
await t.test('PowerShell preserva protocolo de bloqueio', () => {
  assert.equal(call('git checkout -- x', repo, 'PowerShell')?.permissionDecision, 'deny');
});
await t.test('Importar o módulo não consome stdin nem escreve', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    const before = ['data', 'end'].map(event => process.stdin.listenerCount(event));
    await import(${JSON.stringify(pathToFileURL(hook).href)});
    if (['data', 'end'].some((event, i) => process.stdin.listenerCount(event) !== before[i])) throw Error('stdin consumido');
  `], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
});
git('stash', 'push', '-m', 'Fixture');
for (const command of ['git stash drop', 'git stash clear']) {
  await t.test(`Stash com uma entrada bloqueia: ${command}`, () => {
    const result = call(command);
    assert.equal(result?.permissionDecision, 'deny');
    assert.match(result.permissionDecisionReason, /^Trava do Prumb:/);
    assert.match(result.permissionDecisionReason, /1 entrada/);
    assert.match(result.permissionDecisionReason, /não volta com pop/);
  });
}
await check('-C consulta stash do alvo', `git -C "${repo}" stash drop`, true, clean);
await check('-C stash vazio permite', `git -C "${clean}" stash clear`, false);
await check('Stash fora de repositório permite', 'git stash drop', false, root);
for (const command of destructive) await check(`Após stash, limpa permite: ${command}`, command, false);
await check('Fora de repositório permite', 'git checkout -- x', false, root);
for (const input of ['{inválido', 'null', '{}']) {
  await t.test(`Entrada inválida permite: ${input}`, () => {
    const result = spawnSync(process.execPath, [hook], {
      input, encoding: 'utf8', windowsHide: true, env: { ...process.env, PRUMB_HOOK_DEBUG: '0' },
    });
    assert.equal(result.status, 0); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
  });
}

});

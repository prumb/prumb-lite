import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function testarAuditoria(hook) {
  const { avaliarDescarte } = await import(pathToFileURL(hook));
  const root = mkdtempSync(join(tmpdir(), 'descarte-auditoria-'));
  const filho = join(root, 'filho');
  mkdirSync(filho);
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, windowsHide: true, stdio: 'pipe' });
  try {
    for (const cwd of [root, filho]) {
      git(cwd, 'init', '-q'); git(cwd, 'config', 'user.email', 'teste@example.invalid'); git(cwd, 'config', 'user.name', 'Teste');
      writeFileSync(join(cwd, '.gitignore'), 'filho/\n.env\n');
      writeFileSync(join(cwd, 'a.txt'), 'base'); git(cwd, 'add', '.'); git(cwd, 'commit', '-qm', 'base');
    }
    writeFileSync(join(filho, 'a.txt'), 'sujo');
    const avaliar = (command, cwd = filho) => avaliarDescarte({ cwd, tool_input: { command } });
    for (const command of ['git -c color.ui=false reset --hard', 'git reset --quiet --hard', 'git reset -q --hard', 'git.exe reset --hard', 'GIT.EXE reset --hard', '"C:\\Git\\git.exe" reset --hard', 'git --no-pager -C . reset --hard']) {
      assert.equal(avaliar(command)?.permissionDecision, 'deny', command);
    }
    for (const command of ['git reset --soft', 'git status', 'echo "git reset --hard"', 'git log -- reset', 'git restore --staged a.txt']) assert.equal(avaliar(command), null, command);
    for (const cd of ['cd', 'pushd', 'Set-Location', 'sl', 'chdir']) {
      for (const sep of [';', '&&', '||', '|', '\n']) assert.equal(avaliar(`${cd} filho${sep}git reset --hard`, root)?.permissionDecision, 'deny');
    }
    for (const cd of ['cd "$X"', 'cd $(pwd)', 'cd ~outra']) assert.equal(avaliar(`${cd}; git reset --hard`, root)?.permissionDecision, 'ask');
    assert.equal(avaliar('git clean --force'), null, 'clean não remove alterações rastreadas');
    writeFileSync(join(filho, '.env'), 'fixture');
    for (const flags of ['-fdX', '-fdx', '-xdf']) assert.equal(avaliar(`git clean ${flags}`)?.permissionDecision, 'deny');
    assert.equal(avaliar('git clean -fd'), null);
    writeFileSync(join(filho, 'solto'), 'fixture');
    for (const flags of ['--force', '-fd', '-df']) assert.equal(avaliar(`git clean ${flags}`)?.permissionDecision, 'deny');
    assert.equal(avaliar('git clean -fd -- outro'), null);
    assert.equal(avaliar('git clean -fd -e solto'), null);
    rmSync(join(filho, 'solto')); rmSync(join(filho, '.env'));
    writeFileSync(join(filho, 'nfile'), 'fixture');
    assert.equal(avaliar('git clean -fd -enfile'), null, 'exclusão colada preserva f e n no padrão');
    rmSync(join(filho, 'nfile'));
    git(filho, 'stash', 'push', '-qm', 'fixture');
    for (const command of ['git stash --quiet drop', 'git stash drop --quiet', 'git stash clear']) assert.equal(avaliar(command)?.permissionDecision, 'deny');
  } finally { rmSync(root, { recursive: true, force: true }); }
}

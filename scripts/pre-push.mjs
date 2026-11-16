import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
function fail(message) { console.error(message); process.exit(1); }
const check = run(process.execPath, ['scripts/release.mjs', '--check']);
process.stdout.write(check.stdout);
if (check.status !== 0) fail(check.stderr + 'Run node scripts/release.mjs --prepare, test and commit.');
if (run('git', ['diff', '--quiet', 'HEAD', '--', '*.js', '*.html', '*.css', 'scripts', '.githooks']).status !== 0)
  fail('Commit runtime/release changes before pushing.');
for (const line of readFileSync(0, 'utf8').trim().split('\n').filter(Boolean)) {
  const [localRef, localSha, , remoteSha] = line.split(/\s+/);
  if (!localRef.startsWith('refs/heads/') || /^0+$/.test(localSha)) continue;
  if (!/^[a-f0-9]{40,64}$/.test(localSha) || !/^[a-f0-9]{40,64}$/.test(remoteSha)) fail('Invalid Git reference.');
  let base = remoteSha;
  if (/^0+$/.test(base)) {
    // A new branch still needs a baseline if remote history is already known.
    const refs = run('git', ['for-each-ref', '--format=%(objectname)', 'refs/remotes']).stdout.trim().split('\n').filter(Boolean);
    let distance = Infinity; base = null;
    for (const sha of refs) {
      const ancestor = run('git', ['merge-base', sha, localSha]);
      if (ancestor.status !== 0) continue;
      const candidate = ancestor.stdout.trim();
      const count = Number(run('git', ['rev-list', '--count', `${candidate}..${localSha}`]).stdout.trim());
      if (count < distance) { base = candidate; distance = count; }
    }
    if (!base) continue; // First publication, with no known remote history.
  }
  const changed = run('git', ['diff', '--name-only', base, localSha]);
  if (changed.status !== 0) fail('Fetch the remote branch before pushing; its previous commit is unavailable.');
  if (!changed.stdout.split('\n').some(name => /^[^/]+\.(js|html|css)$/.test(name))) continue;
  const before = run('git', ['show', `${base}:config.js`]);
  const after = run('git', ['show', `${localSha}:config.js`]);
  const getVersion = text => text.match(/export const VERSION = ['"]([^'"]+)['"]/)?.[1];
  if (before.status === 0 && getVersion(before.stdout) === getVersion(after.stdout))
    fail('Runtime changed without a new VERSION. Bump config.js, run node scripts/release.mjs --prepare, test and commit.');
}
const tests = run(process.execPath, ['tests/run.js']);
process.stdout.write(tests.stdout);
if (tests.status !== 0) fail(tests.stderr || 'Tests failed.');

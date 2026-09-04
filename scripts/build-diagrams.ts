// archify の図を検証・生成する。
//   templates/archify/<slug>.<kind>.json  → 検証 (showcase) + templates/archify/preview/<slug>.<kind>.html
//   knowledge/diagrams/<slug>.<kind>.json → 検証 (showcase) + knowledge/diagrams/<slug>.<kind>.html
// 使い方: pnpm diagrams [--check] [file.json ...]
//   --check : 検証のみ (HTML を書かない)。pre-commit と CI 向け
// archify はプロジェクトローカルの .claude/skills/archify を使う (グローバルインストールしない)。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { repoRoot } from './lib/repo.ts';

const KINDS = new Set(['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle']);
const root = repoRoot();
const archify = join(root, '.claude', 'skills', 'archify', 'bin', 'archify.mjs');
if (!existsSync(archify)) {
  console.error('error: .claude/skills/archify が無い。pnpm dlx skills add tt-a1i/archify --skill archify --agent claude-code --copy --yes で複製する');
  process.exit(1);
}

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const explicit = argv.filter((a) => !a.startsWith('--')).map((a) => a.replaceAll('\\', '/'));

interface Target { rel: string; kind: string; out: string }
const listDir = (dir: string, outDir: string): Target[] => {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ rel: `${dir}/${f}`, kind: kindOf(f), out: `${outDir}/${f.replace(/\.json$/, '.html')}` }))
    .filter((t) => KINDS.has(t.kind));
};
function kindOf(file: string): string {
  const parts = basename(file, '.json').split('.');
  return parts.length >= 2 ? parts[parts.length - 1] : '';
}
const targets: Target[] = explicit.length
  ? explicit.map((rel) => {
    const dir = dirname(rel);
    const outDir = dir === 'templates/archify' ? 'templates/archify/preview' : dir;
    return { rel, kind: kindOf(rel), out: `${outDir}/${basename(rel).replace(/\.json$/, '.html')}` };
  })
  : [...listDir('templates/archify', 'templates/archify/preview'), ...listDir('knowledge/diagrams', 'knowledge/diagrams')];

const env = { ...process.env, ARCHIFY_UPDATE_CHECK_DISABLED: '1' };
let failed = 0;
for (const t of targets) {
  if (!KINDS.has(t.kind)) { console.error(`error: ${t.rel} はファイル名を <slug>.<kind>.json にする (kind: ${[...KINDS].join('|')})`); failed++; continue; }
  const args = checkOnly
    ? ['validate', t.kind, join(root, t.rel), '--quality', 'showcase', '--json']
    : ['deliver', t.kind, join(root, t.rel), join(root, t.out), '--quality', 'showcase', '--json'];
  if (!checkOnly) mkdirSync(join(root, dirname(t.out)), { recursive: true });
  let raw = '';
  let exit = 0;
  try {
    raw = execFileSync(process.execPath, [archify, ...args], { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const err = e as { stdout?: string; status?: number };
    raw = err.stdout ?? '';
    exit = err.status ?? 1;
  }
  let ok = exit === 0;
  let detail = '';
  try {
    const j = JSON.parse(raw) as { ok?: boolean; checks?: unknown[]; diagnostics?: { message: string }[] };
    ok = ok && j.ok !== false;
    detail = ok ? `checks=${j.checks?.length ?? '?'}` : (j.diagnostics ?? []).map((d) => `\n    ${d.message.split('\n')[0]}`).join('');
  } catch {
    detail = raw.slice(0, 300);
  }
  if (!ok) failed++;
  console.error(`${ok ? 'ok' : 'FAIL'}: ${t.rel}${checkOnly ? '' : ` -> ${t.out}`} ${detail}`);
}
console.error(`diagrams=${targets.length} failed=${failed}${checkOnly ? ' (check only)' : ''}`);
process.exit(failed ? 1 : 0);

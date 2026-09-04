// frontmatter からインデックスを生成する。
//   - <dir>/index.jsonl : markdown が直下にあるディレクトリごとの機械向け一覧 (1 行 1 JSON、gitignore 対象)
//   - INDEX.md          : リポジトリ直下の人間向け一覧 (コミットする)
// 設計は bash 版 extract-frontmatter.sh を踏襲する: concept_id は常にリポジトリルート基準、
// 列挙は git ls-files (削除済み未ステージは除外)、全走査後に一時ファイル + rename で原子的に差し替え、
// 内容が同じなら書き換えない、失敗があれば非ゼロ終了。
// bash 版の mtime キャッシュは持たない (Node では数百ファイルの解析が 1 秒未満で済むため)。
// 使い方: pnpm index [--quiet]
import { existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type Frontmatter, isStringList, splitFrontmatter, str } from './lib/frontmatter.ts';
import { SCOPE_DIRS, listMarkdown, repoRoot, toId } from './lib/repo.ts';

interface Entry {
  concept_id: string;
  directory: string;
  frontmatter: Frontmatter | null;
  mtime: string;
}

const quiet = process.argv.includes('--quiet');
const log = (m: string) => { if (!quiet) console.error(m); };
const root = repoRoot();
const files = listMarkdown(root, SCOPE_DIRS);

const entries: Entry[] = [];
let failed = 0;
for (const rel of files) {
  const abs = join(root, rel);
  const { data, error } = splitFrontmatter(readFileSync(abs, 'utf8'));
  if (error) { console.error(`error: failed to build index line: ${rel}: ${error}`); failed++; continue; }
  entries.push({
    concept_id: toId(rel),
    directory: rel.includes('/') ? dirname(rel).replaceAll('\\', '/') : '.',
    frontmatter: data,
    mtime: statSync(abs).mtime.toISOString(),
  });
}

const tmpFiles = new Set<string>();
const cleanup = () => { for (const t of tmpFiles) { try { unlinkSync(t); } catch { /* 無ければよい */ } } };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

// 内容が同じなら触らない。書くときは一時ファイル + rename
function writeAtomic(abs: string, content: string): boolean {
  if (existsSync(abs) && readFileSync(abs, 'utf8') === content) return false;
  const tmp = `${abs}.tmp.${process.pid}`;
  tmpFiles.add(tmp);
  writeFileSync(tmp, content);
  renameSync(tmp, abs);
  tmpFiles.delete(tmp);
  return true;
}

// ディレクトリごとの index.jsonl
const byDir = new Map<string, Entry[]>();
for (const e of entries) {
  const list = byDir.get(e.directory) ?? [];
  list.push(e);
  byDir.set(e.directory, list);
}
for (const [dir, list] of byDir) {
  const content = list.map((e) => JSON.stringify(e)).join('\n') + '\n';
  const rel = `${dir}/index.jsonl`;
  log(`${writeAtomic(join(root, rel), content) ? 'wrote' : 'unchanged'}: ${rel}`);
}

// INDEX.md (人間向け)。日付を含めず、内容が変わらない限り差分が出ないようにする
const cell = (v: unknown) => str(v).replaceAll('|', '\\|').replaceAll('\n', ' ');
const link = (e: Entry) => `[${e.concept_id}](${e.concept_id}.md)`;
const fm = (e: Entry): Frontmatter => e.frontmatter ?? {};
const tagsOf = (e: Entry): string[] => (isStringList(fm(e).tags) ? (fm(e).tags as string[]) : []);
const md: string[] = [
  '---',
  'type: index',
  'title: 知識インデックス',
  'description: frontmatter から自動生成した全 markdown の一覧',
  'tags: [meta]',
  'keywords: [index, 一覧, frontmatter, 自動生成]',
  '---',
  '',
  '# 知識インデックス',
  '',
  '生成物。手で編集しない。`pnpm index` で再生成する。',
  '',
];
const scopeOrder = (d: string) => (SCOPE_DIRS as readonly string[]).indexOf(d.split('/')[0]);
const dirs = [...byDir.keys()].sort((a, b) => scopeOrder(a) - scopeOrder(b) || a.localeCompare(b));
for (const dir of dirs) {
  md.push(`## ${dir}`, '', '| ID | title | type | status | tags | verified_at |', '|---|---|---|---|---|---|');
  for (const e of byDir.get(dir) ?? []) {
    const f = fm(e);
    md.push(`| ${link(e)} | ${cell(f.title)} | ${cell(f.type)} | ${cell(f.status)} | ${cell(tagsOf(e).join(', '))} | ${cell(f.verified_at)} |`);
  }
  md.push('');
}
const byTag = new Map<string, Entry[]>();
for (const e of entries) {
  for (const t of tagsOf(e)) {
    const list = byTag.get(t) ?? [];
    list.push(e);
    byTag.set(t, list);
  }
}
if (byTag.size) {
  md.push('## タグ別', '');
  for (const t of [...byTag.keys()].sort()) md.push(`- **${t}**: ${(byTag.get(t) ?? []).map(link).join(', ')}`);
  md.push('');
}
const outdated = entries.filter((e) => fm(e).status === 'outdated');
if (outdated.length) {
  md.push('## 無効化された知識', '', '| 旧 | 無効化した側 |', '|---|---|');
  for (const e of outdated) {
    const s = str(fm(e).superseded_by);
    md.push(`| ${link(e)} | ${s ? `[${s}](${s}.md)` : ''} |`);
  }
  md.push('');
}
log(`${writeAtomic(join(root, 'INDEX.md'), md.join('\n')) ? 'wrote' : 'unchanged'}: INDEX.md`);

console.error(`files=${files.length} built=${entries.length} failed=${failed}`);
process.exit(failed ? 1 : 0);

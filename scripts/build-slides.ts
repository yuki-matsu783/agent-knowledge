// slides/*.md (Marp markdown) から slides/*.html を生成し、生成 HTML の先頭にコメント形式の
// frontmatter (元 md の frontmatter から Marp 固有キーを除いたもの + built_from) を付ける。
// 使い方: pnpm slides [slides/foo.md ...]   引数なしなら slides/ 配下すべて
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { type Frontmatter, splitFrontmatter } from './lib/frontmatter.ts';
import { listMarkdown, repoRoot, toId } from './lib/repo.ts';

const root = repoRoot();
const marp = join(root, 'node_modules', '@marp-team', 'marp-cli', 'marp-cli.js');
if (!existsSync(marp)) { console.error('error: marp-cli が無い。pnpm install を実行する'); process.exit(1); }
const theme = join(root, 'templates', 'marp-theme.css');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((a) => a.replaceAll('\\', '/'));
const targets = args.length ? args : listMarkdown(root, ['slides']);
// Marp のグローバル/ローカルディレクティブ。HTML 側の frontmatter には載せない
const MARP_KEYS = new Set(['marp', 'theme', 'paginate', 'style', 'headingDivider', 'size', 'math', 'lang', 'class',
  'backgroundColor', 'backgroundImage', 'backgroundPosition', 'backgroundRepeat', 'backgroundSize', 'color',
  'footer', 'header', 'url', 'image', 'transition']);
const HTML_FM_RE = /^<!--\r?\n---\r?\n[\s\S]*?\r?\n---\r?\n-->\r?\n/;

let failed = 0;
for (const rel of targets) {
  const md = join(root, rel);
  const html = md.replace(/\.md$/, '.html');
  try {
    execFileSync(process.execPath, [marp, '--theme-set', theme, '--html', md, '-o', html], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });
  } catch {
    console.error(`error: marp の変換に失敗: ${rel}`);
    failed++;
    continue;
  }
  const { data } = splitFrontmatter(readFileSync(md, 'utf8'));
  const meta: Frontmatter = {};
  for (const [k, v] of Object.entries(data ?? {})) if (!MARP_KEYS.has(k)) meta[k] = v;
  meta.built_from = toId(rel);
  const body = readFileSync(html, 'utf8').replace(HTML_FM_RE, '');
  writeFileSync(html, `<!--\n---\n${stringify(meta).trimEnd()}\n---\n-->\n${body}`);
  console.error(`built: ${rel} -> ${rel.replace(/\.md$/, '.html')}`);
}
console.error(`slides=${targets.length} failed=${failed}`);
process.exit(failed ? 1 : 0);

// 鮮度点検の候補を列挙する。knowledge-audit skill から使う。
// 使い方: pnpm audit [--days 90]
//   - verified だが verified_at が N 日より古い
//   - verified なのに applies_to が無い
//   - knowledge/ 配下なのに draft のまま
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isStringList, splitFrontmatter, str } from './lib/frontmatter.ts';
import { listMarkdown, repoRoot, toId } from './lib/repo.ts';

const argv = process.argv.slice(2);
const daysArg = argv.indexOf('--days') >= 0 ? Number(argv[argv.indexOf('--days') + 1]) : 90;
const days = Number.isFinite(daysArg) && daysArg >= 0 ? daysArg : 90;
const root = repoRoot();
const limit = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

const rows: [string, string, string][] = [];
for (const rel of listMarkdown(root, ['knowledge', 'adr'])) {
  const { data } = splitFrontmatter(readFileSync(join(root, rel), 'utf8'));
  if (!data) continue;
  const id = toId(rel);
  const status = str(data.status);
  const v = str(data.verified_at);
  const applies = isStringList(data.applies_to) ? data.applies_to.join(' ') : '';
  if (status === 'verified' && v && v < limit) rows.push([id, `verified_at ${v} が ${days} 日より古い`, applies]);
  if (rel.startsWith('knowledge/') && status === 'verified' && !applies) rows.push([id, 'applies_to が無い', '']);
  if (rel.startsWith('knowledge/') && status === 'draft') rows.push([id, 'knowledge/ にあるが draft のまま', applies]);
}
if (!rows.length) { console.log(`点検候補なし (基準日 ${limit})`); process.exit(0); }
console.log('| ID | 理由 | applies_to |');
console.log('|---|---|---|');
for (const r of rows) console.log(`| ${r[0]} | ${r[1]} | ${r[2]} |`);

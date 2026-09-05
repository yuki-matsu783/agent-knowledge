// 鮮度点検の候補を列挙する。knowledge-audit skill から使う。
// 使い方: pnpm audit [--days 90]
//   - stable だが verified_at が N 日より古い
//   - knowledge/ の stable なのに applies_to が無い (type: note は除く。note は未確認が前提)
//   - knowledge/ の stable なのに sources が無い (同上)
//   - stale_after を過ぎている (製品の版で変わりうる挙動に書いた「確かめ直す日」)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isStringList, splitFrontmatter, str } from './lib/frontmatter.ts';
import { listMarkdown, repoRoot, toId } from './lib/repo.ts';

const argv = process.argv.slice(2);
const daysArg = argv.indexOf('--days') >= 0 ? Number(argv[argv.indexOf('--days') + 1]) : 90;
const days = Number.isFinite(daysArg) && daysArg >= 0 ? daysArg : 90;
const root = repoRoot();
const limit = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
// ローカル日付 (UTC だと JST の早朝に前日になる)
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const rows: [string, string, string][] = [];
for (const rel of listMarkdown(root, ['knowledge'])) {
  const { data } = splitFrontmatter(readFileSync(join(root, rel), 'utf8'));
  if (!data) continue;
  const id = toId(rel);
  const status = str(data.status);
  const isNote = str(data.type) === 'note';
  const v = str(data.verified_at);
  const applies = isStringList(data.applies_to) ? data.applies_to.join(' ') : '';
  if (status === 'stable' && v && v < limit) rows.push([id, `verified_at ${v} が ${days} 日より古い`, applies]);
  const stale = str(data.stale_after);
  if (status === 'stable' && stale && stale <= today) rows.push([id, `stale_after ${stale} を過ぎている`, applies]);
  if (rel.startsWith('knowledge/') && status === 'stable' && !isNote && !applies) rows.push([id, 'applies_to が無い', '']);
  if (rel.startsWith('knowledge/') && status === 'stable' && !isNote && !(isStringList(data.sources) && data.sources.length)) rows.push([id, 'sources が無い', applies]);
}
if (!rows.length) { console.log(`点検候補なし (基準日 ${limit})`); process.exit(0); }
console.log('| ID | 理由 | applies_to |');
console.log('|---|---|---|');
for (const r of rows) console.log(`| ${r[0]} | ${r[1]} | ${r[2]} |`);

// frontmatter・配置・命名・相対リンクの規約チェック。
// 規約本体: .claude/rules/markdown-frontmatter.md, directory-layout.md, knowledge-authoring.md
// 語彙: taxonomy.yml
// error が 1 件でもあれば終了コード 1。warning は表示のみ。
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parse } from 'yaml';
import { isStringList, splitFrontmatter, str } from './lib/frontmatter.ts';
import { SCOPE_DIRS, listMarkdown, repoRoot, toId } from './lib/repo.ts';

interface TypeDef {
  description: string;
  dirs: string[];
  max_lines?: number;
  lifecycle?: boolean;
  sources_required?: boolean;
  derived_from_required?: boolean;
}
interface Taxonomy {
  types: Record<string, TypeDef>;
  tags: Record<string, string>;
}

const root = repoRoot();
const taxonomy = parse(readFileSync(join(root, 'taxonomy.yml'), 'utf8')) as Taxonomy;
const files = listMarkdown(root, SCOPE_DIRS, ['INDEX.md']);
const ids = new Set(files.map(toId));
// superseded_by / derived_from の参照先。scope 内の ID か、リポジトリ内に実在する markdown の ID (.claude/docs/ など)
const refExists = (id: string): boolean => ids.has(id) || existsSync(join(root, `${id}.md`));

const errors: string[] = [];
const warnings: string[] = [];
const err = (f: string, m: string) => errors.push(`${f}: ${m}`);
const warn = (f: string, m: string) => warnings.push(`${f}: ${m}`);

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*\.md$/;
const NAME_ALLOW = new Set(['INDEX.md']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const APPLIES_RE = /^[a-z0-9][a-z0-9.-]*@\S+$/;
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const STATUSES = ['draft', 'verified', 'outdated'];
// ローカル日付 (UTC だと JST の早朝に前日になる)
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

for (const rel of files) {
  const text = readFileSync(join(root, rel), 'utf8');
  const name = basename(rel);
  if (!NAME_ALLOW.has(name) && !NAME_RE.test(name)) err(rel, 'ファイル名は ASCII の kebab-case にする');

  const { data, body, error } = splitFrontmatter(text);
  if (error) { err(rel, `frontmatter が YAML として読めない: ${error}`); continue; }
  if (!data) { err(rel, 'frontmatter が無い'); continue; }

  // type と配置
  const type = str(data.type);
  const tdef = taxonomy.types[type];
  if (!tdef) { err(rel, `type '${type}' は taxonomy.yml に無い`); continue; }
  const topDir = rel.includes('/') ? rel.split('/')[0] : '.';
  if (!tdef.dirs.includes(topDir)) err(rel, `type '${type}' を置けるのは ${tdef.dirs.join(', ')} のみ`);
  const lines = body.trim().split('\n').length;
  if (tdef.max_lines && lines > tdef.max_lines) warn(rel, `本文 ${lines} 行。type '${type}' の目安 ${tdef.max_lines} 行を超えている。分割を検討する`);

  // title / description。description は一番力を入れるキー (英語、What / Use when / Not for)
  if (typeof data.title !== 'string' || !data.title.trim()) warn(rel, 'title を書く');
  const desc = typeof data.description === 'string' ? data.description.trim() : '';
  if (!desc) err(rel, 'description を書く (英語で、何の知識か・いつ使うか・いつ使わないか)');
  else if (tdef.lifecycle !== false) {
    if (desc.length < 80) warn(rel, `description が短い (${desc.length} 字)。Use when / Not for を含めて 150〜400 字にする`);
    if (!/\b(use when|when you|when a|when the|applies when)\b/i.test(desc)) warn(rel, 'description に「いつ適用するか」(Use when ...) が無い');
    if (!/\b(not for|not a|not the|not when|does not|do not|not applicable|unrelated to)\b/i.test(desc)) warn(rel, 'description に「いつ適用しないか」(Not for ...) が無い');
  }

  // tags (統制語彙) / keywords (自由)
  if (!isStringList(data.tags)) err(rel, 'tags は文字列のリストにする');
  else {
    for (const tag of data.tags) if (!(tag in taxonomy.tags)) err(rel, `tag '${tag}' は taxonomy.yml に無い。既存タグを使うか taxonomy.yml に追加する`);
    if (data.tags.length < 1 || data.tags.length > 4) warn(rel, `tags は 1〜4 個にする (現在 ${data.tags.length})`);
  }
  if (data.keywords !== undefined) {
    if (!isStringList(data.keywords)) err(rel, 'keywords は文字列のリストにする');
    else if (data.keywords.length < 3 || data.keywords.length > 20) warn(rel, `keywords は 3〜20 個にする (現在 ${data.keywords.length})`);
  } else if (tdef.lifecycle !== false) warn(rel, 'keywords を書く (検索用)');

  // 鮮度: status / verified_at / applies_to / sources / superseded_by
  if (tdef.lifecycle !== false) {
    const status = str(data.status);
    if (!STATUSES.includes(status)) err(rel, `status は ${STATUSES.join(' | ')} のいずれか`);
    if (status !== 'draft' && data.verified_at === undefined) err(rel, `status が ${status} なら verified_at が必要`);
    if (data.verified_at !== undefined) {
      const v = str(data.verified_at);
      if (!DATE_RE.test(v)) err(rel, 'verified_at は YYYY-MM-DD 形式');
      else if (v > today) err(rel, 'verified_at が未来の日付');
    }
    if (data.applies_to !== undefined) {
      if (!isStringList(data.applies_to)) err(rel, 'applies_to は文字列のリストにする');
      else for (const a of data.applies_to) if (!APPLIES_RE.test(a)) err(rel, `applies_to '${a}' は name@version の形式にする`);
    } else if (status === 'verified' && tdef.sources_required) warn(rel, 'verified なら applies_to に検証したバージョンを書く');
    if (data.sources !== undefined) {
      if (!isStringList(data.sources)) err(rel, 'sources は文字列のリストにする');
      else for (const s of data.sources) {
        if (/^https?:\/\//.test(s)) continue;
        if (!existsSync(join(root, s))) err(rel, `sources '${s}' は URL でもリポジトリ内のパスでもない`);
      }
    }
    if (tdef.sources_required && status === 'verified' && !(isStringList(data.sources) && data.sources.length)) {
      err(rel, 'verified にするには sources が 1 件以上必要');
    }
    if (status === 'outdated') {
      if (typeof data.superseded_by !== 'string') err(rel, 'outdated なら superseded_by に無効化した側の ID を書く (knowledge か .claude/docs)');
      else if (!refExists(data.superseded_by)) err(rel, `superseded_by '${data.superseded_by}' が存在しない`);
    } else if (data.superseded_by !== undefined) warn(rel, 'superseded_by は outdated のときだけ書く');
  }
  if (tdef.derived_from_required) {
    if (typeof data.derived_from !== 'string') err(rel, 'derived_from に元の knowledge か .claude/docs のドキュメントの ID を書く');
    else if (!refExists(data.derived_from)) err(rel, `derived_from '${data.derived_from}' が存在しない`);
  }

  // リンク: 相対パスのみ。wikilink とルート絶対パスは禁止
  if (/\[\[[^\]]+\]\]/.test(body)) err(rel, 'wikilink [[...]] は使わない。相対パスで書く');
  for (const m of body.matchAll(LINK_RE)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = decodeURI(target.split('#')[0]);
    if (!path) continue;
    if (path.startsWith('/')) { err(rel, `リンク '${target}' はルート絶対パス。相対パスにする`); continue; }
    if (!existsSync(join(root, dirname(rel), path))) err(rel, `リンク先 '${target}' が存在しない`);
  }
}

for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`error: ${e}`);
console.error(`files=${files.length} errors=${errors.length} warnings=${warnings.length}`);
process.exit(errors.length ? 1 : 0);

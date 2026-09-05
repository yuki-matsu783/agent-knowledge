// frontmatter の index.jsonl を横断検索する。設計は bash 版 search-frontmatter.sh を踏襲する:
//   同じオプションの繰り返しは OR、異なるオプション同士は AND。type/tag/keyword は大文字小文字を無視した
//   完全一致、path/text は部分一致。--text はキー名ではなく値だけを対象にする。
//   matched は --limit で打ち切る前の件数。該当 0 件でも終了コードは 0。
// 使い方: pnpm run search [オプション] (run を省くと pnpm 組み込みの npm 検索になる)
//   --type <値> --tag <値> --keyword <値> --path <部分文字列> --text <部分文字列>
//   --status <値> --since <YYYY-MM-DD> --until <YYYY-MM-DD> (mtime で絞る)
//   --sort path|mtime|type|title  --reverse  --limit <N>
//   --format table|path|json|jsonl|detail|count  --dir <リポジトリルート基準の相対パス>
//   --no-refresh (index.jsonl を再生成しない)  --quiet (件数サマリを出さない)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { type Frontmatter, isStringList, str } from './lib/frontmatter.ts';
import { repoRoot } from './lib/repo.ts';

interface Entry {
  concept_id: string;
  directory: string;
  frontmatter: Frontmatter | null;
  mtime: string;
}

const SORT_KEYS = ['path', 'mtime', 'type', 'title'] as const;
const FORMATS = ['table', 'path', 'json', 'jsonl', 'detail', 'count'] as const;
const EXCLUDED_DIRS = new Set(['.git', 'node_modules']);
type SortKey = (typeof SORT_KEYS)[number];
type Format = (typeof FORMATS)[number];

interface Options {
  types: string[]; tags: string[]; keywords: string[]; statuses: string[]; paths: string[]; texts: string[];
  since: string; until: string; sort: SortKey; reverse: boolean; limit: number; format: Format; dir: string;
  refresh: boolean; quiet: boolean;
}

function usage(): never {
  console.error(`usage: pnpm run search [options]
  --type <v> --tag <v> --keyword <v> --status <v>   完全一致 (大文字小文字を無視)。同じ option の繰り返しは OR
  --path <s> --text <s>                            部分一致
  --since <date> --until <date>                    mtime で絞る
  --sort ${SORT_KEYS.join('|')}  --reverse  --limit <N>
  --format ${FORMATS.join('|')}  --dir <path>
  --no-refresh  --quiet`);
  process.exit(1);
}

function parseArgs(argv: string[]): Options {
  const o: Options = {
    types: [], tags: [], keywords: [], statuses: [], paths: [], texts: [],
    since: '', until: '', sort: 'path', reverse: false, limit: 0, format: 'table', dir: '.',
    refresh: true, quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const takeValue = (): string => {
      const v = argv[i + 1];
      // 値の省略や、値の位置に別オプションが来たケースを「該当なし」と区別する。ハイフン 1 つの値 (-A 等) は通す
      if (v === undefined || v.startsWith('--')) { console.error(`error: ${a} には値が必要`); usage(); }
      i++;
      return v;
    };
    switch (a) {
      case '--type': o.types.push(takeValue()); break;
      case '--tag': o.tags.push(takeValue()); break;
      case '--keyword': o.keywords.push(takeValue()); break;
      case '--status': o.statuses.push(takeValue()); break;
      case '--path': o.paths.push(takeValue()); break;
      case '--text': o.texts.push(takeValue()); break;
      case '--since': o.since = takeValue(); break;
      case '--until': o.until = takeValue(); break;
      case '--sort': {
        const v = takeValue();
        if (!(SORT_KEYS as readonly string[]).includes(v)) { console.error(`error: --sort は ${SORT_KEYS.join('|')}`); usage(); }
        o.sort = v as SortKey; break;
      }
      case '--format': {
        const v = takeValue();
        if (!(FORMATS as readonly string[]).includes(v)) { console.error(`error: --format は ${FORMATS.join('|')}`); usage(); }
        o.format = v as Format; break;
      }
      case '--limit': {
        const v = Number(takeValue());
        if (!Number.isInteger(v)) { console.error('error: --limit は整数'); usage(); }
        o.limit = v; break;
      }
      case '--dir': o.dir = takeValue().replaceAll('\\', '/').replace(/\/$/, '') || '.'; break;
      case '-r': case '--reverse': o.reverse = true; break;
      case '--no-refresh': o.refresh = false; break;
      case '-q': case '--quiet': o.quiet = true; break;
      case '-h': case '--help': usage();
      default: console.error(`error: unknown option: ${a}`); usage();
    }
  }
  // 日付だけの --until は当日の終わりまで含める (辞書順比較で当日分が落ちないように)
  if (/^\d{4}-\d{2}-\d{2}$/.test(o.until)) o.until = `${o.until}T23:59:59.999Z`;
  return o;
}

// index.jsonl を再帰的に集める。index.jsonl は gitignore 対象なので git ls-files ではなく fs で列挙する
function findIndexFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!EXCLUDED_DIRS.has(ent.name)) out.push(...findIndexFiles(join(dir, ent.name)));
    } else if (ent.name === 'index.jsonl') out.push(join(dir, ent.name));
  }
  return out;
}

const fm = (e: Entry): Frontmatter => e.frontmatter ?? {};
const arr = (e: Entry, k: string): string[] => {
  const v = fm(e)[k];
  if (v === undefined || v === null) return [];
  return isStringList(v) ? v : [str(v)];
};
const lower = (xs: string[]) => xs.map((x) => x.toLowerCase());
const matchExact = (needles: string[], hay: string[]) => needles.length === 0 || lower(needles).some((n) => lower(hay).includes(n));
const matchSub = (needles: string[], hay: string) => needles.length === 0 || lower(needles).some((n) => hay.toLowerCase().includes(n));
// --text の対象: concept_id・mtime と frontmatter の値 (キー名は含めない)
function searchableText(e: Entry): string {
  const vals: string[] = [e.concept_id, e.mtime];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    else if (v !== null && v !== undefined) vals.push(String(v));
  };
  walk(fm(e));
  return vals.join(' ');
}
// 表の桁揃え用。CJK・全角を幅 2 で数える
const dwidth = (s: string) => s.length + (s.match(/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/g)?.length ?? 0);
const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - dwidth(s)));

const o = parseArgs(process.argv.slice(2));
const root = repoRoot();
const target = join(root, o.dir);
if (!existsSync(target) || !statSync(target).isDirectory()) {
  console.error(`error: ディレクトリが無い: ${o.dir} (--dir はリポジトリルート基準)`);
  process.exit(1);
}
if (o.refresh) {
  try {
    execFileSync(process.execPath, ['--import', 'tsx', join(root, 'scripts', 'build-index.ts'), '--quiet'], { cwd: root, stdio: 'ignore' });
  } catch {
    console.error('warning: index の再生成に失敗した。既存の index.jsonl で検索を続行する');
  }
}

const indexFiles = findIndexFiles(target);
if (indexFiles.length === 0) {
  console.error('warning: index.jsonl が 1 件も無い。pnpm index を実行する');
  if (!o.quiet) console.error('matched=0 total=0');
  process.exit(0);
}
const seen = new Set<string>();
const all: Entry[] = [];
for (const f of indexFiles) {
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const e = JSON.parse(line) as Entry;
    if (seen.has(e.concept_id)) continue;
    seen.add(e.concept_id);
    all.push(e);
  }
}

const matched = all.filter((e) =>
  matchExact(o.types, [str(fm(e).type)])
  && matchExact(o.statuses, [str(fm(e).status)])
  && matchExact(o.tags, arr(e, 'tags'))
  && matchExact(o.keywords, arr(e, 'keywords'))
  && matchSub(o.paths, e.concept_id)
  && matchSub(o.texts, searchableText(e))
  && (o.since === '' || e.mtime >= o.since)
  && (o.until === '' || e.mtime <= o.until),
);
const keyOf = (e: Entry): string => {
  switch (o.sort) {
    case 'mtime': return `${e.mtime} ${e.concept_id}`;
    case 'type': return `${str(fm(e).type)} ${e.concept_id}`;
    case 'title': return `${str(fm(e).title)} ${e.concept_id}`;
    default: return e.concept_id;
  }
};
matched.sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
if (o.reverse) matched.reverse();
const hits = o.limit > 0 ? matched.slice(0, o.limit) : matched;

const out: string[] = [];
switch (o.format) {
  case 'count':
    out.push(`matched=${matched.length}${hits.length !== matched.length ? ` shown=${hits.length}` : ''} total=${all.length}`);
    break;
  case 'path': for (const e of hits) out.push(e.concept_id); break;
  case 'jsonl': for (const e of hits) out.push(JSON.stringify(e)); break;
  case 'json': out.push(JSON.stringify(hits, null, 2)); break;
  case 'detail':
    for (const e of hits) {
      out.push(`- ${e.concept_id}`);
      out.push(`  type       : ${str(fm(e).type)}`);
      out.push(`  status     : ${str(fm(e).status)}`);
      out.push(`  title      : ${str(fm(e).title)}`);
      out.push(`  description: ${str(fm(e).description)}`);
      out.push(`  tags       : ${arr(e, 'tags').join(', ')}`);
      out.push(`  keywords   : ${arr(e, 'keywords').join(', ')}`);
      out.push(`  verified_at: ${str(fm(e).verified_at)}`);
      out.push(`  mtime      : ${e.mtime}`);
    }
    break;
  default: {
    const tw = Math.max(0, ...hits.map((e) => dwidth(str(fm(e).type))));
    const sw = Math.max(0, ...hits.map((e) => dwidth(str(fm(e).status))));
    const cw = Math.max(0, ...hits.map((e) => dwidth(e.concept_id)));
    for (const e of hits) out.push(`${pad(str(fm(e).type), tw)}  ${pad(str(fm(e).status), sw)}  ${pad(e.concept_id, cw)}  ${str(fm(e).title)}`);
  }
}
if (out.length) console.log(out.join('\n'));
if (!o.quiet && o.format !== 'count') {
  console.error(`matched=${matched.length}${hits.length !== matched.length ? ` shown=${hits.length}` : ''} total=${all.length} indexes=${indexFiles.length}`);
}

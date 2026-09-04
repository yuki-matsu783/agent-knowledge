// YAML frontmatter の切り出し。markdown は先頭の "---" ブロック、HTML は先頭の "<!-- --- ... --- -->" ブロック
import { parse } from 'yaml';

export type Frontmatter = Record<string, unknown>;

export interface SplitResult {
  raw: string | null;
  data: Frontmatter | null;
  body: string;
  error?: string;
}

const MD_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const HTML_RE = /^<!--\r?\n---\r?\n([\s\S]*?)\r?\n---\r?\n-->\r?\n?/;

export function splitFrontmatter(text: string, kind: 'md' | 'html' = 'md'): SplitResult {
  const m = text.match(kind === 'html' ? HTML_RE : MD_RE);
  if (!m) return { raw: null, data: null, body: text };
  const body = text.slice(m[0].length);
  try {
    const data = parse(m[1]) as unknown;
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { raw: m[1], data: null, body, error: 'frontmatter がマッピングではない' };
    }
    return { raw: m[1], data: data as Frontmatter, body };
  } catch (e) {
    return { raw: m[1], data: null, body, error: (e as Error).message };
  }
}

export const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
export const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

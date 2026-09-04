// リポジトリルートの解決と、対象 markdown の列挙
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// lint と index の対象ディレクトリ。.claude/ と templates/ は対象外 (独自の frontmatter を持つため)
export const SCOPE_DIRS = ['knowledge', 'inbox', 'adr', 'slides'] as const;

export function repoRoot(): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

// 追跡済み + 未追跡 (.gitignore 非対象) の markdown を列挙する。削除済みで未ステージのものは除く
export function listMarkdown(root: string, dirs: readonly string[] = SCOPE_DIRS, extraFiles: readonly string[] = []): string[] {
  const pathspecs = [
    ...dirs.filter((d) => existsSync(join(root, d))),
    ...extraFiles.filter((f) => existsSync(join(root, f))),
  ];
  if (pathspecs.length === 0) return [];
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...pathspecs], {
    cwd: root,
    encoding: 'utf8',
  });
  return [...new Set(out.split('\0'))].filter((p) => p.endsWith('.md') && existsSync(join(root, p))).sort();
}

// ID = リポジトリルートからの相対パスから .md を除いたもの
export const toId = (rel: string): string => rel.replace(/\.md$/, '');

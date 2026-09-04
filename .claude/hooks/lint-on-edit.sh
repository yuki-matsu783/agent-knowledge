#!/bin/sh
# PostToolUse (Write|Edit): 対象ディレクトリの markdown か taxonomy.yml を書き換えたら lint を走らせ、
# error があれば exit 2 で結果を Claude に返す。規約を「思い出して守る」のではなく機械的に突き返すための hook。
f=$(jq -r '.tool_input.file_path // empty' | tr '\\' '/')
case "$f" in
  */knowledge/*.md | knowledge/*.md | */inbox/*.md | inbox/*.md | */adr/*.md | adr/*.md | */slides/*.md | slides/*.md | *taxonomy.yml) ;;
  *) exit 0 ;;
esac
out=$(pnpm exec tsx scripts/lint-frontmatter.ts 2>&1) && exit 0
printf '%s\n' "$out" >&2
exit 2

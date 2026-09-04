#!/bin/sh
# PreToolUse (Write|Edit): 生成物 (INDEX.md, index.jsonl, slides/*.html) の手編集を止める。
f=$(jq -r '.tool_input.file_path // empty' | tr '\\' '/')
case "$f" in
  *INDEX.md | *index.jsonl | */slides/*.html | slides/*.html)
    echo "生成物なので手で編集しない: $f (INDEX.md と index.jsonl は pnpm index、slides/*.html は pnpm slides で再生成する)" >&2
    exit 2 ;;
esac
exit 0

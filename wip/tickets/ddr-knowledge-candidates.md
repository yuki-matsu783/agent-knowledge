# 参考ディレクトリ/ddr から knowledge へ抽出する候補

77 件の DDR (i0000-01 〜 i0159-01) を全件読んで選別した。2026-09-05 時点。
「他のリポジトリでも通用する知見か」「既存 knowledge/ と重複しないか」「実測・実例があるか」で優先度を付けた。

元 DDR は issue 駆動 MR ワークフロー機構 (bash + jq、GitHub/GitLab、Claude Code / Gemini CLI 両対応) の決定記録。
ワークフロー固有の flow-id やスクリプト名は落とし、原理と反例だけを持ち込む。

## 注意

- i0045-01 に社内 GitLab のホスト名 `aslead` が出てくる。knowledge へは持ち込まない
- 元リポジトリの issue 番号・PR 番号は sources に URL として残す程度にし、本文には書かない
- 実機検証が 1 環境・1 バージョンに留まるものは type を `note` にする (i0047-01 の allow 側、i0097 系の Gemini ログ、i0111-01 の添付 API)
- 連番 ID の衝突 (i0133-01) は knowledge/ が kebab-case slug なので当てはまらない (adr/ は廃止した)

## 進捗

- 2026-09-05: 優先度 高 #1〜#26 を knowledge/ に作成済み (slug は表のとおり)。`pnpm check` error 0。
  applies_to はこのリポジトリで試していないので書いていない (warning 25 件はすべてこれ)
- 未着手: 優先度 中 #27〜#44、低 #45〜#55

## 優先度 高 (既存 knowledge に無く、実測か実例が付いている)

| # | 候補 (仮 slug) | type | tags | 元 DDR | 要点 |
|---|---|---|---|---|---|
| 1 | transcript-jsonl-is-append-only-across-compact | concept | claude-code, observability, context-management | i0023-01, i0000-04 | transcript は追記専用で、/compact は `compact_boundary` 行と `isCompactSummary` 行を足すだけ。push 断面は先頭 N 行と一致するので全文コピーは要らない。各 assistant 行に `gitBranch` が付く |
| 2 | transcript-usage-tokens-undercount | pitfall | claude-code, cost, observability | i0000-04 (追記) | ストリーミング開始時のプレースホルダ値が更新されず input が最大 100 倍過小になる報告。cache 系は影響小。金額は算出せず「目安」と明記する |
| 3 | transcript-lines-duplicated-on-resume | pitfall | claude-code, observability | i0000-04 (issue #37 追記) | resume のたびに過去行が別 `gitBranch` で再書き出しされ uuid が重複する。uuid は parentUuid チェーンのノード ID なので重複排除してはいけない。行カーソル (処理済み行数をセッション単位で持つ) で二重計上を避ける |
| 4 | transcript-user-content-may-be-string | pitfall | claude-code, observability | i0000-04 | `message.content` は配列とは限らず、人間の素の入力は文字列。合成フィクスチャでは出ない。実データで確かめる |
| 5 | reinject-work-context-after-compact | pattern | claude-code, context-management, workflow | i0057-01 | SessionStart matcher に `compact` を足し「現在地」だけを再注入する。PreCompact は additionalContext 非対応。全文でなく短い節、しきい値超過は切り詰めず警告のみ、起動要因で内容を分岐させない。既存 ask-user-to-reset-context と gemini-cli-no-post-compress-hook の間を埋める |
| 6 | reread-instruction-not-content-after-compact | pattern | claude-code, context-management, prompting | i0113-01 | compact 後は「もう読んだ」という認識自体が信用できない。手順書の中身ではなく「既に読んでいても読み直せ」という指示を hook で注入する。CLAUDE.md に書いても要約対象なので消える |
| 7 | bash-hook-resolves-to-wsl-stub-on-windows | pitfall | claude-code, workflow | i0000-05 | Windows で `"command": "bash"` が System32 の WSL スタブへ黙って解決され hook が無言で死ぬ。Git\bin をシステム環境変数 PATH の先頭側へ (ユーザー環境変数では効かない)。`setx` は 1024 文字で切り詰める |
| 8 | ntfs-junction-is-not-a-git-symlink | pitfall | workflow, gemini-cli | i0000-13 | Windows の junction を git はリンクと認識せず、先の実ファイルを丸ごと個別ファイルとして列挙・コミットする。symlink には開発者モードが要る。リンクは Git 管理から外してセットアップで生成する |
| 9 | generate-gemini-assets-from-claude-assets | pattern | gemini-cli, claude-code, workflow | i0070-01 | .gemini/ をリンクでなく .claude/ からの変換生成物にする。agents の frontmatter スキーマが strict で余分なキーで落ちる、settings の語彙が違う (PreToolUse→BeforeTool、Read→read_file)。変換できないキーは黙って落とさずエラーで止める |
| 10 | command-position-match-fails-closed | pattern | claude-code, security, workflow | i0053-01 | 判定を「正規化→コマンド位置のトークン走査→読めなければ部分一致へ縮退 (ブロック側)」の 3 段にする。eval/xargs/bash -c、8192 バイト超、ライブラリ不在は縮退。誤検知は回復できるが素通りは気づけない。既存 regex-command-match-misfires (shlex) の bash 版・失敗の向きの話 |
| 11 | hook-prefilter-must-stay-superset | pitfall | claude-code, security | i0159-01 | fork を減らす前置フィルタは精密判定の超集合でなければならない。生 JSON を見るので `\n` のバックスラッシュだけ除くと `n` が残り `com\<改行>mit` を取りこぼす。JSON エスケープ 2 文字を丸ごと除く。`${raw,,}` は bash 4 依存で古い環境では hook ごと落ちる |
| 12 | block-vs-notice-hook-selection | pattern | claude-code, security, workflow | i0039-01, i0000-09 | PreToolUse でブロックしてよいのは「禁止操作を文字列で一意に特定できる」かつ「常に使える正規の代替経路がある」場合だけ。どちらか欠けるなら PostToolUse で注意喚起を注入する多重防御に留める。既存 deny-by-hook / injecting-vs-guarding の選択基準 |
| 13 | close-gaps-with-mechanism-not-wording | pattern | claude-code, workflow | i0070-02, i0066-01, i0140-01 | ルール文言が十分強くても事故は起きる。原因を「守らなかった」と「守れる形になっていなかった (記録の欠落・粒度)」に分け、後者は状態 (HANDOFF のヘッダ行) とゲート (値が 0 でなければ mark-done を拒否) で塞ぐ。書き手側だけ行を挿入する非対称でデッドロックを避ける |
| 14 | agent-scripts-must-not-succeed-silently | pattern | workflow, tool-use | i0066-01, i0140-01, i0034-01, i0117-01 | エージェントが呼ぶスクリプトは、書き換え対象が無ければ書き戻さず非 0 で終える。無言の成功はエージェントが「できた」と誤認する。沈黙する縮退 (PR なしと表示) は誤情報になる。スキップ件数は必ず可視化する |
| 15 | name-the-alternative-in-failure-message | pattern | claude-code, mcp, tool-use | i0034-01 | CLI 不在時は「代替の MCP ツール名と引数」を stderr へ出して失敗する。AGENTS.md に書いてあっても読まれなければ機能しない。実行時に必ず目に入る失敗メッセージへ誘導を埋める |
| 16 | tool-description-shows-one-line | pitfall | claude-code, prompting | i0047-01 | Bash ツールの description はコンソールに 1 行しか出ない。全体は description、各ブロックの意図はコマンド内コメントへ。1 行コマンドにコメントを付けると後続を飲む。複数行の 1 行目にコメントを置かない |
| 17 | permissions-deny-any-allow-all-asymmetry | note | claude-code, security | i0047-01 | deny は部分コマンドのいずれか一致で拒否 (ANY)、allow はすべて一致で自動承認 (ALL)。先頭コメント行が deny をすり抜けないことは実測したが allow 側は未確認。照合の実挙動は環境・バージョンで異なる観測がある |
| 18 | plan-file-path-is-reused-on-reentry | pitfall | claude-code, workflow | i0000-06, i0009-01 | ExitPlanMode は plan 引数を取らずハーネス提示パスから読む。同一セッションで再突入すると同じパスが提示され続ける。新セッションでは新パス。plan ツールの利用を「issue につき 1 回の全体計画」に限定して制約に触れない運用へ |
| 19 | adversarial-review-in-isolated-subagent | pattern | claude-code, multi-agent, evaluation | i0077-01, i0135-01 補足 | 読み取り専用サブエージェントに diff・観点表・フェーズだけ渡し「なぜそう実装したか」は渡さない。findings を返すだけで投稿は呼び出し元。回数上限はスクリプトで強制。「無言で消える」欠陥は独立コンテキストでしか拾えなかった実例。既存 context-free-audit-subagent は未検証 note なので、こちらを実装済み pattern として置く |
| 20 | ~~review-points-per-directory-merged-up~~ → rules-as-single-source-for-authoring-and-review | note | claude-code, evaluation, workflow | i0077-02 | REVIEW-POINTS の階層マージは採らない (rules とのすみわけを定義できないことに起因した設計)。rules を関心事ごとの固定フォーマットにして、作成時は読む・レビュー時は関心事別サブエージェントが横断的に読む案を note で置いた |
| 21 | inline-review-comment-provider-constraints | reference | claude-code, tool-use | i0077-03 | GitHub のレビュー投稿はアトミックで 1 件でも不正行があると 422 で全滅、提出済みレビューは削除不可。GitLab は行種別ごとに new_line/old_line の指定が決まる。有効行は hunk ヘッダの範囲で持ち、行を指せない指摘は最小有効行かサマリへ |
| 22 | reversibility-decides-who-acts | pattern | workflow, security | i0041-01, i0086-01 | AI に任せる操作と人間承認が要る操作の線引きは役割分担でなく「取り消せるか」。Draft PR 作成・description 更新は AI、マージと他人の issue への通知 (既読は戻せない) は人間。ハーネスの制限と衝突したらハーネスを優先し、その先の振る舞いを決め打ちにして再現性を保つ |
| 23 | delegate-meaning-to-agent-keep-scripts-decidable | pattern | tool-use, prompting, workflow | i0068-01, i0000-07, i0064-01 | bash で日本語のキーワード抽出は不可 (ロケール依存で静かに再現率が落ちる)。翻訳・キーワード選定・分割判定など意味理解を要するものは AI に委ね、スクリプトには決定的に判定できるもの (DDR 番号重複など) だけを置く |
| 24 | sequential-ids-collide-across-branches | pitfall | workflow | i0133-01, i0046-01 | 連番 ID はブランチ並行で必ず衝突し、ファイル名が違うので git は報告しない (semantic conflict)。過去 4 件のコンフリクト全部がこれ。中央採番される issue 番号を ID にする。ゼロ埋めで辞書順と数値順を揃える |
| 25 | detect-conflicts-with-merge-tree | how-to | workflow | i0046-01, i0067-01 | `git merge-tree --write-tree` で作業ツリーを汚さずに衝突を検知する。結果は終了コードでなく JSON の `hasConflict` で返す (set -e 配下で止まらない)。「衝突しない」と「最新である」は別なので behind 判定は別スクリプトに |
| 26 | committed-vs-ignored-generated-files | pattern | workflow, meta | i0135-01, i0036-01, i0070-01 | 生成物を Git 管理下に置くかは「人間やレビューが直接読むか」で決める。機械可読の中間物 (index.jsonl) は外して SessionStart で再生成、目次は中に残す。Git 管理下の生成物は hook で自動生成しない (勝手な差分が出続ける)。このリポジトリの INDEX.md / index.jsonl の運用根拠になる |

## 優先度 中 (通用するが、既存の rules と重なるか実例が薄い)

| # | 候補 (仮 slug) | type | 元 DDR | 要点 |
|---|---|---|---|---|
| 27 | git-bash-process-spawn-cost | pitfall | i0011-01, i0045-01, i0053-01 | git bash の外部プロセス起動は約 95ms/回。jq はループ内で呼ばず 1 ファイル 1 回、コマンド置換もサブシェル、`$(get_provider)` 内の代入は親に残らずメモ化できない。.claude/rules/scripting.md の実測値の出どころ |
| 28 | pass-large-json-via-file-not-argv | pitfall | i0000-04, i0077-03 | Windows のコマンドライン長上限 (実測約 32KB) で `jq --argjson` が `Argument list too long` (126) になり、set -e で処理全体が無言で止まる。ファイルパスを渡して jq の inputs で読む |
| 29 | git-ls-files-cached-lists-deleted | pitfall | i0000-12, i0117-01 | `find` は .gitignore を見ず巨大ディレクトリでタイムアウトする。`git ls-files --cached --others --exclude-standard` へ。ただし `--cached` は削除済み未ステージも返すので `[[ -f ]]` で除く |
| 30 | bash-glob-treats-brackets-as-class | pitfall | i0009-01 | ファイル名の `[種別]` は未クォートの glob で文字クラスになる。全角 `【】` なら構造的に落とし穴が消える。非 ASCII パスは `core.quotepath=false` を付けないと 8 進エスケープで返る |
| 31 | review-thread-resolve-stays-human | pattern | i0000-01, i0000-02, i0050-01 | AI は返信するがスレッドは resolve しない。完了合図を受けても再取得して未解決を確認する (実地で 3 件未解決だった)。AI 返信は本文先頭の署名で識別。チャットで受けた判断は AI が MR の通常コメントへ記録する |
| 32 | reply-to-own-review-findings-after-human | pattern | i0109-01 | AI が投稿した指摘にも返信を必須にし、返信は人間のレビューを挟んだ後にする。返信を省略してよい類型を作らない |
| 33 | agent-decides-non-interactive-not-env | pattern | i0106-01, i0077-01 | 非対話セッションの判定を環境変数に頼ると誰も設定せず判定が死ぬ。AI が実行環境の性質から判断し、迷ったら「動かない」側へ倒す |
| 34 | source-context-at-comment-sha | pattern | i0043-01 | レビューコメントのソース断面はコメント時点の sha を優先し、取れなければ現 HEAD へ縮退して注記する。縮退より縮退が分からないことが危険。行数だけでは上限にならずバイト上限を併用。shallow clone でも直近 blob は引ける |
| 35 | keep-investigation-and-reflection-slots | pattern | i0092-01 | 全体計画に調査・反映の枠を必ず残し、省略判断は各フェーズ直前で行う。着手直後の見立てで落とすと拾い直す先が無い |
| 36 | separate-plan-from-results | pattern | i0087-01, i0095-01 | 計画は合意のスナップショット、結果は push ごとに変わる。同じファイルに混ぜない。type もライフサイクルで分ける |
| 37 | dry-run-instead-of-confirm-prompt | pattern | i0028-01 | 非対話環境で動くスクリプトは確認プロンプトでなく `--dry-run` を用意し、本実行と同じ形の JSON を返す。残すものは明示リストで持つ。設定値を rm -rf に渡す前に検証する |
| 38 | verify-with-real-data-not-only-fixtures | pattern | i0000-04 教訓, i0053-01 補足 | 合成フィクスチャは分岐の正しさは見るが、サイズや型ゆらぎなど実データでしか出ない性質を拾えない。判定を狭める変更では「狭めた結果こぼれるもの」を先に列挙する |
| 39 | make-hook-script-sourceable-for-tests | how-to | i0057-01, i0039-01 | hook 本体を `main()` へ移し `[ "${BASH_SOURCE[0]}" = "${0}" ]` のときだけ呼ぶ。判定は純粋関数へ切り出し `source` して直接テストする |
| 40 | otel-endpoint-in-settings-local | how-to | i0103-02, i0103-01 | 環境依存の OTel エンドポイントは settings.local.json へ分離し、非依存の値だけ settings.json に置く。git bash 同梱の perl で常駐リスナーを書ける。既存 observability-layer-for-claude-code の実装例 |
| 41 | gemini-session-log-quirks | note | i0097-01〜05 | Gemini CLI v0.39 以降のログは同じ id が再送され、`$set` で全件再送、`$rewindTo` が入る。行カーソルでは二重計上するので id 単位で畳み込む。ブランチ情報が無い。トークン項目が `thoughts` / `tool` で Claude と違う。合成フィクスチャのみで実機未検証 |
| 42 | self-contained-html-over-cdn | pitfall | i0141-01, i0054-01 | Tailwind CDN は存在しないクラスを黙って無視し、リモート実行環境では CDN が遮断されて表示確認できない。エージェントが生成する HTML は自己完結 CSS にする |
| 43 | frontmatter-index-before-grep | pattern | i0038-01 | ドキュメント探索は属性 (type/tags/description) のインデックス検索を先に、外れたら grep。使い分けの判断基準を skill の description に載せて選択対象にする。このリポジトリの道具の説明にならない書き方が必要 |
| 44 | draft-pr-needs-a-commit-on-github | pitfall | i0000-03, i0048-01 | `gh pr create` は base と差分ゼロだと失敗する (GitLab は成功する)。空コミットで 1 回だけリトライ |

## 優先度 低 (プロバイダ・配布固有、または小粒)

| # | 元 DDR | 要点 |
|---|---|---|
| 45 | i0111-01 | GitHub に添付 API が無く未ドキュメント endpoint 依存。必須経路に置かず任意層へ |
| 46 | i0127-01 | GitLab の差分アンカーは Compare ページでは非同期描画で効かず MR diffs ページなら効く。ハッシュが正しいことと URL が飛ぶことは別 |
| 47 | i0044-01, i0045-01 | リポジトリ URL とプロバイダは remote URL から導く (認証不要・fork なし)。`glab auth status` は 14.5 秒かかる |
| 48 | i0033-03 | .gitattributes は配布先で全文置換せず必要行だけ追記。`grep -Fxq` の前に CR を落とす |
| 49 | i0060-01 | git add の pathspec は index も照合する。issue の前提が再現しないときは実測してから直す |
| 50 | i0063-01, i0000-10, i0033-01 | 配布する .claude/ 一式にテストも同梱 (.claude/scripts/test)。版は .claude/VERSION 1 行、CHANGELOG は持たない |
| 51 | i0003-01 | レビューで提示されたスニペットも検証済みの部分だけ採用する (Claude Code のキーが Gemini settings に混入していた) |
| 52 | i0014-01 | GitHub/GitLab 情報は WebFetch でなく gh/glab (認証済み・構造化 JSON) |
| 53 | i0135-01 補足 | awk→bash の区切りにタブを使うと `read` が畳む。frontmatter 読み取りの BOM・末尾空白・行内コメント |
| 54 | i0032-01 | GitLab issue テンプレートは予約名 Default.md で自動適用 |
| 55 | i0020-01, i0110-01, i0112-01, i0088-01 | HANDOFF 進捗表の直接書き換え、種別拡張、フェーズ 5 の並べ替え、追従監視。ワークフロー固有で knowledge には向かない |

## 既に knowledge にあり抽出不要

| 既存 | 対応 DDR |
|---|---|
| grep-tool-skips-gitignored-files | i0135-01 補足 |
| regex-command-match-misfires | i0053-01 (shlex 版。bash 版とフェイルクローズは #10 で補う) |
| deny-by-hook-not-permissions, command-wrappers-instead-of-raw-bash | i0000-09 (permissions.deny は複合コマンドをすり抜ける、ラッパ経由) |
| protected-file-rewritten-via-subprocess | i0000-09 (hook は呼び出し文字列しか見ない) |
| hook-timeout-fails-open | i0053-01 (8192 バイト超で timeout→素通り) |
| injecting-vs-guarding-hooks | i0036-01, i0039-01 の fail-open 設計 |
| gemini-cli-no-post-compress-hook | i0057-01 適用範囲外 |
| decision-log-beside-design-docs | DDR という仕組みそのもの |

## 抽出の進め方 (提案)

1. 高の #1〜#6 (transcript と compact 周り) から。既存の context-management / observability の穴を埋める
2. 次に #10〜#15 (hook の判定と機構化)。security / workflow の既存群と相互リンクできる
3. #24〜#26 はこのリポジトリ自身の運用 (INDEX.md) に関わる
4. 各件 `knowledge-add` skill で作る。sources には元 DDR の GitHub URL (yuki-matsu783/MR-driven-workflow) を書く

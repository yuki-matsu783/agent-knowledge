# 参考ディレクトリ/20_ddr から knowledge へ抽出する候補

154 件の DDR (i0001-01 〜 i0050-07) を全件読んで選別した。2026-09-05 時点。
前回の [ddr-knowledge-candidates.md](ddr-knowledge-candidates.md) (参考ディレクトリ/ddr、77 件) と同じ基準:
「他のリポジトリでも通用するか」「既存 knowledge と重複しないか」「公式文書か実測の裏付けがあるか」。

元 DDR は前回の MR-driven-workflow と agent-workflow を「参考実装」と呼ぶ後継プロジェクト
(issue-MR 駆動の自己改善ワークフロー機構。bash + jq の hook 11 本、提供コマンド、worktree 並列) の決定記録。
前回より hook の実装・実測に踏み込んだ内容が多く、公式 hooks リファレンスの行番号付き引用と実測が付いている。

## 注意

- 元リポジトリの URL は DDR 本文に無い。sources に書く前に確認する (前回と同じ作者なら github.com/yuki-matsu783 配下)
- WF801 / SG-T02 / 0027 といった識別子・チケット番号は本文に持ち込まない。原理と反例だけにする
- 実測が 1 環境 1 回のもの (systemMessage の表示、登録の即時反映) は type を `note` にする
- Claude Code のバージョン依存 (background 既定は v2.1.198 以降) は本文に版を書く
- 前回作った knowledge の「補強・昇格」に使える DDR が多い。新規作成より先に既存の更新を検討する (末尾の表)

## 進捗

- 2026-09-05: 「既存 knowledge の補強・昇格」のうち存在する 8 件 (rules-as-single-source / hook-timeout-fails-open / hook-guards-under-worktree-isolation /
  sequential-ids-collide / reversibility-decides-who-acts / decision-log-beside-design-docs / name-the-alternative / command-position-match) を更新済み。
  前回 #27 / #31 / #33 はファイル未作成なので対象外。note 2 件 (rules-as-single-source、hook-guards-under-worktree-isolation、decision-log) は
  このリポジトリで試していないので type は note のまま。本文に「別プロジェクトの実測」として書いた
- 2026-09-05: 優先度 高 #1〜#26 を knowledge/ に作成済み (slug は表のとおり)。`pnpm check` error 0。
  sources が無い warning 5 件 (#14 / #15 / #17 / #18 / #19) は元リポジトリの URL が確認できたら足す。applies_to は未検証なので書いていない
- 未着手: 優先度 中 #27〜#53、低 #54〜#68

## 優先度 高 (公式文書か実測の裏付けがあり、既存 knowledge に無い)

| # | 候補 (仮 slug) | type | tags | 元 DDR | 要点 |
|---|---|---|---|---|---|
| 1 | hooks-run-in-parallel-not-in-array-order | pitfall | claude-code, security | i0009-21, i0009-24 | 同一イベントに一致する hook は全部並列に走り、settings.json の配列順は実行順ではない (公式)。「先に走る hook が弾くから省ける」最適化は成立しない。複数 deny が同時に出てどの理由が AI に見えるかは不定なので、各 hook の拒否理由は単独で読める文面にする。共有ライブラリが状態ファイルを持つと呼び手間でレースになる (push 検知が時々偽になった) |
| 2 | register-hooks-with-absolute-project-dir-path | pitfall | claude-code, security | i0009-20 | hook は cwd で走り、cwd はルートとは限らない (cd 後・サブディレクトリ起動)。相対パス登録は exit 127 → fail-closed ラッパが拒否側 5 本を同時に deny → 書き込みも実行も止まるロックアウト。案内側は無言で停止。`bash "${CLAUDE_PROJECT_DIR}/.claude/hooks/x.sh"` (shell 形式はダブルクォート必須) |
| 3 | concurrent-hook-writes-append-tmpfile-mkdir-lock | pattern | claude-code, observability | i0009-23, i0009-38, i0009-49, i0009-60, i0009-61 | 並列 hook と並列ツール呼び出しで PostToolUse が同時発火し logs が壊れる。3 段: 追記は 1 行 4 KB (PIPE_BUF) 未満で `>>`、read-modify-write は tmp + mv、加算だけ mkdir ロック (flock は Git Bash に無いことがある)。打ち切りでは trap が効かずロックが残るので作成時刻 60 秒で強制解放しログに残す。「ロックを諦めた」記録にロックが要る循環を避け追記専用ログへ。ヘルパを 1 か所に置き各 hook が自作しない |
| 4 | count-forks-not-seconds-for-hot-path-hooks | pattern | claude-code, cost | i0009-22, i0009-46, i0009-37, i0009-48 | 「1 秒以内」は結果であって守り方でなく検査できない。外部プロセス数を上限にしテストで回数を数える。jq は最大 2 回 (固定パス副入力は 1 回目に相乗り、session_id 依存のパスは stdin を読んでからなので 2 回目)。git / date / sed / find を本体から呼ばない。ライブラリ関数がファイルを開けると上限を関数側から破れる。実測: hook 5 本が 323〜642 ms。前回 #27 の続き |
| 5 | jq-slurpfile-fails-whole-call-on-broken-side-input | pitfall | claude-code, security | i0009-47, i0009-29 | `jq --slurpfile` は副入力が壊れているか無いと呼び出し全体が exit 2・stdout 空になり、stdin の解析結果まで失う。設定 1 ファイルの破損が全拒否 (ロックアウト) に化ける。`[ -f ]` で存在確認 → `--rawfile` + `fromjson? // null`、無ければ `--argjson null`。読めなかった事実は状態変数で呼び手に渡し、扱いは呼び手が決める |
| 6 | bash-pattern-expansion-with-long-literal-is-quadratic | pitfall | workflow | i0009-68 | `${s%%"$m"*}` の `$m` が入力由来の長い文字列だと 4000 文字で 58 秒。位置ベースの走査で 101 ms。`${s:i:1}` の 1 文字ループも O(n^2)。規則ごとに測って犯人を特定する (推測では正規表現側を直すところだった)。負荷中の測定は静かな状態の 3 倍の値が出た |
| 7 | subagent-runs-in-background-by-default | pitfall | claude-code, multi-agent | i0009-50, i0009-51, i0009-71 | v2.1.198 以降 `run_in_background` 省略時は background。PostToolUse Agent は起動直後に発火し `tool_response.status` が `async_launched` (実測)。作業後の検査を置くと作業前を見て「該当なし」を返し、問題なしと誤って伝わる。status で分岐し async では「検査していない」と伝える。起動の事実の通知には逆に有利 |
| 8 | agent-tool-hook-fields-reference | reference | claude-code, multi-agent | i0009-06, i0009-53, i0009-43, i0009-71, i0009-07 | Agent ツール周りの hook 入出力の一覧: SubagentStart に `model` は来ない (公式は SessionStart のみ)。PreToolUse Agent の `tool_input.model` は呼び出し側が明示したときだけ、無いことを「一致」と読まない (実測)。PostToolUse Agent の `tool_response` は camelCase (`agentId` / `status` / `resolvedModel`) でイベント入力の `agent_id` (snake_case) と別名、存在しないキーは jq で null になるだけで常に縮退扱いになる。SubagentStop の出力は親に届かず PostToolUse Agent を使う (公式)。PostToolUse は成功時のみ発火し Bash の `tool_response` に終了コードのフィールドは無い (失敗は PostToolUseFailure の `error` 先頭行 `Exit code N`) |
| 9 | keep-recovery-path-when-guard-config-breaks | pattern | claude-code, security | i0009-29, i0009-28, i0009-47, i0006-09 | 「判定できなければ拒否」は守る対象に関わり得るのに判断できない場合の原則で、設定破損には当てない (既定値で判定を続ける)。復旧経路 (設定自身への ask 付き書き込み・提供コマンド) は全 hook の合意で成立し、並列なので 1 本でも deny すれば潰れる。関わり得る範囲が静的に分かるもの (MCP は draft 解除だけ) は「入力不正」に落とさず明示分岐 + 負のコントロール。read 系と提供コマンドは宣言なしで常に許可 (ヘッドレスは宣言漏れ 1 つで死ぬ)。3 つのロックアウト経路 (#2・#5・設定破損拒否) はどれも「機構が自分を止めて回復手段を奪う」形 |
| 10 | deny-reason-distinguishes-degraded-from-real-denial | pattern | claude-code, prompting | i0009-70 | 縮退 (材料が揃わず拒否側に倒した) で拒否したときは「何が判定を妨げたか (ヒアドキュメント・変数展開・クォート)」を理由に書き、禁止操作をしたと断定しない。ヒアドキュメント本文中の禁止語で登録 3 回目に誤検知し、理由が状況と噛み合わなかった。代償として受け入れる過剰拒否には頻度の見積もり (無ければ実測予定) を添える。踏んでも迂回しない (別構文・語の分割・ENFORCE=0)。踏んだ場で判定を直さず別チケット |
| 11 | glob-double-star-does-not-match-parent | pitfall | claude-code, security | i0009-59, i0009-30 | `dir/**` はパターン位置より下にしか一致せず `rm -rf dir` も祖先 `rm -rf wip` も拾わない。glob 規則を変えると `.claude/**` がルートに一致するなど全判定が壊れるので、その 1 か所で自身と祖先を明示する。rm / mv は宛先だけでなく「元」を判定する。負のコントロール (消してよいディレクトリは通る) をテストに置く |
| 12 | judge-deletes-by-protected-glob-prefix | pattern | claude-code, security | i0010-06 | Edit / Write に削除が無いので削除を全部拒否すると移設が完了しない。削除だけ通す順序付き判定: 対象を読めない → 拒否、展開前の文字 (glob・ブレース・変数・チルダ) → 拒否、保護 glob が「対象/」で始まる (配下に守るものを含み得るディレクトリ) → 拒否、進行状態 → 拒否、一時置き場 → 許可、分類が allow かつ宣言に明示 → 許可、他 → 拒否。配下を列挙せず glob の側から見る。削除は「何を消すか」だけで危険度が測れる |
| 13 | read-only-command-classes-have-option-holes | pitfall | claude-code, security | i0050-04, i0009-56, i0009-41 | 「読み取り専用」に分類したコマンドがオプションで状態を変える: `git -c diff.external=<cmd> diff` は任意実行、`branch -d`、`symbolic-ref <name> <ref>`、`reflog expire`、`diff --output=`、curl の `-T / -d / -F / -X POST`、wget の `--post-file`。グローバル `-c` / `--config-env` は設定名を列挙せず一律 unknown (列挙漏れがそのまま穴)。閉じる向きの規則だけ限定して足す。`cd` は判定の起点をずらすので通さない |
| 14 | count-what-newly-passes-when-widening-a-class | pattern | security, workflow | i0009-41, i0009-56, i0009-58 | 既定拒否だった経路を分類として通すとき「今まで塞がっていたもののうち何が通るようになるか」を数える。curl を web で通したら送信側 (issue 起票 = リモート書き込み) が宣言だけで通る穴が開いた。判定は順序付き (最も強い拒否を先)。記録が残る側 (curl) だけ塞がれ記録が残らない側 (WebFetch) が素通りする倒錯は、正す方向が 1 つしかない |
| 15 | shared-library-classifies-caller-matches-rules | pattern | workflow, tool-use | i0009-17, i0009-03, i0009-24, i0009-48, i0009-39 | 共有ライブラリは入力の機械的分類まで。「規約に照らして正しいか」「宣言されているか」「どの識別子で拒否するか」「`-o` の次が出力先か」は呼び手。二重定義は片方だけ更新される、変わる理由が違う、ライブラリは呼び手の識別子を知らない。状態ファイルをライブラリが持つと呼び手間でレース |
| 16 | bash-return-code-conventions-for-sourced-libs | pattern | workflow | i0009-14, i0009-16, i0009-33, i0009-34, i0009-35 | source するライブラリの規約: 読み込み失敗のポリシー (nop / fatal / deny) は呼び手が決めライブラリは一律にしない。読めないときはスタブが戻り値 2 (0 = 読めた / 1 = キー無し / 2 = ライブラリ不在) で「機構の破損」と「記載不正」を分ける。判定結果は変数、戻り値は読み込みの成否だけ、述語は真偽。`local v=$(f)` は戻り値を潰す、`\|\| true` でなく `\|\| rc=$?`、`$(...)` 内の非 0 は set -e の対象外。「潰さない」は方針でなく書き方の問題 |
| 17 | test-byte-equality-of-copied-boilerplate | pattern | workflow, evaluation | i0009-36 | 「この行を逐語コピーせよ」規約は一致検査が無いと必ずドリフトする (20 本以上、1 回目は変数追加で発生)。grep で集めて雛形とバイト一致を検査し、違うファイルを列挙する。一斉置換は見積もりの作業項目に立てないと後回しになる。source で切り出せない (ルート解決の行そのもの) ものに有効 |
| 18 | push-cross-cutting-decisions-down-to-individual-specs | pattern | workflow, meta | i0009-58, i0009-62, i0009-61 | 横断仕様で決めた規則は、個別の仕様・要件・再掲している表・根拠にした既存決定の 4 種類を列挙して降ろす。2 巡のレビューで閉じ切れなかった 7 件が全部この型。再掲する表には「正は §X」。仕様に書かれない規則は実装されない (ロックの語が該当仕様に 0 件)。番号は名前ではない: 繰り下げたら同じ変更で参照を grep して直す、末尾に足せるなら末尾に |
| 19 | write-fallback-condition-before-measuring | pattern | evaluation, workflow | i0009-54, i0009-71, i0009-43 | 結論を支える前提は検証予定表に載っていなければ検証されない。実測の前に「外れたときの縮退」を書いておくと結果から結論まで機械的に決まる (後から決めると別の材料で守る議論になる)。公式文書で閉じられる TBD は閉じるが、受け入れ条件が実物の確認を求めるものは文書で免除しない。引用は節の文脈ごと正しく (「その他の終了コード」の節の一文で終了 0 を説明していた) |
| 20 | env-gated-probe-with-negative-control | how-to | claude-code, observability, evaluation | i0009-66 | 本番の記録の形 (固定キー) を変えずに hook 入力を実測する: 別ファイルのプローブを環境変数で有効化 (AI は自分で立てられない)、業務条件によらず必ず 1 件出す負のコントロール (観測の欠如を結論に使える)、入力読み込み直後・早期 return より前に置く、撤去は grep 0 件で確認。撤去時に既存の assertion がプローブに寄生していたのが見つかった |
| 21 | record-skips-so-absence-means-degraded | pattern | observability, claude-code | i0009-52, i0009-31 | 「記録が無いときに再掲」は再掲する元が無く成立しない。判定しなかった分岐も理由付きで skip を記録すると、記録の欠如 = 縮退 と読める (通知不要と判定済み / 判定していない を区別)。skip の理由は「model 省略がどれだけ起きるか」の計測にもなる |
| 22 | undeterminable-means-redo-not-assume-done | pattern | workflow, tool-use | i0010-09 | 判定できないとき「進んだことにする」でなく「もう一度やる」側 (冪等な段階は再実行して困らない)。draft 判定は 3 値、未知の状態は再導出、時刻を読めないレビュー指摘は落とさない (損害が非対称)。「止める」が常に安全ではない: 記録を直接編集できない設計では終了 2 が詰みになる。jq の `.x // empty` は false も右辺に倒す |
| 23 | enforce-guarantee-by-reading-committed-version | pattern | workflow, security | i0006-10 | 「スキップ記録は必ず MR の差分になる」保証が「未コミット検査で止まる」に依存していて、未コミットの記録でその検査自身を飛ばせた。保証はコマンド自身が `git show HEAD:<file>` でコミット済み版だけを読んで担保する。飛ばせる検査や別コマンドに依存する保証を書かない |
| 24 | agent-written-declarations-cannot-widen-permissions | pattern | claude-code, security | i0001-02, i0001-18, i0006-05 | AI が書くチケットに「やってよいこと」を宣言させ、上限は人が管理する type 定義。判定順で deny を宣言より前に置き宣言で覆せない。作業中の宣言書き換えは拒否。未記載は拒否でなく警告付き ask (ヘッドレスは deny)。実施側が自分で宣言を足していた実例。リモート書き込みも「特定チケット以外は禁止」でなく同じ宣言体系 |
| 25 | hooks-read-local-state-only | pattern | claude-code, workflow | i0001-14, i0001-25 | hook の判定材料は全実行環境で確実にアクセスできるもの (リポジトリ内ファイル・ローカル git・hook 入力) に限り gh / glab / API を呼ばない。hook は自動で走り失敗時に AI が復旧できない。リモート操作の結果は AI が明示実行するコマンドがローカルに記録し hook はそれを読む。基準は「リモートか」でなく「全環境で使えるか」。base 追従は開始・再開時と最終ゲートの 2 点で常時監視を持たない |
| 26 | mcp-tool-names-are-server-defined | pitfall | claude-code, mcp, security | i0009-27, i0009-28, i0009-12 | MCP ツール名はサーバが定義するので `mcp__github__*` のパターンで種別を分類すると当たらない名前に「守っている」誤安心が生まれる。宣言の有無 (セッション状態) は種別に依らず強制できる。matcher に `mcp__.*` を足しつつ受け止める分岐が無いと全 MCP が「入力不正」で過剰拒否 (フォールバック経路が潰れる)。WebFetch / WebSearch は判定モデルが違うので強制せず記録に留める |

## 優先度 中 (通用するが、既存の rules と重なるか実例が薄い)

| # | 候補 (仮 slug) | type | 元 DDR | 要点 |
|---|---|---|---|---|
| 27 | systemmessage-not-shown-in-interactive-ui | note | i0009-71, i0009-66, i0009-26 | hook JSON の `systemMessage` は公式「shown to the user」だが VSCode 拡張の対話 UI では表示されず、`-p --output-format stream-json` には level notice で載る (人間観測 + 負のコントロール付き)。`additionalContext` は届く。PreToolUse の additionalContext はツール結果の隣に届くので「起動前にメインへ伝える」手段は無い。1 環境 1 回なので note |
| 28 | hook-registration-applies-mid-session | note | i0009-69 | settings.json の hook 登録はセッション途中でも即反映 (2 回実測)。環境変数はセッション開始時のみ。手順書では「登録は即時・環境変数は次のセッションから」を対にして書く |
| 29 | verify-worktree-before-trusting-cwd-root | pitfall | i0009-64, i0050-07, i0009-55 | cwd から上向きに `.claude` を探すだけだと参考実装のディレクトリへ cd するだけで別の `.claude` が採られ作業中 0 枚 → 全素通り (実測)。候補が本流の worktree か gitdir の相互参照を双方向で確かめる (片方向だと stale 登録の指し先に置くだけで信用される)。確かめられなければ本流に倒す (厳しい側)。既存 hook-guards-under-worktree-isolation の「未検証」を実測で埋める材料 |
| 30 | shared-vs-per-worktree-state-split | pattern | i0050-02, i0009-55 | 進行状態・ロック・集計・セッション記憶は共有ルート (本流) に、判定記録と実行ログは作業ツリー側に残し cwd と agent_id を記録に足す。丸ごと作業ツリー側に置くと宣言・承認が読めず再拒否、ロックと集計が分裂。共有ルートを環境変数で差し替え可能にすると保護対象を外から外せる |
| 31 | merge-worktrees-at-boundaries-abort-on-conflict | pattern | i0050-03, i0050-05, i0050-06 | 作業ツリーの合流はタスクの切れ目 (作業中 0 枚) に固定し提供コマンド経由。解けない衝突は中断して合流前に戻し人へ返す (内容の判断を機械にさせない)。採番は本流だけ (種類が違えば同番号が衝突せず合流する実測)。既定は worktree を切らない (単独では利得 0、戻すのは非対称)。既存 sequential-ids-collide と parallel-agents-isolated-by-worktree の補強 |
| 32 | subagents-write-lessons-back-to-ticket | pattern | i0001-11, i0001-08, i0001-17 | サブエージェントの試行錯誤はコンテキストの外に消え、差分から「うまくいかなかったこと」は読めない。作業ログの固定見出し (必須 2 つだけ、他は空欄可、定型文で埋めない) に反映すべき内容を残させ、振り返りはメインエージェントが人と行う。時刻は自己申告でなくスクリプトが記録 |
| 33 | derive-position-from-state-not-handoff-file | pattern | i0001-04, i0001-03 | 手書き引き継ぎファイルを持たず、現在地はチケット配置・状態ファイル・ブランチから SessionStart hook が導出して注入。手書きは実態とずれても検知できない。前提は状態遷移が全部スクリプト経由で AI の自己申告で進まないこと。既存 reinject-work-context-after-compact (HANDOFF 前提) の対案 |
| 34 | evals-defined-not-run-by-default | pattern | i0001-20 | 機械実行できるテスト (hook・スクリプト) は都度実行、LLM 挙動に依存する skill / rule / agent は eval 定義の作成・更新まで。実行は人が明示依頼したときだけ (費用の開始判断を AI に持たせない)。レポートに「定義の一覧 + 未実行」を明記 |
| 35 | state-unmeasured-benefit-in-decision | note | i0050-01 | 採用の根拠が依頼と原則の読み直しで利得 (短縮幅) は測れていない、と決定に明記する。推定値で埋めると実測を装った推測になる。「コスト側だけ数値がある非対称」を残すと後から何を確かめ直すか分かる |
| 36 | stage-recorded-idempotent-finalize | pattern | i0004-03 | 片付け → push → 最終ゲート → draft 解除を 1 コマンドに統合し段階を状態ファイルに記録。失敗時は同じコマンドの再実行で済んだ段階を飛ばす (前進のみ、巻き戻さない)。「チケット無し状態で許す操作」が「再実行」1 点に縮み例外規定が消える |
| 37 | write-none-instead-of-empty-section | pattern | i0006-03, i0006-11 | 必須節の一覧はテンプレートの属性だけが持ち仕様書に書かない (3 者同期を避ける)。必須節は空にせず「無し」と 1 行 (存在検査は空を防げない実例)。プレースホルダは要素内容に置きコメントに隠さない。固有節は必須節の後に追加可 |
| 38 | one-error-id-one-cause-append-never-renumber | pattern | i0006-12, i0010-05, i0010-07, i0009-15 | 識別子は「見たら何をすればよいか」を引く鍵。1 番号 1 原因。引数・環境の誤り (終了 2) は必ず専用番号を持ち末尾に足す、既存を振り直さない (テスト期待値・分岐・案内に散る)。ライブラリ既定の番号も台帳に載せ「出たら代入忘れ」のシグナルに |
| 39 | never-record-dot-as-approved-scope | pitfall | i0006-07 | 承認単位を親ディレクトリにするとルート直下ファイルの親 `.` を承認した瞬間に全パスが許可。ルート直下はファイル単位、`.` は記録にあっても無視 (読み手側で守る)。一致は完全一致か `scope/` 配下 (前方一致だと `logs` で `logs2` が通る) |
| 40 | redact-by-key-name-not-only-entropy | pattern | i0006-08 | 40 文字以上の base64 様の語を一律マスクするとパス (`/` を含む) やブランチ名が消えて記録が読めない。`/`・ハイフン 2 個以上の小文字語・小文字と `_` の語を除外し、`/` を含む秘密はキー名 (`token=` / `*_key=`) で拾う。置換結果 `***` に再一致しない形に |
| 41 | classify-flows-by-origin-not-outcome | pattern | i0017-02 | 要件書のメイン / 代替 / 例外の振り分けを起点で判定 (全実行が通る → メイン、起点が正常 → 代替、異常 → 例外、成果物の規定 → 規約節)。終わり方は検算 (代替は必ず目的達成)。一意に決まらないものは書き手が決めず返す。repo-docs.md の EARS 運用に関わる |
| 42 | cap-flowchart-nodes-and-split-at-handoffs | pattern | i0017-01, i0017-03 | mermaid 図は EARS の前に置き 15 ノード上限、超えたら承認・引き渡し・状態確定の点で分割、ID は文書全体で通し番号。図にだけある情報を作らない。1 行に辺を連ねない (差分が汚れる)。規約節は接頭辞付きで 3 節まで、自由記述は 600 字以内 (45 件の実測から) |
| 43 | trace-issue-criteria-into-requirements | pattern | i0020-02 | 仕様 ↔ 要件の対応表だけでは issue → 要件の欠落 (26 件が 19 件に) を検出できず行数一致で通った。要件書の概要章に issue 受け入れ条件との対応表を置きセルフレビューで行数一致を見る。章順の規定を触らずに済む置き場の選び方 |
| 44 | separate-not-now-from-never-in-requirements | pattern | i0009-44, i0009-19 | スコープ由来の「今回はやらない」を要件に恒久禁止として書かない (別 issue で扱う道が要件違反になる)。自制に依存する統制は要件に明記。同じ事実は矛盾する場所すべてで揃える (例外フローに書いても非機能要件だけ読む人に届かない) |
| 45 | empty-vs-empty-tests-pass-vacuously | pitfall | i0009-04, i0009-09 | 依存先が未実装だと「両方無出力」で無意味に通るテストができる。スタブで代えると観点が「スタブと一致するか」に変わる。受け入れ条件の「テストが通る」を「この issue で実装する分」と解釈し理由付きで送る |
| 46 | identify-steps-by-type-not-position | pattern | i0001-06, i0001-12 | フェーズ進行を位置番号で管理すると挿入で全参照が繰り下がり決定記録に「当時の番号」が積む。type 識別子から次の skill を機械的に決める。計画と実施を対にする。「両方」の種別を置かず issue を分割 |
| 47 | dangling-delegation-in-rules | pitfall | i0009-65 | rules が「正はあちらが持つ、ここには再掲しない」と委譲した先が存在しない状態は規定が無いより悪い (委譲した側だけ整って見える)。5 巡残った。ルール本体だけ先に作ると要件との 1:1 が崩れる |
| 48 | resolve-repo-root-without-fork | how-to | i0006-06, i0009-22 | BASH_SOURCE 上向き探索 → CLAUDE_PROJECT_DIR → git rev-parse の順。git rev-parse 単独は fork (約 95 ms) と、リポジトリ外で空になり `source "/.claude/…"` で set -e 即死。相対段数固定は置き場で深さが違う |
| 49 | hook-logs-go-to-file-not-stdout | pitfall | i0004-01 | hook の stdout は応答チャネル、stderr も Claude Code に読まれる場面がある。ログはファイルのみ、logger 関数は常に成功 (ログのせいで本体を止めない) |
| 50 | headless-proceeds-on-defaults-except-irreversible | pattern | i0010-03, i0050-06, i0009-13 | ヘッドレスで合意が取れないとき「報告して終える」は必ず止まる地点を残す。既定の提案どおり決めて記録し進む。取り消せない外部副作用 (別 issue 起票) だけ既定で進めない。ask は deny に置換、`permissionDecision: defer` は `-p` でしか効かず対話では警告のみ。既存 reversibility-decides-who-acts の補強 |
| 51 | when-spec-and-impl-diverge-pick-truth-explicitly | pattern | i0009-63, i0050-07, i0006-09, i0009-40 | 仕様と実装が食い違ったら計画段階でどちらを正にするか決める。安全側で動いている実装は正にし正史を書き戻す。値集合が実体より狭い仕様は誤読の原因。マージ済み決定記録の本文は変えず置き換え記録で上書き。根拠が偽なら決定を保って根拠を訂正 |
| 52 | keep-spec-current-only | pattern | i0001-01, i0001-29 | 要件・仕様には現在有効な内容だけ。変更履歴・レビュー記録・影響範囲の changelog を持たない (4600 行に肥大)。経緯は issue 番号ベース ID の決定記録へ。仕様書は種別ごとの固定フォーマットで要件との対応表 (全件列挙) 必須。既存 decision-log-beside-design-docs の実運用例 |
| 53 | skill-name-no-underscore | pitfall | i0001-10 | Agent Skills 仕様で `name` は小文字英字・数字・ハイフンのみ、親ディレクトリ名と一致。`00_workflow_` は不可、`00-workflow-` は可 (数字始まりは許される)。公式仕様で確認できるので作るなら小さく |

## 優先度 低 (プロバイダ・配布固有、または小粒)

| # | 元 DDR | 要点 |
|---|---|---|
| 54 | i0009-72 | bash 変数に構造を持たせる区切りバイトを深さ別 (0x1D / 0x1E / 0x1F) に割り当て、表を 1 か所に置く。同じバイトを 2 段で使うと入れ子が復元できない |
| 55 | i0009-45, i0009-08 | テスト ID の枝番 (T09b) は無関係の派生に見える。語彙表を持つ判定は全要素を踏破する。ランナーの ID 抽出正規表現が接頭辞の制約になる |
| 56 | i0006-04 | 素の bash テスト + 共通 assert + ID 付き出力、bats 不採用 (依存を増やさない) |
| 57 | i0009-25, i0001-24 | 登録表は command 文字列を期待値に持ち、変換規則で照合しない (例外を規則に埋めない)。hook はイベント別番号ディレクトリ、複数イベントのものは主たるイベント下 |
| 58 | i0004-02 | 片付けで消える成果物は添付後に毎回 push して履歴に載せ、片付け直前 SHA 固定のリンクを報告に添える |
| 59 | i0010-02 | GitHub 添付 API は image/png 以外 422 (html / md / txt / zip / pdf 全部)、ブラウザ経路は CSRF で再現不可の実測表。前回 #45 の補強 |
| 60 | i0009-32 | 実行者不一致の通知はタスク実施者の subagent_type に限定。レビュアーや探索を別モデルで起動すると誤警告になり通知の信用を落とす |
| 61 | i0001-27 | closed issue の再オープンは同じ不具合の再発に限り承認付き。仕様変更は常に新規 |
| 62 | i0001-05 | HTML ビューは生成スクリプトでなくテンプレートのコピー + Edit。前回 #42 と重なる |
| 63 | i0009-10 | hook が読む外部データは 1 ディレクトリに集約し保護パターン 1 行で覆う。hook 配下に assets/ を作らない |
| 64 | i0006-01, i0006-02 | frontmatter 読み取りを純 bash 1 か所に (参考実装は入れ子を黙って捨てていた)。移動とコミットは一体で、拒否なら移動もしない |
| 65 | i0001-07, i0001-16 | 人間レビュー要否と実行モデルをチケットに宣言し、既定は rules に置き全体計画は差分を提案する |
| 66 | i0009-02, i0009-18 | 異常 (作業中 2 枚) の検知は hook 1 か所、コマンドは不変条件 (1 枚) 前提で動く。同じ判定を 4 か所に置かない |
| 67 | i0004-05, i0004-07 | 提供コマンド内部の git は拒否対象外。コミットを生成するサブコマンド (revert / cherry-pick / am / rebase / commit-tree) も commit と同列に拒否、merge は例外、stash は対象外 |
| 68 | i0001-13, i0001-28 | 一時ファイルは wip/tmp、機構の記録はルート直下 logs/ (gitignore)。このリポジトリの directory-layout.md が既に同じ運用なので knowledge にしない |

## 既存 knowledge の補強・昇格に使える DDR

| 既存 | 元 DDR | 何を足せるか |
|---|---|---|
| rules-as-single-source-for-authoring-and-review (note) | i0001-19, i0009-65 | 後継プロジェクトが同じ結論に至った実例。成果物ルール / 行動ルールの 2 分類、7 章固定 (適用範囲 / 構造・配置 / 書式・可読性 / セキュリティ / 堅牢性 / パフォーマンス / テスト・機械的検査)、定めが無い章は「該当なし」+ 根拠 1 行、罠は該当章に出所付き、収集は paths グロブ。note の「確かめていないこと」1 つ目 (フォーマット) に答えが出た |
| hook-timeout-fails-open | i0009-11, i0009-42 | 登録ラッパの `\|\|` も trap ERR も打ち切りには効かない。timeout を短く明示するのは fail-open を早めるだけで逆効果。permissions の deny / ask は hook の結果に関係なく評価されるので外側の多重防御にはなるが複合コマンドは止められない。PostToolBatch の exit 2 は事後 |
| hook-guards-under-worktree-isolation | i0009-55, i0009-64, i0050-02, i0050-07 | description の「未検証」を実測で埋める: CLAUDE_PROJECT_DIR は本流のまま・cwd が追随 (公式 + 実測)、worktree で機構が丸ごと無効化する経路 |
| sequential-ids-collide-across-branches | i0050-05 | 種類が違えば同番号が衝突せず合流する実測。採番を本流 1 か所に限る解 |
| reversibility-decides-who-acts | i0010-03 | ヘッドレスでは既定で進み、取り消せない外部副作用だけ止まる |
| decision-log-beside-design-docs (note) | i0001-01, i0009-58, i0050-07 | 正史と経緯の分離を実運用した例、DDR 本文不変 + 置き換え、影響の列挙規約 |
| name-the-alternative-in-failure-message | i0009-70 | 縮退の拒否と本来の拒否で文面を分ける |
| command-position-match-fails-closed | i0009-01, i0009-70 | クォートで割れたサブコマンド (`git 'commit'`) は unknown → 拒否側。ヒアドキュメント本文を実行位置として数えない |
| 前回 #27 git-bash-process-spawn-cost | i0009-22, i0009-68 | fork 上限を回数で検査する形、パターン照合の O(n^2) |
| 前回 #31 review-thread-resolve-stays-human | i0001-15, i0001-26 | unresolved の確認、チャット承認の MR コメントへの書き写し |
| 前回 #33 agent-decides-non-interactive-not-env | i0009-13 | `defer` は -p 専用 |

## 既に knowledge にあり抽出不要

| 既存 | 対応 DDR |
|---|---|
| adversarial-review-in-isolated-subagent | 各所の「敵対的レビュー」「境界レビュー」の言及 |
| detect-conflicts-with-merge-tree | i0001-25 の最終ゲート |
| generate-gemini-assets-from-claude-assets, ntfs-junction-is-not-a-git-symlink | i0009-25 / i0010-01 の「symlink は Windows で不安定」 |
| subagent-model-selection-by-orchestrator | i0001-07 の実行者指定 |
| close-gaps-with-mechanism-not-wording | i0001-03, i0001-17 の「スクリプトで検査」 |

## 抽出の進め方 (提案)

1. 先に「既存の補強・昇格」の表を処理する。特に rules-as-single-source (i0001-19) と hook-guards-under-worktree-isolation は note / 未検証から昇格できる
2. 高の #1〜#9 (hook の並列・登録・並行書き込み・fork 上限・Agent ツールの入出力) は公式引用と実測が揃っており、まとめて作ると相互リンクが張れる
3. 高の #10〜#17 (拒否の設計、glob、分類の穴、ライブラリの責務、bash 規約) は security / workflow の既存群と繋がる
4. 高の #18〜#26 (設計文書の運用、検証の作法) は meta / evaluation の既存群と繋がる
5. 各件 `knowledge-add` skill で作る。sources には元リポジトリの URL (要確認) と、公式 hooks リファレンス https://code.claude.com/docs/en/hooks を書く

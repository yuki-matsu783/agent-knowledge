---
type: how-to
nature: best-practice
title: エージェントの gh / glab / git 認証は範囲限定トークン 1 本に寄せるべき
description: >-
  How to give a coding agent just enough Git-forge credentials: issue a token scoped to one repository
  or group (GitLab project/group access token, GitHub fine-grained PAT) instead of an account-wide
  classic PAT, expose it once through the `env` block of `.claude/settings.local.json` so `glab` and
  `gh` pick it up, and route plain `git push` through the same token by registering
  `glab auth git-credential` / `gh auth setup-git` as the credential helper. Use when Claude Code runs
  `gh` / `glab` / `git push` on your behalf and you want the blast radius of a mistaken or injected
  instruction bounded by the token itself. Not for CI pipelines, which already have `CI_JOB_TOKEN`, and
  not a secrets-manager design; the token sits in plaintext on disk.
tags: [security, workflow, claude-code]
keywords: [glab, gh, GITLAB_TOKEN, GH_TOKEN, settings.local.json, env, credential helper, git-credential, project access token, group access token, fine-grained PAT, スコープ, 範囲限定, bot ユーザー, 資格情報, keyring, 平文, gitignore]
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [claude-code@2.1, glab@1.114, gh@2.97, git@2.39]
sources:
  - https://code.claude.com/docs/en/settings
  - https://docs.gitlab.com/cli/authentication/
  - https://docs.gitlab.com/user/project/settings/project_access_tokens/
  - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
  - https://git-scm.com/docs/gitcredentials
intervention: tool
---

# エージェントの gh / glab / git 認証は範囲限定トークン 1 本に寄せるべき

## 前提

- Claude Code が `gh` / `glab` / `git push` を自分で実行する。人が毎回打つのではない
- エージェントは指示の取り違えとプロンプトインジェクションで、意図していないリポジトリを触りうる。
  **トークンに与えた範囲がそのまま被害の上限**になるので、範囲の決定が唯一の効く防御になる
- 個人アカウント全体に効くトークン (GitLab の personal access token、GitHub の classic PAT) は使わない
- ここで扱うのは開発者の手元。CI は `CI_JOB_TOKEN` が別にあるので対象外

## 手順

1. **範囲を限定したトークンを発行する。** 作業対象のリポジトリ (かグループ) だけに効くものを選ぶ。

   | 相手 | 発行するもの | 範囲 |
   |---|---|---|
   | GitLab | project access token | 1 プロジェクト |
   | GitLab | group access token | 1 グループ配下のプロジェクト |
   | GitHub | fine-grained PAT | Only select repositories で選んだリポジトリ |

   role と scope も最小にする。GitLab なら `api` (MR やイシューの操作に要る) と `write_repository` (push に要る) を
   必要な分だけ。`read_repository` だけでは push できない。

2. **環境変数の名前を決める。** CLI が読む名前は決まっている。

   | CLI | 変数 | 備考 |
   |---|---|---|
   | glab | `GITLAB_TOKEN` | `GITLAB_ACCESS_TOKEN` `OAUTH_TOKEN` も同じ扱い。**keyring に保存済みの資格情報より優先** |
   | glab | `GITLAB_HOST` | self-managed のとき |
   | gh | `GH_TOKEN` | `GITHUB_TOKEN` より優先。保存済みの資格情報より優先 |
   | gh | `GH_HOST` | GitHub Enterprise Server のとき |

3. **`.claude/settings.local.json` の `env` に書く。** 共有される `.claude/settings.json` には書かない。

   ```json
   {
     "env": {
       "GITLAB_TOKEN": "glpat-xxxxxxxxxxxxxxxxxxxx",
       "GH_TOKEN": "github_pat_xxxxxxxxxxxxxxxxxxxx"
     }
   }
   ```

   `env` は設定の他のキーと同じ優先順位に従い、Project local (`settings.local.json`) は
   Shared project (`settings.json`) を上書きする。プロジェクトごとに別のトークンを当てられる。

4. **git も同じトークンを使わせる。** CLI を credential helper に登録すると、git は helper に
   ユーザー名とパスワードを問い合わせ、helper が環境変数のトークンを返す。

   ```sh
   git config --global credential.https://gitlab.com.helper '!glab auth git-credential'
   gh auth setup-git
   ```

   リポジトリ単位に閉じたいなら `--global` を外してそのリポジトリの `.git/config` に書く。
   これで **トークンの実体が `env` の 1 箇所だけ**になる。git 用に別の資格情報を保存しないので、
   トークンを差し替えると `gh` / `glab` / `git push` が同時に切り替わり、失効させれば同時に止まる。

## 確認方法

1. セッションを開き直してから `glab auth status` / `gh auth status` を実行し、トークンの出どころが
   環境変数だと表示されることを見る
2. helper を単体で叩き、環境変数のトークンがそのまま出ることを見る。git を巻き込まずに切り分けられる

   ```sh
   printf 'protocol=https\nhost=gitlab.com\n\n' | glab auth git-credential get
   # capability[]=authtype / username=glab / password=<GITLAB_TOKEN の値>
   ```

   `gh auth git-credential get` は `username=x-access-token` と `password=<GH_TOKEN の値>` を返す。
3. **範囲外のリポジトリで失敗することを確かめる。** 成功側だけ見ても、範囲が効いているのか
   単に広いトークンが通っているのか区別できない。負のコントロールがここでの本題になる

## つまずきどころ

- **`settings.local.json` は平文**。Claude Code が自分で作ったファイルは git から外れるが、
  手で作った場合は自分で `.gitignore` に足す。ホームディレクトリのバックアップや同期の対象にも入る点は残る
- **`env` はセッション開始時に読まれる**。動いているセッションで Bash から `export` しても外側には届かない。
  書き換えたら起動し直す
- **環境変数は `glab auth login` で keyring に保存した資格情報を上書きする**。「ログインし直したのに古い権限のまま」は
  たいていこれ。切り分けは手順 2 の helper 単体実行が速い
- **Windows では helper をリポジトリに足しただけでは GUI のダイアログが先に開く** (2026-09-05、Git for Windows と glab 1.114 で確認)。
  システム設定 (`C:/Program Files/Git/etc/gitconfig`) に `credential.helper=manager` があり、helper は設定の階層をまたいで**累積**するので、
  `.git/config` に glab を足しても順番は manager の後になる。manager の Git Credential Manager がダイアログを出し、エージェントの Bash は
  それに答えられないまま `git push` が止まる (`fatal: helper error (-1): User cancelled dialog` か、`GIT_TERMINAL_PROMPT=0` でも待ち続ける)。
  空の helper を 1 つ挟むと連鎖がそこでリセットされるので、リポジトリ設定を「空 → glab」の順にする

  ```sh
  git config --replace-all credential.helper ""
  git config --add credential.helper '!glab auth git-credential'
  git config --get-all credential.helper   # manager / (空行) / !glab auth git-credential の順に出れば可
  ```

  worktree に入ったセッションでは `glab auth git-credential` を含むコマンドが Bash ツールに拒否されるので、この設定と手順 2 の単体確認は
  worktree の外で行う ([worktree に入ったセッションでは複合 git コマンドが拒否された](../agents/worktree-session-refuses-compound-git-commands.md))
- **project / group access token は bot ユーザーとして動く**。コミットの author、MR の承認、メンションの扱いが
  人のアカウントと違う。承認まわりの運用に当てる前に確かめる
- hook から呼ぶスクリプトはこの認証に頼らせない。
  [hook から呼ぶスクリプトは gh / glab に依存させず git だけで完結させる](../hooks/scripts/keep-provider-cli-out-of-hook-scripts.md)
- 範囲外を踏んだときのメッセージは、そのままだと何をすればよいか分からない。
  [失敗メッセージに代替手段を名指しで埋め込む](../mcp/name-the-alternative-in-failure-message.md)

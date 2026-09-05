---
type: pitfall
nature: finding
title: glab mr create の --create-source-branch はブランチ名を title から作り日本語が落ちた
description: >-
  Records what `glab mr create --related-issue <iid> --create-source-branch --title "Draft: Resolve
  worktree 手順の検証"` produced against a self-managed GitLab CE 18.5 in docker: the source branch
  was named from the title with non-ASCII characters dropped (`Draft-Resolve-worktree-`), not the
  `<iid>-<slug>` form the web UI's "Create merge request and branch" button uses. Use when scripting the issue-to-branch step with glab and the
  branch name must be predictable, or when a worktree or checkout step downstream needs to know the
  branch name. Not for gh, and not measured on gitlab.com or other glab versions.
tags: [workflow, claude-code]
keywords:
  - glab
  - mr create
  - --related-issue
  - --create-source-branch
  - --source-branch
  - --title
  - ブランチ名
  - slug
  - 日本語
  - 非 ASCII
  - Create merge request and branch
  - Closes
  - GitLab CE
  - 自己管理
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [glab@1.114, gitlab@18.5]
sources:
  - https://gitlab.com/gitlab-org/cli/-/blob/main/docs/source/mr/create.md
  - https://docs.gitlab.com/user/project/merge_requests/creating_merge_requests/
---

# glab mr create の --create-source-branch はブランチ名を title から作り日本語が落ちた

## 症状

docker の GitLab CE 18.5 (自己管理) に対して glab 1.114 で、issue #1 (title「worktree 手順の検証用 issue」) から MR とブランチを作った。

```sh
glab mr create -R root/issue114-pages --related-issue 1 --create-source-branch \
  --target-branch main --title "Draft: Resolve worktree 手順の検証" -y
```

結果は次のとおり。

| 項目 | 期待 (Web UI の「Create merge request and branch」相当) | 実際 |
|---|---|---|
| ブランチ名 | `1-worktree` のような `<iid>-<slug>` | `Draft-Resolve-worktree-` (title の ASCII 部分を `-` でつなぎ、日本語は落ちて末尾に `-` が残る) |
| MR の description | `Closes #1` | `Closes #1` (空行 2 つの後) |
| draft | true | true |

`--title` を省くと「--Title or --fill required for non-interactive mode」で止まる (`-y` を付けても)。

## 原因

glab の `--create-source-branch` は、`--source-branch` が無いとき MR の title からブランチ名を生成する。
issue の iid は使わず、非 ASCII 文字は捨てられる。Web UI のボタンは GitLab 側 (Rails) がブランチ名を `<iid>-<issue title の slug>` で決めるので、
同じ「issue から MR とブランチ」でも命名規則が違う。

## 回避策

- `--source-branch <iid>-<slug>` を明示して UI と同じ名前にする。後続の `git worktree add` や checkout が名前を予測できる
- `--related-issue` のとき glab は MR を draft にして title に `Draft: ` を前置するので、`--title` には書かない (書くと二重になる。上の例はそれをやってしまっている)
- 実際にできたブランチ名は決めつけず `git fetch origin && git branch -r` で読む。
  [GitLab のマージリクエストのブランチで worktree に入る手順](../agents/worktree-on-gitlab-merge-request-branch.md) の 1 手目がこれ

## 再現条件

- glab 1.114、GitLab CE 18.5.4 (docker、`external_url http://localhost:8929`)、Windows の Git Bash
- `-y` (非対話)。対話モードでは確かめていない
- gitlab.com と他の glab の版では未確認

## 関連

- [エージェントの gh / glab / git 認証は範囲限定トークン 1 本に寄せるべき](scoped-token-for-agent-git-cli-auth.md)

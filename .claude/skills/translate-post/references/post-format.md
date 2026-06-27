# 本仓库 Post 格式约定（翻译类）

本仓库为 Hexo 博客。Post 文件位于 `source/_posts/`。以下约定从现有 post 提炼，翻译类 post 须遵守。

## 文件

- 路径：`source/_posts/<slug>.md`
- 命名：仅 `<slug>.md`（日期写在 frontmatter，不放文件名）
- slug 用英文短横线，如 `loop-engineering.md`

## Frontmatter

```yaml
---
title: 中文标题（英文原标题可括注）
author: 原作者名（Tong 译）
date: YYYY-MM-DD HH:MM
tags:
  - 标签1
  - 标签2
categories:
  - 技术积累
---
```

- `author`：翻译类写「原作者（Tong 译）」。
- `date`：用翻译/发布当天的日期时间。

## 正文结构

```
# 中文标题

> **译者按：** ……（说明翻译背景、术语处理原则、链接保留情况）

> **关于作者：** 原作者简介（原文给定）+ Twitter 链接。

---

[译文正文……]

---

> 本文采用了AI生成的文本，并全部经过人工审核编辑。
```

## 头尾固定块

- **头部**两段引用：先「译者按」，再「关于作者」（含作者简介与 `[@handle](twitter链接)`）。
- **结尾**固定标识，逐字使用：

  > 本文采用了AI生成的文本，并全部经过人工审核编辑。

## 链接

- 原文超链接在译文**相同位置**保留，`[锚文本](URL)` 指向相同 URL。
- 图片保留 `src` 与 `alt`，位置不变。

## 提交约定

- commit message：`Add post: <slug>`
- commit message 结尾加：`Co-Authored-By: Claude <noreply@anthropic.com>`
- 临时术语文件 `terms.txt`（仓库根目录）**不提交**，收尾删除。

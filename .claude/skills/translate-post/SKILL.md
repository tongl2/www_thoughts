---
name: translate-post
description: 用于将外文技术博客翻译为本仓库（Hexo）的中文 post。当用户说"翻译这篇文章""把这篇博文翻译成中文 post""译一篇 post"时触发。完整覆盖术语对照、抓取原文与链接资源、按项目格式翻译、人工确认后再提交的流程。
---

# 翻译外文博文为 Hexo Post

将一篇外文技术博客翻译为本仓库的中文 post。两条核心纪律：**先定术语再翻正文**；**翻译产出后等用户确认 OK 才提交**。

## 何时触发

用户提供一个外文博客 URL，要求翻译成中文 post 并发布到本仓库。

## 工作流程（严格按阶段顺序）

### 阶段一：术语准备（先不翻正文）

1. **通读原文**，提取所有新概念、专业名词、工具名、命令名、人名。
2. **建立术语对照表**：在仓库根目录建临时文件 `terms.txt`，每条三要素：
   - 名词（英文原词）
   - 原文上下文（定位用的短引句）
   - 建议译法（含备注；有争议的标 ⚠️）
3. **等用户在 `terms.txt` 中定稿译法**。定稿前不碰正文。
   - 定稿标志：用户说"术语定好了""可以开始翻译"等明确确认。

### 阶段二：翻译前准备

4. **确认项目格式约定**：读 `source/_posts/` 下现有 post（如最近一篇），核对 frontmatter 字段、文件命名、头部引用、结尾 AI 标识措辞。详见 [references/post-format.md](./references/post-format.md)。
5. **抓取原文完整正文**用于翻译。
6. **抓取 HTML 源码，提取全部需保留的链接资源**：超链接 `<a href>`、图片 `<img src>`、其他媒体（video/source/iframe）。记录每条的锚文本/位置与目标 URL。
   - ⚠️ 不要依赖会"加工"网页的抓取工具（如 web reader，常丢 URL），也不要用搜索引擎猜 slug。
   - 用脚本一键提取：
     ```bash
     node .claude/skills/translate-post/scripts/extract-links.mjs <文章URL>
     # 或先保存 HTML 再解析：node .../extract-links.mjs <url> --html saved.html
     ```
   - 脚本输出"锚文本 → URL"对照表，翻译时按原位置放回。

### 阶段三：翻译

7. **按定稿术语 + 项目格式写全文**。保留原文标题层级、清单、表格、分隔线。
8. **链接资源按原位置保留**，指向相同 URL；图片同样保留 `src` 与 `alt`。
9. **套用翻译类 post 固定头尾**：译者按（引用块）+ 作者简介（含 Twitter），`author` 写「原作者（刘通 译）」，结尾加 AI 标识。详见 [references/post-format.md](./references/post-format.md)。
10. **停下，等用户人工检查并确认 OK**。用户没明确放行前，不进入提交。

### 阶段四：收尾

11. **吸收改稿经验（commit 前）**：用户确认 OK 后、提交前，读取用户修改定稿的文章，与第一版初稿逐处对比，把新体现的翻译/编辑偏好补充进 [`references/translation-style.md`](./references/translation-style.md)。这一步把每次人工改稿沉淀为可复用的风格规则，持续减少后续返工。
12. **commit + push**（仅限用户确认后）：
    - 只提交 `source/_posts/<slug>.md`；临时 `terms.txt` 不入库。
    - commit message：`Add post: <slug>`，结尾加 `Co-Authored-By: Claude <noreply@anthropic.com>`。
    - 本仓库为个人博客，按既有惯例直接提交到 `main`。
13. **删除临时文件** `terms.txt`。

## 关键纪律

- **术语先行**：阶段一未定稿，不翻正文。
- **提交需放行**：阶段三产出后，必须等用户确认 OK 才 commit。
- **链接用源码提取**：用 `extract-links.mjs` 抓 HTML 源码，不靠加工工具或搜索猜。
- **临时文件不入库**：`terms.txt` 不提交，收尾删除。

## 相关资源

### 脚本
- [`scripts/extract-links.mjs`](./scripts/extract-links.mjs) — 抓取页面 HTML，列出全部超链接/图片/媒体资源及目标 URL。

### 参考文件
- [`references/post-format.md`](./references/post-format.md) — 本仓库 post 的格式约定（frontmatter、头尾引用、AI 标识、署名）。
- [`references/translation-style.md`](./references/translation-style.md) — 译者定稿的翻译与编辑偏好（意译、译者增值、术语偏好等），从人工改稿中提炼。

---
name: paper-to-blog
description: This skill should be used when the user asks to "read this paper", "write a blog post about this paper", "turn this paper into a blog", "interpret this paper", or provides a paper link (arXiv or otherwise) and wants it turned into a Chinese blog article.
version: 0.1.0
---

# 论文转博客助手

## 用途

将学术论文转化为中文技术博客文章，保存到 source/_posts/ 目录。

## 使用时机

当用户提供论文链接，并要求写成博客文章时使用。

## 工作流程

### 1. 确认执行范围

给用户简短确认，说明：
- 将阅读论文并生成中文博客文章
- 文章保存到 source/_posts/ 目录
- 配图保存到同名文件夹

用户确认后继续。如果用户已经明确要求，可跳过此步骤。

### 2. 初始化论文工作区

运行 bootstrap 脚本获取论文信息并下载资源：

```bash
python .claude/skills/paper-to-blog/scripts/bootstrap_arxiv_blog.py "<arxiv_url>"
```

解析脚本输出的 JSON 结果，获得以下信息：
- `paper_dir`: 论文工作目录（PDF、源文件、元数据）
- `slug`: 博客文件名前缀
- `blog_path`: 博客文件应该保存的路径
- `image_dir`: 图片应该存放的路径
- `pdf_path`: 下载的 PDF 路径
- `source_path`: TeX Source 路径（如果有）
- `title`: 论文标题
- `abstract`: 论文摘要
- `authors`: 作者列表
- `abs_url`: arXiv 论文链接
- `categories`: 论文分类

### 3. 创建博客文件和目录

根据脚本返回的路径信息：
1. 创建博客文件：`touch {blog_path}`
2. 创建图片目录：`mkdir -p {image_dir}`
3. 使用 `references/blog-structure.md` 中的模板填充博客文件
4. 用脚本返回的元数据替换模板中的占位符（标题、摘要、论文链接等）

### 4. 阅读论文

按以下顺序获取信息：
1. 读取 `metadata.json` 获取论文元数据
2. 查看 arXiv 摘要页面了解概览
3. 阅读 TeX Source（如果下载成功，优先用它确认公式、模块名、算法步骤）
4. 阅读 PDF 文件详细理解内容

### 5. 理解论文核心

完成以下检查清单：
- [ ] 识别论文要解决的问题与研究动机
- [ ] 理解核心方法与关键模块
- [ ] 梳理训练或推理流程
- [ ] 掌握实验设置与主要结果
- [ ] 总结论文创新点
- [ ] 分析局限性与适用边界
- [ ] 思考对实际应用的启发
- [ ] 记录关键术语解释

对不确定的内容明确标注"论文未明确说明"。

### 6. 编写博客文章

按照 `references/blog-structure.md` 中的详细指南填充博客内容：
- 替换模板中的占位符为实际内容
- 添加必要的 mermaid 图表（1-3 张关键图）
- 确保格式符合规范

### 7. 处理配图

图片保存到已经创建的 image_dir 目录：
- 图片命名：img1.jpg, img2.jpg 等
- 在文章中使用相对路径引用：`![](./img1.jpg)`
- 可添加图片说明

### 8. 交付

告知用户博客文件路径，使用标准交付格式。

## 博客结构概览

博客文章包含以下部分：

1. **Frontmatter** - YAML 元数据（标题、作者、日期、标签、分类固定为"论文走读"）
2. **概述** - 背景、问题、核心贡献
3. **背景知识（可选）** - 前置知识、现有方法局限
4. **核心方法** - 主要思路、模块拆解、mermaid 图表
5. **实验与结果** - 实验设置、主要结果、消融实验
6. **讨论** - 亮点、局限、启发
7. **参考资料** - 论文链接、相关资源
8. **标准结尾** - AI 生成声明

详细结构和示例见 `references/blog-structure.md`。

## 写作风格

- 使用中文表达，自然、准确、深入浅出
- 公式使用 LaTeX 语法
- 代码块添加语法高亮
- 对不确定的内容明确标注"论文未明确说明"

## 非 arXiv 论文处理

对于非 arXiv 的论文链接：
- 手动下载论文 PDF
- 按照 slug 规则手动创建博客文件和图片目录
- 参考 `references/blog-structure.md` 中的模板创建博客骨架
- 后续流程与 arXiv 论文相同

## 参考资源

### 参考文件

查看 `references/blog-structure.md` 获取：
- 论文理解检查清单
- 完整的博客结构模板
- 详细的写作指南
- 博客风格参考

### 示例文件

查看 `examples/` 目录中的示例博客文章：
- `examples/sample-blog.md` - 完整示例

### 脚本文件

使用 `scripts/bootstrap_arxiv_blog.py` 自动初始化 arXiv 论文工作区：
- 自动下载 PDF 和 TeX Source
- 自动生成博客骨架
- 自动创建图片目录
- 自动生成元数据

## 经验总结与常见问题

### 可复用执行经验
- 所有核心论点必须标注对应原论文章节，采用【§X.X】简洁格式，方便读者溯源
- 参考资料仅需放延伸资源，不需要重复添加已在头部给出的论文原文链接
- 优先读取TeX Source获取精准内容，比PDF解析更可靠，尤其是公式和代码部分
- 博客结构严格遵循模板，保持统一的阅读体验
- 专业术语首次出现可以适当补充解释，兼顾不同技术背景的读者

### 常见注意事项
- 如果没有获取到论文配图，直接跳过即可，不需要强行添加无关图片或专门说明
- 章节标注要准确，跨多个章节的内容标注为【§X-Y】，整篇内容标注为【§X】
- 参考资料每个链接都要有简短说明，让读者知道链接的用途
- 实验数据要和原论文完全一致，不确定的内容明确标注"论文未明确说明"
- 如果需要解压下载的文件，注意下载文件名往往和论文标题一致、带有空格，相关命令要正确使用引号

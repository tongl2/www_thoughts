---
title: 循环工程（Loop Engineering）
author: Addy Osmani (刘通 译)
date: 2026-06-26 15:30
updated: 2026-06-26 17:54
tags:
  - AI
  - Agent
  - Claude Code
  - 循环工程
  - 软件工程
  - 翻译
categories:
  - 技术积累
---

# 循环工程（Loop Engineering）

> **译者按：** 这是 Addy Osmani 关于“编程 Agent 工作流如何演进”的一篇文章。作者提出了一种新兴的工程范式——循环工程（Loop Engeering）。与其亲手去给 Agent 写 Prompt，不如设计一个会自动构建 prompt 的系统——他称之为“循环（loop）”。文章把循环工程拆解成五个基本组件外加一个记忆系统，并把它们逐一拆解、对比 OpenAI Codex 与 Claude Code 两个产品的对应实现。
> 我们不难发现，Codex和Claude Code两个主流Agent工具都不约而同地实现了这些Loop，它也预示着程序员的工作正在从繁琐的使用AI工具，迁移至编排AI助手、构建工作流。
>
> 原文链接：[https://addyosmani.com/blog/loop-engineering](https://addyosmani.com/blog/loop-engineering/)

> **关于作者：** Addy Osmani 是一位工程与布道领域的领导者，在 Google 工作超过 14 年，先后负责 Chrome 的开发者体验，以及近年来的 AI（Gemini、编程 Agent、agentic 工程）方向，最近担任 Google Cloud AI 总监。Twitter：[@addyosmani](http://twitter.com/addyosmani)。

---

循环工程（Loop Engineering）下，人们不再主动给Agent写提示词，而是是设计一个系统来执行这一环节。这里的“循环（loop）”可以理解为一个递归的过程：你定义一个目标，然后 AI 不断迭代，直到完成。我相信这或许就是我们未来与编程 Agent 协作的方式。不过，目前它还处于早期阶段，我对此也持保留态度。同时，当前我们也[*必须*考虑](https://x.com/weswinder/status/2063700289710964906) token 成本的问题——你 token 额度的多少会带来使用模式的天差地别。我想拆开来讲讲，这究竟是什么，以及它意味着什么。

---

Peter Steinberger （译者注：OpenClaw的创办人）最近[说](https://x.com/steipete/status/2063697162748260627)：“你不要再亲手去给 Agent 写 prompt 了。你应该去设计那些替你给 Agent 写 prompt 的循环。”同样，Anthropic Claude Code 的负责人 Boris Cherny 也[说](https://x.com/rohanpaul_ai/status/2063289804708835412)：“我已经不再亲手给 Claude 写 prompt 了。我有一堆循环，它们替我写 prompt 、去想接下来该做什么。我的工作是写循环。”

那么，这一切到底意味着什么呢？

过去差不多两年里，人们获取编程 Agent 输出的结果，方式就是写一个好的 prompt、提供足够的上下文。你打一句话，读它返回的东西，再打下一句。Agent 是一个工具，而自始至终是你一直握着它，一轮接一轮。这种模式差不多要过时了，或者至少有些人认为它即将过时了。

现在，你搭建一个小系统，它去发现工作、分发工作、检查工作、记录完成了什么，然后决定下一步——你让这个系统去驱动那些 Agent，而不是你亲自操作。我之前写过它的“近亲”：[Harness 工程（agent harness engineering）](https://addyosmani.com/blog/agent-harness-engineering/)，讲的是打造单个 Agent 运行的环境；以及[工厂模型（the factory model）](https://addyosmani.com/blog/factory-model/)，讲的是用于构建软件的系统。而“循环工程”位于“Harness工程”之上一层。它靠定时器运行，会生成一些小型辅助程序，还能自行供给自身所需。

让我意外的是，这个其实已经不再是“工具”层面的事了。一年前，如果你想创建一个循环，就得写一大堆 bash 脚本，然后永远维护着那堆脚本，这些脚本只属于你个人。而现在，这些组件直接就集成在产品里了。Steinberger 列出的清单，几乎能一一对应到 Codex 应用上，然后又几乎一样地对应到 Claude Code 上。一旦你注意到这些组件的结构是相同的，你就无需再纠结用哪个工具了——你只负责设计一个循环，它在哪个工具里都能照常运转。

## 五个组件，外加一个笔记

一个[循环](https://x.com/reach_vb/status/2063713960495558940)需要五样东西，外加一个用来记事的地方。我先列出来，再逐一进行说明。

1. **自动化任务（Automations）**，按计划自行触发执行，能够自动完成发现任务和分类处理工作。
2. **工作树（Worktrees）**，让两个并行工作的 Agent 不会互相干扰。
3. **Skill**，把项目知识记录下来，免得 Agent 只能瞎猜。
4. **插件（Plugin）与连接器（connectors）**，把你正在使用的工具接入 Agent。
5. **Sub-agent**，一个负责提出想法，另一个负责验证其可行性，分工合作。

然后是第六样东西：记忆，可以是一个 markdown 文件，或是一块 Linear 看板。任何能够保存单次对话之外的信息，并记录“做完了什么”和“接下来做什么”的东西都可以算作记忆。虽然听起来用处不大，但这正是所有长驻 Agent 依赖的机制。我在[长驻 Agent（long-running agents）](https://addyosmani.com/blog/long-running-agents/)里详细讲过：模型在两次运行之间会忘掉一切，所以记忆必须落在磁盘上，而不是留在上下文里。Agent 会遗忘，但本地仓库不会。

如今这两个产品都已经凑齐了全部这些组件。

| 组件 | 在循环中的职责 | Codex 应用 | Claude Code |
| --- | --- | --- | --- |
| **自动化任务（Automations）** | 按计划做任务发现与分级 | [Automations](https://developers.openai.com/codex/app/automations)：选项目、prompt、执行周期、环境配置；结果进入分类邮箱；`/goal` 用于“跑到完成为止” | 定时任务与cron调度、`/loop`、`/goal`、钩子（Hooks）、GitHub Actions |
| **工作树（Worktrees）** | 隔离并行的工作 | 每个线程内建工作树 | `git worktree`、`--worktree`、给 subagent 设置的 `isolation: worktree` |
| **Skill** | 将项目知识固化 | [Agent Skills](https://developers.openai.com/codex/skills)（`SKILL.md`），用 `$name` 显式调用或隐式触发 | [Agent Skills](https://addyosmani.com/blog/agent-skills/)（`SKILL.md`） |
| **插件（Plugin） / 连接器（Connector）** | 接入工具 | MCP连接器、以插件的形式分发 | MCP server、插件 |
| **Sub-agent** | 构思和验证 | 在 `.codex/agents/` 里以 TOML 定义的 [subagent](https://developers.openai.com/codex/subagents) | 在 `.claude/agents/` 里的 task subagent、Agent 团队 |
| **状态（State）** | 跟踪完成情况 | 使用 Markdown 或 Linear MCP | Markdown（`AGENTS.md`、进度文件）或通过 MCP 使用 Linear |

这些名字在两个产品里略有不同，但能力是一样的。接下来我挨个讲一讲，因为说实话，一个循环究竟能否立得住、会不会悄悄漏得到处都是，差别全在这些细节里。

## 自动化任务，这是心跳

自动化任务使得循环操作真正成为了可重复执行的任务，而不只是你随手跑一次的东西。在 Codex 应用里，你在 Automations 标签页里创建一个，选好项目、它要跑的 prompt、多久跑一次，以及它是在你本地的 checkout 上跑、还是在后台工作树上跑。如果一次任务有所发现，它就会进入任务分类邮箱；而没有新发现的任务则会被直接归档，这非常方便。OpenAI 内部就拿自动化功能来处理一些繁琐的工作，比如日常的 issue 分类、汇总 CI 失败、写 commit 摘要、追查某人上周引入的 bug。自动化任务可以调用 Skill，这样让这个重复性的任务保持可维护性。你只需用 `$skill-name` 来触发任务即可。不会有人愿意更新自动化任务调度器里的一大坨海量指令。

Claude Code 也实现了同样的功能，不过是通过调度和钩子（Hooks）实现的。你可以用 `/loop` 按固定间隔跑一个 prompt 或命令，你可以排一个 cron 定时任务，你可以用钩子（Hooks）在 Agent 生命周期的某些节点上触发 shell 命令。此外，如果你希望即使在关闭笔记本电脑后，该任务仍能持续运行，可以将整个系统部署到 GitHub Actions 中。这本质上都是一样的思路：定义一个自主任务，给它设定一个周期，然后让系统自动把任务处理好、送达给你，这样你就不用巡视检查了。

还有一个机制值得一讲，它和这篇文章的主题密切相关。`/loop` 是按固定周期重复跑；`/goal` 则是一直跑到你写的某个条件成立为止，每轮结束都有一个独立的小模型来检查结果。给代码打分的Agent和写代码的Agent不是同一个。你给它类似“test/auth里所有测试用例通过、lint没有问题”这样的停机条件，然后就可以托管了。Codex也有同样的东西，也叫 `/goal`，它会跨轮次一直工作，直到一个可验证的停止条件成立，还支持暂停、恢复和清空。同样的机制，从两个工具都能窥见——这就是本文核心的模式。

综上，这是把整个工作“托举”起来的那部分。而循环其余的部分，则是关于如何执行的。

## 工作树，别让“并行”变成“混乱”

你只要同时跑超过一个 Agent，文件就开始冲突了，最终导致失败。两个 Agent 同时修改一个文件，就像两个工程师没有预先沟通就往同一行代码提交一样，是非常头疼的场景。使用 git worktree 就能解决它：它提供独立工作目录，拥有自己的独立分支，还能共享同一份仓库历史。这样一个 Agent 的修改就永远不会影响另一个 Agent checkout的版本。

Codex 把工作树支持直接内置了，多个线程同时操作同一仓库，不会互相干扰。Claude Code 则通过 `git worktree` 实现：`--worktree` 启动参数可以在一个独立的 checkout 里打开会话，subagent 的 `isolation: worktree` 配置可以让每个subagent拥有一个相互隔离的独立工作树，用后即清理。我在[编排开销（the orchestration tax）](https://addyosmani.com/blog/orchestration-tax/)里写过这其中“以人为本”的那一面：工作树只是消除了机械性的冲突，但能真正并行跑多少个任务，取决于你的 review 带宽，而不是工具。“人”才是并行度的上限。

## Skill，让避免每次都重新解释项目

Skill可以让你不必像个金鱼一样、每次会话都把同一个项目的上下文重新解释一遍。两个工具使用了同一种格式：一个文件夹，里面放着一个 `SKILL.md` 承载指令和元数据，外加可选的脚本、参考和素材。Codex 在你用 `$` 或 `/skills` 调用时、或者当你的任务恰好匹配到某个 Skill 的描述时，会自动运行对应Skill。这也是为什么一个枯燥而详细的描述会胜过一个“聪明”的描述。Claude Code 的做法如出一辙，我在 [Skill（agent skills）](https://addyosmani.com/blog/agent-skills/)里写过这个模式。

Skill 也是让你不用反复付出“意图债务”代价的地方。我在[意图债务（the intent debt）](https://addyosmani.com/blog/intent-debt/)里论述过：一个 Agent 每次会话都是冷启动的，它会用一个自信的猜测去填补你意图里的每一个空白。而 Skill 可以把这种意图写在外面，体现那些惯例、构建步骤、那种“我们之所以不这么干，是因为那次事故”。一次写好，Agent 每次运行都能读到。没有 Skill，循环每个周期都会从零开始重新推导你的整个项目；有了 Skill，它就可以积累起来。

有一件事要理清楚：Skill 是写作格式，而插件（plugin）是分发它的方式。当你想跨仓库共享一个 Skill、或者把几个Skills打包到一起时，你就把它们封装成一个插件。Codex 和 Claude Code 里都是如此。

## 插件（plugin）和连接器（connector），把循环和工具连接起来

只能访问文件系统的循环，能力是非常有限的。基于 MCP 构建的连接器可以让 Agent 读你的 issue 跟踪系统、查询数据库、调用临时 API、在 Slack 发送消息。Codex 和 Claude Code 都支持 MCP，所以你为其中一个软件写的MCP通常可以迁移至另一个。而插件则把连接器和 Skill 打包在一起，这样你的同事一键就能装好你那套配置，无需从头重建。

这就是一个只会说“这是修复方案”的 Agent，与一个能自己开 PR、关联 Linear 工单、并在 CI 变绿后去群里 ping 人的循环工程之间的差别。这些连接器，正是循环工程能够在你真实的环境里上手、而不仅仅是告诉你“如果可以的话我会怎么做”的原因。

## Sub-agent，把“执行者”和“验证者”隔开

循环工程里，到目前为止最有用的结构性设计，就是把“写代码的那个”和“检查的那个”分开。如果让写代码的那个模型自批自改，有点过于宽容。这时，另一个用不同的指令、有时甚至是不同的模型的 Agent，往往能抓到第一个 Agent 自己把自己说服了的那些问题。

Codex 只在你要求时才生成 subagent。它会同时运行这些子代理，然后将结果合并成一个答案。你把自定义的 Agent 定义成 `.codex/agents/` 里的 TOML 文件，每个都有一个名字、一段描述、若干指令，以及可选的模型和推理强度（reasoning effort）。你的“安全审查者”可以是一个高推理强度、功能强大的大模型，而你的“探索者”可以是个快速的、只进行只读操作的模型。Claude Code 在 `.claude/agents/` 实现了同样的功能，还可以通过Agent Teams实现各 Agent 之间协作。两个软件共同的常见分工方式是：一个 Agent 去探索、一个去实现、一个对照说明文档做验证。

我已经讲过两次这个观点了：一次是在 [Code Agent 编排（the code agent orchestra）](https://addyosmani.com/blog/code-agent-orchestra/)，一次是在[对抗式代码 Review（adversarial code review）](https://addyosmani.com/blog/adversarial-code-review/)。它之所以在循环工程里特别重要，是因为循环是在你不在场盯着时跑的。因此，只有真正值得信赖的验证者，才可以确保流程顺利自主运行。由于每个Sub-agent会各自调用模型、使用工具，所以这样会烧掉更多token。因此，只有在需要一个客观的“局外人”意见时，才适合使用这种方法。这基本上就是 Claude Code 的 `/goal` 在底层做的事：由一个全新的模型来判定循环是否完成，不能由干活的那一个来判。这种机制把执行者/验证者分离（maker/checker split）应用到了停机条件上，提升了系统的可靠性。

## 一个循环长什么样

把上面的组件拼到一起，一条线就演变成了一个小小的控制面板。下面是我日常在用的一种形态。

每天早晨，一个自动化任务会在代码仓库上跑一次。它的 prompt 会调用一个任务分类 Skill，读取昨天的 CI 失败项、未关闭的 issue、最近的 commit，然后把发现的事项写进一个 markdown 文件或一个 Linear 看板。对于每一个需要处理的事项，主线程会打开一个隔离的工作树，派一个 sub-agent 去起草修复方案，再派第二个 sub-agent 用项目Skill 和现有测试用例来审核修改内容。

我的MCP连接器可以让我的循环去创建 PR、更新工单。任何循环自行处理不了的东西，都会落到分类邮箱里留给我。状态文件是整套系统的核心，它记录了哪些任务尝试过、哪些解决了、哪些还没有闭环。第二天早上的那次循环执行会从今天停下的地方接着往下走。

现在来看看你实际上做的工作：你只进行了一次设计，那些步骤你一个都没亲手去 prompt。这正验证了 Steinberger 的那个观点：在 Codex 和 Claude Code 里，循环工程是共通的，因为这些基本组件都是一样的。

## 循环仍然不会替你做的事

循环工程改变的是工作形态，而不会把你从工作中抹掉。实际上，随着循环越来越好，有三个问题其实是变得更尖锐了，而不是更轻松。

验证的工作仍然需要由你来完成。一个无人值守运行的循环会不断产生错误。把执行者和验证者分离到不同的subagent的原因是让“任务已完成”这一事件变得更可靠，但这依旧只是一个AI的声明，而无法被AI自证。我一直在强调 [AI 时代的代码 Review（code review in the age of AI）](https://addyosmani.com/blog/code-review-ai/)里的一句话：你的工作是交付你已经确认可以正常运行的代码。

如果你放任这种情况发生，你认知中的内容就会不断腐烂。循环工程替你写代码的速度越快，“实际存在的代码”和“你真正理解的代码”之间的鸿沟就越大，这就是[认知债务（comprehension debt）](https://addyosmani.com/blog/comprehension-debt/)。越流畅的循环只会让这笔债务长得越快，你必须读一下循环工程的产出，来消除这笔债务。

这种舒服的状态往往是机器危险的。循环执行起来后，你很容易放弃自己的观点，全盘接受它吐回来的东西。我把这称作[认知屈服（cognitive surrender）](https://addyosmani.com/blog/cognitive-surrender/)。如果你带着判断力去设计循环，它是良药；如果你设计了循环而逃避了思考，它就是毒药。同样的行为，却能产生相反的后果。

## 搭建循环，但请保持工程师本色

我认为这就是我们工作将来的演进方向。话虽如此，如果我不亲自去 review 代码，或完全依赖自动化循环去修代码，我的产品质量一定会受影响。最终，我可能就会陷入一个恶性循环中，不断给自己挖坑。

即便如此，我还是建议你去搭建你自己的循环。但别忘了，直接给agent下发提示词也是很高效的做法，关键在于你怎么找到适合你的平衡。

循环带来的收益也可能因你而异。两个人可以搭出一模一样的循环，但最终收益却截然不同。一个人对工作内容深刻理解，用循环来加速；另一个人则完全不尝试理解工作的内容。循环工程本身无法分辨这其中的差别，只有人可以控制这些收益。

这也是循环工程比 prompt 工程更困难，而不是更容易的原因。Cherny 的观点也不是说工作变轻松了，而是关键点不一样了。

所以，去构建循环工程吧。但是，要带着一个务实的工程师的态度去搭建，不要只想当那个按下“go”的人。

---

> 本文采用了AI生成的文本，并全部经过人工审核编辑。

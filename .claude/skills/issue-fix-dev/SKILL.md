---
name: issue-fix-dev
description: 用于处理本项目的issue修复和功能开发流程
---

# Issue Fix Development Skill

这个skill用于处理本项目的issue修复和功能开发。

## 触发条件

当用户明确要求你：
- 修复某个issue
- 基于某个issue进行开发
- 完成某个issue号对应的任务

## 工作流程

### 1. 确认issue信息
- 确保用户提供本项目的issue链接或issue编号
- 如果没有提供，向用户索取

### 2. 读取issue内容
- 使用GitHub MCP工具读取issue的详细信息（如`mcp__plugin_github_github__issue_read`）
- 从标题、描述和讨论区中确认开发内容
- 对于开发范围、实现效果不明确的部分，**必须**向用户提问

### 3. 整理开发范围
- 将所有明确的内容整理成清晰的开发范围描述
- 向用户进行最终确认

### 4. 制定开发计划
- 切回main分支，并拉取最新代码
- 基于确认的开发范围，制定详细的开发计划
- 计划包含：
  - 功能描述
  - 预期效果
  - 大致的修改点
- 将计划以markdown格式评论到issue的评论区中
- 计划结尾添加：
  > 本开发计划由Claude Code生成。生成时间{timestamp}。使用模型{model_name}。

### 5. 确认开发计划
- 询问用户计划是否OK
- 如果不OK，根据反馈修改计划并刷新issue评论
- 重复此过程直到用户满意

### 6. 创建开发分支
- 从main分支拉出新的开发分支，并切换到开发分支
- 分支命名建议：`fix/issue-{number}` 或 `feature/issue-{number}`

### 7. 创建开发checklist
- 基于开发计划创建详细的checklist
- 使用TaskCreate工具管理任务

### 8. 依次开发调试
- 按照checklist顺序执行
- 每个任务开发完成后执行`npm test`
- **每次commit前必须保证npm test通过**
- 建议新增对应的测试用例（不强求）
- 期间不切换分支

### 9. 最终测试
- 所有内容开发完成后，再次执行`npm test`
- 确保所有用例通过
- 如果用例失败，定位问题并修复

### 10. 提交PR
- 将开发分支代码推送到远端对应分支
- 创建PR，审查人设为 tongl2
- PR内容包含：
  - 关联对应的issue
  - 修改点说明
  - 影响性分析
  - npm test测试报告

## 重要注意事项

- 每次commit前必须通过测试
- 遇到不明确的需求必须向用户确认，不要自行推断
- **永远不能**使用force push/commit amend等高危命令

## 相关知识

详见 [references/](./references/) 目录下的知识文件：
- [Hexo构建机制](./references/hexo-knowledge.md)

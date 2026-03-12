---
title: Brief about FSDP(WIP)
date:
updated:
tags: torch,fsdp,training,ai,llm,transformers
categories:
---
# FSDP简介

## Recap：线性层训练过程、GPU（NPU）内存与DP并行

### 一次最简单的训练

让我们从一个最简单的单卡训练场景开始：我们会看到，在单卡上训练一个不带偏置项的线性层 $Y = XW^\top$ ，需要**3处关键的MatMul**。假设输入维度为 $D_{in}$ ，输出维度为 $D_{out}$ ，batch size为 $B$ ，序列长度为 $L$ 。输入数据 $X$ 的shape为 $(B, L, D_{in})$ ，权重矩阵 $W$ 的shape为 $(D_{out}, D_{in})$ 。

**前向传播（第一处Matmul）：**

$$
Y = XW^\top \quad \text{其中} \quad Y \in \mathbb{R}^{B \times L \times D_{out}}
$$

计算完成后， $X$ 被暂存用于反向传播。

模型前向传播完成后，对计算结果应用Loss函数，求得 $\mathcal{L}$ 。设上游梯度为 $dY = \frac{\partial \mathcal{L}}{\partial Y}$ ，shape与 $Y$ 相同，为 $(B, L, D_{out})$ 。反向传播时，根据链式法则：

**权重梯度（用于更新优化器状态，第二处Matmul）：**

$$
\frac{\partial \mathcal{L}}{\partial W} = dY^\top \cdot X \quad \Rightarrow \quad dW \in \mathbb{R}^{D_{out} \times D_{in}}
$$

**输入梯度（用于反向传播到前层，第三处Matmul）：**

$$
\frac{\partial \mathcal{L}}{\partial X} = dY \cdot W \quad \Rightarrow \quad dX \in \mathbb{R}^{B \times L \times D_{in}}
$$

完成反向传播后，我们得到梯度 $dW$ 。Adam优化器为每个可训练参数维护两个状态：一阶矩（动量） $m$ 和二阶矩（二阶动量/方差） $v$ 。优化器状态的shape与参数（ $W$ ）相同，为 $(D_{out}, D_{in})$ 。优化器状态最终会被用于更新参数权重：

$$
W \Leftarrow W - lr \cdot \frac{m}{\sqrt{v}} \quad \text{其中}lr\text{是超参数，代表learning rate}
$$

### GPU（NPU）内存占用

当前主流大模型的线性层使用BF16训练，即三次MatMul的操作数都是BF16。这样产生的激活值和权重的dtype都是BF16，然而，为了保证数值稳定性，优化器状态 $m$ 和 $v$ 仍需高精度（FP32）存储。每层Linear都需要在卡上存储的Tensor（不包含计算时临时生成、用完即释放的Tensor）及其属性如下：

| Tensor               | Shape               | Dtype | 内存占用（B）                               |
|----------------------|---------------------|-------|--------------------------------------------|
| 输入激活 $X$          | $(B, L, D_{in})$    | BF16  | $2 \times B \times L \times D_{in}$        |
| 权重 $W$              | $(D_{out}, D_{in})$ | BF16  | $2 \times D_{out} \times D_{in}$           |
| 权重梯度 $dW$         | $(D_{out}, D_{in})$ | BF16  | $2 \times D_{out} \times D_{in}$           |
| 优化器状态 $m_W, v_W$ | $(D_{out}, D_{in})$ | FP32  | $2 \times 4 \times D_{out} \times D_{in }$ |

**总内存占用估算**： $\text{Memory(B)} \approx 2BLD_{in} + 12D_{in}D_{out}$

可见，权重梯度和优化器状态占据了大量内存空间，导致单卡训练时模型的参数规模受限。对于数十层的模型，单卡显存很快成为瓶颈。

### DP并行训练

为了突破单卡内存限制、增加参数规模和训练吞吐，我们需要分布式训练。**数据并行（Data Parallel, DP）**是一种常见的提升吞吐的并行策略。

数据并行（DP）的核心思想是将输入批次 $X$ 沿batch维度切分到 $N$ 张卡上，每张卡保存完整的模型参数副本。在DP下：
- 每张卡接收 $B/N$ 的局部数据： $X_{local} \in \mathbb{R}^{(B/N) \times L \times D_{in}}$ 。
- 每张卡持有完整的 $W$ 。
- 每张卡独立计算前向和反向，得到局部梯度 $dW_{local}$ ；反向传播后，各卡梯度做All-Reduce通信，得到完整梯度 $dW_{global} = \sum_{i=1}^N dW_{local}^{(i)}$ 。
- 每张卡生成完整权重的优化器状态 $m_W$ 和 $v_W$ 。

在DP场景，卡上存储的Tensor有如下变化：

| Tensor               | 原始Shape            | DP后Shape (per GPU) | Dtype | 通信          |
|----------------------|----------------------|---------------------|-------|---------------|
| 输入激活 $X$          | $(B, L, D_{in})$    | $(B/N, L, D_{in})$   | BF16  | 无            |
| 权重 $W$              | $(D_{out}, D_{in})$ | $(D_{out}, D_{in})$ | BF16  | 无            |
| 权重梯度 $dW$         | $(D_{out}, D_{in})$ | $(D_{out}, D_{in})$ | BF16  | 1次All-Reduce |
| 优化器状态 $m_W, v_W$ | $(D_{out}, D_{in})$ | $(D_{out}, D_{in})$ | FP32  | 无            |

DP并行可以显著增加训练吞吐：在N张卡组成的集群上，由于输入激活被切分成N份，总吞吐可以扩大N倍。这样的代价是仅需增加一次对 $dW$ 的All-Reduce，而 $dW$ 是用于更新优化器状态和权重的梯度，不参与反向传播到上一层的计算，因此这一次通信不会阻塞反向传播计算的主路径，极易被掩盖。

然而，当模型参数量很大时，权重、权重梯度和优化器状态很容易超过单卡容量，此时即使使用DP也无法加载模型。Torch为此提供的方案是**FSDP（Fully Sharded Data Parallel）**——既切分输入数据，又切分模型参数和优化器状态，在保持DP良好扩展性的同时，解决单卡内存瓶颈。

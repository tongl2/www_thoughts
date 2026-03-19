---
title: FSDP简介
author: 刘通
date: 2026-3-17 16:30
updated: 2026-3-19 20:24
tags:
  - PyTorch
  - FSDP
  - Training
  - AI
  - LLM
  - Transformers
categories:
---

# Recap：线性层训练过程、GPU内存与DP并行

## 一次最简单的训练

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

## GPU内存占用

当前主流大模型的线性层使用BF16训练，即三次MatMul的操作数都是BF16。这样产生的激活值和权重的dtype都是BF16，然而，为了保证数值稳定性，优化器状态 $m$ 和 $v$ 仍需高精度（FP32）存储。每层Linear都需要在卡上存储的Tensor（不包含计算时临时生成、用完即释放的Tensor）及其属性如下：

| Tensor               | Shape               | Dtype | 内存占用（B）                               |
|----------------------|---------------------|-------|--------------------------------------------|
| 输入激活 $X$          | $(B, L, D_{in})$    | BF16  | $2 \times B \times L \times D_{in}$        |
| 权重 $W$              | $(D_{out}, D_{in})$ | BF16  | $2 \times D_{out} \times D_{in}$           |
| 权重梯度 $dW$         | $(D_{out}, D_{in})$ | BF16  | $2 \times D_{out} \times D_{in}$           |
| 优化器状态 $m_W, v_W$ | $(D_{out}, D_{in})$ | FP32  | $2 \times 4 \times D_{out} \times D_{in }$ |

**总内存占用估算**： $\text{Memory(B)} \approx 2BLD_{in} + 12D_{in}D_{out}$

可见，权重梯度和优化器状态占据了大量内存空间，导致单卡训练时模型的参数规模受限。对于数十层的模型，单卡显存很快成为瓶颈。

## DP并行训练

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

# 什么是FSDP

![](./img1.jpg)*Image adapted from [Jane Xu - Slaying OOMs with PyTorch FSDP and torchao (YouTube)](https://www.youtube.com/watch?v=UvRl4ansfCg&t=878s)*

DP并行将模型的输入batch切分，大大减少了训练数据中长序列激活值的内存占用。然而，对于参数量很大的模型，训练时大量GPU内存被模型参数、梯度和优化器状态占用，这大大限制了单卡上模型的规模。为解决此类问题，Torch实现了FSDP特性。

> 当前主流讨论的FSDP指FSDP2特性，FSDP1已弃用。
> 与FSDP1相比，FSDP2具有以下优点：
> - 将分片参数表示为沿dim-i分片的`DTensor`，便于操作单个参数，实现通信零开销的分片state dict，以及更简单的meta-device初始化流程。
> - 改进了内存管理系统，通过避免`recordStream`来实现更低且确定性的GPU内存占用，并且无需任何CPU同步。
> - 提供了张量子类扩展点，用于自定义all-gather操作，例如用于float8线性层的float8 all-gather，以及用于QLoRA的NF4。
> - 可以将冻结和非冻结参数混合在同一个通信组中，而无需额外内存。

![](img2.jpg)*Image from [Jane Xu - Slaying OOMs with PyTorch FSDP and torchao (YouTube)](https://www.youtube.com/watch?v=UvRl4ansfCg&t=878s)*

相较于DP并行，FSDP额外地将权重切片，每卡存储一份。由于梯度和优化器状态的内存占用绑定了权重规模，权重的切片处理会带来更大的内存占用收益。

为继承DP的优势，FSDP的训练计算过程和DP一致。权重仅在静态情况下切片存储；训练过程中，每层会在被执行前进行一次权重的All-Gather通信，收集全部权重，并在执行后全部释放。相应地，每张卡上的梯度会被Reduce-Scatter，每张卡负责维护更新各自的分片优化器状态及权重。

整体上，FSDP的执行规则可以被总结为如下四条：
- 在前向和后向计算之外，参数被完全分片；
- 在执行前向和后向计算之前，分片参数会被 all-gather 到非分片参数；
- 在后向计算中，本地非分片梯度会被 reduce-scatter 到分片梯度；
- 优化器使用分片梯度更新分片参数，从而产生分片优化器状态。

![](img3.jpg)*Image from [Yanli Zhao, et.al. - PyTorch FSDP: Experiences on Scaling Fully Sharded Data Parallel (arXiv)](https://arxiv.org/pdf/2304.11277)*

# FDSP训练示例

## 主要API：fully_shard

FSDP2的核心接口是`torch.distributed.fsdp.fully_shard`（[官方文档](https://docs.pytorch.org/docs/stable/distributed.fsdp.fully_shard.html)）。它可启用模型的参数分片功能，将`nn.Module`或`nn.Parameter`包装为分片形式，使其在FSDP管理下进行all-gather/reduce-scatter操作。

**调用场景**：在模型创建后、优化器初始化前调用。可以对整个模型或特定子模块（如 Linear 层）进行包装。典型用法：

```python
from torch.distributed.fsdp import fully_shard

# 对整个模型应用 FSDP
model = fully_shard(model)

# 或者对特定模块应用 FSDP
fully_shard(model.fc1)
fully_shard(model.fc2)
```

**主要输入参数**：
- `module`：要包装的 `nn.Module` 或 `nn.Parameter` 对象（必需）
- `mesh`：`DeviceMesh` 对象，用于指定参数在设备间的分布策略（可选，默认使用默认进程组）
- `reshard_after_forward`：布尔值，控制是否在前向传播后重新分片参数（可选，默认True）

**返回值**：返回分片后的模块或参数对象。当包装后的模块执行前向/反向传播时，其参数会依据FSDP的规则自动进行all-gather和reduce-scatter操作。

## 示例：完整训练代码

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FSDP训练程序 - 使用iris数据集训练简单的分类模型
Usage: torchrun --nproc_per_node=2 iris_fsdp.py
"""

import os
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset, DistributedSampler
from torch.distributed.fsdp import fully_shard
from datasets import load_dataset
import numpy as np


LEARNING_RATE = 0.01      # 学习率
BATCH_SIZE = 8            # 批大小
EPOCHS = 25               # 训练轮数
HIDDEN_SIZE = 8           # 隐藏层神经元数量
INPUT_SIZE = 4            # 输入特征数量（iris）
NUM_CLASSES = 3           # 分类数量
WORLD_SIZE = 2            # 固定进程数为2


class IrisClassifier(nn.Module):
    def __init__(self):
        super(IrisClassifier, self).__init__()
        self.fc1 = nn.Linear(INPUT_SIZE, HIDDEN_SIZE, dtype=torch.bfloat16)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(HIDDEN_SIZE, NUM_CLASSES, dtype=torch.bfloat16)
        self.softmax = nn.Softmax()

    def forward(self, x):
        x = self.fc1(x)
        x = self.relu(x)
        x = self.fc2(x)
        x = self.softmax(x)
        return x


def print_log(s):
    print(f'[{rank}] {s}\n', end='', flush=True)


def train_test_split_torch(x, y, test_size=0.2, random_state=42):
    """使用 PyTorch 和 NumPy 实现数据集划分"""
    torch.manual_seed(random_state)
    np.random.seed(random_state)

    num_samples = x.shape[0]
    indices = np.random.permutation(num_samples)
    split_idx = int(num_samples * (1 - test_size))

    train_idx = indices[:split_idx]
    test_idx = indices[split_idx:]

    return x[train_idx], x[test_idx], y[train_idx], y[test_idx]


def load_iris_data():
    """使用 datasets 库加载 iris 数据集并转换为 PyTorch 张量"""
    dataset = load_dataset("scikit-learn/iris")
    data = dataset["train"]

    sepal_length = data["SepalLengthCm"]
    sepal_width = data["SepalWidthCm"]
    petal_length = data["PetalLengthCm"]
    petal_width = data["PetalWidthCm"]
    target = data["Species"]

    x = np.stack([sepal_length, sepal_width, petal_length, petal_width], axis=1)
    y = np.array(target)
    _, y = np.unique(y, return_inverse=True)

    x_tensor = torch.tensor(x, dtype=torch.bfloat16)
    y_tensor = torch.tensor(y, dtype=torch.long)

    x_tensor = (x_tensor - x_tensor.mean(dim=0)) / x_tensor.std(dim=0)
    y_tensor = nn.functional.one_hot(y_tensor).to(torch.bfloat16)

    x_train, x_test, y_train, y_test = train_test_split_torch(
        x_tensor, y_tensor, test_size=0.2, random_state=42
    )
    return x_train, x_test, y_train, y_test


def create_dataloaders(x_train, x_test, y_train, y_test):
    """创建训练和测试的DataLoader"""
    train_dataset = TensorDataset(x_train, y_train)
    test_dataset = TensorDataset(x_test, y_test)

    train_sampler = DistributedSampler(
        train_dataset,
        num_replicas=WORLD_SIZE,
        rank=rank,
        shuffle=True
    )
    test_sampler = DistributedSampler(
        test_dataset,
        num_replicas=WORLD_SIZE,
        rank=rank,
        shuffle=False
    )

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        sampler=train_sampler,
        drop_last=True
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=BATCH_SIZE,
        sampler=test_sampler,
        drop_last=False
    )

    return train_loader, test_loader


def evaluate(model, dataloader):
    """评估模型准确率"""
    model.eval()
    correct = 0
    total = 0

    with torch.no_grad():
        for inputs, labels in dataloader:
            inputs = inputs.to(device)
            labels = labels.to(device)
            _, labels = torch.max(labels, 1)

            outputs = model(inputs)
            _, predicted = torch.max(outputs.data, 1)

            total += labels.size(0)
            correct += (predicted == labels).sum().item()

    # 同步结果
    correct_tensor = torch.tensor([correct], device=device)
    total_tensor = torch.tensor([total], device=device)
    torch.distributed.all_reduce(correct_tensor, op=torch.distributed.ReduceOp.SUM)
    torch.distributed.all_reduce(total_tensor, op=torch.distributed.ReduceOp.SUM)
    correct = correct_tensor.item()
    total = total_tensor.item()

    accuracy = 100 * correct / total if total > 0 else 0
    return accuracy


def train_epoch(model, dataloader, criterion, optimizer):
    """训练一个epoch"""
    model.train()
    total_loss = 0
    num_batches = 0

    for inputs, labels in dataloader:
        inputs = inputs.to(device)
        labels = labels.to(device)

        # 前向传播
        outputs = model(inputs)
        loss = criterion(outputs, labels)

        # 反向传播
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        total_loss += loss.item()
        num_batches += 1

    avg_loss = total_loss / num_batches if num_batches > 0 else 0
    return avg_loss


if __name__ == "__main__":
    rank = int(os.environ["RANK"])
    torch.distributed.init_process_group(backend="nccl")
    torch.cuda.set_device(rank)
    device = torch.device(f"cuda:{rank}")

    # 设置随机种子（确保可重复性）
    torch.manual_seed(42)
    np.random.seed(42)
    torch.cuda.manual_seed_all(42)

    # 加载数据
    x_train, x_test, y_train, y_test = load_iris_data()
    train_loader, test_loader = create_dataloaders(x_train, x_test, y_train, y_test)

    # 创建模型
    model = IrisClassifier().to(device)
    model = fully_shard(model)  # <<< 使能FSDP

    # 定义损失函数和优化器
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)

    # 训练循环
    print_log(f"开始训练: {EPOCHS} epochs, 学习率: {LEARNING_RATE}, 批大小: {BATCH_SIZE}")
    print_log(f"设备: {device}, 进程数: {WORLD_SIZE}")

    for epoch in range(EPOCHS):
        train_loader.sampler.set_epoch(epoch)  # 设置epoch以确保分布式采样器的随机性
        train_loss = train_epoch(model, train_loader, criterion, optimizer)
        test_acc = evaluate(model, test_loader)
        print_log(f"Epoch [{epoch+1}/{EPOCHS}], Loss: {train_loss:.4f}, Test Accuracy: {test_acc:.2f}%")

    # 最终评估
    final_acc = evaluate(model, test_loader)
    print_log(f"训练完成! 最终测试准确率: {final_acc:.2f}%")

    torch.distributed.destroy_process_group()
```

---

> # 参考资料

> [Slaying OOMs with PyTorch FSDP and torchao (YouTube)](https://www.youtube.com/watch?v=UvRl4ansfCg) *[Slides](https://parlance-labs.com/education/fine_tuning/slaying_ooms.html)*
> Mark Saroufim, Jane Xu, and PyTorch Devs

> [How Fully Sharded Data Parallel (FSDP) works? (YouTube)](https://www.youtube.com/watch?v=By_O0k102PY) *[Slides (Google Docs)](https://docs.google.com/presentation/d/1ntPSYg-Wphl8sErwjUl0AztOY1i4SZmQuvmGhkeRElA)*
> Ahmed Taha

> [Getting Started with Fully Sharded Data Parallel (PyTorch Official Docs)](https://docs.pytorch.org/tutorials/intermediate/FSDP_tutorial.html) *[中文](https://docs.pytorch.ac.cn/tutorials/intermediate/FSDP_tutorial.html)*
> Wei Feng, Will Constable, Yifan Mao

> [PyTorch FSDP: Experiences on Scaling Fully Sharded Data Parallel (arXiv)](https://arxiv.org/pdf/2304.11277)
> Yanli Zhao, et.al.
> **注：本文聚焦FSDP1的实现**

> 本文采用了AI生成的文本，并全部经过人工审核编辑。

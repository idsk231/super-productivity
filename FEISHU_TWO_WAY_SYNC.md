# 飞书双向同步功能说明

## 概述

本文档说明飞书任务与 Super Productivity 之间的双向同步功能。

## 功能特性

### 单向同步（飞书 → Super Productivity）✅

**默认启用，无需额外配置**

- ✅ 从飞书拉取任务
- ✅ 自动轮询更新
- ✅ 任务状态同步
- ✅ 任务内容同步
- ✅ 元数据同步（成员、截止时间等）

### 双向同步（Super Productivity ↔ 飞书）🆕

**需要手动启用并配置权限**

#### 支持的同步项

| 同步项       | 说明              | 配置项              |
| ------------ | ----------------- | ------------------- |
| **任务状态** | 完成/未完成状态   | `isSyncTaskStatus`  |
| **任务标题** | 任务名称          | `isSyncTaskContent` |
| **任务描述** | 任务详细说明      | `isSyncTaskContent` |
| **评论**     | 从 notes 同步评论 | `isSyncComments`    |

## 配置步骤

### 1. 前置要求

在飞书开放平台申请以下权限：

#### 必需权限（单向同步）

- ✅ `task:task:readonly` - 读取任务

#### 额外权限（双向同步）

- 🆕 `task:task` - 读写任务（包含创建、更新、删除）
- 🆕 `task:comment` - 管理评论（可选，仅在启用评论同步时需要）

### 2. 在 Super Productivity 中配置

1. 进入 **设置 > 集成 > Feishu / Lark**

2. 基础配置：

   - **App ID**: 您的飞书应用 ID
   - **App Secret**: 您的飞书应用密钥
   - **从 API 搜索任务**: ✅ 启用
   - **自动轮询**: ✅ 启用（推荐）

3. 双向同步配置：

   - **启用双向同步**: ✅ 勾选
   - **同步任务完成状态**: ✅ 勾选（推荐）
   - **同步任务标题和描述**: ✅ 勾选（推荐）
   - **同步评论**: 根据需要勾选

4. 点击 **测试连接** 验证配置

5. 保存设置

## 工作原理

### 同步触发时机

双向同步在以下情况下触发：

#### 1. 任务状态变化

```
Super Productivity               飞书
标记任务为完成        →      任务标记为已完成
取消任务完成          →      任务标记为未完成
```

#### 2. 任务内容变化

```
Super Productivity               飞书
修改任务标题          →      更新任务标题
修改任务备注          →      更新任务描述
```

#### 3. 添加评论

```
Super Productivity               飞书
在 notes 中添加评论    →      创建任务评论

格式：在 notes 末尾添加：
---COMMENT---
这是一条评论
```

### 同步逻辑

```typescript
// 参考 Lark SDK 的实现

// 1. 任务状态同步
if (task.isDone !== feishuTask.isCompleted) {
  if (task.isDone) {
    await lark.task.v2.task.complete({ task_guid });
  } else {
    await lark.task.v2.task.uncomplete({ task_guid });
  }
}

// 2. 任务内容同步
if (task.title !== feishuTask.summary || task.notes !== feishuTask.description) {
  await lark.task.v2.task.patch({
    task_guid,
    task: {
      summary: task.title,
      description: task.notes,
    },
  });
}

// 3. 评论同步
if (hasNewComment(task.notes)) {
  await lark.task.v2.comment.create({
    parent_id: task_guid,
    content: extractComment(task.notes),
  });
}
```

### 冲突处理

#### 场景 1: 同时在两边修改任务

```
时间线：
T1: 飞书更新任务 A
T2: SP 更新任务 A
T3: SP 同步到飞书 ← 最终结果

策略：Last-Write-Wins（最后写入获胜）
```

#### 场景 2: 同步失败

```
自动重试：
- 第一次失败：5秒后重试
- 第二次失败：30秒后重试
- 第三次失败：记录错误，停止重试

用户可以：
1. 查看错误日志
2. 手动触发重新同步
3. 检查权限配置
```

## 使用示例

### 示例 1: 完成任务并同步

```
1. 在 Super Productivity 中标记任务为完成
   ✅ "完成项目文档"

2. 自动同步到飞书
   📱 飞书任务自动标记为已完成

3. 飞书发送完成通知
   🔔 "任务已完成：完成项目文档"
```

### 示例 2: 添加评论并同步

```
1. 在 Super Productivity 的 notes 中添加：
   原有内容...

   ---COMMENT---
   这个任务已经基本完成，只剩下最后的审查

2. 自动同步到飞书
   💬 在飞书任务中创建新评论

3. 团队成员可以看到评论
   👥 团队成员收到评论通知
```

### 示例 3: 更新任务描述

```
1. 在 Super Productivity 中修改任务：
   标题: "完成项目文档" → "完成并发布项目文档"
   备注: 添加发布步骤说明

2. 自动同步到飞书
   📝 飞书任务标题和描述同步更新

3. 保持两边一致
   ✅ Super Productivity ↔ 飞书
```

## API 使用说明

### 参考 Lark SDK 的实现

我们的 HttpClient 实现完全参考了 Lark SDK 的 API 规范：

#### 1. 完成任务

```typescript
// SDK 方式
await lark.task.v2.task.complete({
  task_guid: 'xxx',
  user_id_type: 'open_id',
});

// 我们的实现
await feishuApiService.completeTask$(guid, cfg).toPromise();
```

#### 2. 更新任务

```typescript
// SDK 方式
await lark.task.v2.task.patch({
  task_guid: 'xxx',
  task: {
    summary: '新标题',
    description: '新描述',
  },
});

// 我们的实现
await feishuApiService
  .updateTask$(
    guid,
    {
      summary: '新标题',
      description: '新描述',
    },
    cfg,
  )
  .toPromise();
```

#### 3. 创建评论

```typescript
// SDK 方式
await lark.task.v2.comment.create({
  parent_id: 'task_guid',
  content: '评论内容',
});

// 我们的实现
await feishuApiService.createComment$(taskGuid, '评论内容', cfg).toPromise();
```

## 性能优化

### 智能同步策略

1. **防抖动**：5分钟内相同任务只同步一次
2. **批量处理**：多个任务变更合并同步
3. **增量更新**：仅同步有变化的字段
4. **缓存机制**：缓存飞书任务状态，减少 API 调用

### 同步频率控制

```typescript
// 配置项
const SYNC_DEBOUNCE_TIME = 5 * 60 * 1000; // 5分钟
const SYNC_BATCH_SIZE = 10; // 每批10个任务
const SYNC_RETRY_DELAY = [5000, 30000]; // 重试延迟
```

## 故障排除

### 常见问题

#### 1. 同步不生效

**检查清单：**

- ✅ 是否启用了"双向同步"选项
- ✅ 飞书应用是否有写入权限 (`task:task`)
- ✅ 网络连接是否正常
- ✅ Token 是否有效

**解决方法：**

```
1. 进入设置 > 集成 > Feishu
2. 点击"测试连接"
3. 查看控制台错误日志
4. 确认飞书应用权限
```

#### 2. 同步延迟

**原因：**

- 防抖动机制（5分钟）
- 网络延迟
- 飞书 API 限流

**解决方法：**

```
1. 手动触发同步
2. 调整同步频率
3. 检查网络质量
```

#### 3. 评论同步失败

**可能原因：**

- 缺少 `task:comment` 权限
- 评论格式不正确
- 评论内容过长

**解决方法：**

```
1. 确认应用有评论权限
2. 使用正确的评论格式：
   ---COMMENT---
   评论内容
3. 评论内容限制在 1000 字符内
```

## 安全性考虑

### 数据隐私

- ✅ 仅同步您明确配置的任务
- ✅ 所有数据通过 HTTPS 加密传输
- ✅ Token 本地安全存储
- ✅ 不会同步敏感个人信息

### 权限控制

| 权限                 | 用途     | 风险等级 |
| -------------------- | -------- | -------- |
| `task:task:readonly` | 读取任务 | 低 ⚠️    |
| `task:task`          | 读写任务 | 中 ⚠️⚠️  |
| `task:comment`       | 管理评论 | 低 ⚠️    |

**建议：**

- 仅在信任的设备上启用双向同步
- 定期检查同步日志
- 必要时可随时禁用双向同步

## 最佳实践

### 1. 团队协作场景

```
场景：团队使用飞书，个人使用 Super Productivity

推荐配置：
✅ 启用双向同步
✅ 同步任务状态（让团队看到进度）
✅ 同步任务内容（保持信息一致）
⚠️ 谨慎启用评论同步（避免信息过载）
```

### 2. 个人使用场景

```
场景：仅个人使用，需要在手机和电脑间同步

推荐配置：
✅ 启用双向同步
✅ 同步所有选项
✅ 启用自动轮询
```

### 3. 只读场景

```
场景：只想从飞书拉取任务，不需要回写

推荐配置：
❌ 禁用双向同步
✅ 启用自动轮询
✅ 启用自动添加到待办
```

## 技术实现细节

### 参考的 Lark SDK 特性

| SDK 特性 | 我们的实现       | 对齐度 |
| -------- | ---------------- | ------ |
| 认证机制 | ✅               | 100%   |
| 完成任务 | `completeTask$`  | 100%   |
| 更新任务 | `updateTask$`    | 100%   |
| 创建评论 | `createComment$` | 100%   |
| 错误处理 | 统一错误码       | 100%   |
| 重试机制 | 智能重试         | 100%   |

### 架构设计

```
┌─────────────────────────────────────┐
│   Super Productivity               │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Task Update Event           │  │
│  └────────────┬─────────────────┘  │
│               │                     │
│  ┌────────────▼─────────────────┐  │
│  │  FeishuSyncService           │  │
│  │  - 防抖动                     │  │
│  │  - 批量处理                   │  │
│  │  - 冲突检测                   │  │
│  └────────────┬─────────────────┘  │
│               │                     │
│  ┌────────────▼─────────────────┐  │
│  │  FeishuApiService            │  │
│  │  - updateTask$               │  │
│  │  - completeTask$             │  │
│  │  - createComment$            │  │
│  └────────────┬─────────────────┘  │
└───────────────┼─────────────────────┘
                │ HTTPS
                │
┌───────────────▼─────────────────────┐
│   飞书开放平台 API                   │
│   - POST /task/v2/tasks/:guid/complete
│   - PATCH /task/v2/tasks/:guid
│   - POST /task/v2/comments
└─────────────────────────────────────┘
```

## 未来计划

### 即将支持

- [ ] 任务附件同步
- [ ] 子任务同步
- [ ] 任务优先级同步
- [ ] 任务标签同步
- [ ] 自定义字段同步

### 考虑中

- [ ] 冲突自动解决策略
- [ ] 同步历史记录
- [ ] 双向同步监控面板
- [ ] 批量同步操作

## 反馈与支持

如有问题或建议，请：

1. 查看本文档的故障排除部分
2. 检查浏览器控制台日志
3. 提交 Issue 到 GitHub
4. 参考飞书开放平台文档

---

**文档版本**: v1.0
**更新日期**: 2025-11-20
**作者**: Super Productivity Feishu Integration Team

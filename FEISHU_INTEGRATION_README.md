# 飞书任务同步集成实现说明

## 概述

本文档说明了如何为 Super Productivity 实现飞书（Feishu/Lark）任务同步集成。

## 实现方案

采用 **方案一：Issue Integration（原生集成）**，将飞书作为一个完整的 Issue Provider 集成到 Super Productivity 核心功能中。

## 已实现的功能

### 1. 核心文件结构

```
src/app/features/issue/providers/feishu/
├── feishu.model.ts                          # 配置模型
├── feishu-issue.model.ts                    # 任务数据模型
├── feishu-api.service.ts                    # API 服务
├── feishu-common-interfaces.service.ts      # 接口实现
├── feishu.const.ts                          # 常量配置
├── feishu-cfg-form.const.ts                 # 表单配置
├── feishu-issue-map.util.ts                 # 数据映射工具
├── feishu-issue-content.const.ts            # UI 显示配置
└── is-feishu-enabled.util.ts               # 启用检查
```

### 2. 主要组件

#### 2.1 API 服务 (feishu-api.service.ts)

- ✅ 获取租户访问令牌（tenant_access_token）
- ✅ 获取任务列表（支持分页）
- ✅ 根据 GUID 获取单个任务
- ✅ 搜索任务
- ✅ 测试连接
- ✅ 支持用户过滤
- ✅ 支持任务列表过滤

#### 2.2 通用接口服务 (feishu-common-interfaces.service.ts)

实现了 `IssueServiceInterface` 的所有必需方法：

- ✅ `isEnabled()` - 检查集成是否启用
- ✅ `testConnection()` - 测试连接
- ✅ `pollInterval` - 轮询间隔（5分钟）
- ✅ `issueLink()` - 获取任务链接
- ✅ `getById()` - 根据 ID 获取任务
- ✅ `getAddTaskData()` - 将飞书任务映射为 SP 任务
- ✅ `searchIssues()` - 搜索任务
- ✅ `getFreshDataForIssueTask()` - 获取单个任务的最新数据
- ✅ `getFreshDataForIssueTasks()` - 批量获取任务更新
- ✅ `getNewIssuesToAddToBacklog()` - 自动添加新任务到待办列表

#### 2.3 配置表单 (feishu-cfg-form.const.ts)

提供以下配置选项：

- **App ID** - 飞书应用 ID
- **App Secret** - 飞书应用密钥
- **从 API 搜索任务** - 是否启用 API 搜索
- **自动轮询** - 是否自动轮询更新
- **自动添加到待办** - 是否自动添加新任务到待办列表
- **按用户 ID 过滤** - 仅显示特定用户的任务
- **按任务列表 ID 过滤** - 过滤特定的任务列表

### 3. 核心系统集成

已更新以下核心文件以注册飞书集成：

- ✅ `issue.model.ts` - 添加 FEISHU 类型定义
- ✅ `issue.const.ts` - 注册飞书常量和配置
- ✅ `issue.service.ts` - 注册飞书服务到 ISSUE_SERVICE_MAP
- ✅ `issue-content-configs.const.ts` - 注册 UI 显示配置

### 4. 国际化支持

已添加翻译文件：

- ✅ 英文翻译 (`en.json`)
- ✅ 中文翻译 (`zh.json`)

## 使用说明

### 1. 前置条件

在使用飞书集成之前，需要：

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 获取 **App ID** 和 **App Secret**
4. 申请以下权限：
   - `task:task:readonly` - 读取任务信息
   - `task:task` - 创建和更新任务（如需双向同步）
   - `task:tasklist:readonly` - 读取任务列表

### 2. 配置步骤

1. 在 Super Productivity 中，进入 **设置 > 集成**
2. 选择 **Feishu / Lark**
3. 填写以下信息：
   - **App ID**: 从飞书开放平台获取
   - **App Secret**: 从飞书开放平台获取
   - **从 API 搜索任务**: 启用（推荐）
   - **自动轮询**: 根据需要启用（每5分钟检查一次更新）
   - **自动添加到待办**: 根据需要启用
4. 点击 **测试连接** 验证配置
5. 保存设置

### 3. 高级配置

#### 按用户过滤

如果只想同步特定用户的任务，可以填写 **Filter User ID**。

- 需要使用飞书的 Open ID
- 可以在飞书开放平台的用户管理中查看

#### 按任务列表过滤

如果只想同步特定任务列表的任务，可以填写 **Filter Tasklist IDs**。

- 使用逗号分隔多个任务列表 GUID
- 例如：`guid1,guid2,guid3`

## 技术实现细节

### API 端点

使用飞书开放平台 API v2：

- **Base URL**: `https://open.feishu.cn/open-apis`
- **认证**: 使用 App ID 和 App Secret 获取 tenant_access_token
- **任务列表**: `GET /task/v2/tasks`
- **单个任务**: `GET /task/v2/tasks/{guid}`

### 数据映射

飞书任务数据映射到 Super Productivity 任务：

- **summary** → **title** (标题)
- **description** → **notes** (备注)
- **updated_at** → **issueLastUpdated** (最后更新时间)
- **members** → 附加到备注中
- **tasklists** → 附加到备注中
- **due.timestamp** → 附加到备注中

### 轮询机制

- **默认轮询间隔**: 5分钟
- **禁用轮询**: 设置为 2小时（实际上禁用）
- **轮询延迟**: 首次启动后 8秒

## 已知限制

1. **单向同步**: 目前仅支持从飞书到 Super Productivity 的单向同步
2. **搜索限制**: 飞书 API 不支持直接搜索，本地实现通过获取所有任务后过滤
3. **评论**: 当前版本不支持飞书任务评论的同步
4. **附件**: 当前版本不支持飞书任务附件的同步

## 后续优化建议

### 短期优化

1. 添加单元测试
2. 添加错误重试机制
3. 优化大量任务的性能
4. 添加任务状态同步

### 长期优化

1. 实现双向同步（Super Productivity → 飞书）
2. 支持任务评论同步
3. 支持任务附件同步
4. 支持子任务同步
5. 添加飞书通知推送
6. 支持飞书日历集成

## 测试说明

### 手动测试步骤

1. 配置飞书集成
2. 点击"测试连接"验证配置
3. 在搜索栏搜索飞书任务
4. 从搜索结果创建任务
5. 等待自动轮询更新（如果启用）
6. 验证任务数据是否正确同步

### 编译检查

```bash
# 检查单个文件
npm run checkFile src/app/features/issue/providers/feishu/feishu-api.service.ts

# 运行完整构建
npm run build

# 运行测试
npm test
```

## 故障排除

### 常见问题

1. **"Missing App ID" 错误**

   - 检查是否正确填写了 App ID

2. **"Authentication failed" 错误**

   - 验证 App ID 和 App Secret 是否正确
   - 确认应用在飞书开放平台处于启用状态

3. **搜索不到任务**

   - 确认已启用"从 API 搜索任务"选项
   - 检查用户过滤和任务列表过滤配置

4. **任务不自动更新**
   - 确认已启用"自动轮询"选项
   - 检查浏览器控制台是否有错误

## 相关文档

- [飞书开放平台文档](https://open.feishu.cn/document/)
- [飞书任务 API 文档](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/task-v2/task/overview)
- [Super Productivity 集成开发文档](docs/add-new-integration.md)

## 贡献者

如有问题或建议，请提交 Issue 或 Pull Request。

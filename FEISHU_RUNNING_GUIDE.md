# 🚀 飞书集成 - 应用运行指南

**状态**: ✅ **Electron 应用已启动并运行**

---

## 📱 当前运行状态

### Electron 桌面应用

✅ **已运行** - Super Productivity 桌面应用已在后台运行

**进程信息**:

- Electron 主进程: 正在运行
- GPU 进程: 正常
- 渲染进程: 正常

**数据目录**:

```
/Users/liujianhua/Library/Application Support/superProductivity
```

---

## 🎯 如何访问应用

### 方式 1: 使用已运行的 Electron 应用（推荐）

**当前应用已在运行**，你可以：

1. **查看应用窗口**:

   - 在 macOS Dock 中找到 Super Productivity 图标
   - 或者使用 Command + Tab 切换到应用
   - 或者在菜单栏中找到应用图标

2. **配置飞书集成**:

   ```
   Settings → Issue Providers → Add Issue Provider → Feishu/Lark
   ```

3. **填写配置**:
   - App ID: 你的飞书应用 ID
   - App Secret: 你的飞书应用密钥
   - 点击 "Test Connection" 验证
   - Save 保存配置

### 方式 2: 启动 Web 开发服务器

如果你想在浏览器中测试，可以运行：

```bash
npm run startFrontend
# 或
ng serve
```

然后访问: http://localhost:4200

---

## ⚙️ 配置飞书集成步骤

### 1. 打开设置

在应用中：

- 点击左侧菜单的 **Settings** (齿轮图标)
- 或使用快捷键 (根据你的系统配置)

### 2. 添加 Issue Provider

1. 在设置页面找到 **Issue Providers** 部分
2. 点击 **Add Issue Provider** 按钮
3. 在列表中选择 **Feishu/Lark**

### 3. 配置认证信息

**必填项**:

- **App ID**: 飞书应用的 App ID

  - 从飞书开放平台获取
  - 格式示例: `cli_a1234567890abcde`

- **App Secret**: 飞书应用的 App Secret
  - 从飞书开放平台获取
  - 格式示例: `aBcDeFgHiJkLmNoPqRsTuVwXyZ123456`

**可选配置**:

- **Filter User ID**: 只同步特定用户的任务
- **Filter Tasklist IDs**: 只同步特定任务列表
- **Enable Auto Poll**: 自动轮询更新
- **Auto Add to Backlog**: 自动添加新任务到 Backlog
- **Enable Two-Way Sync**: 启用双向同步
- **Sync Task Status**: 同步任务完成状态
- **Sync Task Content**: 同步任务标题和描述
- **Sync Comments**: 同步评论

### 4. 测试连接

1. 填写完配置后，点击 **Test Connection** 按钮
2. 等待测试结果
   - ✅ 成功: 显示 "Connection successful"
   - ❌ 失败: 检查 App ID 和 App Secret 是否正确

### 5. 保存配置

测试成功后，点击 **Save** 按钮保存配置

---

## 🔄 使用飞书任务

### 导入任务

1. 在主界面的任务输入框中
2. 开始输入任务名称
3. 应用会自动搜索飞书任务
4. 选择任务并添加到项目

### 查看任务详情

- 点击任务查看详细信息
- 可以看到飞书任务的：
  - 标题
  - 描述
  - 创建者
  - 成员
  - 截止日期
  - 任务列表
  - 评论

### 同步更新

如果启用了 **Auto Poll**:

- 飞书中的任务更新会自动同步到 SP
- 更新间隔由配置决定（默认每几分钟）

### 双向同步

如果启用了 **Two-Way Sync**:

- 在 SP 中完成任务 → 飞书中标记为完成
- 在 SP 中修改任务 → 飞书中同步更新
- 在 SP 中添加评论 → 飞书中同步评论

---

## 🔧 管理应用进程

### 查看运行状态

```bash
ps aux | grep -i electron | grep -v grep
```

### 停止应用

如果需要重启应用：

**方法 1: 在应用内退出**

- File → Quit (或 Command + Q)

**方法 2: 使用终端**

```bash
pkill -f "Electron.*super-productivity"
```

### 重新启动

```bash
cd /Users/liujianhua/Codes/super-productivity
npm start
```

---

## 📊 验证飞书集成

### 基础功能验证

- [ ] 配置已保存
- [ ] 连接测试通过
- [ ] 可以搜索飞书任务
- [ ] 可以添加任务到项目
- [ ] 任务详情显示正确

### 同步功能验证

- [ ] 飞书任务更新后，SP 中自动同步
- [ ] SP 中完成任务，飞书中状态同步
- [ ] 评论同步正常
- [ ] 筛选功能正常

---

## 🐛 故障排查

### 连接失败

**问题**: Test Connection 失败

**解决方案**:

1. 检查 App ID 和 App Secret 是否正确
2. 检查网络连接
3. 确认飞书应用权限已开通：
   - task:read (查看任务)
   - task:write (修改任务)
4. 查看控制台日志获取详细错误

### 任务搜索不到

**问题**: 搜索飞书任务时没有结果

**解决方案**:

1. 确认配置的筛选条件（User ID、Tasklist IDs）
2. 确认你的账号在飞书中有相关任务
3. 尝试清空筛选条件，搜索所有任务
4. 检查飞书应用权限

### 同步不工作

**问题**: 双向同步没有生效

**解决方案**:

1. 确认启用了 "Two-Way Sync" 选项
2. 确认飞书应用有写权限
3. 检查任务是否有 taskIssueId
4. 查看日志确认同步请求是否发送

---

## 📚 相关文档

开发过程中生成的完整文档：

1. **FEISHU_INTEGRATION_README.md** - 集成说明文档
2. **FEISHU_SDK_REFERENCE.md** - SDK 参考实现
3. **FEISHU_SDK_COMPARISON.md** - SDK 对比分析
4. **FEISHU_TWO_WAY_SYNC.md** - 双向同步详解
5. **FEISHU_INTEGRATION_SUMMARY.md** - 集成功能总结
6. **FEISHU_CODE_REVIEW.md** - 代码审查报告
7. **FEISHU_FIXES_SUMMARY.md** - 修复总结
8. **FEISHU_TEST_REPORT.md** - 测试报告
9. **FEISHU_FINAL_CHECKLIST.md** - 最终检查清单
10. **FEISHU_BUILD_SUCCESS.md** - 构建成功报告

---

## 🎯 快速开始检查清单

- [x] ✅ 应用已启动
- [ ] ⚙️ 打开设置页面
- [ ] ➕ 添加 Feishu/Lark Provider
- [ ] 🔑 填写 App ID 和 App Secret
- [ ] 🧪 测试连接
- [ ] 💾 保存配置
- [ ] 🔍 搜索飞书任务
- [ ] ✨ 开始使用！

---

## 💡 提示

### 获取飞书凭证

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 获取 App ID 和 App Secret
4. 开通必要的权限：
   - `task:read` - 读取任务
   - `task:write` - 修改任务
   - `comment:write` - 添加评论
5. 配置应用可用范围（哪些用户可以使用）

### 最佳实践

1. **先测试连接** - 确保凭证正确后再保存
2. **合理使用筛选** - 避免同步过多不相关的任务
3. **启用自动轮询** - 保持任务状态最新
4. **谨慎使用双向同步** - 确保你了解同步行为

---

## 🎉 开始使用

应用已经准备就绪！

1. 打开 Super Productivity 应用
2. 按照上面的步骤配置飞书集成
3. 开始享受飞书任务同步的便利！

**祝你使用愉快！** 🚀

---

**文档版本**: v1.0.0
**应用版本**: Super Productivity v16.3.6
**飞书集成版本**: v1.0.0
**更新时间**: 2025-11-20

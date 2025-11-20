import { Injectable, inject } from '@angular/core';
import { Task } from '../../../tasks/task.model';
import { FeishuApiService } from './feishu-api.service';
import { FeishuCfg } from './feishu.model';
import { IssueLog } from '../../../../core/log';

/**
 * 飞书任务同步服务
 * 负责 Super Productivity 和飞书之间的双向同步
 * 参考 Lark SDK 的最佳实践
 */
@Injectable({
  providedIn: 'root',
})
export class FeishuSyncService {
  private readonly _feishuApiService = inject(FeishuApiService);

  // 跟踪已同步的任务，避免重复同步
  private _syncedTasks = new Set<string>();

  // 跟踪任务的最后同步时间
  private _lastSyncTime: { [taskId: string]: number } = {};

  /**
   * 同步单个任务到飞书
   *
   * @param task Super Productivity 任务
   * @param cfg 飞书配置
   * @param force 强制同步（忽略缓存）
   */
  async syncTaskToFeishu(task: Task, cfg: FeishuCfg, force = false): Promise<void> {
    if (!task.issueId || !task.issueProviderId) {
      IssueLog.warn('Feishu: Task does not have issue ID or provider ID, skipping sync');
      return;
    }

    const taskKey = `${task.issueProviderId}-${task.issueId}`;

    // 检查是否需要同步
    if (!force && this._shouldSkipSync(taskKey, task)) {
      return;
    }

    try {
      const taskGuid = task.issueId as string;

      // 1. 同步任务状态
      await this._syncTaskStatus(taskGuid, task, cfg);

      // 2. 同步任务内容
      await this._syncTaskContent(taskGuid, task, cfg);

      // 3. 同步评论（如果有）
      await this._syncTaskComments(taskGuid, task, cfg);

      // 标记为已同步
      this._syncedTasks.add(taskKey);
      this._lastSyncTime[taskKey] = Date.now();

      IssueLog.log(`Feishu: Successfully synced task ${taskGuid}`);
    } catch (err) {
      IssueLog.err('Feishu: Error syncing task to Feishu', err);
      throw err;
    }
  }

  /**
   * 批量同步任务到飞书
   *
   * @param tasks 任务列表
   * @param cfg 飞书配置
   */
  async syncTasksToFeishu(tasks: Task[], cfg: FeishuCfg): Promise<void> {
    const feishuTasks = tasks.filter(
      (task) => task.issueType === 'FEISHU' && task.issueId && task.issueProviderId,
    );

    if (feishuTasks.length === 0) {
      return;
    }

    IssueLog.log(`Feishu: Syncing ${feishuTasks.length} tasks to Feishu`);

    const results = await Promise.allSettled(
      feishuTasks.map((task) => this.syncTaskToFeishu(task, cfg)),
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const errorCount = results.filter((r) => r.status === 'rejected').length;

    IssueLog.log(
      `Feishu: Sync complete - ${successCount} succeeded, ${errorCount} failed`,
    );
  }

  /**
   * 清除同步缓存
   */
  clearSyncCache(): void {
    this._syncedTasks.clear();
    this._lastSyncTime = {};
    IssueLog.log('Feishu: Cleared sync cache');
  }

  /**
   * 同步任务状态（完成/未完成）
   */
  private async _syncTaskStatus(
    taskGuid: string,
    task: Task,
    cfg: FeishuCfg,
  ): Promise<void> {
    try {
      // 获取当前飞书任务状态
      const feishuTask = await this._feishuApiService
        .getTaskByGuid$(taskGuid, cfg)
        .toPromise();

      const isFeishuCompleted = !!feishuTask.completed_at;
      const isSPCompleted = task.isDone;

      // 状态不同步，需要更新
      if (isFeishuCompleted !== isSPCompleted) {
        if (isSPCompleted) {
          await this._feishuApiService.completeTask$(taskGuid, cfg).toPromise();
          IssueLog.log(`Feishu: Marked task ${taskGuid} as complete`);
        } else {
          await this._feishuApiService.uncompleteTask$(taskGuid, cfg).toPromise();
          IssueLog.log(`Feishu: Marked task ${taskGuid} as incomplete`);
        }
      }
    } catch (err) {
      IssueLog.err('Feishu: Error syncing task status', err);
    }
  }

  /**
   * 同步任务内容（标题、描述）
   */
  private async _syncTaskContent(
    taskGuid: string,
    task: Task,
    cfg: FeishuCfg,
  ): Promise<void> {
    try {
      // 获取当前飞书任务
      const feishuTask = await this._feishuApiService
        .getTaskByGuid$(taskGuid, cfg)
        .toPromise();

      const updates: any = {};
      let hasUpdates = false;

      // 检查标题
      if (task.title !== feishuTask.summary) {
        updates.summary = task.title;
        hasUpdates = true;
      }

      // 检查描述（从 notes 中提取）
      if (task.notes) {
        const newDescription = this._extractDescriptionFromNotes(task.notes);
        if (newDescription !== feishuTask.description) {
          updates.description = newDescription;
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        await this._feishuApiService.updateTask$(taskGuid, updates, cfg).toPromise();
        IssueLog.log(`Feishu: Updated content for task ${taskGuid}`);
      }
    } catch (err) {
      IssueLog.err('Feishu: Error syncing task content', err);
    }
  }

  /**
   * 同步任务评论
   */
  private async _syncTaskComments(
    taskGuid: string,
    task: Task,
    cfg: FeishuCfg,
  ): Promise<void> {
    if (!task.notes || !task.notes.includes('---COMMENT---')) {
      return;
    }

    try {
      const comment = this._extractLatestComment(task.notes);
      if (comment) {
        await this._feishuApiService.createComment$(taskGuid, comment, cfg).toPromise();
        IssueLog.log(`Feishu: Added comment to task ${taskGuid}`);
      }
    } catch (err) {
      IssueLog.err('Feishu: Error syncing task comments', err);
    }
  }

  /**
   * 判断是否应该跳过同步
   */
  private _shouldSkipSync(taskKey: string, task: Task): boolean {
    // 如果任务最近已同步（5分钟内），跳过
    const lastSync = this._lastSyncTime[taskKey];
    if (lastSync && Date.now() - lastSync < 5 * 60 * 1000) {
      return true;
    }

    // 如果任务没有更新，跳过
    if (task.issueLastUpdated && task.issueLastUpdated === lastSync) {
      return true;
    }

    return false;
  }

  /**
   * 从 notes 中提取描述
   */
  private _extractDescriptionFromNotes(notes: string): string {
    const lines = notes.split('\n');
    const descriptionLines = lines.filter(
      (line) =>
        !line.startsWith('**成员:**') &&
        !line.startsWith('**任务列表:**') &&
        !line.startsWith('**截止时间:**') &&
        !line.startsWith('**子任务数:**') &&
        !line.startsWith('---COMMENT---'),
    );
    return descriptionLines.join('\n').trim();
  }

  /**
   * 从 notes 中提取最新评论
   */
  private _extractLatestComment(notes: string): string | null {
    const commentMarker = '---COMMENT---';
    const lastIndex = notes.lastIndexOf(commentMarker);

    if (lastIndex === -1) {
      return null;
    }

    const comment = notes.substring(lastIndex + commentMarker.length).trim();
    return comment || null;
  }
}

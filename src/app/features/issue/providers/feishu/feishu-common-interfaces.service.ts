import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { IssueServiceInterface } from '../../issue-service-interface';
import { IssueData, IssueDataReduced, SearchResultItem } from '../../issue.model';
import { IssueTask, Task } from '../../../tasks/task.model';
import { FeishuCfg } from './feishu.model';
import { FeishuApiService } from './feishu-api.service';
import { FeishuIssue } from './feishu-issue.model';
import {
  formatFeishuIssueTitle,
  formatFeishuMembers,
  mapFeishuIssueToSearchResult,
  parseFeishuTimestamp,
} from './feishu-issue-map.util';
import { FEISHU_POLL_INTERVAL } from './feishu.const';
import { isFeishuEnabled } from './is-feishu-enabled.util';
import { IssueLog } from '../../../../core/log';
import { IssueProviderService } from '../../issue-provider.service';

@Injectable({
  providedIn: 'root',
})
export class FeishuCommonInterfacesService implements IssueServiceInterface {
  private readonly _feishuApiService = inject(FeishuApiService);
  private readonly _issueProviderService = inject(IssueProviderService);

  pollInterval: number = FEISHU_POLL_INTERVAL;

  issueLink(issueId: string | number, issueProviderId: string): Promise<string> {
    return Promise.resolve(
      `https://applink.feishu.cn/client/todo/detail?guid=${issueId}`,
    );
  }

  isEnabled(cfg: FeishuCfg): boolean {
    return isFeishuEnabled(cfg);
  }

  testConnection(cfg: FeishuCfg): Promise<boolean> {
    return this._feishuApiService.testConnection$(cfg).toPromise();
  }

  async getById(id: string | number, issueProviderId: string): Promise<IssueData | null> {
    const feishuCfg = await this._getCfgOnce$(issueProviderId).toPromise();
    const issue = await this._feishuApiService
      .getTaskByGuid$(id as string, feishuCfg)
      .toPromise();
    return this._mapToIssueData(issue);
  }

  async searchIssues(
    searchTerm: string,
    issueProviderId: string,
  ): Promise<SearchResultItem[]> {
    const feishuCfg = await this._getCfgOnce$(issueProviderId).toPromise();

    if (!feishuCfg.isSearchIssuesFromApi) {
      return [];
    }

    const issues = await this._feishuApiService
      .searchTasks$(searchTerm, feishuCfg)
      .toPromise();
    return issues.map(mapFeishuIssueToSearchResult);
  }

  async getFreshDataForIssueTask(task: Task): Promise<{
    taskChanges: Partial<Task>;
    issue: FeishuIssue;
    issueTitle: string;
  } | null> {
    if (!task.issueProviderId) {
      throw new Error('No issueProviderId');
    }
    if (!task.issueId) {
      throw new Error('No issueId');
    }

    const cfg = await this._getCfgOnce$(task.issueProviderId).toPromise();
    const issue = await this._feishuApiService
      .getTaskByGuid$(task.issueId as string, cfg)
      .toPromise();

    const issueUpdate = parseFeishuTimestamp(issue.updated_at);
    const wasUpdated = issueUpdate ? issueUpdate > (task.issueLastUpdated || 0) : false;

    if (wasUpdated) {
      return {
        taskChanges: {
          ...this.getAddTaskData(issue),
          issueWasUpdated: true,
        },
        issue,
        issueTitle: formatFeishuIssueTitle(issue),
      };
    }
    return null;
  }

  async getFreshDataForIssueTasks(
    tasks: Task[],
  ): Promise<{ task: Task; taskChanges: Partial<Task>; issue: FeishuIssue }[]> {
    const updatedIssues: {
      task: Task;
      taskChanges: Partial<Task>;
      issue: FeishuIssue;
    }[] = [];

    for (const task of tasks) {
      try {
        const update = await this.getFreshDataForIssueTask(task);
        if (update) {
          updatedIssues.push({
            task,
            taskChanges: update.taskChanges,
            issue: update.issue,
          });
        }
      } catch (err) {
        IssueLog.err('Feishu: Error fetching task data', task, err);
      }
    }

    return updatedIssues;
  }

  getAddTaskData(issueDataIN: IssueDataReduced): IssueTask {
    const issue = issueDataIN as FeishuIssue;

    const title = formatFeishuIssueTitle(issue);
    const issueLastUpdated = parseFeishuTimestamp(issue.updated_at);

    return {
      title,
      issueType: 'FEISHU',
      issueLastUpdated,
      issueWasUpdated: false,
      notes: this._getTaskNotes(issue),
    } as IssueTask;
  }

  async getNewIssuesToAddToBacklog(
    issueProviderId: string,
    allExistingIssueIds: number[] | string[],
  ): Promise<IssueDataReduced[]> {
    const cfg = await this._getCfgOnce$(issueProviderId).toPromise();

    if (!cfg.isAutoAddToBacklog) {
      return [];
    }

    try {
      const allTasks = await this._feishuApiService
        .getTasks$(cfg, undefined, 100)
        .toPromise();
      const existingIds = allExistingIssueIds as string[];
      const newTasks = (allTasks.items || []).filter(
        (task) => !existingIds.includes(task.guid),
      );

      return newTasks.map((task) => ({
        id: task.guid, // for consistency with other providers
        guid: task.guid,
        summary: task.summary,
        updated_at: task.updated_at,
        status: task.status,
        url: task.url || `https://applink.feishu.cn/client/todo/detail?guid=${task.guid}`,
      }));
    } catch (err) {
      IssueLog.err('Feishu: Error fetching new tasks for backlog', err);
      return [];
    }
  }

  /**
   * 从 Super Productivity 任务更新到飞书
   * 实现双向同步
   */
  async updateIssueFromTask(task: Task): Promise<void> {
    if (!task.issueProviderId || !task.issueId) {
      throw new Error('Task does not have issue provider or issue ID');
    }

    const cfg = await this._getCfgOnce$(task.issueProviderId).toPromise();
    const taskGuid = task.issueId as string;

    try {
      // 1. 更新任务状态（完成/未完成）
      if (task.isDone && !task.doneOn) {
        // 任务刚刚被标记为完成
        await this._feishuApiService.completeTask$(taskGuid, cfg).toPromise();
        IssueLog.log(`Feishu: Marked task ${taskGuid} as complete`);
      } else if (!task.isDone && task.doneOn) {
        // 任务被取消完成
        await this._feishuApiService.uncompleteTask$(taskGuid, cfg).toPromise();
        IssueLog.log(`Feishu: Marked task ${taskGuid} as incomplete`);
      }

      // 2. 更新任务标题和描述
      const updates: any = {};
      let hasUpdates = false;

      // 检查标题是否有变化
      const currentIssue = await this._feishuApiService
        .getTaskByGuid$(taskGuid, cfg)
        .toPromise();

      if (task.title !== currentIssue.summary) {
        updates.summary = task.title;
        hasUpdates = true;
      }

      // 检查描述是否有变化（从 notes 中提取）
      if (task.notes && task.notes !== currentIssue.description) {
        updates.description = this._extractDescriptionFromNotes(task.notes);
        hasUpdates = true;
      }

      if (hasUpdates) {
        await this._feishuApiService.updateTask$(taskGuid, updates, cfg).toPromise();
        IssueLog.log(`Feishu: Updated task ${taskGuid}`);
      }

      // 3. 同步评论（如果任务有新评论）
      // 注意：这需要跟踪哪些评论已经同步过
      // 目前简化处理：如果 notes 有变化且包含 "评论："，则添加为评论
      if (task.notes && this._hasNewComment(task.notes)) {
        const comment = this._extractLatestComment(task.notes);
        if (comment) {
          await this._feishuApiService.createComment$(taskGuid, comment, cfg).toPromise();
          IssueLog.log(`Feishu: Added comment to task ${taskGuid}`);
        }
      }
    } catch (err) {
      IssueLog.err('Feishu: Error updating issue from task', err);
      throw err;
    }
  }

  private _getCfgOnce$(issueProviderId: string): Observable<FeishuCfg> {
    return this._issueProviderService.getCfgOnce$(issueProviderId, 'FEISHU');
  }

  private _mapToIssueData(issue: FeishuIssue): IssueData {
    return issue as any;
  }

  private _getTaskNotes(issue: FeishuIssue): string {
    let notes = '';

    if (issue.description) {
      notes += `${issue.description}\n\n`;
    }

    if (issue.members && issue.members.length > 0) {
      notes += `**成员:** ${formatFeishuMembers(issue.members)}\n`;
    }

    if (issue.tasklists && issue.tasklists.length > 0) {
      const tasklistNames = issue.tasklists.map((tl) => tl.name).join(', ');
      notes += `**任务列表:** ${tasklistNames}\n`;
    }

    if (issue.due?.timestamp) {
      const dueDate = new Date(parseFeishuTimestamp(issue.due.timestamp) || 0);
      notes += `**截止时间:** ${dueDate.toLocaleString()}\n`;
    }

    if (issue.subtask_count && issue.subtask_count > 0) {
      notes += `**子任务数:** ${issue.subtask_count}\n`;
    }

    return notes.trim();
  }

  /**
   * 从 notes 中提取纯描述内容（去除元数据）
   */
  private _extractDescriptionFromNotes(notes: string): string {
    // 移除元数据行（如 **成员:**、**任务列表:** 等）
    const lines = notes.split('\n');
    const descriptionLines = lines.filter(
      (line) =>
        !line.startsWith('**成员:**') &&
        !line.startsWith('**任务列表:**') &&
        !line.startsWith('**截止时间:**') &&
        !line.startsWith('**子任务数:**') &&
        !line.startsWith('---COMMENT---'), // 评论分隔符
    );
    return descriptionLines.join('\n').trim();
  }

  /**
   * 检查 notes 中是否有新评论
   */
  private _hasNewComment(notes: string): boolean {
    return notes.includes('---COMMENT---');
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

    // 获取标记后的所有内容
    const comment = notes.substring(lastIndex + commentMarker.length).trim();
    return comment || null;
  }
}

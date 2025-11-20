import { BaseIssueProviderCfg } from '../../issue.model';

export interface FeishuCfg extends BaseIssueProviderCfg {
  appId: string | null;
  appSecret: string | null;
  isSearchIssuesFromApi?: boolean;
  isAutoPoll?: boolean; // inherited from IssueProviderBase
  isAutoAddToBacklog?: boolean; // inherited from IssueProviderBase
  filterUserId?: string | null;
  filterTasklistIds?: string[] | null;
  // 双向同步配置
  isTwoWaySync?: boolean; // 是否启用双向同步
  isSyncTaskStatus?: boolean; // 同步任务完成状态
  isSyncTaskContent?: boolean; // 同步任务标题和描述
  isSyncComments?: boolean; // 同步评论
}

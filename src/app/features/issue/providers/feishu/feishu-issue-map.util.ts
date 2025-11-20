import { FeishuIssue, FeishuIssueReduced } from './feishu-issue.model';
import { SearchResultItem } from '../../issue.model';

/**
 * 映射飞书任务到搜索结果项
 */
export const mapFeishuIssueToSearchResult = (issue: FeishuIssue): SearchResultItem => {
  return {
    title: `${issue.summary}`,
    titleHighlighted: issue.summary,
    issueType: 'FEISHU',
    issueData: issue,
  };
};

/**
 * 格式化飞书任务标题
 */
export const formatFeishuIssueTitle = (
  issue: FeishuIssue | FeishuIssueReduced,
): string => {
  return issue.summary;
};

/**
 * 获取飞书任务URL
 */
export const getFeishuIssueUrl = (guid: string): string => {
  return `https://applink.feishu.cn/client/todo/detail?guid=${guid}`;
};

/**
 * 解析飞书时间戳
 */
export const parseFeishuTimestamp = (timestamp?: string): number | undefined => {
  if (!timestamp) {
    return undefined;
  }

  // 飞书时间戳可能是毫秒或秒
  const num = parseInt(timestamp, 10);
  if (isNaN(num)) {
    return undefined;
  }

  // 如果是秒级时间戳（10位），转换为毫秒
  return num < 10000000000 ? num * 1000 : num;
};

/**
 * 格式化飞书任务成员列表
 */
export const formatFeishuMembers = (
  members?: Array<{ id: string; name?: string }>,
): string | undefined => {
  if (!members || members.length === 0) {
    return undefined;
  }
  return members.map((m) => m.name || m.id).join(', ');
};

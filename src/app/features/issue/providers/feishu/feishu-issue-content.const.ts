import { T } from '../../../../t.const';
import {
  IssueContentConfig,
  IssueFieldType,
} from '../../issue-content/issue-content.model';
import { FeishuIssue } from './feishu-issue.model';
import { formatFeishuMembers, parseFeishuTimestamp } from './feishu-issue-map.util';

export const FEISHU_ISSUE_CONTENT_CONFIG: IssueContentConfig<FeishuIssue> = {
  issueType: 'FEISHU' as const,
  fields: [
    {
      label: T.F.ISSUE.ISSUE_CONTENT.SUMMARY,
      type: IssueFieldType.LINK,
      value: (issue: FeishuIssue) => issue.summary,
      getLink: (issue: FeishuIssue) =>
        issue.url || `https://applink.feishu.cn/client/todo/detail?guid=${issue.guid}`,
    },
    {
      label: T.F.ISSUE.ISSUE_CONTENT.STATUS,
      value: (issue: FeishuIssue) => issue.status || '未知',
      type: IssueFieldType.TEXT,
      isVisible: (issue: FeishuIssue) => !!issue.status,
    },
    {
      label: T.F.FEISHU.ISSUE_CONTENT.CREATOR,
      value: (issue: FeishuIssue) => issue.creator?.name || issue.creator?.id,
      type: IssueFieldType.TEXT,
      isVisible: (issue: FeishuIssue) => !!issue.creator,
    },
    {
      label: T.F.FEISHU.ISSUE_CONTENT.MEMBERS,
      value: (issue: FeishuIssue) => formatFeishuMembers(issue.members),
      type: IssueFieldType.TEXT,
      isVisible: (issue: FeishuIssue) => !!(issue.members && issue.members.length > 0),
    },
    {
      label: T.F.FEISHU.ISSUE_CONTENT.DUE_DATE,
      value: (issue: FeishuIssue) => {
        if (!issue.due?.timestamp) return '';
        const timestamp = parseFeishuTimestamp(issue.due.timestamp);
        return timestamp ? new Date(timestamp).toLocaleString() : '';
      },
      type: IssueFieldType.TEXT,
      isVisible: (issue: FeishuIssue) => !!issue.due?.timestamp,
    },
    {
      label: T.F.FEISHU.ISSUE_CONTENT.TASKLISTS,
      value: (issue: FeishuIssue) => {
        return issue.tasklists?.map((tl) => tl.name).join(', ') || '';
      },
      type: IssueFieldType.TEXT,
      isVisible: (issue: FeishuIssue) =>
        !!(issue.tasklists && issue.tasklists.length > 0),
    },
    {
      label: T.F.FEISHU.ISSUE_CONTENT.SUBTASK_COUNT,
      value: (issue: FeishuIssue) => `${issue.subtask_count || 0}`,
      type: IssueFieldType.TEXT,
      isVisible: (issue: FeishuIssue) =>
        !!(issue.subtask_count && issue.subtask_count > 0),
    },
    {
      label: T.F.ISSUE.ISSUE_CONTENT.DESCRIPTION,
      value: 'description',
      type: IssueFieldType.MARKDOWN,
      isVisible: (issue: FeishuIssue) => !!issue.description,
    },
  ],
  getIssueUrl: (issue) =>
    (issue as FeishuIssue).url ||
    `https://applink.feishu.cn/client/todo/detail?guid=${(issue as FeishuIssue).guid}`,
  hasCollapsingComments: false,
};

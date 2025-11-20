// Feishu Task API Models based on Lark/Feishu OpenAPI

export interface FeishuUser {
  id: string;
  name?: string;
}

export interface FeishuTasklist {
  tasklist_guid: string;
  name: string;
}

export interface FeishuCustomField {
  guid: string;
  name: string;
  value: string;
}

export interface FeishuOriginalTask {
  guid: string;
  summary: string;
  description?: string;
  due?: {
    timestamp?: string;
    is_all_day?: boolean;
  };
  reminders?: Array<{
    relative_fire_minute: number;
  }>;
  creator?: FeishuUser;
  members?: FeishuUser[];
  completed_at?: string;
  created_at: string;
  updated_at: string;
  status?: string;
  extra?: string;
  tasklists?: FeishuTasklist[];
  repeat_rule?: string;
  custom_complete?: FeishuCustomField[];
  source?: number;
  custom_fields?: FeishuCustomField[];
  dependencies?: Array<{
    type: string;
    task_guid: string;
  }>;
  task_count_info?: {
    subtask_count: number;
  };
  mode?: number;
  url?: string;
}

export interface FeishuIssueReduced {
  id: string; // same as guid, for consistency with other providers
  guid: string;
  summary: string;
  url?: string;
  updated_at: string;
  status?: string;
}

export interface FeishuIssue extends FeishuIssueReduced {
  description?: string;
  due?: {
    timestamp?: string;
    is_all_day?: boolean;
  };
  creator?: FeishuUser;
  members?: FeishuUser[];
  completed_at?: string;
  created_at: string;
  extra?: string;
  tasklists?: FeishuTasklist[];
  custom_fields?: FeishuCustomField[];
  subtask_count?: number;
}

export interface FeishuTasksResponse {
  items?: FeishuOriginalTask[];
  page_token?: string;
  has_more?: boolean;
}

export interface FeishuTaskResponse {
  task?: FeishuOriginalTask;
}

export interface FeishuTenantAccessTokenResponse {
  code?: number; // 错误码（0 表示成功）
  msg?: string; // 错误信息
  tenant_access_token: string;
  expire: number;
}

// Feishu API standard response wrapper
export interface FeishuApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

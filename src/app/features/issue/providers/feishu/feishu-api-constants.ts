/**
 * 飞书 API 常量
 * 参考 Lark SDK 的错误码和常量定义
 */

/**
 * 飞书 API 错误码
 * 参考: https://open.feishu.cn/document/ukTMukTMukTM/ugjM14COyUjL4ITN
 */
export enum FeishuErrorCode {
  SUCCESS = 0, // 成功
  INVALID_PARAM = 1, // 参数错误
  UNAUTHORIZED = 99991663, // 认证失败
  PERMISSION_DENIED = 99991664, // 权限不足
  RATE_LIMIT_EXCEEDED = 99991400, // 请求频率超限
  TENANT_ACCESS_TOKEN_INVALID = 99991672, // tenant_access_token 无效
  APP_ID_INVALID = 10013, // app_id 无效
  APP_SECRET_INVALID = 10014, // app_secret 无效
}

/**
 * 飞书 API 错误信息映射
 */
export const FEISHU_ERROR_MESSAGES: { [code: number]: string } = {
  [FeishuErrorCode.SUCCESS]: '成功',
  [FeishuErrorCode.INVALID_PARAM]: '参数错误',
  [FeishuErrorCode.UNAUTHORIZED]: '认证失败，请检查 App ID 和 App Secret',
  [FeishuErrorCode.PERMISSION_DENIED]: '权限不足，请检查应用权限配置',
  [FeishuErrorCode.RATE_LIMIT_EXCEEDED]: '请求频率超限，请稍后重试',
  [FeishuErrorCode.TENANT_ACCESS_TOKEN_INVALID]: 'Access Token 无效或已过期',
  [FeishuErrorCode.APP_ID_INVALID]: 'App ID 无效',
  [FeishuErrorCode.APP_SECRET_INVALID]: 'App Secret 无效',
};

/**
 * 用户 ID 类型
 * 参考 SDK 的 UserIdType
 */
export enum FeishuUserIdType {
  OPEN_ID = 'open_id', // 开放平台用户 ID（推荐）
  UNION_ID = 'union_id', // 统一用户 ID
  USER_ID = 'user_id', // 企业内用户 ID
}

/**
 * 任务状态
 */
export enum FeishuTaskStatus {
  TODO = 'todo', // 待办
  IN_PROGRESS = 'in_progress', // 进行中
  COMPLETED = 'completed', // 已完成
}

/**
 * API 版本
 */
export const FEISHU_API_VERSION = 'v2';

/**
 * 默认配置
 */
export const FEISHU_API_DEFAULTS = {
  PAGE_SIZE: 50, // 默认分页大小
  MAX_PAGE_SIZE: 100, // 最大分页大小
  TOKEN_EXPIRE_BUFFER: 5 * 60 * 1000, // Token 提前刷新时间（5分钟）
  DEFAULT_TOKEN_EXPIRE: 7200, // 默认 Token 过期时间（2小时）
  MAX_PAGES: 10, // 最大分页数
  REQUEST_TIMEOUT: 30000, // 请求超时时间（30秒）
} as const;

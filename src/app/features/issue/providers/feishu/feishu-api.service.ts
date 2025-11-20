import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, ObservableInput, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { FeishuCfg } from './feishu.model';
import {
  FeishuApiResponse,
  FeishuIssue,
  FeishuOriginalTask,
  FeishuTaskResponse,
  FeishuTasksResponse,
  FeishuTenantAccessTokenResponse,
} from './feishu-issue.model';
import { SnackService } from '../../../../core/snack/snack.service';
import { FEISHU_API_BASE_URL } from './feishu.const';
import {
  FEISHU_ERROR_MESSAGES,
  FeishuErrorCode,
  FEISHU_API_DEFAULTS,
  FeishuUserIdType,
} from './feishu-api-constants';
import { HANDLED_ERROR_PROP_STR } from '../../../../app.constants';
import { T } from '../../../../t.const';
import { throwHandledError } from '../../../../util/throw-handled-error';
import { ISSUE_PROVIDER_HUMANIZED } from '../../issue.const';
import { IssueLog } from '../../../../core/log';

@Injectable({
  providedIn: 'root',
})
export class FeishuApiService {
  private _snackService = inject(SnackService);
  private _http = inject(HttpClient);

  private _tenantAccessTokenCache: {
    [key: string]: { token: string; expiresAt: number };
  } = {};

  /**
   * 获取租户访问令牌
   * 参考 Lark SDK: lark.core.getInternalTenantAccessToken
   * API: POST /auth/v3/tenant_access_token/internal
   */
  getTenantAccessToken$(cfg: FeishuCfg): Observable<string> {
    this._checkSettings(cfg);

    const cacheKey = `${cfg.appId}`;
    const cached = this._tenantAccessTokenCache[cacheKey];

    // 检查缓存是否有效（提前刷新，与 SDK 保持一致）
    if (
      cached &&
      cached.expiresAt > Date.now() + FEISHU_API_DEFAULTS.TOKEN_EXPIRE_BUFFER
    ) {
      return of(cached.token);
    }

    const url = `${FEISHU_API_BASE_URL}/auth/v3/tenant_access_token/internal`;
    const body = {
      app_id: cfg.appId,
      app_secret: cfg.appSecret,
    };

    const headers = new HttpHeaders({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/json; charset=utf-8',
    });

    return this._http.post<FeishuTenantAccessTokenResponse>(url, body, { headers }).pipe(
      map((res) => {
        // 参考 SDK：先检查错误码
        if (res.code !== undefined && res.code !== FeishuErrorCode.SUCCESS) {
          const errorMsg =
            FEISHU_ERROR_MESSAGES[res.code] ||
            res.msg ||
            'Failed to get tenant access token';
          throw new Error(`[${res.code}] ${errorMsg}`);
        }

        if (!res.tenant_access_token) {
          throw new Error('Failed to get tenant access token');
        }

        // 缓存token（默认 7200 秒，即 2 小时，与 SDK 保持一致）
        const expireSeconds = res.expire || FEISHU_API_DEFAULTS.DEFAULT_TOKEN_EXPIRE;
        // eslint-disable-next-line no-mixed-operators
        const expiresAt = Date.now() + expireSeconds * 1000;
        this._tenantAccessTokenCache[cacheKey] = {
          token: res.tenant_access_token,
          expiresAt,
        };

        IssueLog.log('Feishu: Successfully obtained tenant access token');
        return res.tenant_access_token;
      }),
      catchError((err) => this._handleRequestError$(err, cfg)),
    );
  }

  /**
   * 获取任务列表
   * 参考 Lark SDK: lark.task.v2.task.list
   * API: GET /task/v2/tasks
   *
   * @param cfg 配置
   * @param pageToken 分页标记
   * @param pageSize 分页大小（默认 50，最大 100）
   */
  getTasks$(
    cfg: FeishuCfg,
    pageToken?: string,
    pageSize: number = 50,
  ): Observable<FeishuTasksResponse> {
    return this.getTenantAccessToken$(cfg).pipe(
      switchMap((token) => {
        // 构建查询参数（参考 SDK 的参数处理）
        const params: { [key: string]: string } = {
          page_size: Math.min(pageSize, FEISHU_API_DEFAULTS.MAX_PAGE_SIZE).toString(),
        };

        if (pageToken) {
          params.page_token = pageToken;
        }

        // 用户 ID 类型和用户 ID（参考 SDK 的 user_id_type 参数）
        if (cfg.filterUserId) {
          params.user_id_type = FeishuUserIdType.OPEN_ID; // 推荐使用 open_id
          params.user_id = cfg.filterUserId;
        }

        // 任务列表过滤（多个用逗号分隔）
        if (cfg.filterTasklistIds && cfg.filterTasklistIds.length > 0) {
          params.tasklist_guids = cfg.filterTasklistIds.join(',');
        }

        // 构建 URL
        const queryString = Object.keys(params)
          .map((key) => `${key}=${encodeURIComponent(params[key])}`)
          .join('&');
        const url = `${FEISHU_API_BASE_URL}/task/v2/tasks?${queryString}`;

        // 设置请求头（参考 SDK 的标准请求头）
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Type': 'application/json; charset=utf-8',
        });

        return this._http
          .get<FeishuApiResponse<FeishuTasksResponse>>(url, { headers })
          .pipe(
            map((res) => {
              // 参考 SDK 的错误码处理
              if (res.code !== FeishuErrorCode.SUCCESS) {
                const errorMsg =
                  FEISHU_ERROR_MESSAGES[res.code] || res.msg || 'Failed to get tasks';
                throw new Error(`[${res.code}] ${errorMsg}`);
              }
              return res.data || { items: [], has_more: false };
            }),
            catchError((err) => this._handleRequestError$(err, cfg)),
          );
      }),
    );
  }

  /**
   * 根据GUID获取单个任务
   * 参考 Lark SDK: lark.task.v2.task.get
   * API: GET /task/v2/tasks/:task_guid
   *
   * @param guid 任务的全局唯一ID
   * @param cfg 配置
   */
  getTaskByGuid$(guid: string, cfg: FeishuCfg): Observable<FeishuIssue> {
    return this.getTenantAccessToken$(cfg).pipe(
      switchMap((token) => {
        // 参考 SDK：支持 user_id_type 参数
        const url = `${FEISHU_API_BASE_URL}/task/v2/tasks/${encodeURIComponent(guid)}?user_id_type=${FeishuUserIdType.OPEN_ID}`;

        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Type': 'application/json; charset=utf-8',
        });

        return this._http
          .get<FeishuApiResponse<FeishuTaskResponse>>(url, { headers })
          .pipe(
            map((res) => {
              // 参考 SDK 的错误码处理
              if (res.code !== FeishuErrorCode.SUCCESS || !res.data?.task) {
                const errorMsg =
                  FEISHU_ERROR_MESSAGES[res.code] || res.msg || 'Failed to get task';
                throw new Error(`[${res.code}] ${errorMsg}`);
              }
              return this._mapToFeishuIssue(res.data.task);
            }),
            catchError((err) => this._handleRequestError$(err, cfg)),
          );
      }),
    );
  }

  /**
   * 搜索任务
   * 注意：飞书 API 暂不提供搜索接口（与 SDK 保持一致）
   * 实现方式：获取所有任务后本地过滤
   *
   * @param searchTerm 搜索关键词
   * @param cfg 配置
   */
  searchTasks$(searchTerm: string, cfg: FeishuCfg): Observable<FeishuIssue[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return of([]);
    }

    // 参考 SDK 实现：先获取所有任务，然后本地过滤
    return this._getAllTasks$(cfg).pipe(
      map((tasks) => {
        const term = searchTerm.toLowerCase().trim();
        return tasks.filter(
          (task) =>
            task.summary.toLowerCase().includes(term) ||
            (task.description && task.description.toLowerCase().includes(term)) ||
            // 额外支持任务 GUID 搜索
            task.guid.toLowerCase().includes(term),
        );
      }),
    );
  }

  /**
   * 获取所有任务（处理分页）
   * 参考 SDK 的分页处理逻辑
   *
   * @param cfg 配置
   * @param maxPages 最大分页数（防止数据量过大），默认 10 页
   */
  private _getAllTasks$(
    cfg: FeishuCfg,
    maxPages: number = FEISHU_API_DEFAULTS.MAX_PAGES,
  ): Observable<FeishuIssue[]> {
    let currentPage = 0;

    const fetchPage = (pageToken?: string): Observable<FeishuIssue[]> => {
      // 防止无限递归
      if (currentPage >= maxPages) {
        IssueLog.warn(
          `Feishu: Reached max pages limit (${maxPages}), stopping pagination`,
        );
        return of([]);
      }

      currentPage++;

      return this.getTasks$(cfg, pageToken, FEISHU_API_DEFAULTS.MAX_PAGE_SIZE).pipe(
        // 使用最大页大小 100 以减少请求次数
        switchMap((response) => {
          const currentPageTasks = (response.items || []).map((task) =>
            this._mapToFeishuIssue(task),
          );

          // 参考 SDK：检查 has_more 和 page_token
          if (response.has_more && response.page_token) {
            // 递归获取下一页
            return fetchPage(response.page_token).pipe(
              map((nextPageTasks) => [...currentPageTasks, ...nextPageTasks]),
            );
          }

          return of(currentPageTasks);
        }),
        catchError((err) => {
          IssueLog.err('Feishu: Error fetching page', err);
          // 即使某一页失败，也返回已获取的任务
          return of([]);
        }),
      );
    };

    return fetchPage();
  }

  /**
   * 测试连接
   * 参考 SDK：验证凭证 + 测试 API 调用
   *
   * @param cfg 配置
   */
  testConnection$(cfg: FeishuCfg): Observable<boolean> {
    // 步骤1: 验证配置
    try {
      this._checkSettings(cfg);
    } catch (err) {
      return of(false);
    }

    // 步骤2: 获取 token（验证凭证）
    return this.getTenantAccessToken$(cfg).pipe(
      // 步骤3: 尝试获取任务列表（验证权限）
      switchMap(() => this.getTasks$(cfg, undefined, 1)),
      map(() => {
        IssueLog.log('Feishu: Connection test successful');
        return true;
      }),
      catchError((err) => {
        IssueLog.warn('Feishu: Connection test failed', err);
        return of(false);
      }),
    );
  }

  /**
   * 更新任务
   * 参考 Lark SDK: lark.task.v2.task.patch
   * API: PATCH /task/v2/tasks/:task_guid
   *
   * @param guid 任务 GUID
   * @param updates 要更新的字段
   * @param cfg 配置
   */
  updateTask$(
    guid: string,
    updates: Partial<{
      summary: string;
      description: string;
      due: { timestamp: string; is_all_day?: boolean };
      extra: string;
    }>,
    cfg: FeishuCfg,
  ): Observable<FeishuIssue> {
    return this.getTenantAccessToken$(cfg).pipe(
      switchMap((token) => {
        const url = `${FEISHU_API_BASE_URL}/task/v2/tasks/${encodeURIComponent(guid)}?user_id_type=${FeishuUserIdType.OPEN_ID}`;

        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Type': 'application/json; charset=utf-8',
        });

        // 构建更新数据（参考 SDK 的 patch 实现）
        const body: any = {
          task: updates,
        };

        return this._http
          .patch<FeishuApiResponse<FeishuTaskResponse>>(url, body, { headers })
          .pipe(
            map((res) => {
              if (res.code !== FeishuErrorCode.SUCCESS || !res.data?.task) {
                const errorMsg =
                  FEISHU_ERROR_MESSAGES[res.code] || res.msg || 'Failed to update task';
                throw new Error(`[${res.code}] ${errorMsg}`);
              }
              return this._mapToFeishuIssue(res.data.task);
            }),
            catchError((err) => this._handleRequestError$(err, cfg)),
          );
      }),
    );
  }

  /**
   * 完成任务
   * 参考 Lark SDK: lark.task.v2.task.complete
   * API: POST /task/v2/tasks/:task_guid/complete
   *
   * @param guid 任务 GUID
   * @param cfg 配置
   */
  completeTask$(guid: string, cfg: FeishuCfg): Observable<FeishuIssue> {
    return this.getTenantAccessToken$(cfg).pipe(
      switchMap((token) => {
        const url = `${FEISHU_API_BASE_URL}/task/v2/tasks/${encodeURIComponent(guid)}/complete?user_id_type=${FeishuUserIdType.OPEN_ID}`;

        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Type': 'application/json; charset=utf-8',
        });

        // 参考 SDK：complete 接口通常不需要 body，或者发送空对象
        return this._http
          .post<FeishuApiResponse<FeishuTaskResponse>>(url, {}, { headers })
          .pipe(
            map((res) => {
              if (res.code !== FeishuErrorCode.SUCCESS || !res.data?.task) {
                const errorMsg =
                  FEISHU_ERROR_MESSAGES[res.code] || res.msg || 'Failed to complete task';
                throw new Error(`[${res.code}] ${errorMsg}`);
              }
              return this._mapToFeishuIssue(res.data.task);
            }),
            catchError((err) => this._handleRequestError$(err, cfg)),
          );
      }),
    );
  }

  /**
   * 取消完成任务
   * 参考 Lark SDK: lark.task.v2.task.uncomplete
   * API: POST /task/v2/tasks/:task_guid/uncomplete
   *
   * @param guid 任务 GUID
   * @param cfg 配置
   */
  uncompleteTask$(guid: string, cfg: FeishuCfg): Observable<FeishuIssue> {
    return this.getTenantAccessToken$(cfg).pipe(
      switchMap((token) => {
        const url = `${FEISHU_API_BASE_URL}/task/v2/tasks/${encodeURIComponent(guid)}/uncomplete?user_id_type=${FeishuUserIdType.OPEN_ID}`;

        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Type': 'application/json; charset=utf-8',
        });

        return this._http
          .post<FeishuApiResponse<FeishuTaskResponse>>(url, {}, { headers })
          .pipe(
            map((res) => {
              if (res.code !== FeishuErrorCode.SUCCESS || !res.data?.task) {
                const errorMsg =
                  FEISHU_ERROR_MESSAGES[res.code] ||
                  res.msg ||
                  'Failed to uncomplete task';
                throw new Error(`[${res.code}] ${errorMsg}`);
              }
              return this._mapToFeishuIssue(res.data.task);
            }),
            catchError((err) => this._handleRequestError$(err, cfg)),
          );
      }),
    );
  }

  /**
   * 创建任务评论
   * 参考 Lark SDK: lark.task.v2.comment.create
   * API: POST /task/v2/comments
   *
   * @param taskGuid 任务 GUID
   * @param content 评论内容（富文本）
   * @param cfg 配置
   */
  createComment$(
    taskGuid: string,
    content: string,
    cfg: FeishuCfg,
  ): Observable<{ comment_id: string }> {
    return this.getTenantAccessToken$(cfg).pipe(
      switchMap((token) => {
        const url = `${FEISHU_API_BASE_URL}/task/v2/comments?user_id_type=${FeishuUserIdType.OPEN_ID}`;

        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Type': 'application/json; charset=utf-8',
        });

        // 参考 SDK：评论内容需要是富文本格式
        const body = {
          content,
          parent_id: taskGuid, // 任务 GUID 作为父 ID
          reply_to_comment_id: undefined, // 如果是回复评论，填写被回复的评论 ID
        };

        return this._http
          .post<FeishuApiResponse<{ comment_id: string }>>(url, body, { headers })
          .pipe(
            map((res) => {
              if (res.code !== FeishuErrorCode.SUCCESS || !res.data) {
                const errorMsg =
                  FEISHU_ERROR_MESSAGES[res.code] ||
                  res.msg ||
                  'Failed to create comment';
                throw new Error(`[${res.code}] ${errorMsg}`);
              }
              return res.data;
            }),
            catchError((err) => this._handleRequestError$(err, cfg)),
          );
      }),
    );
  }

  /**
   * 映射原始任务数据到FeishuIssue
   */
  private _mapToFeishuIssue(task: FeishuOriginalTask): FeishuIssue {
    return {
      id: task.guid, // for consistency with other providers
      guid: task.guid,
      summary: task.summary,
      description: task.description,
      due: task.due,
      creator: task.creator,
      members: task.members,
      completed_at: task.completed_at,
      created_at: task.created_at,
      updated_at: task.updated_at,
      status: task.status,
      extra: task.extra,
      tasklists: task.tasklists,
      custom_fields: task.custom_fields,
      subtask_count: task.task_count_info?.subtask_count || 0,
      url: task.url || `https://applink.feishu.cn/client/todo/detail?guid=${task.guid}`,
    };
  }

  /**
   * 检查配置
   */
  private _checkSettings(cfg: FeishuCfg): void {
    if (!cfg.appId) {
      this._snackService.open({
        type: 'ERROR',
        msg: T.F.FEISHU.S.MISSING_APP_ID,
      });
      throwHandledError('Feishu: Missing App ID');
    }
    if (!cfg.appSecret) {
      this._snackService.open({
        type: 'ERROR',
        msg: T.F.FEISHU.S.MISSING_APP_SECRET,
      });
      throwHandledError('Feishu: Missing App Secret');
    }
  }

  /**
   * 错误处理
   * 参考 SDK 的错误处理和分类
   */
  private _handleRequestError$(
    err: HttpErrorResponse | Error | unknown,
    cfg: FeishuCfg,
  ): ObservableInput<any> {
    const errStr = `${ISSUE_PROVIDER_HUMANIZED.FEISHU || 'Feishu'}: ${err}`;
    IssueLog.err(errStr, err);

    let errorMsg = T.F.FEISHU.S.UNKNOWN_ERROR;

    // HTTP 状态码错误（参考 SDK 的 HTTP 错误处理）
    if (err instanceof HttpErrorResponse) {
      switch (err.status) {
        case 400:
          errorMsg = T.F.FEISHU.S.GENERAL_ERROR;
          break;
        case 401:
        case 403:
          errorMsg = T.F.FEISHU.S.AUTH_ERROR;
          // 清除缓存的 token
          const cacheKey = `${cfg.appId}`;
          delete this._tenantAccessTokenCache[cacheKey];
          break;
        case 429:
          errorMsg = 'Feishu: 请求频率超限，请稍后重试';
          break;
        case 500:
        case 502:
        case 503:
          errorMsg = 'Feishu: 服务器错误，请稍后重试';
          break;
        default:
          errorMsg = `Feishu: HTTP ${err.status} 错误`;
      }

      // 尝试解析飞书 API 错误码（参考 SDK 的错误响应处理）
      if (err.error?.code) {
        const feishuErrorMsg = FEISHU_ERROR_MESSAGES[err.error.code];
        if (feishuErrorMsg) {
          errorMsg = `Feishu [${err.error.code}]: ${feishuErrorMsg}`;
        }
      }
    } else if (err instanceof Error) {
      // 业务错误（如错误码非 0）
      if (err.message.startsWith('[')) {
        // 已包含错误码的错误
        errorMsg = `Feishu: ${err.message}`;
      } else {
        errorMsg = T.F.FEISHU.S.GENERAL_ERROR;
      }
    }

    this._snackService.open({
      type: 'ERROR',
      msg: errorMsg,
    });

    return throwError(() => ({
      [HANDLED_ERROR_PROP_STR]: 'Feishu Error',
      err,
      errorMsg,
    }));
  }
}

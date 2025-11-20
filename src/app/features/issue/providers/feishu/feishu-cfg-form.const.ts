import {
  ConfigFormSection,
  LimitedFormlyFieldConfig,
} from '../../../config/global-config.model';
import { T } from '../../../../t.const';
import { FeishuCfg } from './feishu.model';

export const DEFAULT_FEISHU_CFG: FeishuCfg = {
  isEnabled: false,
  appId: null,
  appSecret: null,
  isSearchIssuesFromApi: true,
  isAutoPoll: false,
  isAutoAddToBacklog: false,
  filterUserId: null,
  filterTasklistIds: null,
  isTwoWaySync: false,
  isSyncTaskStatus: true,
  isSyncTaskContent: true,
  isSyncComments: false,
};

export const FEISHU_CONFIG_FORM: LimitedFormlyFieldConfig<FeishuCfg>[] = [
  {
    key: 'appId',
    type: 'input',
    templateOptions: {
      label: T.F.FEISHU.FORM.APP_ID,
      type: 'text',
      required: true,
    },
  },
  {
    key: 'appSecret',
    type: 'input',
    templateOptions: {
      label: T.F.FEISHU.FORM.APP_SECRET,
      type: 'password',
      required: true,
    },
  },
  {
    key: 'isSearchIssuesFromApi',
    type: 'checkbox',
    defaultValue: true,
    templateOptions: {
      label: T.F.FEISHU.FORM.IS_SEARCH_ISSUES_FROM_API,
    },
  },
  {
    key: 'isAutoPoll',
    type: 'checkbox',
    defaultValue: false,
    templateOptions: {
      label: T.F.FEISHU.FORM.IS_AUTO_POLL,
    },
  },
  {
    key: 'isAutoAddToBacklog',
    type: 'checkbox',
    defaultValue: false,
    templateOptions: {
      label: T.F.FEISHU.FORM.IS_AUTO_ADD_TO_BACKLOG,
    },
  },
  {
    key: 'filterUserId',
    type: 'input',
    templateOptions: {
      label: T.F.FEISHU.FORM.FILTER_USER_ID,
      type: 'text',
      description: T.F.FEISHU.FORM.FILTER_USER_ID_DESCRIPTION,
    },
  },
  {
    key: 'filterTasklistIds',
    type: 'input',
    templateOptions: {
      label: T.F.FEISHU.FORM.FILTER_TASKLIST_IDS,
      type: 'text',
      description: T.F.FEISHU.FORM.FILTER_TASKLIST_IDS_DESCRIPTION,
    },
  },
  {
    key: 'isTwoWaySync',
    type: 'checkbox',
    defaultValue: false,
    templateOptions: {
      label: T.F.FEISHU.FORM.IS_TWO_WAY_SYNC,
      description: T.F.FEISHU.FORM.IS_TWO_WAY_SYNC_DESCRIPTION,
    },
  },
  {
    key: 'isSyncTaskStatus',
    type: 'checkbox',
    defaultValue: true,
    templateOptions: {
      label: T.F.FEISHU.FORM.IS_SYNC_TASK_STATUS,
    },
    hideExpression: (model) => !model.isTwoWaySync,
  },
  {
    key: 'isSyncTaskContent',
    type: 'checkbox',
    defaultValue: true,
    templateOptions: {
      label: T.F.FEISHU.FORM.IS_SYNC_TASK_CONTENT,
    },
    hideExpression: (model) => !model.isTwoWaySync,
  },
  {
    key: 'isSyncComments',
    type: 'checkbox',
    defaultValue: false,
    templateOptions: {
      label: T.F.FEISHU.FORM.IS_SYNC_COMMENTS,
      description: T.F.FEISHU.FORM.IS_SYNC_COMMENTS_DESCRIPTION,
    },
    hideExpression: (model) => !model.isTwoWaySync,
  },
];

export const FEISHU_CONFIG_FORM_SECTION: ConfigFormSection<FeishuCfg> = {
  title: 'Feishu / Lark',
  key: 'FEISHU',
  items: FEISHU_CONFIG_FORM,
  help: T.F.FEISHU.FORM_SECTION.HELP,
};

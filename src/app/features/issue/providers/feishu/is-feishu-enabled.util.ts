import { FeishuCfg } from './feishu.model';

export const isFeishuEnabled = (cfg: FeishuCfg): boolean => {
  return !!(cfg && cfg.isEnabled && cfg.appId && cfg.appSecret);
};

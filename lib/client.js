window.__ModuleLoader__.load({
  id: '@goodandready/dsh-gitea',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')

    const NS = 'dsh-gitea'
    const css =
      '.dgt-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none}' +
      '.dgt-head{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}' +
      '.dgt-title{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}' +
      '.dgt-sub{color:var(--dsw-alias-label-secondary);font-size:13px}' +
      '.dgt-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}' +
      '.dgt-field{display:flex;flex-direction:column;gap:6px;padding:12px 0}' +
      '.dgt-input{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;box-sizing:border-box;width:100%}' +
      '.dgt-foot{border-top:1px solid var(--dsw-alias-border-l2);display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px}' +
      '.dgt-save{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}' +
      '.dgt-cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}' +
      '.dgt-headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}' +
      '.dgt-chevron{color:var(--dsw-alias-label-secondary);flex:none;transition:transform .16s}' +
      '.dgt-chevronOpen{transform:rotate(180deg)}' +
      '.dgt-pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}' +
      '.dgt-failed{min-width:0;color:var(--dsw-alias-label-error);flex:1;margin:0;font-size:12px;line-height:1.5}' +
      '.dgt-discard{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 14px;font-size:13px;color:var(--dsw-alias-label-secondary);background:transparent}' +
      '.dgt-discard:disabled,.dgt-save:disabled{opacity:.4;cursor:default}' +
      '.dgt-fieldHead{align-items:center;gap:8px;display:flex}' +
      '.dgt-label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}' +
      '.dgt-hint{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:1.5}' +
      '.dgt-badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}' +
      '.dgt-badgeOn{color:var(--dsw-alias-state-success-primary)}' +
      '.dgt-git-wrap{position:relative;display:flex;align-items:center}' +
      '.dgt-git-chip{font-size:11px;line-height:1;padding:4px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dgt-git-dirty{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary)}' +
      '.dgt-git-muted{color:var(--dsw-alias-label-secondary)}' +
      '.dgt-git-panel{position:absolute;top:calc(100% + 8px);right:0;z-index:40;width:min(360px,78vw);max-height:min(420px,60vh);overflow:auto;padding:12px 14px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);box-shadow:0 8px 24px rgba(0,0,0,.18)}' +
      '.dgt-git-kicker{margin:0 0 8px;font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary)}' +
      '.dgt-git-empty{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-primary)}' +
      '.dgt-git-repo{font-size:13px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}' +
      '.dgt-git-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:4px 0 10px}' +
      '.dgt-git-branch{min-width:0;font-size:12px;color:var(--dsw-alias-label-primary)}' +
      '.dgt-git-state{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}' +
      '.dgt-git-stateDirty{color:var(--dsw-alias-state-warning-primary)}' +
      '.dgt-git-h{font-size:11px;font-weight:500;color:var(--dsw-alias-label-secondary);margin:10px 0 4px}' +
      '.dgt-git-pre{font-size:11px;line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0;padding:8px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}' +
      '.dgt-git-badge{font-size:10px;line-height:1;padding:1px 5px;border-radius:4px;font-weight:600;margin-left:4px;display:inline-block}' +
      '.dgt-git-ahead{background:rgba(34,197,94,.15);color:#22c55e}' +
      '.dgt-git-behind{background:rgba(234,179,8,.15);color:#eab308}' +
      '.dgt-btn-graph{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:6px 12px;font-size:12px;font-weight:500;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;width:100%;justify-content:center}' +
      '.dgt-btn-graph:hover{background:var(--dsw-alias-bg-layer-3)}' +
      '.dgt-backdrop{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.5);backdrop-filter:blur(2px)}' +
      '.dgt-graph-dialog{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000;width:min(780px,92vw);max-height:85vh;display:flex;flex-direction:column;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);box-shadow:0 12px 36px rgba(0,0,0,.3);overflow:hidden}' +
      '.dgt-graph-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2)}' +
      '.dgt-graph-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);margin:0}' +
      '.dgt-graph-close{appearance:none;background:0 0;border:0;cursor:pointer;font-size:16px;color:var(--dsw-alias-label-secondary);padding:4px 8px;border-radius:6px}' +
      '.dgt-graph-close:hover{color:var(--dsw-alias-label-primary)}' +
      '.dgt-graph-body{overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:4px}' +
      '.dgt-graph-row{display:flex;align-items:baseline;gap:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.4;padding:3px 0}' +
      '.dgt-graph-lanes{flex:none;white-space:pre;letter-spacing:1px;font-size:13px}' +
      '.dgt-graph-node{color:#22c55e;font-weight:700}' +
      '.dgt-graph-merge{color:#a855f7;font-weight:700}' +
      '.dgt-graph-pass{color:var(--dsw-alias-border-l1)}' +
      '.dgt-graph-gap{color:transparent}' +
      '.dgt-graph-oid{flex:none;color:var(--dsw-alias-label-secondary);text-decoration:none;font-weight:600;font-size:11px}' +
      '.dgt-graph-oid:hover{color:var(--dsw-alias-label-primary);text-decoration:underline}' +
      '.dgt-graph-main{flex:1;min-width:0;display:flex;flex-direction:column}' +
      '.dgt-graph-subject{color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dgt-graph-meta{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px}' +
      '.dgt-graph-ref{padding:0 5px;border-radius:4px;font-size:10px;font-weight:600;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}' +
      '.dgt-graph-refCurrent{border-color:#22c55e;color:#22c55e}' +
      '.dgt-graph-ci{font-size:10px;padding:0 4px;border-radius:4px;font-weight:600}' +
      '.dgt-graph-ci-success{background:rgba(34,197,94,.15);color:#22c55e}' +
      '.dgt-graph-ci-failure{background:rgba(239,68,68,.15);color:#ef4444}' +
      '.dgt-graph-ci-pending{background:rgba(234,179,8,.15);color:#eab308}' +
      '.dgt-graph-more{appearance:none;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:6px 12px;font-size:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);margin:8px auto;display:block}' +
      '.dgt-sectionTitle{margin:16px 0 8px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);border-bottom:1px solid var(--dsw-alias-border-l2);padding-bottom:4px}' +
      '.dgt-checkRow{display:flex;align-items:flex-start;gap:10px;padding:8px 0;cursor:pointer}' +
      '.dgt-checkbox{width:16px;height:16px;margin-top:2px;accent-color:var(--dsw-alias-label-primary);cursor:pointer;flex:none}' +
      '.dgt-checkLabelWrap{display:flex;flex-direction:column;gap:2px}' +
      '.dgt-advancedToggle{appearance:none;background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 12px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;gap:6px;margin:12px 0 4px}' +
      '.dgt-advancedToggle:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}' +
      '.dgt-advancedPanel{border-top:1px dashed var(--dsw-alias-border-l2);margin-top:10px;padding-top:6px}' +
      '.dgt-instanceRow{padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;margin-bottom:6px;font-size:12px;background:var(--dsw-alias-bg-layer-2);display:flex;justify-content:space-between;align-items:center}' +
      '.dgt-graph-more:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.dgt-badgeOk{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:rgba(16,185,129,0.08)}' +
      '.dgt-badgeWarn{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary);background:rgba(245,158,11,0.08)}' +
      '.dgt-badgeBad{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:rgba(239,68,68,0.08)}' +
      '.dgt-badgesRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px}' +
      '.dgt-drawer-backdrop{position:fixed;inset:0;z-index:998;background:rgba(0,0,0,.35);backdrop-filter:blur(2px);transition:opacity .2s ease}' +
      '.dgt-drawer{position:fixed;top:0;right:0;bottom:0;width:min(440px,94vw);z-index:999;background:var(--dsw-alias-bg-base);border-left:1px solid var(--dsw-alias-border-l1);box-shadow:-8px 0 32px rgba(0,0,0,.22);display:flex;flex-direction:column;animation:dgtSlideIn .2s cubic-bezier(0.16,1,0.3,1);box-sizing:border-box}' +
      '@keyframes dgtSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}' +
      '.dgt-drawer-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}' +
      '.dgt-drawer-title-wrap{display:flex;align-items:center;gap:8px;min-width:0}' +
      '.dgt-drawer-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dgt-drawer-branch-badge{font-size:11px;padding:2px 7px;border-radius:6px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-family:ui-monospace,monospace;display:inline-flex;align-items:center;gap:4px}' +
      '.dgt-drawer-actions{display:flex;align-items:center;gap:6px;flex:none}' +
      '.dgt-drawer-btn{appearance:none;background:transparent;border:1px solid transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);border-radius:6px;padding:4px 8px;font-size:14px;display:inline-flex;align-items:center;justify-content:center;transition:all .15s}' +
      '.dgt-drawer-btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}' +
      '.dgt-drawer-btn-spin{animation:dgtSpin .8s linear infinite}' +
      '@keyframes dgtSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
      '.dgt-drawer-btn-close{font-size:18px;line-height:1;padding:2px 8px}' +
      '.dgt-drawer-tabs{display:flex;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);padding:0 8px}' +
      '.dgt-drawer-tab{appearance:none;background:transparent;border:0;border-bottom:2px solid transparent;cursor:pointer;padding:10px 14px;font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;gap:6px;transition:all .15s}' +
      '.dgt-drawer-tab:hover{color:var(--dsw-alias-label-primary)}' +
      '.dgt-drawer-tabActive{color:var(--dsw-alias-state-success-primary);border-bottom-color:var(--dsw-alias-state-success-primary);font-weight:600}' +
      '.dgt-drawer-tab-badge{font-size:10px;padding:1px 5px;border-radius:999px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary)}' +
      '.dgt-drawer-tab-badgeAlert{background:rgba(234,179,8,.18);color:#eab308;font-weight:700}' +
      '.dgt-drawer-body{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px}' +
      '.dgt-drawer-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}' +
      '.dgt-drawer-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px}' +
      '.dgt-drawer-dim{font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dgt-drawer-val{font-size:12px;color:var(--dsw-alias-label-primary);font-weight:500}' +
      '.dgt-drawer-sec-h{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--dsw-alias-label-tertiary)}' +
      '.dgt-drawer-clean-box{display:flex;align-items:center;gap:8px;padding:10px 0}' +
      '.dgt-drawer-empty{padding:32px 0;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px}'

    const cssId = 'dsh-gitea/PluginCard.module.css'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-dsh-plugin="' + NS + '"]')) {
      const tag = document.createElement('style')
      tag.textContent = css
      tag.setAttribute('data-plugin', 'dsh-gitea')
      tag.dataset.dshPlugin = NS
      tag.dataset.pluginCss = cssId
      document.head.appendChild(tag)
    }

    function getService(c, name) {
      if (!c) return undefined
      if (typeof c.get === 'function') {
        try { return c.get(name) } catch { /* ignore */ }
      }
      return c[name]
    }

    const en = {
      title: 'Gitea',
      description: 'Gitea or Forgejo tools and credentials.',
      intro: 'Create a DSH credential, paste the API token there, then type only the credential name below (for example GITEA_TOKEN). Never paste the token into this form.',
      baseUrl: 'Instance URL',
      baseUrlHint: 'e.g. https://gitea.example.com',
      tokenEnv: 'Credential name',
      tokenEnvHint: 'Name of the DSH credential, not the token itself. Default GITEA_TOKEN.',
      tokenOn: 'Token configured',
      tokenOff: 'Token not configured',
      save: 'Save',
      saving: 'Saving\u2026',
      discard: 'Discard',
      unsaved: 'Unsaved',
      saveFailed: 'Save failed',
      loading: 'Loading\u2026',
      settingsUnavailable: 'Settings unavailable (namespace not registered).',
      expand: 'Expand',
      collapse: 'Collapse',
      sectionInstance: 'Connection & Core Settings',
      sectionDefaults: 'Defaults & Git Worktrees',
      sectionWebhooks: 'Webhooks & Notifications',
      sectionScheduler: 'Background Triage Scheduler',
      sectionInstances: 'Additional Instances',
      toggleAdvanced: 'Advanced settings',
      defaultOwner: 'Default organization or user',
      defaultOwnerHint: 'Fallback repository owner when tool calls omit owner/repo.',
      defaultRepo: 'Default repository',
      defaultRepoHint: 'Fallback repository name when tool calls omit owner/repo.',
      gitWrapper: 'Git wrapper binary',
      gitWrapperHint: 'Command wrapper for git write ops (e.g. git-deepseek-harness). Empty disables worktrees.',
      dodReminder: 'Definition of Done reminder',
      dodReminderHint: 'Remind if a tool changed git files without referencing an issue or PR. Never blocks.',
      forceHttpsUrls: 'Force HTTPS URLs in links',
      forceHttpsUrlsHint: 'Rewrite html_url from http:// to https:// behind reverse proxy.',
      timeoutMs: 'HTTP timeout (ms)',
      timeoutMsHint: 'Request timeout for Gitea API calls in milliseconds (default 30000).',
      webhookSecretEnv: 'Webhook secret credential',
      webhookSecretEnvHint: 'DSH credential holding secret to verify X-Gitea-Signature on POST /dsh-gitea/webhook.',
      notifyWebhook: 'Push notification webhook URL',
      notifyWebhookHint: 'External webhook URL for PR and CI failure alerts. Empty disables push.',
      bgSchedulerEnabled: 'Enable background scheduler',
      bgSchedulerEnabledHint: 'Periodically run triage/health checks and compile digest events.',
      bgSchedulerIntervalMin: 'Scheduler interval (minutes)',
      bgSchedulerIntervalMinHint: 'Interval between background triage checks (default 60).',
      bgSchedulerOwner: 'Scheduler target owner',
      bgSchedulerOwnerHint: 'Owner for background triage (defaults to default owner if empty).',
      bgSchedulerRepo: 'Scheduler target repo',
      bgSchedulerRepoHint: 'Repository for background triage (defaults to default repo if empty).',
      bgSchedulerWebhook: 'Scheduler digest webhook URL',
      bgSchedulerWebhookHint: 'Optional webhook URL to deliver triage digests to external channel.',
      noInstances: 'No additional instances configured. Add them in profile YAML if needed.',
      gitHint: 'Git status for this chat: branch and uncommitted changes.',
      drawerTitle: 'Git Inspector',
      drawerClose: 'Close (Esc)',
      drawerRefresh: 'Refresh',
      tabStatus: 'Status',
      tabGraph: 'Graph & CI',
      tabEvents: 'Events & PRs',
      branch: 'Branch',
      upstream: 'Upstream',
      statusClean: 'Working tree is clean',
      statusDirty: 'Uncommitted changes',
      noChangesDesc: 'No modified or untracked files in the working directory.',
      activePr: 'Active Pull Request',
      viewInGitea: 'View in Gitea',
      recentEvents: 'Recent Events',
      noEvents: 'No webhook events recorded yet.',
      gitEmpty: 'Appears after the agent opens a git folder.',
      gitClean: 'Clean',
      gitDirty: 'Uncommitted changes',
      gitCommits: 'Recent commits',
      gitChanges: 'Changes',
      gitNoCommits: 'No commits yet',
      gitNoChanges: 'No uncommitted changes',
      gitAhead: 'Ahead',
      gitBehind: 'Behind',
      gitSync: 'Sync',
      gitUpToDate: 'Up to date with remote',
      openGraph: 'Commit graph',
      graphTitle: 'Git Commit Graph',
      graphLoading: 'Loading commit graph\u2026',
      graphEmpty: 'No commits found in repository',
      graphLoadMore: 'Load more commits',
      graphClose: 'Close graph',
      justNow: 'just now',
      minutesAgo: 'm ago',
      hoursAgo: 'h ago',
      daysAgo: 'd ago',
      ciPass: 'CI passed',
      ciFail: 'CI failed',
      ciPending: 'CI running',
    }
    const ru = {
      title: 'Gitea',
      description: 'Инструменты и учётные данные Gitea или Forgejo.',
      intro: 'Создайте учётные данные DSH, вставьте туда API-токен и ниже укажите только имя (например GITEA_TOKEN). Токен в эту форму не вставляйте.',
      baseUrl: 'Адрес инстанса',
      baseUrlHint: 'например https://gitea.example.com',
      tokenEnv: 'Имя учётных данных',
      tokenEnvHint: 'Имя записи DSH, не сам токен. По умолчанию GITEA_TOKEN.',
      tokenOn: 'Токен настроен',
      tokenOff: 'Токен не настроен',
      save: 'Сохранить',
      saving: 'Сохранение\u2026',
      discard: 'Отменить',
      unsaved: 'Не сохранено',
      saveFailed: 'Не удалось сохранить',
      loading: 'Загрузка\u2026',
      settingsUnavailable: 'Настройки недоступны (пространство не зарегистрировано).',
      expand: 'Развернуть',
      collapse: 'Свернуть',
      sectionInstance: 'Подключение и основные параметры',
      sectionDefaults: 'Значения по умолчанию и Git',
      sectionWebhooks: 'Вебхуки и уведомления',
      sectionScheduler: 'Фоновый планировщик проверок',
      sectionInstances: 'Дополнительные инстансы',
      toggleAdvanced: 'Дополнительные настройки',
      defaultOwner: 'Организация или пользователь по умолчанию',
      defaultOwnerHint: 'Организация или пользователь по умолчанию, если не указан в вызове инструмента.',
      defaultRepo: 'Репозиторий по умолчанию',
      defaultRepoHint: 'Имя репозитория по умолчанию, если не указано в вызове инструмента.',
      gitWrapper: 'Команда-обертка git',
      gitWrapperHint: 'Скрипт для операций записи (например git-deepseek-harness). Если пусто, работа с воркдеревьями отключена.',
      dodReminder: 'Напоминание Definition of Done',
      dodReminderHint: 'Напоминать, если инструмент изменил git-файлы без ссылки на задачу или PR. Не блокирует работу.',
      forceHttpsUrls: 'Принудительный HTTPS в ссылках',
      forceHttpsUrlsHint: 'Переписывать ссылки http:// в https:// при работе за HTTPS reverse proxy.',
      timeoutMs: 'Таймаут запросов (мс)',
      timeoutMsHint: 'Таймаут HTTP-запросов к Gitea API в миллисекундах (по умолчанию 30000).',
      webhookSecretEnv: 'Учётные данные секрета вебхука',
      webhookSecretEnvHint: 'Имя записи DSH с секретом для проверки подписи X-Gitea-Signature на POST /dsh-gitea/webhook.',
      notifyWebhook: 'URL вебхука для пуш-уведомлений',
      notifyWebhookHint: 'Внешний URL для оповещений о новых PR и упавшем CI. Пусто = пуш отключён.',
      bgSchedulerEnabled: 'Включить фоновый планировщик',
      bgSchedulerEnabledHint: 'Периодический запуск триажа/проверок здоровья с отправкой дайджеста.',
      bgSchedulerIntervalMin: 'Интервал планировщика (минуты)',
      bgSchedulerIntervalMinHint: 'Интервал между фоновыми проверками (по умолчанию 60).',
      bgSchedulerOwner: 'Целевой владелец планировщика',
      bgSchedulerOwnerHint: 'Владелец для проверок (по умолчанию совпадает со значением по умолчанию).',
      bgSchedulerRepo: 'Целевой репозиторий планировщика',
      bgSchedulerRepoHint: 'Репозиторий для проверок (по умолчанию совпадает со значением по умолчанию).',
      bgSchedulerWebhook: 'URL вебхука для дайджеста планировщика',
      bgSchedulerWebhookHint: 'URL для отправки дайджеста во внешний канал.',
      noInstances: 'Дополнительные инстансы не настроены. Задаются в конфигурации профиля.',
      gitHint: 'Git этого чата: ветка и незакоммиченные правки.',
      gitEmpty: 'Появится, когда агент откроет git-папку.',
      gitClean: 'Чисто',
      gitDirty: 'Есть правки',
      gitCommits: 'Последние коммиты',
      gitChanges: 'Изменения',
      gitNoCommits: 'Коммитов пока нет',
      gitNoChanges: 'Нет незакоммиченных правок',
      gitAhead: 'Опережает',
      gitBehind: 'Отстает',
      gitSync: 'Синхронизация',
      gitUpToDate: 'Синхронизировано с remote',
      openGraph: 'Граф коммитов',
      graphTitle: 'Граф коммитов Git',
      graphLoading: 'Загрузка графа коммитов\u2026',
      graphEmpty: 'В репозитории нет коммитов',
      graphLoadMore: 'Загрузить ещё коммиты',
      graphClose: 'Закрыть граф',
      justNow: 'только что',
      minutesAgo: 'мин. назад',
      hoursAgo: 'ч. назад',
      daysAgo: 'дн. назад',
      ciPass: 'CI пройден',
      ciFail: 'CI упал',
      ciPending: 'CI выполняется',
    }

    function useActiveLocale(ctx) {
      const localeSvc = getService(ctx, 'locale')
      return React.useSyncExternalStore(
        React.useMemo(() => (cb) => (localeSvc && typeof localeSvc.subscribe === 'function' ? localeSvc.subscribe(cb) : () => {}), [localeSvc]),
        React.useCallback(() => {
          if (localeSvc && typeof localeSvc.getSnapshot === 'function') {
            const snap = localeSvc.getSnapshot()
            const active = snap && snap.active
            if (typeof active === 'string' && active) return active
          }
          return typeof navigator !== 'undefined' ? String(navigator.language || '').slice(0, 2) : 'en'
        }, [localeSvc]),
      )
    }

    function makeT(locale) {
      const dict = String(locale || '').startsWith('ru') ? ru : en
      return (key) => dict[key] || en[key] || key
    }

    function sameDraft(a, b) {
      if (!a && !b) return true
      if (!a || !b) return false
      const keys = [
        'baseUrl', 'tokenEnv', 'defaultOwner', 'defaultRepo', 'gitWrapper',
        'dodReminder', 'forceHttpsUrls', 'timeoutMs', 'webhookSecretEnv',
        'notifyWebhook', 'bgSchedulerEnabled', 'bgSchedulerIntervalMin',
        'bgSchedulerOwner', 'bgSchedulerRepo', 'bgSchedulerWebhook'
      ]
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]
        if (a[k] !== b[k]) return false
      }
      return JSON.stringify(a.instances || []) === JSON.stringify(b.instances || [])
    }

    
    function FallbackChevron() {
      return React.createElement(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': true },
        React.createElement('path', {
          d: 'M3.5 5.25L7 8.75L10.5 5.25',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        })
      )
    }
    const Chevron = FallbackChevron

    function createErrorBoundary() {
      if (!React || typeof React.Component !== 'function') {
        return function NoopBoundary(props) { return props?.children || null }
      }
      return class ErrorBoundary extends React.Component {
        constructor(props) {
          super(props)
          this.state = { hasError: false, error: null }
        }
        static getDerivedStateFromError(error) {
          return { hasError: true, error }
        }
        componentDidCatch(error, errorInfo) {
          console.error('[dsh-gitea] React Error:', error, errorInfo)
        }
        render() {
          if (this.state.hasError) {
            return React.createElement(
              'div',
              {
                className: 'dgt-failed',
                style: { margin: '12px 0', padding: '12px', border: '1px solid var(--dsw-alias-state-error-primary)', borderRadius: '8px' },
              },
              React.createElement('div', { style: { fontWeight: 600, marginBottom: '6px' } }, '⚠️ Gitea UI Error:'),
              React.createElement('div', { style: { fontSize: '12px', wordBreak: 'break-all' } }, String(this.state.error?.message || this.state.error)),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'dgt-discard',
                  style: { marginTop: '10px', fontSize: '12px', padding: '4px 10px' },
                  onClick: () => this.setState({ hasError: false, error: null }),
                },
                'Retry'
              )
            )
          }
          return this.props?.children || null
        }
      }
    }
    const ErrorBoundary = createErrorBoundary()

    function valueField(id, label, hint, value, onEdit) {
      return React.createElement('div', { className: 'dgt-field' },
        React.createElement('div', { className: 'dgt-fieldHead' },
          React.createElement('label', { className: 'dgt-label', htmlFor: id }, label),
        ),
        React.createElement('input', {
          id,
          className: 'dgt-input',
          type: 'text',
          value: value == null ? '' : value,
          onChange: (e) => onEdit(e.target.value),
        }),
        hint ? React.createElement('p', { className: 'dgt-hint' }, hint) : null,
      )
    }

    function checkboxField(id, label, hint, checked, onToggle) {
      return React.createElement('label', { className: 'dgt-checkRow', htmlFor: id },
        React.createElement('input', {
          id,
          className: 'dgt-checkbox',
          type: 'checkbox',
          checked: !!checked,
          onChange: (e) => onToggle(e.target.checked),
        }),
        React.createElement('span', { className: 'dgt-checkLabelWrap' },
          React.createElement('span', { className: 'dgt-label' }, label),
          hint ? React.createElement('span', { className: 'dgt-hint' }, hint) : null,
        ),
      )
    }

    function numberField(id, label, hint, value, onEdit, min, max) {
      return React.createElement('div', { className: 'dgt-field' },
        React.createElement('div', { className: 'dgt-fieldHead' },
          React.createElement('label', { className: 'dgt-label', htmlFor: id }, label),
        ),
        React.createElement('input', {
          id,
          className: 'dgt-input',
          type: 'number',
          min,
          max,
          value: value == null ? '' : value,
          onChange: (e) => {
            const val = e.target.value === '' ? '' : Number(e.target.value)
            onEdit(val)
          },
        }),
        hint ? React.createElement('p', { className: 'dgt-hint' }, hint) : null,
      )
    }

    function GiteaSettingsForm(props) {
      const t = props.t
      const onDirty = props.onDirty
      const ctx = props.ctx
      const [saved, setSaved] = React.useState(null)
      const [draft, setDraft] = React.useState(null)
      const [tokenConfigured, setTokenConfigured] = React.useState(false)
      const [tokenEnvError, setTokenEnvError] = React.useState('')
      const [saving, setSaving] = React.useState(false)
      const [err, setErr] = React.useState('')
      const [showAdvanced, setShowAdvanced] = React.useState(false)

      const scope = React.useMemo(() => {
        const svc = getService(ctx, 'settingsScope')
        return svc && typeof svc.bind === 'function' ? svc.bind({ namespace: NS }) : undefined
      }, [ctx])

      const snapshot = React.useSyncExternalStore(
        React.useMemo(() => (cb) => (scope ? scope.subscribe(cb) : () => {}), [scope]),
        React.useCallback(() => (scope ? scope.getSnapshot() : { status: 'ready' }), [scope]),
        React.useCallback(() => ({ status: 'loading' }), []),
      )

      const status = (snapshot && snapshot.status) || 'ready'
      const writable = snapshot && snapshot.writable !== undefined ? snapshot.writable : true

      const applyPayload = (data) => {
        const cfg = (data && data.config) || {}
        const next = {
          baseUrl: cfg.baseUrl || '',
          tokenEnv: cfg.tokenEnv || '',
          defaultOwner: cfg.defaultOwner || '',
          defaultRepo: cfg.defaultRepo || '',
          gitWrapper: cfg.gitWrapper || '',
          dodReminder: !!cfg.dodReminder,
          forceHttpsUrls: !!cfg.forceHttpsUrls,
          timeoutMs: typeof cfg.timeoutMs === 'number' ? cfg.timeoutMs : 30000,
          webhookSecretEnv: cfg.webhookSecretEnv || '',
          notifyWebhook: cfg.notifyWebhook || '',
          bgSchedulerEnabled: !!cfg.bgSchedulerEnabled,
          bgSchedulerIntervalMin: typeof cfg.bgSchedulerIntervalMin === 'number' ? cfg.bgSchedulerIntervalMin : 60,
          bgSchedulerOwner: cfg.bgSchedulerOwner || '',
          bgSchedulerRepo: cfg.bgSchedulerRepo || '',
          bgSchedulerWebhook: cfg.bgSchedulerWebhook || '',
          instances: Array.isArray(cfg.instances) ? cfg.instances : [],
        }
        setSaved(next)
        setDraft(next)
        setTokenConfigured(!!(data && data.tokenConfigured))
        setTokenEnvError((data && data.tokenEnvError) || '')
      }

      React.useEffect(() => {
        if (status === 'unavailable') return
        let alive = true
        fetch('/dsh-gitea/config', { cache: 'no-store' })
          .then((res) => res.json())
          .then((data) => { if (alive) applyPayload(data) })
          .catch((e) => { if (alive) setErr(String(e && e.message ? e.message : e)) })
        return () => { alive = false }
      }, [status])

      const setField = (key, value) => setDraft((d) => Object.assign({}, d || {}, { [key]: value }))
      const dirty = !!(draft && saved && !sameDraft(draft, saved))
      React.useEffect(() => { if (typeof onDirty === 'function') onDirty(dirty) }, [dirty, onDirty])
      const blocked = !dirty || saving || !draft || !writable || status !== 'ready'

      const save = async () => {
        if (!draft || blocked) return
        setErr('')
        setSaving(true)
        try {
          const payload = Object.assign({}, draft)
          if (payload.timeoutMs === '' || isNaN(Number(payload.timeoutMs))) payload.timeoutMs = 30000
          else payload.timeoutMs = Number(payload.timeoutMs)
          if (payload.bgSchedulerIntervalMin === '' || isNaN(Number(payload.bgSchedulerIntervalMin))) payload.bgSchedulerIntervalMin = 60
          else payload.bgSchedulerIntervalMin = Number(payload.bgSchedulerIntervalMin)

          if (scope && typeof scope.set === 'function') {
            const broken = []
            for (const [k, v] of Object.entries(payload)) {
              if (k === 'instances' && Array.isArray(v) && v.length === 0) continue
              try { await scope.set(k, v) } catch (e) { broken.push(k + ': ' + (e?.message || e)) }
            }
            if (broken.length) throw new Error(broken.join('; '))
          }
          const res = await fetch('/dsh-gitea/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error((data && data.error && data.error.message) || ('HTTP ' + res.status))
          applyPayload(data)
        } catch (e) {
          setErr(String(e && e.message ? e.message : e))
        } finally {
          setSaving(false)
        }
      }

      if (status === 'loading' || (!draft && !err && status !== 'unavailable')) {
        return React.createElement('p', { className: 'dgt-hint' }, t('loading'))
      }

      if (status === 'unavailable') {
        return React.createElement('p', { className: 'dgt-failed' }, t('settingsUnavailable'))
      }

      return React.createElement(React.Fragment, null,
        React.createElement('p', { className: 'dgt-hint' }, t('intro')),

        // Core Connection
        valueField('plugin-config-dsh-gitea-url', t('baseUrl'), t('baseUrlHint'), draft.baseUrl, (v) => setField('baseUrl', v)),
        valueField('plugin-config-dsh-gitea-token-env', t('tokenEnv'), t('tokenEnvHint'), draft.tokenEnv, (v) => setField('tokenEnv', v)),
        React.createElement('div', { className: 'dgt-badgesRow' },
          React.createElement('span', { className: 'dgt-badge ' + (tokenConfigured ? 'dgt-badgeOk' : 'dgt-badgeBad') },
            tokenConfigured ? t('tokenOn') : t('tokenOff')),
          draft.baseUrl
            ? React.createElement('span', { className: 'dgt-badge dgt-badgeOk' }, t('badgeOnline'))
            : React.createElement('span', { className: 'dgt-badge dgt-badgeWarn' }, t('badgeOffline')),
        ),
        tokenEnvError ? React.createElement('p', { className: 'dgt-failed' }, tokenEnvError) : null,
        typeof location !== 'undefined' && location.protocol === 'https:' && /^http:\/\//i.test(draft.baseUrl || '')
          ? React.createElement('p', { className: 'dgt-failed' }, 'Gitea endpoint is HTTP, but DSH is HTTPS — embedded Gitea pages will be blocked (mixed content). Use an HTTPS Gitea endpoint / reverse proxy.')
          : null,

        // Core Defaults
        valueField('plugin-config-dsh-gitea-default-owner', t('defaultOwner'), t('defaultOwnerHint'), draft.defaultOwner, (v) => setField('defaultOwner', v)),
        valueField('plugin-config-dsh-gitea-default-repo', t('defaultRepo'), t('defaultRepoHint'), draft.defaultRepo, (v) => setField('defaultRepo', v)),

        // Advanced toggle
        React.createElement('div', null,
          React.createElement('button', {
            type: 'button',
            className: 'dgt-advancedToggle',
            onClick: () => setShowAdvanced((v) => !v),
          },
            React.createElement('span', null, showAdvanced ? '▾ ' : '▸ '),
            t('toggleAdvanced'),
          ),
        ),

        // Advanced panel
        showAdvanced ? React.createElement('div', { className: 'dgt-advancedPanel' },
          // Defaults & Git
          React.createElement('div', { className: 'dgt-sectionTitle' }, t('sectionDefaults')),
          valueField('plugin-config-dsh-gitea-git-wrapper', t('gitWrapper'), t('gitWrapperHint'), draft.gitWrapper, (v) => setField('gitWrapper', v)),
          checkboxField('plugin-config-dsh-gitea-dod-reminder', t('dodReminder'), t('dodReminderHint'), draft.dodReminder, (v) => setField('dodReminder', v)),
          checkboxField('plugin-config-dsh-gitea-force-https', t('forceHttpsUrls'), t('forceHttpsUrlsHint'), draft.forceHttpsUrls, (v) => setField('forceHttpsUrls', v)),
          numberField('plugin-config-dsh-gitea-timeout', t('timeoutMs'), t('timeoutMsHint'), draft.timeoutMs, (v) => setField('timeoutMs', v), 1000, 300000),

          // Webhooks & Notifications
          React.createElement('div', { className: 'dgt-sectionTitle' }, t('sectionWebhooks')),
          valueField('plugin-config-dsh-gitea-webhook-secret-env', t('webhookSecretEnv'), t('webhookSecretEnvHint'), draft.webhookSecretEnv, (v) => setField('webhookSecretEnv', v)),
          valueField('plugin-config-dsh-gitea-notify-webhook', t('notifyWebhook'), t('notifyWebhookHint'), draft.notifyWebhook, (v) => setField('notifyWebhook', v)),

          // Background Scheduler
          React.createElement('div', { className: 'dgt-sectionTitle' }, t('sectionScheduler')),
          checkboxField('plugin-config-dsh-gitea-bg-scheduler', t('bgSchedulerEnabled'), t('bgSchedulerEnabledHint'), draft.bgSchedulerEnabled, (v) => setField('bgSchedulerEnabled', v)),
          draft.bgSchedulerEnabled ? React.createElement(React.Fragment, null,
            numberField('plugin-config-dsh-gitea-bg-interval', t('bgSchedulerIntervalMin'), t('bgSchedulerIntervalMinHint'), draft.bgSchedulerIntervalMin, (v) => setField('bgSchedulerIntervalMin', v), 1, 1440),
            valueField('plugin-config-dsh-gitea-bg-owner', t('bgSchedulerOwner'), t('bgSchedulerOwnerHint'), draft.bgSchedulerOwner, (v) => setField('bgSchedulerOwner', v)),
            valueField('plugin-config-dsh-gitea-bg-repo', t('bgSchedulerRepo'), t('bgSchedulerRepoHint'), draft.bgSchedulerRepo, (v) => setField('bgSchedulerRepo', v)),
            valueField('plugin-config-dsh-gitea-bg-webhook', t('bgSchedulerWebhook'), t('bgSchedulerWebhookHint'), draft.bgSchedulerWebhook, (v) => setField('bgSchedulerWebhook', v)),
          ) : null,

          // Instances
          React.createElement('div', { className: 'dgt-sectionTitle' }, t('sectionInstances')),
          Array.isArray(draft.instances) && draft.instances.length > 0
            ? React.createElement('div', null,
                draft.instances.map((inst, idx) =>
                  React.createElement('div', { key: idx, className: 'dgt-instanceRow' },
                    React.createElement('strong', null, inst.name || 'Unnamed'),
                    React.createElement('span', null, String(inst.baseUrl || '') + ' (' + String(inst.tokenEnv || 'no token') + ')'),
                  ),
                ),
              )
            : React.createElement('p', { className: 'dgt-hint' }, t('noInstances')),
        ) : null,

        // Footer
        React.createElement('div', { className: 'dgt-foot' },
          err ? React.createElement('p', { className: 'dgt-failed', role: 'status' }, err || t('saveFailed')) : null,
          React.createElement('button', {
            type: 'button',
            className: 'dgt-discard',
            disabled: !dirty || saving,
            onClick: () => { setDraft(saved); setErr('') },
          }, t('discard')),
          React.createElement('button', {
            type: 'button',
            className: 'dgt-save',
            disabled: blocked,
            onClick: save,
          }, t(saving ? 'saving' : 'save')),
        ),
        React.createElement(EventsPanel, { t }),
      )
    }

    function EventsPanel(props) {
      const t = typeof props.t === 'function' ? props.t : makeT(props.locale)
      const [events, setEvents] = React.useState(null)
      React.useEffect(() => {
        let alive = true
        let id = null
        const load = () => {
          if (typeof document !== 'undefined' && document.hidden) return
          fetch('/dsh-gitea/events', { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => { if (alive) setEvents(data && data.data ? data.data : []) })
            .catch(() => { if (alive) setEvents([]) })
        }
        load()
        id = setInterval(load, 5000)

        const onVisibilityChange = () => {
          if (typeof document !== 'undefined' && !document.hidden && alive) {
            load()
          }
        }
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
          document.addEventListener('visibilitychange', onVisibilityChange)
        }
        return () => {
          alive = false
          if (id) clearInterval(id)
          if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
            document.removeEventListener('visibilitychange', onVisibilityChange)
          }
        }
      }, [])
      const rows = Array.isArray(events) ? events : []
      const locOrigin = typeof location !== 'undefined' ? location.origin : ''
      return React.createElement('div', { className: 'dgt-field' },
        React.createElement('div', { className: 'dgt-fieldHead' },
          React.createElement('span', { className: 'dgt-label' }, t('eventsTitle')),
        ),
        rows.length === 0
          ? React.createElement('p', { className: 'dgt-hint' }, t('eventsEmptyHint', { url: locOrigin }))
          : React.createElement('ul', { style: { listStyle: 'none', margin: 0, padding: 0 } },
              rows.slice(0, 10).map((ev, i) =>
                React.createElement('li', { key: i, style: { fontSize: 12, lineHeight: 1.6, padding: '4px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)' } },
                  (ev.type === 'pull_request' ? 'PR ' : (ev.type || '') + ' ') + (ev.number != null ? '#' + ev.number : '') + ' ' + (ev.title || '') + ' — ' + (ev.action || ev.conclusion || '') + ' (' + String(ev.at || '').slice(0, 16).replace('T', ' ') + ')',
                ),
              ),
            ),
      )
    }

    function GiteaPluginCard(props) {
      const [open, setOpen] = React.useState(false)
      const [dirty, setDirty] = React.useState(false)
      const t = typeof props.t === 'function' ? props.t : makeT(props.locale)
      const title = t('title')
      return React.createElement('li', { className: 'dgt-card' + (open ? ' dgt-cardOpen' : '') },
        React.createElement('button', {
          type: 'button',
          className: 'dgt-head',
          'aria-expanded': open,
          'aria-label': (open ? t('collapse') : t('expand')) + ': ' + title,
          onClick: () => setOpen((value) => !value),
        },
          React.createElement('span', { className: 'dgt-headText' },
            React.createElement('span', { className: 'dgt-title' }, title),
            React.createElement('span', { className: 'dgt-sub' }, t('description')),
          ),
          dirty ? React.createElement('span', { className: 'dgt-pending' }, t('unsaved')) : null,
          React.createElement('span', { className: 'dgt-chevron' + (open ? ' dgt-chevronOpen' : '') }, '\u25be'),
        ),
        React.createElement('div', {
          className: 'dgt-body',
          hidden: !open,
          style: open ? undefined : { display: 'none' },
        }, React.createElement(GiteaSettingsForm, { t, ctx: props.ctx, onDirty: setDirty })),
      )
    }

    function workspaceCwdFrom(session, workspaces) {
      const items = (workspaces && workspaces.items) || []
      const sessionId = session && (session.sessionId || session.id)
      const workspaceId = session && session.workspaceId
      let ws = null
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (workspaceId && (item.workspaceId === workspaceId || item.id === workspaceId)) { ws = item; break }
        if (sessionId && item.sessionIds && item.sessionIds.indexOf(sessionId) >= 0) { ws = item; break }
      }
      return (ws && (ws.path || ws.cwd)) || ''
    }

    function chipSessionId(props, session) {
      return String((props && props.sessionId) || (session && (session.sessionId || session.id)) || '').trim()
    }

    function glyphChar(glyph) {
      switch (glyph) {
        case 'node': return '\u25cf'
        case 'merge': return '\u25c6'
        case 'pass': return '\u2502'
        case 'gap': return ' '
        default: return ' '
      }
    }

    function formatRelativeTime(epochSeconds, t) {
      if (!epochSeconds) return ''
      const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - epochSeconds)
      if (elapsed < 60) return t('justNow')
      if (elapsed < 3600) return Math.floor(elapsed / 60) + ' ' + t('minutesAgo')
      if (elapsed < 86400) return Math.floor(elapsed / 3600) + ' ' + t('hoursAgo')
      if (elapsed < 30 * 86400) return Math.floor(elapsed / 86400) + ' ' + t('daysAgo')
      const date = new Date(epochSeconds * 1000)
      const pad = (n) => String(n).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }

    function GitSidebarDrawer(props) {
      const { cwd, sessionId, snap, ready, onClose, onRefresh, t } = props
      const [tab, setTab] = React.useState('status')
      const [graphData, setGraphData] = React.useState(null)
      const [graphLoading, setGraphLoading] = React.useState(false)
      const [graphLimit, setGraphLimit] = React.useState(100)
      const [events, setEvents] = React.useState([])
      const [eventsLoading, setEventsLoading] = React.useState(false)
      const [refreshing, setRefreshing] = React.useState(false)

      React.useEffect(() => {
        const onKeyDown = (e) => {
          if (e.key === 'Escape') onClose()
        }
        if (typeof window !== 'undefined') {
          window.addEventListener('keydown', onKeyDown)
          return () => window.removeEventListener('keydown', onKeyDown)
        }
      }, [onClose])

      const loadGraph = React.useCallback((limit) => {
        setGraphLoading(true)
        const q = ['limit=' + limit]
        if (cwd) q.push('cwd=' + encodeURIComponent(cwd))
        if (sessionId) q.push('sessionId=' + encodeURIComponent(sessionId))
        fetch('/dsh-gitea/git-graph?' + q.join('&'), { cache: 'no-store' })
          .then((r) => r.json())
          .then((res) => { if (res?.ok && res.data) setGraphData(res.data) })
          .catch(() => {})
          .finally(() => setGraphLoading(false))
      }, [cwd, sessionId])

      React.useEffect(() => {
        if (tab === 'graph') loadGraph(graphLimit)
      }, [tab, graphLimit, loadGraph])

      const loadEvents = React.useCallback(() => {
        setEventsLoading(true)
        fetch('/dsh-gitea/events', { cache: 'no-store' })
          .then((r) => r.json())
          .then((res) => { if (res?.ok && Array.isArray(res.data)) setEvents(res.data) })
          .catch(() => {})
          .finally(() => setEventsLoading(false))
      }, [])

      React.useEffect(() => {
        if (tab === 'events') loadEvents()
      }, [tab, loadEvents])

      const handleManualRefresh = () => {
        setRefreshing(true)
        if (typeof onRefresh === 'function') onRefresh()
        if (tab === 'graph') loadGraph(graphLimit)
        if (tab === 'events') loadEvents()
        setTimeout(() => setRefreshing(false), 600)
      }

      const title = ready ? (snap.repoName || snap.branch || 'Repository') : t('drawerTitle')
      const branchName = ready ? (snap.branch || 'HEAD') : ''

      let statusContent = null
      if (!ready) {
        statusContent = React.createElement('div', { className: 'dgt-drawer-empty' },
          React.createElement('p', { style: { margin: 0, color: 'var(--dsw-alias-label-secondary)' } }, t('gitEmpty'))
        )
      } else {
        const isDirty = !!snap.dirty
        const dirtyCount = snap.dirtyFiles || 0
        const pr = snap.pr
        const syncText = (snap.ahead > 0 || snap.behind > 0)
          ? ((snap.ahead > 0 ? '\u2191 ' + snap.ahead + ' ' + t('gitAhead') : '') +
             (snap.ahead > 0 && snap.behind > 0 ? ', ' : '') +
             (snap.behind > 0 ? '\u2193 ' + snap.behind + ' ' + t('gitBehind') : '') +
             (snap.upstream ? ' (' + snap.upstream + ')' : ''))
          : (snap.upstream ? t('gitUpToDate') + ' (' + snap.upstream + ')' : '')

        statusContent = React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'dgt-drawer-card' },
            React.createElement('div', { className: 'dgt-drawer-row' },
              React.createElement('span', { className: 'dgt-drawer-dim' }, t('branch')),
              React.createElement('span', { className: 'dgt-drawer-val', style: { fontFamily: 'ui-monospace, monospace' } }, branchName)
            ),
            syncText ? React.createElement('div', { className: 'dgt-drawer-row' },
              React.createElement('span', { className: 'dgt-drawer-dim' }, t('gitSync')),
              React.createElement('span', { className: 'dgt-drawer-val' }, syncText)
            ) : null,
            snap.head ? React.createElement('div', { className: 'dgt-drawer-row' },
              React.createElement('span', { className: 'dgt-drawer-dim' }, 'HEAD'),
              React.createElement('span', { className: 'dgt-drawer-val', style: { fontFamily: 'ui-monospace, monospace' } }, snap.head.slice(0, 7))
            ) : null
          ),

          pr && pr.prNumber ? React.createElement('div', { className: 'dgt-drawer-card' },
            React.createElement('span', { className: 'dgt-drawer-sec-h' }, t('activePr')),
            React.createElement('div', { className: 'dgt-drawer-row' },
              React.createElement('span', { style: { fontWeight: 600 } }, '#' + pr.prNumber),
              pr.ciFailed
                ? React.createElement('span', { className: 'dgt-badge dgt-badgeBad' }, 'CI Failed')
                : React.createElement('span', { className: 'dgt-badge dgt-badgeOk' }, 'Active')
            )
          ) : null,

          React.createElement('div', { className: 'dgt-drawer-card' },
            React.createElement('div', { className: 'dgt-drawer-row', style: { marginBottom: 6 } },
              React.createElement('span', { className: 'dgt-drawer-sec-h' }, t('gitChanges')),
              isDirty
                ? React.createElement('span', { className: 'dgt-badge dgt-badgeWarn' }, dirtyCount + ' changed')
                : React.createElement('span', { className: 'dgt-badge dgt-badgeOk' }, t('gitClean'))
            ),
            isDirty
              ? React.createElement('pre', { className: 'dgt-git-pre', style: { maxHeight: 220, overflowY: 'auto' } }, snap.diff || snap.dirty)
              : React.createElement('div', { className: 'dgt-drawer-clean-box' },
                  React.createElement('span', { style: { color: 'var(--dsw-alias-state-success-primary)', fontSize: 16 } }, '\u2713'),
                  React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 } }, t('noChangesDesc'))
                )
          ),

          snap.graph ? React.createElement('div', { className: 'dgt-drawer-card' },
            React.createElement('span', { className: 'dgt-drawer-sec-h' }, t('gitCommits')),
            React.createElement('pre', { className: 'dgt-git-pre', style: { maxHeight: 160, overflowY: 'auto' } }, snap.graph)
          ) : null
        )
      }

      let graphContent = null
      const commits = graphData?.commits || []
      const lanes = graphData?.lanes || []
      const baseUrl = graphData?.baseUrl || ''
      const owner = graphData?.owner || ''
      const repo = graphData?.repo || ''

      if (graphLoading && commits.length === 0) {
        graphContent = React.createElement('div', { style: { padding: '24px 0', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, t('graphLoading'))
      } else if (commits.length === 0) {
        graphContent = React.createElement('div', { style: { padding: '24px 0', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, t('graphEmpty'))
      } else {
        graphContent = React.createElement('div', { className: 'dgt-graph-body', style: { padding: 0 } },
          commits.map((commit, idx) => {
            const laneRow = lanes[idx]
            const cols = laneRow?.columns || ['node']
            const commitUrl = (baseUrl && owner && repo && commit.oid)
              ? `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commit/${commit.oid}`
              : null

            const ciBadge = commit.ciStatus ? React.createElement('span', {
              className: 'dgt-graph-ci dgt-graph-ci-' + commit.ciStatus,
              title: 'CI: ' + commit.ciStatus,
            }, commit.ciStatus === 'success' ? 'CI \u2713' : (commit.ciStatus === 'failure' ? 'CI \u2717' : 'CI \u25cf')) : null

            return React.createElement('div', { key: commit.oid || idx, className: 'dgt-graph-row' },
              React.createElement('span', { className: 'dgt-graph-lanes' },
                cols.map((glyph, cIdx) => React.createElement('span', {
                  key: cIdx,
                  className: 'dgt-graph-' + glyph,
                }, glyphChar(glyph)))
              ),
              commitUrl
                ? React.createElement('a', {
                    href: commitUrl,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className: 'dgt-graph-oid',
                    title: commit.oid,
                  }, (commit.oid || '').slice(0, 7))
                : React.createElement('span', {
                    className: 'dgt-graph-oid',
                    title: commit.oid,
                  }, (commit.oid || '').slice(0, 7)),
              React.createElement('div', { className: 'dgt-graph-main' },
                React.createElement('span', { className: 'dgt-graph-subject', title: commit.subject }, commit.subject || ''),
                React.createElement('div', { className: 'dgt-graph-meta' },
                  (commit.refs || []).map((ref) => React.createElement('span', {
                    key: ref,
                    className: 'dgt-graph-ref' + (ref === branchName ? ' dgt-graph-refCurrent' : ''),
                  }, ref)),
                  ciBadge,
                  React.createElement('span', null, commit.author || ''),
                  React.createElement('span', null, '\u00b7'),
                  React.createElement('span', null, formatRelativeTime(commit.authorTime, t))
                )
              )
            )
          }),
          graphData?.hasMore ? React.createElement('button', {
            type: 'button',
            className: 'dgt-graph-more',
            onClick: () => setGraphLimit((prev) => prev + 100),
          }, t('graphLoadMore')) : null
        )
      }

      let eventsContent = null
      if (eventsLoading && events.length === 0) {
        eventsContent = React.createElement('div', { style: { padding: '24px 0', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, t('loading'))
      } else if (events.length === 0) {
        eventsContent = React.createElement('div', { style: { padding: '24px 0', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, t('noEvents'))
      } else {
        eventsContent = React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          events.slice(0, 30).map((ev, i) => React.createElement('div', { key: ev.id || i, className: 'dgt-drawer-card' },
            React.createElement('div', { className: 'dgt-drawer-row' },
              React.createElement('span', { className: 'dgt-badge dgt-badgeOk' }, ev.type || 'event'),
              React.createElement('span', { className: 'dgt-drawer-dim', style: { fontSize: 11 } }, formatRelativeTime(Math.floor(new Date(ev.timestamp || Date.now()).getTime() / 1000), t))
            ),
            React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-primary)' } }, ev.title || ev.message || JSON.stringify(ev.payload || {}))
          ))
        )
      }

      return React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'dgt-drawer-backdrop', onClick: onClose }),
        React.createElement('aside', {
          className: 'dgt-drawer',
          role: 'dialog',
          'aria-modal': true,
          'aria-label': t('drawerTitle'),
        },
          React.createElement('div', { className: 'dgt-drawer-head' },
            React.createElement('div', { className: 'dgt-drawer-title-wrap' },
              React.createElement('h3', { className: 'dgt-drawer-title' }, title),
              branchName ? React.createElement('span', { className: 'dgt-drawer-branch-badge' }, '\u2442 ' + branchName) : null
            ),
            React.createElement('div', { className: 'dgt-drawer-actions' },
              React.createElement('button', {
                type: 'button',
                className: 'dgt-drawer-btn' + (refreshing ? ' dgt-drawer-btn-spin' : ''),
                title: t('drawerRefresh'),
                'aria-label': t('drawerRefresh'),
                onClick: handleManualRefresh,
              }, '\u27f3'),
              React.createElement('button', {
                type: 'button',
                className: 'dgt-drawer-btn dgt-drawer-btn-close',
                title: t('drawerClose'),
                'aria-label': t('drawerClose'),
                onClick: onClose,
              }, '\u00d7')
            )
          ),
          React.createElement('div', { className: 'dgt-drawer-tabs' },
            React.createElement('button', {
              type: 'button',
              className: 'dgt-drawer-tab' + (tab === 'status' ? ' dgt-drawer-tabActive' : ''),
              onClick: () => setTab('status'),
            },
              t('tabStatus'),
              ready && snap.dirty ? React.createElement('span', { className: 'dgt-drawer-tab-badge dgt-drawer-tab-badgeAlert' }, snap.dirtyFiles || '*') : null
            ),
            React.createElement('button', {
              type: 'button',
              className: 'dgt-drawer-tab' + (tab === 'graph' ? ' dgt-drawer-tabActive' : ''),
              onClick: () => setTab('graph'),
            }, t('tabGraph')),
            React.createElement('button', {
              type: 'button',
              className: 'dgt-drawer-tab' + (tab === 'events' ? ' dgt-drawer-tabActive' : ''),
              onClick: () => setTab('events'),
            },
              t('tabEvents'),
              events.length > 0 ? React.createElement('span', { className: 'dgt-drawer-tab-badge' }, events.length) : null
            )
          ),
          React.createElement('div', { className: 'dgt-drawer-body' },
            tab === 'status' ? statusContent : (tab === 'graph' ? graphContent : eventsContent)
          )
        )
      )
    }

    function useCrossTabGitStatus(cwd, sessionId) {
      const [snap, setSnap] = React.useState(null)

      const fetchStatus = React.useCallback(() => {
        if (typeof document !== 'undefined' && document.hidden) return
        const query = []
        if (cwd) query.push('cwd=' + encodeURIComponent(cwd))
        if (sessionId) query.push('sessionId=' + encodeURIComponent(sessionId))
        fetch('/dsh-gitea/git-status' + (query.length ? '?' + query.join('&') : ''), { cache: 'no-store' })
          .then((res) => res.json())
          .then((data) => {
            setSnap(data)
            if (typeof BroadcastChannel !== 'undefined') {
              const ch = new BroadcastChannel('dsh_gitea_sync')
              ch.postMessage({ type: 'git-status', payload: data })
              ch.close()
            }
          })
          .catch(() => {
            setSnap({ ok: false })
          })
      }, [cwd, sessionId])

      React.useEffect(() => {
        let alive = true
        const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('dsh_gitea_sync') : null

        if (channel) {
          channel.onmessage = (ev) => {
            if (alive && ev.data && ev.data.type === 'git-status') {
              setSnap(ev.data.payload)
            }
          }
        }

        const onVisibilityChange = () => {
          if (typeof document !== 'undefined' && !document.hidden && alive) {
            fetchStatus()
          }
        }
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
          document.addEventListener('visibilitychange', onVisibilityChange)
        }

        let abortController = typeof AbortController !== 'undefined' ? new AbortController() : null
        if (typeof navigator !== 'undefined' && navigator.locks && abortController) {
          navigator.locks.request('dsh_gitea_status_leader', { signal: abortController.signal }, async () => {
            fetchStatus()
            const id = setInterval(fetchStatus, 4000)
            return new Promise((resolve) => {
              abortController.signal.addEventListener('abort', () => {
                clearInterval(id)
                resolve()
              })
            })
          }).catch(() => {
            fetchStatus()
          })
        } else {
          fetchStatus()
          const id = setInterval(fetchStatus, 4000)
          return () => {
            alive = false
            clearInterval(id)
            if (channel) channel.close()
            if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
              document.removeEventListener('visibilitychange', onVisibilityChange)
            }
          }
        }

        return () => {
          alive = false
          if (abortController) abortController.abort()
          if (channel) channel.close()
          if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
            document.removeEventListener('visibilitychange', onVisibilityChange)
          }
        }
      }, [cwd, sessionId, fetchStatus])

      return [snap, fetchStatus]
    }

    function GitStrip(props) {
      const t = typeof props.t === 'function' ? props.t : makeT(props.locale)
      const [open, setOpen] = React.useState(false)
      const session = props.useSession ? props.useSession(function (s) { return s }) : null
      const workspaces = props.useWorkspaces ? props.useWorkspaces(function (s) { return s }) : null
      const cwd = workspaceCwdFrom(session, workspaces)
      const sessionId = chipSessionId(props, session)
      const statusRes = useCrossTabGitStatus(cwd, sessionId)
      const snap = Array.isArray(statusRes) ? statusRes[0] : statusRes
      const fetchStatus = Array.isArray(statusRes) ? statusRes[1] : null

      const ready = snap && snap.ok
      const pr = ready && snap.pr ? snap.pr : null

      const syncBadge = []
      if (ready && snap.ahead > 0) {
        syncBadge.push(React.createElement('span', { key: 'a', className: 'dgt-git-badge dgt-git-ahead', title: t('gitAhead') + ': ' + snap.ahead }, '\u2191' + snap.ahead))
      }
      if (ready && snap.behind > 0) {
        syncBadge.push(React.createElement('span', { key: 'b', className: 'dgt-git-badge dgt-git-behind', title: t('gitBehind') + ': ' + snap.behind }, '\u2193' + snap.behind))
      }

      const chipLabel = [
        (ready ? ((snap.branch || '?') + (snap.dirty ? ' *' : '')) : 'git'),
        ...syncBadge,
        (pr && pr.prNumber ? ' #' + pr.prNumber : ''),
        (pr && pr.ciFailed ? ' CI\u2717' : ''),
      ]

      const chip = React.createElement('button', {
        type: 'button',
        className: 'dgt-git-chip' + (ready && snap.dirty ? ' dgt-git-dirty' : '') + (ready ? '' : ' dgt-git-muted'),
        title: t('gitHint'),
        'aria-expanded': open,
        onClick: () => setOpen((value) => !value),
      }, ...chipLabel)

      const drawer = open ? React.createElement(GitSidebarDrawer, {
        cwd,
        sessionId,
        snap,
        ready,
        onClose: () => setOpen(false),
        onRefresh: fetchStatus,
        t,
      }) : null

      return React.createElement('div', { className: 'dgt-git-wrap' }, chip, drawer)
    }

    function apply(ctx) {
      const localeSvc = getService(ctx, 'locale')
      const slotsSvc = getService(ctx, 'slots')

      try {
        if (localeSvc && typeof ctx.effect === 'function') {
          ctx.effect(() => {
            try {
              if (typeof localeSvc.register === 'function') {
                localeSvc.register(NS, { en })
              }
            } catch (err) {
              console.warn('[dsh-gitea] словарь уже зарегистрирован:', (err && err.message) || err)
            }
          }, 'dsh-gitea: словарь en')
        }
      } catch (taken) {
        console.warn('[dsh-gitea] словарь уже зарегистрирован:', (taken && taken.message) || taken)
      }

      function useLocale() { return useActiveLocale(ctx) }

      if (slotsSvc && typeof slotsSvc.inject === 'function') {
        try {
          slotsSvc.inject('settings.plugin.item', () => slotsSvc.register(
            {
              name: 'settings.plugin.item',
              key: NS,
              locale: NS,
              inject: () => ({ ctx }),
            },
            (props) => React.createElement(GiteaPluginCard, Object.assign({}, props, { ctx, locale: useLocale() })),
          ))
        } catch (err) {
          console.error('[dsh-gitea] ошибка регистрации settings.plugin.item:', err)
        }

        try {
          slotsSvc.inject('conversation.session.header.utilities', () => slotsSvc.register(
            {
              name: 'conversation.session.header.utilities',
              id: '@goodandready/dsh-gitea',
              order: 25,
            },
            (props) => React.createElement(GitStrip, Object.assign({}, props, { locale: useLocale() })),
          ))
        } catch (err) {
          console.error('[dsh-gitea] ошибка регистрации conversation.session.header.utilities:', err)
        }
      }
    }

    module.exports = { apply, inject: ['slots', 'locale', 'settingsScope'] }
    return module.exports
  },
})

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
      '.dgt-graph-more:hover{background:var(--dsw-alias-bg-layer-2)}'

    const cssId = 'dsh-gitea/PluginCard.module.css'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="' + cssId + '"]')) {
      const tag = document.createElement('style')
      tag.textContent = css
      tag.setAttribute('data-plugin', 'dsh-gitea')
      tag.dataset.pluginCss = cssId
      document.head.appendChild(tag)
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
      expand: 'Expand',
      collapse: 'Collapse',
      gitHint: 'Git status for this chat: branch and uncommitted changes.',
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
      expand: 'Развернуть',
      collapse: 'Свернуть',
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
      return React.useSyncExternalStore(
        React.useMemo(() => (cb) => (ctx && ctx.locale ? ctx.locale.subscribe(cb) : () => {}), [ctx]),
        React.useCallback(() => {
          if (ctx && ctx.locale) {
            const active = ctx.locale.getSnapshot().active
            if (typeof active === 'string' && active) return active
          }
          return typeof navigator !== 'undefined' ? String(navigator.language || '').slice(0, 2) : 'en'
        }, [ctx]),
      )
    }

    function makeT(locale) {
      const dict = String(locale || '').startsWith('ru') ? ru : en
      return (key) => dict[key] || en[key] || key
    }

    function sameDraft(a, b) {
      const left = a || {}
      const right = b || {}
      return String(left.baseUrl || '') === String(right.baseUrl || '') &&
        String(left.tokenEnv || '') === String(right.tokenEnv || '')
    }

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
        React.createElement('p', { className: 'dgt-hint' }, hint),
      )
    }

    function GiteaSettingsForm(props) {
      const t = props.t
      const onDirty = props.onDirty
      const [saved, setSaved] = React.useState(null)
      const [draft, setDraft] = React.useState(null)
      const [tokenConfigured, setTokenConfigured] = React.useState(false)
      const [tokenEnvError, setTokenEnvError] = React.useState('')
      const [saving, setSaving] = React.useState(false)
      const [err, setErr] = React.useState('')

      const applyPayload = (data) => {
        const cfg = data && data.config ? data.config : {}
        const next = {
          baseUrl: cfg.baseUrl || '',
          tokenEnv: cfg.tokenEnv || '',
        }
        setSaved(next)
        setDraft(next)
        setTokenConfigured(!!(data && data.tokenConfigured))
        setTokenEnvError((data && data.tokenEnvError) || '')
      }

      React.useEffect(() => {
        let alive = true
        fetch('/dsh-gitea/config', { cache: 'no-store' })
          .then((res) => res.json())
          .then((data) => { if (alive) applyPayload(data) })
          .catch((e) => { if (alive) setErr(String(e && e.message ? e.message : e)) })
        return () => { alive = false }
      }, [])

      const setField = (key, value) => setDraft((d) => Object.assign({}, d || {}, { [key]: value }))
      const dirty = !!(draft && saved && !sameDraft(draft, saved))
      React.useEffect(() => { if (typeof onDirty === 'function') onDirty(dirty) }, [dirty, onDirty])
      const blocked = !dirty || saving || !draft

      const save = async () => {
        if (!draft) return
        setErr('')
        setSaving(true)
        try {
          const res = await fetch('/dsh-gitea/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft),
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

      if (!draft) return React.createElement('p', { className: 'dgt-hint' }, t('loading'))

      return React.createElement(React.Fragment, null,
        React.createElement('p', { className: 'dgt-hint' }, t('intro')),
        valueField('plugin-config-dsh-gitea-url', t('baseUrl'), t('baseUrlHint'), draft.baseUrl, (v) => setField('baseUrl', v)),
        valueField('plugin-config-dsh-gitea-token-env', t('tokenEnv'), t('tokenEnvHint'), draft.tokenEnv, (v) => setField('tokenEnv', v)),
        React.createElement('div', { className: 'dgt-fieldHead' },
          React.createElement('span', { className: 'dgt-badge' + (tokenConfigured ? ' dgt-badgeOn' : '') },
            tokenConfigured ? t('tokenOn') : t('tokenOff')),
        ),
        tokenEnvError ? React.createElement('p', { className: 'dgt-failed' }, tokenEnvError) : null,
        typeof location !== 'undefined' && location.protocol === 'https:' && /^http:\/\//i.test(draft.baseUrl || '')
          ? React.createElement('p', { className: 'dgt-failed' }, 'Gitea endpoint is HTTP, but DSH is HTTPS — embedded Gitea pages will be blocked (mixed content). Use an HTTPS Gitea endpoint / reverse proxy.')
          : null,
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
        const load = () => {
          fetch('/dsh-gitea/events', { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => { if (alive) setEvents(data && data.data ? data.data : []) })
            .catch(() => { if (alive) setEvents([]) })
        }
        load()
        const id = setInterval(load, 5000)
        return () => { alive = false; clearInterval(id) }
      }, [])
      const rows = Array.isArray(events) ? events : []
      return React.createElement('div', { className: 'dgt-field' },
        React.createElement('div', { className: 'dgt-fieldHead' },
          React.createElement('span', { className: 'dgt-label' }, 'Gitea events'),
        ),
        rows.length === 0
          ? React.createElement('p', { className: 'dgt-hint' }, 'Событий пока нет. Настройте webhook в Gitea: Settings → Webhooks → Add, URL ' + (typeof location !== 'undefined' ? location.origin : '') + '/dsh-gitea/webhook, тип gitea.')
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
        }, React.createElement(GiteaSettingsForm, { t, onDirty: setDirty })),
      )
    }

    function GiteaSidebarSection(props) {
      const t = typeof props.t === 'function' ? props.t : makeT(props.locale)
      return React.createElement('div', { style: { padding: 16 } },
        React.createElement(GiteaSettingsForm, { t }),
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

    function GitGraphDialog(props) {
      const { cwd, sessionId, currentBranch, onClose, t } = props
      const [data, setData] = React.useState(null)
      const [loading, setLoading] = React.useState(true)
      const [limit, setLimit] = React.useState(100)

      const load = React.useCallback((reqLimit) => {
        setLoading(true)
        const query = ['limit=' + reqLimit]
        if (cwd) query.push('cwd=' + encodeURIComponent(cwd))
        if (sessionId) query.push('sessionId=' + encodeURIComponent(sessionId))
        fetch('/dsh-gitea/git-graph?' + query.join('&'), { cache: 'no-store' })
          .then((res) => res.json())
          .then((res) => {
            if (res?.ok && res.data) setData(res.data)
          })
          .catch(() => {})
          .finally(() => setLoading(false))
      }, [cwd, sessionId])

      React.useEffect(() => { load(limit) }, [load, limit])

      React.useEffect(() => {
        const onKeyDown = (e) => {
          if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [onClose])

      const commits = data?.commits || []
      const lanes = data?.lanes || []
      const baseUrl = data?.baseUrl || ''
      const owner = data?.owner || ''
      const repo = data?.repo || ''

      return React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'dgt-backdrop', onClick: onClose }),
        React.createElement('div', { className: 'dgt-graph-dialog', role: 'dialog', 'aria-modal': true },
          React.createElement('div', { className: 'dgt-graph-head' },
            React.createElement('h3', { className: 'dgt-graph-title' },
              t('graphTitle') + (repo ? ' — ' + repo : '') + (currentBranch ? ' (' + currentBranch + ')' : '')
            ),
            React.createElement('button', {
              type: 'button',
              className: 'dgt-graph-close',
              'aria-label': t('graphClose'),
              onClick: onClose,
            }, '\u00d7')
          ),
          React.createElement('div', { className: 'dgt-graph-body' },
            loading && commits.length === 0
              ? React.createElement('div', { style: { padding: '24px 0', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, t('graphLoading'))
              : commits.length === 0
                ? React.createElement('div', { style: { padding: '24px 0', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, t('graphEmpty'))
                : commits.map((commit, idx) => {
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
                            className: 'dgt-graph-ref' + (ref === currentBranch ? ' dgt-graph-refCurrent' : ''),
                          }, ref)),
                          ciBadge,
                          React.createElement('span', null, commit.author || ''),
                          React.createElement('span', null, '\u00b7'),
                          React.createElement('span', null, formatRelativeTime(commit.authorTime, t))
                        )
                      )
                    )
                  }),
            data?.hasMore ? React.createElement('button', {
              type: 'button',
              className: 'dgt-graph-more',
              onClick: () => setLimit((prev) => prev + 100),
            }, t('graphLoadMore')) : null
          )
        )
      )
    }

    function useCrossTabGitStatus(cwd, sessionId) {
      const [snap, setSnap] = React.useState(null)

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

        const fetchStatus = () => {
          const query = []
          if (cwd) query.push('cwd=' + encodeURIComponent(cwd))
          if (sessionId) query.push('sessionId=' + encodeURIComponent(sessionId))
          fetch('/dsh-gitea/git-status' + (query.length ? '?' + query.join('&') : ''), { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => {
              if (alive) {
                setSnap(data)
                if (channel) channel.postMessage({ type: 'git-status', payload: data })
              }
            })
            .catch(() => {
              if (alive) setSnap({ ok: false })
            })
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
          }
        }

        return () => {
          alive = false
          if (abortController) abortController.abort()
          if (channel) channel.close()
        }
      }, [cwd, sessionId])

      return snap
    }

    function GitStrip(props) {
      const t = typeof props.t === 'function' ? props.t : makeT(props.locale)
      const [open, setOpen] = React.useState(false)
      const [graphOpen, setGraphOpen] = React.useState(false)
      const session = props.useSession ? props.useSession(function (s) { return s }) : null
      const workspaces = props.useWorkspaces ? props.useWorkspaces(function (s) { return s }) : null
      const cwd = workspaceCwdFrom(session, workspaces)
      const sessionId = chipSessionId(props, session)
      const snap = useCrossTabGitStatus(cwd, sessionId)

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
        onClick: () => setOpen((value) => !value),
      }, ...chipLabel)

      let panel = null
      if (open) {
        const meta = []
        if (pr && pr.prNumber) {
          meta.push(React.createElement('div', { key: 'pr', className: 'dgt-git-row' },
            React.createElement('span', { className: 'dgt-git-branch' }, 'PR #' + pr.prNumber),
            React.createElement('span', { className: 'dgt-git-state' }, 'open'),
          ))
        }
        if (pr && pr.ciFailed) {
          meta.push(React.createElement('div', { key: 'ci', className: 'dgt-git-row' },
            React.createElement('span', { className: 'dgt-git-branch' }, 'CI'),
            React.createElement('span', { className: 'dgt-git-state dgt-git-stateDirty' }, 'failed'),
          ))
        }

        const syncInfo = []
        if (ready) {
          const syncText = (snap.ahead > 0 || snap.behind > 0)
            ? ((snap.ahead > 0 ? t('gitAhead') + ' ' + snap.ahead : '') +
               (snap.ahead > 0 && snap.behind > 0 ? ', ' : '') +
               (snap.behind > 0 ? t('gitBehind') + ' ' + snap.behind : '') +
               (snap.upstream ? ' (' + snap.upstream + ')' : ''))
            : (snap.upstream ? t('gitUpToDate') + ' (' + snap.upstream + ')' : '')
          if (syncText) {
            syncInfo.push(React.createElement('div', { key: 'sync', className: 'dgt-git-row' },
              React.createElement('span', { className: 'dgt-git-branch' }, t('gitSync')),
              React.createElement('span', { className: 'dgt-git-state' + (snap.behind > 0 ? ' dgt-git-stateDirty' : '') }, syncText),
            ))
          }
        }

        const body = ready
          ? [
              React.createElement('p', { key: 'kicker', className: 'dgt-git-kicker' }, t('gitHint')),
              React.createElement('div', { key: 'repo', className: 'dgt-git-repo' }, snap.repoName || snap.branch || 'git'),
              React.createElement('div', { key: 'row', className: 'dgt-git-row' },
                React.createElement('span', { className: 'dgt-git-branch' }, snap.branch || '?'),
                React.createElement('span', { className: 'dgt-git-state' + (snap.dirty ? ' dgt-git-stateDirty' : '') }, snap.dirty ? t('gitDirty') + (snap.dirtyFiles ? ' (' + snap.dirtyFiles + ')' : '') : t('gitClean')),
              ),
              ...syncInfo,
              ...meta,
              React.createElement('button', {
                key: 'graph-btn',
                type: 'button',
                className: 'dgt-btn-graph',
                onClick: () => { setOpen(false); setGraphOpen(true) },
              }, '\u22b9 ' + t('openGraph')),
              React.createElement('div', { key: 'commits-h', className: 'dgt-git-h' }, t('gitCommits')),
              React.createElement('pre', { key: 'commits', className: 'dgt-git-pre' }, snap.graph || t('gitNoCommits')),
              React.createElement('div', { key: 'diff-h', className: 'dgt-git-h' }, t('gitChanges')),
              React.createElement('pre', { key: 'diff', className: 'dgt-git-pre' }, snap.dirty ? (snap.diff || t('gitDirty')) : t('gitNoChanges')),
            ]
          : [
              React.createElement('p', { key: 'kicker', className: 'dgt-git-kicker' }, t('gitHint')),
              React.createElement('p', { key: 'empty', className: 'dgt-git-empty' }, t('gitEmpty')),
            ]
        panel = React.createElement('div', { className: 'dgt-git-panel' }, body)
      }

      const dialog = graphOpen ? React.createElement(GitGraphDialog, {
        cwd,
        sessionId,
        currentBranch: snap?.branch || '',
        onClose: () => setGraphOpen(false),
        t,
      }) : null

      return React.createElement('div', { className: 'dgt-git-wrap' }, chip, panel, dialog)
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, ru }), 'dsh-gitea: dictionaries')
      function useLocale() { return useActiveLocale(ctx) }
      const tryPluginItem = () => {
        try {
          ctx.slots.inject('settings.plugin.item', () => ctx.slots.register(
            {
              name: 'settings.plugin.item',
              key: NS,
              locale: NS,
              inject: () => ({ ctx }),
            },
            (props) => React.createElement(GiteaPluginCard, Object.assign({}, props, { locale: useLocale() })),
          ))
          return true
        } catch {
          return false
        }
      }
      if (!tryPluginItem()) {
        ctx.slots.inject('settings.section', () => ctx.slots.register(
          {
            name: 'settings.section',
            id: '@goodandready/dsh-gitea',
            order: 31,
            locale: NS,
            label: () => {
              const snap = ctx.locale && ctx.locale.getSnapshot ? ctx.locale.getSnapshot() : {}
              return makeT(snap.active)('title')
            },
            inject: () => ({ ctx }),
          },
          (props) => React.createElement(GiteaSidebarSection, Object.assign({}, props, { locale: useLocale() })),
        ))
      }
      ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register(
        {
          name: 'conversation.session.header.utilities',
          id: '@goodandready/dsh-gitea',
          order: 25,
        },
        (props) => React.createElement(GitStrip, Object.assign({}, props, { locale: useLocale() })),
      ))
    }

    module.exports = { apply, inject: ['slots', 'locale'] }
    return module.exports
  },
})

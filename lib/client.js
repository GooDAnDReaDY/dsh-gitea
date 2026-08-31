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
      '.dgt-git-pre{font-size:11px;line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0;padding:8px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}'

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

    function GitStrip(props) {
      const t = typeof props.t === 'function' ? props.t : makeT(props.locale)
      const [snap, setSnap] = React.useState(null)
      const [open, setOpen] = React.useState(false)
      const session = props.useSession ? props.useSession(function (s) { return s }) : null
      const workspaces = props.useWorkspaces ? props.useWorkspaces(function (s) { return s }) : null
      const cwd = workspaceCwdFrom(session, workspaces)
      const sessionId = chipSessionId(props, session)

      React.useEffect(() => {
        let alive = true
        const load = () => {
          const query = []
          if (cwd) query.push('cwd=' + encodeURIComponent(cwd))
          if (sessionId) query.push('sessionId=' + encodeURIComponent(sessionId))
          fetch('/dsh-gitea/git-status' + (query.length ? '?' + query.join('&') : ''), { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => { if (alive) setSnap(data) })
            .catch(() => { if (alive) setSnap({ ok: false }) })
        }
        load()
        const id = setInterval(load, 4000)
        return () => { alive = false; clearInterval(id) }
      }, [cwd, sessionId])

      const ready = snap && snap.ok
      const chip = React.createElement('button', {
        type: 'button',
        className: 'dgt-git-chip' + (ready && snap.dirty ? ' dgt-git-dirty' : '') + (ready ? '' : ' dgt-git-muted'),
        title: t('gitHint'),
        onClick: () => setOpen((value) => !value),
      }, ready ? ((snap.branch || '?') + (snap.dirty ? ' *' : '')) : 'git')

      let panel = null
      if (open) {
        const body = ready
          ? [
              React.createElement('p', { key: 'kicker', className: 'dgt-git-kicker' }, t('gitHint')),
              React.createElement('div', { key: 'repo', className: 'dgt-git-repo' }, snap.repoName || snap.branch || 'git'),
              React.createElement('div', { key: 'row', className: 'dgt-git-row' },
                React.createElement('span', { className: 'dgt-git-branch' }, snap.branch || '?'),
                React.createElement('span', { className: 'dgt-git-state' + (snap.dirty ? ' dgt-git-stateDirty' : '') }, snap.dirty ? t('gitDirty') : t('gitClean')),
              ),
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

      return React.createElement('div', { className: 'dgt-git-wrap' }, chip, panel)
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

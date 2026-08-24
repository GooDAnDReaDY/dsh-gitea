window.__ModuleLoader__.load({
  id: '@goodandready/dsh-gitea',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')

    const CSS =
      '.dgt-wrap{display:flex;flex-direction:column;gap:22px;padding:4px 0;max-width:720px}' +
      '.dgt-block{display:flex;flex-direction:column;gap:10px}' +
      '.dgt-h{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}' +
      '.dgt-sub{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.45}' +
      '.dgt-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary)}' +
      '.dgt-field input{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px;font-size:13px}' +
      '.dgt-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
      '.dgt-save{background:var(--dsw-alias-brand-primary);color:#fff;border:none;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer}' +
      '.dgt-ok{font-size:12px;color:var(--dsw-alias-state-success-primary)}' +
      '.dgt-bad{font-size:12px;color:var(--dsw-alias-state-error-primary)}' +
      '.dgt-badge{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);white-space:nowrap}' +
      '.dgt-badge-on{color:var(--dsw-alias-state-success-primary);border-color:currentColor}' +
      '.dgt-git-wrap{position:relative;display:flex;align-items:center}' +
      '.dgt-git-chip{font-size:11px;line-height:1;padding:4px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dgt-git-dirty{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary)}' +
      '.dgt-git-muted{color:var(--dsw-alias-label-secondary)}' +
      '.dgt-git-panel{position:absolute;top:calc(100% + 8px);right:0;z-index:40;width:min(520px,70vw);max-height:min(420px,60vh);overflow:auto;padding:10px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);box-shadow:0 8px 24px rgba(0,0,0,.18)}' +
      '.dgt-git-meta{font-size:11px;color:var(--dsw-alias-label-secondary);margin-bottom:8px;word-break:break-all}' +
      '.dgt-git-pre{font-size:11px;line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0 0 10px;padding:8px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}'

    const cssId = 'dsh-gitea/settings.module.css'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="' + cssId + '"]')) {
      const tag = document.createElement('style')
      tag.textContent = CSS
      tag.setAttribute('data-plugin', 'dsh-gitea')
      tag.dataset.pluginCss = cssId
      document.head.appendChild(tag)
    }

    function GiteaSection() {
      const [draft, setDraft] = React.useState(null)
      const [tokenConfigured, setTokenConfigured] = React.useState(false)
      const [tokenEnvError, setTokenEnvError] = React.useState('')
      const [saved, setSaved] = React.useState(false)
      const [err, setErr] = React.useState('')

      const applyPayload = (data) => {
        const cfg = data && data.config ? data.config : {}
        setDraft(Object.assign({}, cfg))
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

      if (!draft) return React.createElement('div', { className: 'dgt-wrap' }, 'Loading\u2026')

      const setField = (key, value) => setDraft((d) => Object.assign({}, d || {}, { [key]: value }))

      const save = async () => {
        setErr('')
        setSaved(false)
        try {
          const res = await fetch('/dsh-gitea/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error((data && data.error && data.error.message) || ('HTTP ' + res.status))
          applyPayload(data)
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        } catch (e) {
          setErr(String(e && e.message ? e.message : e))
        }
      }

      const textField = (key, label, hint) => React.createElement('label', { className: 'dgt-field' }, label,
        React.createElement('input', {
          value: draft && draft[key] !== undefined ? draft[key] : '',
          onChange: (e) => setField(key, e.target.value),
        }),
        hint ? React.createElement('span', { className: 'dgt-sub' }, hint) : null)

      return React.createElement('div', { className: 'dgt-wrap' },
        React.createElement('div', { className: 'dgt-block' },
          React.createElement('div', { className: 'dgt-h' }, 'Gitea'),
          React.createElement('div', { className: 'dgt-sub' },
            'Point tools at a Gitea or Forgejo instance. Create a DSH credential, paste the API token there, then type only the credential name below (for example GITEA_TOKEN). Never paste the token into this form.'),
        ),
        textField('baseUrl', 'Instance URL', 'e.g. https://gitea.example.com'),
        textField('tokenEnv', 'Credential name', 'Name of the DSH credential, not the token itself. Default GITEA_TOKEN.'),
        React.createElement('div', { className: 'dgt-row' },
          React.createElement('span', {
            className: 'dgt-badge' + (tokenConfigured ? ' dgt-badge-on' : ''),
          }, tokenConfigured ? 'Token configured' : 'Token not configured'),
        ),
        tokenEnvError ? React.createElement('div', { className: 'dgt-bad' }, tokenEnvError) : null,
        textField('defaultOwner', 'Default owner', ''),
        textField('defaultRepo', 'Default repo', ''),
        textField('repoDir', 'Working copy path', 'Absolute path to a git checkout. Used by worktree tools and the git chip in the chat header.'),
        React.createElement('div', { className: 'dgt-row' },
          React.createElement('button', { type: 'button', className: 'dgt-save', onClick: save }, 'Save'),
          saved ? React.createElement('span', { className: 'dgt-ok' }, 'Saved') : null,
          err ? React.createElement('span', { className: 'dgt-bad' }, err) : null,
        ),
      )
    }

    function GitStrip() {
      const [snap, setSnap] = React.useState(null)
      const [open, setOpen] = React.useState(false)

      React.useEffect(() => {
        let alive = true
        const load = () => {
          fetch('/dsh-gitea/git-status', { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => { if (alive) setSnap(data) })
            .catch(() => { if (alive) setSnap({ ok: false }) })
        }
        load()
        const id = setInterval(load, 4000)
        return () => { alive = false; clearInterval(id) }
      }, [])

      if (!snap || !snap.ok) {
        return React.createElement('button', {
          type: 'button',
          className: 'dgt-git-chip dgt-git-muted',
          title: (snap && snap.error) || 'Set working copy path in Gitea settings',
        }, 'git')
      }

      const label = (snap.branch || '?') + (snap.dirty ? ' *' : '')
      return React.createElement('div', { className: 'dgt-git-wrap' },
        React.createElement('button', {
          type: 'button',
          className: 'dgt-git-chip' + (snap.dirty ? ' dgt-git-dirty' : ''),
          onClick: () => setOpen((value) => !value),
          title: [snap.repoName, snap.worktree].filter(Boolean).join(' · '),
        }, label),
        open ? React.createElement('div', { className: 'dgt-git-panel' },
          React.createElement('div', { className: 'dgt-git-meta' },
            [snap.repoName, snap.branch, snap.dirty ? 'dirty' : 'clean', snap.worktree].filter(Boolean).join(' · ')),
          React.createElement('pre', { className: 'dgt-git-pre' }, snap.graph || '(no commits)'),
          React.createElement('pre', { className: 'dgt-git-pre' }, snap.diff || '(clean working tree)'),
        ) : null,
      )
    }

    function apply(ctx) {
      ctx.slots.inject('settings.section', () => ctx.slots.register(
        {
          name: 'settings.section',
          id: '@goodandready/dsh-gitea',
          order: 31,
          label: () => 'Gitea',
        },
        GiteaSection,
      ))
      ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register(
        {
          name: 'conversation.session.header.utilities',
          id: '@goodandready/dsh-gitea',
          order: 25,
        },
        GitStrip,
      ))
    }

    module.exports = { apply, inject: ['slots'] }
    return module.exports
  },
})

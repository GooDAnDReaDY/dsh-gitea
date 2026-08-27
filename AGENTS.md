# Agent guide

## Package identity

Keep all three package identity sites aligned as `@@goodandready/dsh-gitea`:

1. `package.json` package name
2. `cordis.patch.yml` loader name
3. `lib/client.js` loader id

The short Cordis patch id remains `dsh-gitea`.

## Workflow

- Use `git-agent` for every Git operation; never use bare `git`.
- Never commit, print, log, or embed tokens, credentials, private keys, or real instance secrets.
- Run `npm test` before committing behavior changes.
- Install the published private package by exact version; after a package change, verify the installed copy.

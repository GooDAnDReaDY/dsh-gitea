const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const HEX_TOKEN = /^[a-fA-F0-9]{32,}$/

export function isCredentialRefName(value) {
  return REF_PATTERN.test(String(value || ''))
}

export function looksLikeToken(value) {
  const s = String(value || '').trim()
  return HEX_TOKEN.test(s)
}

export function assertCredentialRef(ref) {
  if (!isCredentialRefName(ref)) {
    throw new Error('credential ref must be an environment variable name')
  }
  return ref
}

export function credentialRefStatus(tokenEnv) {
  const name = String(tokenEnv || '').trim()
  if (looksLikeToken(name)) {
    return {
      ok: false,
      error: 'That looks like an API token. Put the secret in DSH credentials and enter only the credential name (for example GITEA_TOKEN).',
    }
  }
  if (!isCredentialRefName(name)) {
    return {
      ok: false,
      error: 'Credential ref must be an environment-variable name like GITEA_TOKEN.',
    }
  }
  return { ok: true, name }
}

/** Drop write-only secret fields so they never land in plugin settings. */
export function stripSecretsFromConfig(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  const config = { ...payload }
  delete config.keys
  delete config.token
  delete config.apiKey
  return config
}

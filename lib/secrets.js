const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export function assertCredentialRef(ref) {
  if (!REF_PATTERN.test(ref)) {
    throw new Error('credential ref must be an environment variable name')
  }
  return ref
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

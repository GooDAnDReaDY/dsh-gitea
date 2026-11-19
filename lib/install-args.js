/**
 * Canonical installer argument builder shared by deploy.sh and the
 * host-side one-click updater (lib/plugin-updater.js).
 *
 * Policy (issue #214, reaffirmed by #379): the npm release-age quarantine
 * (minimumReleaseAge) is never disabled for plugin installs. Both supported
 * install paths MUST build their command through this helper so the flag set
 * can never drift apart again; a regression test asserts the parity.
 */

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'

export function buildPluginInstallArgs({
  profileName = 'web',
  packageSpec,
  registry = DEFAULT_REGISTRY,
} = {}) {
  if (typeof packageSpec !== 'string' || packageSpec.trim() === '') {
    throw new TypeError('packageSpec is required')
  }
  if (
    typeof profileName !== 'string'
    || profileName.trim() === ''
    || profileName.includes('/')
    || profileName.includes('\\')
  ) {
    throw new TypeError('profileName must be a non-empty path-free string')
  }
  if (typeof registry !== 'string' || registry.trim() === '') {
    throw new TypeError('registry must be a non-empty string')
  }
  // NOTE: do NOT add --config.minimumReleaseAge=0 here; the release-age
  // quarantine is a deliberate supply-chain protection (issue #214, #379).
  return ['plugin', '--profile', profileName, 'add', packageSpec, `--registry=${registry}`]
}

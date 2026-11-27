import { buildFacadeDefs, buildFacadeRoutes } from './tool-facades.js'
import { loadRouteMap, platformSupports } from './route-map.js'

/**
 * capabilities (issue #397): adaptive platform matrix. Detects the instance
 * flavor, then answers per facade action whether the underlying platform
 * route exists - so agents learn "not supported here" before calling.
 */

// Known feature probes: platform route requirements of notable capabilities.
const FEATURE_PROBES = [
  { feature: 'codeSearch', method: 'GET', path: '/repos/{owner}/{repo}/search/code', note: 'Gitea and Forgejo REST APIs have no repository code search; use local git grep (#292).' },
  { feature: 'packageLookup', method: 'GET', path: '/packages/{owner}/{type}/{name}', note: 'Unversioned package lookup is Gitea-only; Forgejo exposes version-specific routes.' },
  { feature: 'packageLookupLatest', method: 'GET', path: '/packages/{owner}/{type}/{name}/-/latest', note: 'Latest-package shortcut.' },
  { feature: 'actionsRuns', method: 'GET', path: '/repos/{owner}/{repo}/actions/runs', note: 'Gitea Actions runs list.' },
  { feature: 'wikiPages', method: 'GET', path: '/repos/{owner}/{repo}/wiki/pages', note: 'Wiki pages.' },
]

export async function runCapabilities(args = {}, deps = {}) {
  const client = deps?.client
  let platform = 'gitea'
  let flavorVersion = ''
  if (client?.getVersion) {
    const res = await client.getVersion().catch(() => null)
    const version = String(res?.ok ? res.data?.version || '' : '').toLowerCase()
    if (version.includes('forgejo')) platform = 'forgejo'
    flavorVersion = version
  }
  if (args.platform === 'gitea' || args.platform === 'forgejo') platform = args.platform

  const includeEcosystem = args.include_ecosystem === true
  const allDefs = buildFacadeDefs()
  const facadeDefs = allDefs.filter((d) => includeEcosystem || !d.ecosystem)
  const routes = buildFacadeRoutes()
  const routeMap = loadRouteMap()[platform] ?? []

  const facades = facadeDefs.map((def) => {
    const actions = def.parameters?.action?.enum ?? []
    const actionRoutes = actions.map((action) => {
      const route = routes[def.name]?.[action]
      if (!route) return { action, route: null, supported: false }
      return { action, route: route.canonical, supported: true }
    })
    return {
      facade: def.name,
      ecosystem: Boolean(def.ecosystem),
      description: def.description,
      actions: actionRoutes,
      count: actions.length,
    }
  })

  const features = FEATURE_PROBES.map((probe) => ({
    ...probe,
    supported: platformSupports(platform, probe.method, probe.path),
  }))

  const capabilities = {
    platform,
    flavorVersion,
    routeCount: routeMap.length,
    facades,
    features,
    notes: [
      ...allDefs.filter((d) => d.ecosystem && !includeEcosystem)
        .map((d) => `Ecosystem facade ${d.name} is registered only with enableEcosystemTools: true.`),
    ],
  }
  return { ok: true, data: capabilities }
}

export async function runRouteCheck(args = {}) {
  const platform = args.platform === 'forgejo' || args.platform === 'gitea' ? args.platform : 'gitea'
  const method = String(args.method || 'GET').toUpperCase()
  const path = String(args.path || '')
  if (!path.startsWith('/')) {
    return { ok: false, error: 'path must start with /' }
  }
  return {
    ok: true,
    data: {
      platform,
      method,
      path,
      supported: platformSupports(platform, method, path),
      candidates: loadRouteMap()[platform]?.filter((r) => r.split(' ')[1].split('/').filter(Boolean).length === path.split('/').filter(Boolean).length).slice(0, 10) ?? [],
    },
  }
}

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * route-map (issue #397): runtime access to the compact platform route map
 * distilled from the vendored OpenAPI fixtures (scripts/build-route-map.mjs).
 * Used by gitea_capabilities to answer "does this platform support X?"
 * without network round-trips.
 */

const ROUTE_MAP_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'route-map.json')
let cache

export function loadRouteMap() {
  if (!cache) {
    cache = JSON.parse(readFileSync(ROUTE_MAP_FILE, 'utf8'))
  }
  return cache
}

export function platformSupports(platform, method, path) {
  const routes = loadRouteMap()[platform] ?? []
  const probe = `${String(method).toUpperCase()} ${path}`
  const segs = probe.split(' ')[1].split('/').filter(Boolean)
  for (const route of routes) {
    const [routeMethod, routeTemplate] = route.split(' ')
    if (routeMethod !== String(method).toUpperCase()) continue
    const tsegs = routeTemplate.split('/').filter(Boolean)
    if (tsegs.length !== segs.length) continue
    if (tsegs.every((t, i) => (t.startsWith('{') ? true : t === segs[i]))) return true
  }
  return false
}

export function matchRouteTemplates(platform, path) {
  const routes = loadRouteMap()[platform] ?? []
  const segs = String(path).split('/').filter(Boolean)
  return routes
    .map((r) => r.split(' ')[1])
    .filter((t) => {
      const tsegs = t.split('/').filter(Boolean)
      return tsegs.length === segs.length && tsegs.every((t, i) => (t.startsWith('{') ? true : t === segs[i]))
    })
}

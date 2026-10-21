import { wrap, pickQuery, asNumber } from './common.js'

const RELEASE_TOOLS = new Set([
  'gitea_releases',
  'gitea_release_plan',
  'gitea_release_assistant',
  'gitea_ci',
  'gitea_ci_logs_analyze',
  'gitea_task_tracker_sync',
  'gitea_memory_brain_sync',
  'gitea_incident_report',
  'gitea_packages_list',
  'gitea_package_get',
  'gitea_package_delete',
  'gitea_package_config',
])

export function isReleaseTool(name) {
  return RELEASE_TOOLS.has(name)
}

export async function handleReleaseTool(name, args, deps, ctx) {
  const { client, settings, remoteUrl, owner, repo } = ctx

  if (name === 'gitea_release_assistant') {
    const { runReleaseAssistant } = await import('../release-assistant.js')
    return runReleaseAssistant(args, deps)
  }

  if (name === 'gitea_memory_brain_sync') {
    const { runMemoryBrainSync } = await import('../memory-brain-sync.js')
    return runMemoryBrainSync(args, deps)
  }

  if (name === 'gitea_ci_logs_analyze') {
    const { runCiLogsAnalyze } = await import('../ci-explainer.js')
    return runCiLogsAnalyze(args, { ...deps, client, settings, remoteUrl })
  }

  if (name === 'gitea_task_tracker_sync') {
    const { runTaskTrackerSync } = await import('../task-tracker-sync.js')
    return runTaskTrackerSync(args, { ...deps, client, settings, remoteUrl })
  }

  if (name === 'gitea_incident_report') {
    const { runIncidentReport } = await import('../incident-report.js')
    return runIncidentReport(args, { ...deps, client, settings, remoteUrl })
  }

  if (name === 'gitea_release_plan') {
    const { buildReleasePlan } = await import('../release-generator.js')
    return buildReleasePlan({ ...args, owner: args.owner || owner, repo: args.repo || repo }, { ...deps, client, settings })
  }

  if (name === 'gitea_packages_list') {
    const { listRegistryPackages } = await import('../package-registry.js')
    return listRegistryPackages({ ...args, owner: args.owner || owner, repo: args.repo || repo }, { ...deps, client, settings })
  }

  if (name === 'gitea_package_get') {
    const { getRegistryPackage } = await import('../package-registry.js')
    return getRegistryPackage({ ...args, owner: args.owner || owner }, { ...deps, client, settings })
  }

  if (name === 'gitea_package_delete') {
    const { deleteRegistryPackageVersion } = await import('../package-registry.js')
    return deleteRegistryPackageVersion({ ...args, owner: args.owner || owner }, { ...deps, client, settings })
  }

  if (name === 'gitea_package_config') {
    const { generateRegistryConfig } = await import('../package-registry.js')
    return generateRegistryConfig({ ...args, owner: args.owner || owner }, { ...deps, client, settings })
  }

  switch (name) {
    case 'gitea_releases': {
      const action = args.action || 'list'
      if (action === 'list') {
        return wrap(await client.listReleases(owner, repo, pickQuery(args, ['limit', 'page'])))
      }
      if (action === 'create') {
        return wrap(await client.createRelease(owner, repo, {
          tag_name: args.tag_name,
          name: args.name,
          body: args.body,
        }))
      }
      if (action === 'update') {
        return wrap(await client.updateRelease(owner, repo, asNumber(args.release_id), { name: args.name, body: args.body }))
      }
      if (action === 'delete') {
        if (args.confirm !== true) {
          return { ok: false, error: 'Deleting a release requires confirm: true (boolean).' }
        }
        return wrap(await client.deleteRelease(owner, repo, asNumber(args.release_id)))
      }
      if (action === 'plan') {
        const { planReleaseNow } = await import('../release-now.js')
        return planReleaseNow({ owner, repo }, deps)
      }
      if (action === 'notes') {
        const { buildReleaseNotes } = await import('../release-notes.js')
        return buildReleaseNotes({ owner, repo, fromTag: args.fromTag, toTag: args.toTag }, { client })
      }
      return { ok: false, error: `unknown action: ${action}` }
    }

    case 'gitea_ci': {
      const action = args.action || 'status'
      if (action === 'status') {
        return wrap(await client.listActionsRuns(owner, repo, pickQuery(args, ['branch', 'sha', 'limit', 'page'])))
      }
      if (action === 'jobs') {
        return wrap(await client.listRunJobs(owner, repo, asNumber(args.run_id), {}))
      }
      if (action === 'run') {
        return wrap(await client.getActionsRun(owner, repo, asNumber(args.run_id)))
      }
      if (action === 'logs') {
        return wrap(await client.getJobLogs(owner, repo, asNumber(args.job_id)))
      }
      if (action === 'rerun') {
        if (args.confirm !== true) return { ok: false, error: 'Rerunning a job requires confirm: true (boolean).' }
        if (!args.job_id && !args.run_id) return { ok: false, error: 'Rerunning requires job_id or run_id.' }
        if (args.job_id) {
          if (args.run_id) {
            return wrap(await client.rerunActionsJob(owner, repo, asNumber(args.run_id), asNumber(args.job_id)))
          }
          return wrap(await client.rerunActionsJob(owner, repo, asNumber(args.job_id)))
        }
        return wrap(await client.rerunActionsRun(owner, repo, asNumber(args.run_id)))
      }
      if (action === 'explain') {
        const { explainFailedJob } = await import('../ci-explainer.js')
        return { ok: true, data: explainFailedJob(args.job || {}) }
      }
      return { ok: false, error: `unknown action: ${action}` }
    }

    default:
      return { ok: false, error: `Unknown release tool: ${name}` }
  }
}

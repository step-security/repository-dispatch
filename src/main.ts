import * as core from '@actions/core'
import * as github from '@actions/github'
import axios, {isAxiosError} from 'axios'
import {inspect} from 'util'

/* eslint-disable  @typescript-eslint/no-explicit-any */
function hasErrorStatus(error: any): error is {status: number} {
  return typeof error.status === 'number'
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

async function validateSubscription(): Promise<void> {
  const API_URL = `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/subscription`

  try {
    await axios.get(API_URL, {timeout: 3000})
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403) {
      core.error(
        'Subscription is not valid. Reach out to support@stepsecurity.io'
      )
      process.exit(1)
    } else {
      core.info('Timeout or API not reachable. Continuing to next step.')
    }
  }
}

async function run(): Promise<void> {
  try {
    await validateSubscription()
    const inputs = {
      token: core.getInput('token'),
      repository: core.getInput('repository'),
      eventType: core.getInput('event-type'),
      clientPayload: core.getInput('client-payload')
    }
    core.debug(`Inputs: ${inspect(inputs)}`)

    const [owner, repo] = inputs.repository.split('/')
    if (!owner || !repo) {
      throw new Error('Repository must be in format "owner/repo"')
    }

    const octokit = github.getOctokit(inputs.token)

    let clientPayload: any
    try {
      clientPayload = JSON.parse(inputs.clientPayload)
    } catch (error) {
      throw new Error('Invalid JSON in client-payload')
    }

    await octokit.rest.repos.createDispatchEvent({
      owner: owner,
      repo: repo,
      event_type: inputs.eventType,
      client_payload: clientPayload
    })
  } catch (error) {
    core.debug(inspect(error))
    if (hasErrorStatus(error) && error.status == 404) {
      core.setFailed(
        'Repository not found, OR token has insufficient permissions.'
      )
    } else {
      core.setFailed(getErrorMessage(error))
    }
  }
}

run()

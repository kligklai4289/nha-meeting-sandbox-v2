import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  INITIAL_ADMIN_EMAIL,
  provisionInitialAdmin,
  validateExecutionContext,
} from './lib/initialAdminProvisioning.mjs'
import { parseOperatorEnvironment } from './lib/operatorEnvironment.mjs'

const MODE_FLAGS = new Map([
  ['--capture-linked-staging', 'capture-linked-staging'],
  ['--dry-run', 'dry-run'],
  ['--execute', 'execute'],
])

function invalidArguments() {
  throw new Error('Invalid operator arguments')
}

export function assertSupportedNodeVersion(version = process.versions.node) {
  const match = /^(\d+)\./.exec(version)
  if (!match || Number(match[1]) < 22) {
    throw new Error('Unsupported Node.js runtime: requires Node.js >=22')
  }
}

export function parseOperatorArguments(argv) {
  const modes = []
  let target = null
  let targetCount = 0
  let stagingConfirmed = false
  let confirmationCount = 0

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (MODE_FLAGS.has(argument)) {
      modes.push(MODE_FLAGS.get(argument))
    } else if (argument === '--target') {
      targetCount += 1
      target = argv[index + 1] ?? null
      index += 1
    } else if (argument === '--confirm-linked-project-is-staging') {
      confirmationCount += 1
      stagingConfirmed = true
    } else {
      invalidArguments()
    }
  }

  if (
    modes.length !== 1
    || targetCount !== 1
    || target !== 'staging'
    || confirmationCount !== 1
    || stagingConfirmed !== true
  ) invalidArguments()

  return { mode: modes[0], target, stagingConfirmed }
}

export async function captureLinkedStagingRef({
  linkedProjectRef,
  target,
  stagingConfirmed,
  writeMapping,
}) {
  if (!linkedProjectRef || target !== 'staging' || stagingConfirmed !== true) {
    throw new Error('Staging capture refused')
  }
  await writeMapping({ stagingProjectRef: linkedProjectRef })
}

function createRequestId() {
  return `request-${randomBytes(8).toString('hex')}`
}

async function readLinkedProjectRef(root) {
  return (await readFile(resolve(root, 'supabase', '.temp', 'project-ref'), 'utf8')).trim()
}

async function readCapturedStagingRef(root) {
  const content = await readFile(resolve(root, '.supabase-projects.local.json'), 'utf8')
  const mapping = JSON.parse(content)
  return typeof mapping.stagingProjectRef === 'string' ? mapping.stagingProjectRef : ''
}

function authAdminFailure() {
  throw new Error('Auth Admin operation failed')
}

export function createAuthAdminPort(client) {
  return {
    async findUserByEmail(email) {
      const perPage = 1000
      const seenPages = new Set()
      const matches = []
      let expectedLastPage = null
      let expectedTotal = null
      let observedUsers = 0
      let page = 1

      for (;;) {
        if (!Number.isInteger(page) || page < 1 || seenPages.has(page)) authAdminFailure()
        seenPages.add(page)

        let response
        try {
          response = await client.auth.admin.listUsers({ page, perPage })
        } catch {
          authAdminFailure()
        }
        const { data, error } = response ?? {}
        if (
          error
          || !data
          || !Array.isArray(data.users)
          || !Number.isInteger(data.lastPage)
          || data.lastPage < 0
          || !Number.isInteger(data.total)
          || data.total < 0
          || !(data.nextPage === null || Number.isInteger(data.nextPage))
        ) authAdminFailure()

        if (expectedLastPage === null) {
          expectedLastPage = data.lastPage
          expectedTotal = data.total
          const emptySentinel = data.lastPage === 0 && data.total === 0
          if (!emptySentinel && (data.lastPage < 1 || data.total < 1)) authAdminFailure()
        } else if (data.lastPage !== expectedLastPage || data.total !== expectedTotal) {
          authAdminFailure()
        }

        observedUsers += data.users.length
        if (observedUsers > expectedTotal) authAdminFailure()

        for (const candidate of data.users) {
          if (candidate?.email?.toLowerCase() !== email.toLowerCase()) continue
          if (typeof candidate.id !== 'string' || !candidate.id) authAdminFailure()
          matches.push({ id: candidate.id })
        }

        if (data.nextPage === null) {
          const completedEmptySentinel = data.lastPage === 0
            && page === 1
            && observedUsers === 0
          const completedPagination = data.lastPage > 0
            && page === data.lastPage
            && observedUsers === expectedTotal
          if (!completedEmptySentinel && !completedPagination) authAdminFailure()
          break
        }
        if (
          data.nextPage !== page + 1
          || data.nextPage > data.lastPage
          || seenPages.has(data.nextPage)
        ) authAdminFailure()
        page = data.nextPage
      }

      if (matches.length > 1) authAdminFailure()
      return matches[0] ?? null
    },
    async inviteUserByEmail(email, options) {
      const { data, error } = await client.auth.admin.inviteUserByEmail(email, options)
      if (error || !data.user) throw new Error('Auth Admin operation failed')
      return { id: data.user.id }
    },
  }
}

function createDatabasePort(client) {
  return {
    async findAdminProfile(userId) {
      const { data, error } = await client
        .from('admin_profiles')
        .select('role,is_active')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw new Error('Database operation failed')
      return data
    },
    async upsertAdminProfile(profile) {
      const { error } = await client
        .from('admin_profiles')
        .upsert(profile, { onConflict: 'user_id' })
      if (error) throw new Error('Database operation failed')
    },
    async findProvisioningAudit(userId) {
      const { data, error } = await client
        .from('audit_logs')
        .select('id')
        .eq('actor_type', 'system')
        .eq('action', 'initial_admin_provisioned')
        .eq('target_table', 'admin_profiles')
        .eq('target_id', userId)
        .limit(1)
        .maybeSingle()
      if (error) throw new Error('Database operation failed')
      return Boolean(data)
    },
    async insertAuditLog(evidence) {
      const { error } = await client.from('audit_logs').insert(evidence)
      if (error) throw new Error('Database operation failed')
    },
  }
}

export async function runProvisioningMode({
  mode,
  context,
  environment,
  createSupabaseClient,
  requestId,
  report,
}) {
  if (mode !== 'dry-run' && mode !== 'execute') {
    throw new Error('Provisioning preflight failed')
  }
  validateExecutionContext(context)
  if (mode === 'dry-run') {
    return provisionInitialAdmin({ mode, context, requestId, report })
  }

  const client = createSupabaseClient(
    environment.SUPABASE_URL,
    environment.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  )
  return provisionInitialAdmin({
    mode,
    context,
    authAdmin: createAuthAdminPort(client),
    database: createDatabasePort(client),
    requestId,
    report,
  })
}

async function run() {
  assertSupportedNodeVersion()
  const root = process.cwd()
  const requestId = createRequestId()
  const args = parseOperatorArguments(process.argv.slice(2))
  const linkedProjectRef = await readLinkedProjectRef(root)

  if (args.mode === 'capture-linked-staging') {
    await captureLinkedStagingRef({
      linkedProjectRef,
      target: args.target,
      stagingConfirmed: args.stagingConfirmed,
      writeMapping: async (mapping) => writeFile(
        resolve(root, '.supabase-projects.local.json'),
        `${JSON.stringify(mapping, null, 2)}\n`,
        { encoding: 'utf8', flag: 'wx' },
      ),
    })
    console.log(`dry-run ready ${requestId}`)
    return
  }

  const { createClient } = await import('@supabase/supabase-js')
  const environment = parseOperatorEnvironment(process.env)
  const context = {
    targetEmail: INITIAL_ADMIN_EMAIL,
    target: args.target,
    stagingConfirmed: args.stagingConfirmed,
    linkedProjectRef,
    capturedStagingRef: await readCapturedStagingRef(root),
    supabaseUrl: environment.SUPABASE_URL,
    hasServerCredentials: true,
    redirectTo: environment.INITIAL_ADMIN_REDIRECT_TO,
    redirectOrigins: environment.INITIAL_ADMIN_REDIRECT_ORIGINS,
  }

  await runProvisioningMode({
    mode: args.mode,
    context,
    environment,
    createSupabaseClient: createClient,
    requestId,
    report: console.log,
  })
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  run().catch(() => {
    process.exitCode = 1
  })
}

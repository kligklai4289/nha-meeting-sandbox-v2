import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  INITIAL_ADMIN_EMAIL,
  provisionInitialAdmin,
} from './lib/initialAdminProvisioning.mjs'
import { parseOperatorEnvironment } from './lib/operatorEnvironment.mjs'
import {
  assertSupportedNodeVersion,
  captureLinkedStagingRef,
  createAuthAdminPort,
  parseOperatorArguments,
  runProvisioningMode,
} from './invite-initial-admin.mjs'

const approvedContext = {
  targetEmail: INITIAL_ADMIN_EMAIL,
  target: 'staging' as const,
  stagingConfirmed: true,
  linkedProjectRef: 'linked-ref',
  capturedStagingRef: 'linked-ref',
  supabaseUrl: 'https://linked-ref.supabase.co',
  hasServerCredentials: true,
  redirectTo: 'https://fa-auth-preview.vercel.app/admin/auth/confirm',
  redirectOrigins: ['https://fa-auth-preview.vercel.app'],
}

type Profile = { role: string; is_active: boolean } | null

function createPorts(options: {
  existingUserId?: string
  profile?: Profile
  auditExists?: boolean
} = {}) {
  const mutations: Array<{ operation: string; value?: unknown }> = []
  const reads: string[] = []

  return {
    mutations,
    reads,
    authAdmin: {
      async findUserByEmail() {
        reads.push('find-user')
        return options.existingUserId ? { id: options.existingUserId } : null
      },
      async inviteUserByEmail(email: string, invitation: { redirectTo: string }) {
        mutations.push({ operation: 'invite', value: { email, ...invitation } })
        return { id: 'invited-user' }
      },
    },
    database: {
      async findAdminProfile(userId: string) {
        reads.push(`find-profile:${userId}`)
        return options.profile ?? null
      },
      async upsertAdminProfile(profile: unknown) {
        mutations.push({ operation: 'upsert-profile', value: profile })
      },
      async findProvisioningAudit(userId: string) {
        reads.push(`find-audit:${userId}`)
        return options.auditExists ?? false
      },
      async insertAuditLog(evidence: unknown) {
        mutations.push({ operation: 'insert-audit', value: evidence })
      },
    },
  }
}

describe('initial Admin provisioning', () => {
  it('performs no reads or mutations in dry-run mode', async () => {
    const ports = createPorts()
    const output: string[] = []

    const result = await provisionInitialAdmin({
      mode: 'dry-run',
      context: approvedContext,
      authAdmin: ports.authAdmin,
      database: ports.database,
      requestId: 'request-test',
      report: (line) => output.push(line),
    })

    expect(result).toEqual({ status: 'dry-run ready', requestId: 'request-test' })
    expect(ports.reads).toEqual([])
    expect(ports.mutations).toEqual([])
    expect(output).toEqual(['dry-run ready request-test'])
  })

  it('invites the approved absent user once and activates a profile', async () => {
    const ports = createPorts()

    const result = await provisionInitialAdmin({
      mode: 'execute',
      context: approvedContext,
      authAdmin: ports.authAdmin,
      database: ports.database,
      requestId: 'request-test',
    })

    expect(result.status).toBe('profile activated')
    expect(ports.mutations).toEqual([
      {
        operation: 'invite',
        value: {
          email: 'pichailakarm@gmail.com',
          redirectTo: 'https://fa-auth-preview.vercel.app/admin/auth/confirm',
        },
      },
      {
        operation: 'upsert-profile',
        value: { user_id: 'invited-user', role: 'admin', is_active: true },
      },
      {
        operation: 'insert-audit',
        value: {
          actor_type: 'system',
          action: 'initial_admin_provisioned',
          target_table: 'admin_profiles',
          target_id: 'invited-user',
          request_id: 'request-test',
          after_data: { invitation_requested: true, role: 'admin', is_active: true },
        },
      },
    ])
  })

  it('does not reinvite an existing user and repairs an inactive profile', async () => {
    const ports = createPorts({
      existingUserId: 'existing-user',
      profile: { role: 'admin', is_active: false },
    })

    const result = await provisionInitialAdmin({
      mode: 'execute',
      context: approvedContext,
      authAdmin: ports.authAdmin,
      database: ports.database,
      requestId: 'request-test',
    })

    expect(result.status).toBe('profile activated')
    expect(ports.mutations.map(({ operation }) => operation)).toEqual([
      'upsert-profile',
      'insert-audit',
    ])
    expect(ports.mutations[0]?.value).toEqual({
      user_id: 'existing-user',
      role: 'admin',
      is_active: true,
    })
  })

  it('is a no-op when the user already has an active admin profile', async () => {
    const ports = createPorts({
      existingUserId: 'existing-user',
      profile: { role: 'admin', is_active: true },
      auditExists: true,
    })

    const result = await provisionInitialAdmin({
      mode: 'execute',
      context: approvedContext,
      authAdmin: ports.authAdmin,
      database: ports.database,
      requestId: 'request-test',
    })

    expect(result.status).toBe('already provisioned')
    expect(ports.mutations).toEqual([])
  })

  it.each([
    ['URL/ref mismatch', { supabaseUrl: 'https://different-ref.supabase.co' }],
    ['Supabase URL port', { supabaseUrl: 'https://linked-ref.supabase.co:443' }],
    ['Supabase URL path', { supabaseUrl: 'https://linked-ref.supabase.co/rest' }],
    ['Supabase URL query', { supabaseUrl: 'https://linked-ref.supabase.co?target=staging' }],
    ['Supabase URL hash', { supabaseUrl: 'https://linked-ref.supabase.co#staging' }],
    ['Supabase URL protocol', { supabaseUrl: 'http://linked-ref.supabase.co' }],
    ['captured ref mismatch', { capturedStagingRef: 'different-ref' }],
    ['missing confirmation', { stagingConfirmed: false }],
    ['missing server credentials', { hasServerCredentials: false }],
    ['production target', { target: 'production' as const }],
    ['wrong initial Admin', { targetEmail: ['other', 'example.com'].join('@') }],
    ['redirect origin missing from allow-list', {
      redirectTo: 'https://other-preview.vercel.app/admin/auth/confirm',
    }],
    ['wildcard redirect origin', { redirectOrigins: ['https://*.vercel.app'] }],
    ['non-Preview HTTPS origin', { redirectOrigins: ['https://example.com'] }],
    ['allow-list origin with path', {
      redirectOrigins: ['https://fa-auth-preview.vercel.app/admin'],
    }],
    ['redirect query', {
      redirectTo: 'https://fa-auth-preview.vercel.app/admin/auth/confirm?next=staging',
    }],
    ['redirect credentials', {
      redirectTo: `https://${['operator', 'synthetic'].join(':')}@fa-auth-preview.vercel.app/admin/auth/confirm`,
    }],
  ])('refuses %s before any Auth or database call', async (_name, contextChange) => {
    const ports = createPorts()

    await expect(provisionInitialAdmin({
      mode: 'execute',
      context: { ...approvedContext, ...contextChange },
      authAdmin: ports.authAdmin,
      database: ports.database,
      requestId: 'request-test',
    })).rejects.toThrow('Provisioning preflight failed')

    expect(ports.reads).toEqual([])
    expect(ports.mutations).toEqual([])
  })

  it('reports only an approved status and local correlation ID', async () => {
    const sensitive = {
      secret: ['sb', 'secret', 'test-sensitive'].join('_'),
      token: ['token', 'test-sensitive'].join('-'),
      link: 'https://fa-auth-preview.vercel.app/admin/auth/confirm',
      password: ['password', 'test-sensitive'].join('-'),
      userId: 'user-sensitive-value',
      projectRef: 'project-sensitive',
    }
    const ports = createPorts({
      existingUserId: sensitive.userId,
      profile: { role: 'admin', is_active: true },
      auditExists: true,
    })
    const output: string[] = []

    await provisionInitialAdmin({
      mode: 'execute',
      context: {
        ...approvedContext,
        linkedProjectRef: sensitive.projectRef,
        capturedStagingRef: sensitive.projectRef,
        supabaseUrl: `https://${sensitive.projectRef}.supabase.co`,
        redirectTo: sensitive.link,
        supabaseSecret: sensitive.secret,
        opaqueToken: sensitive.token,
        password: sensitive.password,
      },
      authAdmin: ports.authAdmin,
      database: ports.database,
      requestId: 'request-safe-correlation',
      report: (line) => output.push(line),
    })

    const rendered = output.join('\n')
    expect(rendered).toBe('already provisioned request-safe-correlation')
    for (const value of Object.values(sensitive)) expect(rendered).not.toContain(value)
    expect(rendered).not.toContain(INITIAL_ADMIN_EMAIL)
  })

  it.each([
    {
      redirectTo: 'http://localhost:4173/admin/auth/confirm',
      redirectOrigins: ['http://localhost:4173'],
    },
    {
      redirectTo: 'http://127.0.0.1:4173/admin/auth/confirm',
      redirectOrigins: ['http://127.0.0.1:4173'],
    },
  ])('accepts a concrete approved local development origin', async (redirect) => {
    const ports = createPorts()

    const result = await provisionInitialAdmin({
      mode: 'dry-run',
      context: { ...approvedContext, ...redirect },
      authAdmin: ports.authAdmin,
      database: ports.database,
      requestId: 'request-test',
    })

    expect(result.status).toBe('dry-run ready')
  })

  it('repairs a missing provisioning audit for an already-active profile', async () => {
    const ports = createPorts({
      existingUserId: 'existing-user',
      profile: { role: 'admin', is_active: true },
      auditExists: false,
    })

    const result = await provisionInitialAdmin({
      mode: 'execute',
      context: approvedContext,
      authAdmin: ports.authAdmin,
      database: ports.database,
      requestId: 'request-repair',
    })

    expect(result.status).toBe('already provisioned')
    expect(ports.mutations).toEqual([{
      operation: 'insert-audit',
      value: expect.objectContaining({
        action: 'initial_admin_provisioned',
        target_id: 'existing-user',
      }),
    }])
  })

  it('recovers an audit failure on retry without repeating the profile upsert', async () => {
    let profile: Profile = { role: 'admin', is_active: false }
    let auditExists = false
    let upserts = 0
    let auditAttempts = 0
    const authAdmin = {
      async findUserByEmail() { return { id: 'existing-user' } },
      async inviteUserByEmail() { throw new Error('unexpected invitation') },
    }
    const database = {
      async findAdminProfile() { return profile },
      async upsertAdminProfile() {
        upserts += 1
        profile = { role: 'admin', is_active: true }
      },
      async findProvisioningAudit() { return auditExists },
      async insertAuditLog() {
        auditAttempts += 1
        if (auditAttempts === 1) throw new Error('synthetic audit failure')
        auditExists = true
      },
    }

    await expect(provisionInitialAdmin({
      mode: 'execute', context: approvedContext, authAdmin, database,
      requestId: 'request-first',
    })).rejects.toThrow('synthetic audit failure')

    await expect(provisionInitialAdmin({
      mode: 'execute', context: approvedContext, authAdmin, database,
      requestId: 'request-retry',
    })).resolves.toMatchObject({ status: 'already provisioned' })
    expect(upserts).toBe(1)
    expect(auditAttempts).toBe(2)
  })

  it('does not duplicate an audit when a prior unknown response actually committed it', async () => {
    let profile: Profile = { role: 'admin', is_active: false }
    let auditExists = false
    let upserts = 0
    let auditAttempts = 0
    const authAdmin = {
      async findUserByEmail() { return { id: 'existing-user' } },
      async inviteUserByEmail() { throw new Error('unexpected invitation') },
    }
    const database = {
      async findAdminProfile() { return profile },
      async upsertAdminProfile() {
        upserts += 1
        profile = { role: 'admin', is_active: true }
      },
      async findProvisioningAudit() { return auditExists },
      async insertAuditLog() {
        auditAttempts += 1
        auditExists = true
        throw new Error('synthetic lost response')
      },
    }

    await expect(provisionInitialAdmin({
      mode: 'execute', context: approvedContext, authAdmin, database,
      requestId: 'request-first',
    })).rejects.toThrow('synthetic lost response')
    await expect(provisionInitialAdmin({
      mode: 'execute', context: approvedContext, authAdmin, database,
      requestId: 'request-retry',
    })).resolves.toMatchObject({ status: 'already provisioned' })

    expect(upserts).toBe(1)
    expect(auditAttempts).toBe(1)
  })
})

describe('initial Admin operator controls', () => {
  it.each(['22.0.0', '24.15.0'])('accepts supported Node.js runtime %s', (version) => {
    expect(() => assertSupportedNodeVersion(version)).not.toThrow()
  })

  it.each(['21.99.0', 'invalid'])('rejects unsupported Node.js runtime %s', (version) => {
    expect(() => assertSupportedNodeVersion(version))
      .toThrow('Unsupported Node.js runtime: requires Node.js >=22')
  })

  it('pins the workspace engine and operator documentation to Node.js 22 or newer', async () => {
    const packageJson = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf8'))
    const packageLock = JSON.parse(await readFile(resolve(process.cwd(), 'package-lock.json'), 'utf8'))
    const readme = await readFile(resolve(process.cwd(), 'README.md'), 'utf8')
    const runbook = await readFile(resolve(process.cwd(), 'docs', 'part-3-auth-runbook.md'), 'utf8')
    const operator = await readFile(
      resolve(process.cwd(), 'scripts', 'invite-initial-admin.mjs'),
      'utf8',
    )

    expect(packageJson.engines?.node).toBe('>=22.0.0')
    expect(packageLock.packages?.['']?.engines?.node).toBe('>=22.0.0')
    expect(readme).toContain('Node.js 22')
    expect(readme).not.toContain('Node.js 20.19')
    expect(runbook).toContain('Node.js 22')
    expect(operator).toContain('assertSupportedNodeVersion()')
    expect(operator).not.toContain("from '@supabase/supabase-js'")
    expect(operator).toContain("await import('@supabase/supabase-js')")
    expect(operator.indexOf('\n  assertSupportedNodeVersion()'))
      .toBeLessThan(operator.indexOf("await import('@supabase/supabase-js')"))
  })

  it('parses server credentials and a concrete redirect-origin allow-list in plain JavaScript', () => {
    const parsed = parseOperatorEnvironment({
      SUPABASE_URL: 'https://linked-ref.supabase.co',
      SUPABASE_SECRET_KEY: ['sb', 'secret', 'test-value'].join('_'),
      FA_SESSION_SIGNING_SECRET: 'a'.repeat(32),
      FA_CODE_PEPPER: 'b'.repeat(32),
      INITIAL_ADMIN_REDIRECT_TO: 'https://fa-auth-preview.vercel.app/admin/auth/confirm',
      INITIAL_ADMIN_REDIRECT_ORIGINS: 'http://localhost:4173,https://fa-auth-preview.vercel.app',
    })

    expect(parsed.INITIAL_ADMIN_REDIRECT_ORIGINS).toEqual([
      'http://localhost:4173',
      'https://fa-auth-preview.vercel.app',
    ])
  })

  it('rejects an invalid redirect-origin allow-list without exposing environment values', () => {
    const secret = ['sb', 'secret', 'test-sensitive'].join('_')
    expect(() => parseOperatorEnvironment({
      SUPABASE_URL: 'https://linked-ref.supabase.co',
      SUPABASE_SECRET_KEY: secret,
      FA_SESSION_SIGNING_SECRET: 'a'.repeat(32),
      FA_CODE_PEPPER: 'b'.repeat(32),
      INITIAL_ADMIN_REDIRECT_TO: 'https://fa-auth-preview.vercel.app/admin/auth/confirm',
      INITIAL_ADMIN_REDIRECT_ORIGINS: 'https://*.vercel.app',
    })).toThrow('Invalid operator environment configuration: INITIAL_ADMIN_REDIRECT_ORIGINS')

    try {
      parseOperatorEnvironment({ SUPABASE_SECRET_KEY: secret })
    } catch (error) {
      expect(String(error)).not.toContain(secret)
    }
  })

  it.each([
    [
      ['--dry-run', '--target', 'staging', '--confirm-linked-project-is-staging'],
      { mode: 'dry-run', target: 'staging', stagingConfirmed: true },
    ],
    [
      ['--execute', '--target', 'staging', '--confirm-linked-project-is-staging'],
      { mode: 'execute', target: 'staging', stagingConfirmed: true },
    ],
    [
      ['--capture-linked-staging', '--target', 'staging', '--confirm-linked-project-is-staging'],
      { mode: 'capture-linked-staging', target: 'staging', stagingConfirmed: true },
    ],
  ])('accepts the guarded operator mode %j', (argv, expected) => {
    expect(parseOperatorArguments(argv as string[])).toEqual(expected)
  })

  it.each([
    { argv: [] },
    { argv: ['--dry-run'] },
    { argv: ['--execute'] },
    { argv: ['--execute', '--target', 'production', '--confirm-linked-project-is-staging'] },
    { argv: ['--execute', '--target', 'staging', '--email', 'pichailakarm@gmail.com'] },
    { argv: ['--dry-run', '--execute', '--target', 'staging', '--confirm-linked-project-is-staging'] },
    { argv: ['--execute', '--target', 'staging', '--target', 'staging', '--confirm-linked-project-is-staging'] },
    { argv: ['--execute', '--target', 'staging', '--confirm-linked-project-is-staging', '--confirm-linked-project-is-staging'] },
  ])('rejects unsafe or ambiguous arguments $argv', ({ argv }) => {
    expect(() => parseOperatorArguments(argv)).toThrow('Invalid operator arguments')
  })

  it('captures the linked ref only after explicit Staging confirmation', async () => {
    const writes: unknown[] = []

    await captureLinkedStagingRef({
      linkedProjectRef: 'linked-ref',
      target: 'staging',
      stagingConfirmed: true,
      writeMapping: async (mapping) => writes.push(mapping),
    })

    expect(writes).toEqual([{ stagingProjectRef: 'linked-ref' }])
  })

  it.each([
    { linkedProjectRef: '', target: 'staging', stagingConfirmed: true },
    { linkedProjectRef: 'linked-ref', target: 'production', stagingConfirmed: true },
    { linkedProjectRef: 'linked-ref', target: 'staging', stagingConfirmed: false },
  ])('refuses an unsafe linked-ref capture before writing', async (input) => {
    const writes: unknown[] = []

    await expect(captureLinkedStagingRef({
      ...input,
      writeMapping: async (mapping) => writes.push(mapping),
    })).rejects.toThrow('Staging capture refused')

    expect(writes).toEqual([])
  })

  it('validates the full execution context before creating a Supabase client', async () => {
    let clientsCreated = 0

    await expect(runProvisioningMode({
      mode: 'execute',
      context: { ...approvedContext, redirectOrigins: ['https://other-preview.vercel.app'] },
      environment: {
        SUPABASE_URL: approvedContext.supabaseUrl,
        SUPABASE_SECRET_KEY: ['sb', 'secret', 'test-value'].join('_'),
      },
      createSupabaseClient() {
        clientsCreated += 1
        throw new Error('client must not be created')
      },
      requestId: 'request-test',
    })).rejects.toThrow('Provisioning preflight failed')

    expect(clientsCreated).toBe(0)
  })

  it('rejects an unsupported orchestration mode before creating a Supabase client', async () => {
    let clientsCreated = 0

    await expect(runProvisioningMode({
      mode: 'capture-linked-staging',
      context: approvedContext,
      environment: {
        SUPABASE_URL: approvedContext.supabaseUrl,
        SUPABASE_SECRET_KEY: ['sb', 'secret', 'test-value'].join('_'),
      },
      createSupabaseClient() {
        clientsCreated += 1
        return {}
      },
      requestId: 'request-test',
    })).rejects.toThrow('Provisioning preflight failed')

    expect(clientsCreated).toBe(0)
  })

  it('has no runtime TypeScript dependency and imports as plain Node ESM', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'scripts', 'invite-initial-admin.mjs'),
      'utf8',
    )

    const typeScriptRuntimeImport = /\.ts['"]/
    expect(typeScriptRuntimeImport.test(source)).toBe(false)
    await expect(import('./invite-initial-admin.mjs')).resolves.toBeDefined()
  })
})

describe('Auth Admin pagination adapter', () => {
  function authClientWithPages(pages: Map<number, unknown>) {
    const requestedPages: number[] = []
    return {
      requestedPages,
      client: {
        auth: {
          admin: {
            async listUsers({ page }: { page: number }) {
              requestedPages.push(page)
              return pages.get(page)
            },
          },
        },
      },
    }
  }

  it('traverses sequential SDK pages and finds one normalized exact match', async () => {
    const fixture = authClientWithPages(new Map([
      [1, { data: { users: [{ id: 'other-one', email: 'one@example.test' }], nextPage: 2, lastPage: 3, total: 3 }, error: null }],
      [2, { data: { users: [{ id: 'existing-user', email: 'PICHAIlaKARM@gmail.com' }], nextPage: 3, lastPage: 3, total: 3 }, error: null }],
      [3, { data: { users: [{ id: 'other-two', email: 'two@example.test' }], nextPage: null, lastPage: 3, total: 3 }, error: null }],
    ]))

    const result = await createAuthAdminPort(fixture.client)
      .findUserByEmail('pichailakarm@gmail.com')

    expect(result).toEqual({ id: 'existing-user' })
    expect(fixture.requestedPages).toEqual([1, 2, 3])
  })

  it('fails closed when SDK pagination metadata skips a page', async () => {
    const fixture = authClientWithPages(new Map([
      [1, { data: { users: [], nextPage: 3, lastPage: 3, total: 1 }, error: null }],
      [3, { data: { users: [{ id: 'other-user', email: 'other@example.test' }], nextPage: null, lastPage: 3, total: 1 }, error: null }],
    ]))

    await expect(createAuthAdminPort(fixture.client)
      .findUserByEmail('pichailakarm@gmail.com'))
      .rejects.toThrow('Auth Admin operation failed')
    expect(fixture.requestedPages).toEqual([1])
  })

  it('fails closed when exact normalized duplicates exist across pages', async () => {
    const fixture = authClientWithPages(new Map([
      [1, { data: { users: [{ id: 'first-user', email: 'pichailakarm@gmail.com' }], nextPage: 2, lastPage: 2, total: 2 }, error: null }],
      [2, { data: { users: [{ id: 'second-user', email: 'PICHAIlAKARM@gmail.com' }], nextPage: null, lastPage: 2, total: 2 }, error: null }],
    ]))

    await expect(createAuthAdminPort(fixture.client)
      .findUserByEmail('pichailakarm@gmail.com'))
      .rejects.toThrow('Auth Admin operation failed')
  })

  it.each([
    ['cyclic', { users: [], nextPage: 1, lastPage: 2, total: 0 }],
    ['malformed', { users: [], nextPage: '2', lastPage: 2, total: 0 }],
    ['out-of-range', { users: [], nextPage: 3, lastPage: 2, total: 0 }],
    ['premature-end', { users: [], nextPage: null, lastPage: 2, total: 0 }],
  ])('fails closed on %s SDK pagination metadata', async (_name, data) => {
    const fixture = authClientWithPages(new Map([
      [1, { data, error: null }],
    ]))

    await expect(createAuthAdminPort(fixture.client)
      .findUserByEmail('pichailakarm@gmail.com'))
      .rejects.toThrow('Auth Admin operation failed')
  })

  it.each([
    [
      'changed lastPage',
      { users: [{ id: 'other-two', email: 'two@example.test' }], nextPage: null, lastPage: 3, total: 2 },
    ],
    [
      'changed total',
      { users: [{ id: 'other-two', email: 'two@example.test' }], nextPage: null, lastPage: 2, total: 3 },
    ],
    [
      'incomplete observed total',
      { users: [], nextPage: null, lastPage: 2, total: 2 },
    ],
  ])('fails closed on %s across SDK pages', async (_name, secondPage) => {
    const fixture = authClientWithPages(new Map([
      [1, { data: { users: [{ id: 'other-one', email: 'one@example.test' }], nextPage: 2, lastPage: 2, total: 2 }, error: null }],
      [2, { data: secondPage, error: null }],
    ]))

    await expect(createAuthAdminPort(fixture.client)
      .findUserByEmail('pichailakarm@gmail.com'))
      .rejects.toThrow('Auth Admin operation failed')
  })
})

describe('scanner-safe Admin email templates', () => {
  it.each([
    ['admin-invite.html', 'invite'],
    ['admin-recovery.html', 'recovery'],
  ])('routes %s through explicit confirmation with TokenHash', async (file, type) => {
    const template = await readFile(
      resolve(process.cwd(), 'supabase', 'templates', file),
      'utf8',
    )

    expect(template).toContain(
      `href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=${type}"`,
    )
    expect(template).not.toContain('ConfirmationURL')
    expect(template).not.toMatch(/<(?:img|script)\b/i)
  })
})

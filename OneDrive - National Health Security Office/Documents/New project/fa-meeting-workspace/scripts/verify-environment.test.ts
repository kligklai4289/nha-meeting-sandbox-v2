import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const scriptPath = resolve(process.cwd(), 'scripts', 'verify-environment.mjs')
const fixtureRoots: string[] = []

async function writeFixtureFile(root: string, relativePath: string, content = '') {
  const path = join(root, ...relativePath.split('/'))
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, content, 'utf8')
}

async function createCleanFixture() {
  const root = await mkdtemp(join(tmpdir(), 'fa-env-verifier-'))
  fixtureRoots.push(root)

  await writeFixtureFile(root, '.env.example', [
    'VITE_SUPABASE_URL=',
    'VITE_SUPABASE_PUBLISHABLE_KEY=',
    'SUPABASE_URL=',
    'SUPABASE_SECRET_KEY=',
    'FA_SESSION_SIGNING_SECRET=',
    'FA_CODE_PEPPER=',
    '',
  ].join('\n'))
  await writeFixtureFile(
    root,
    'supabase/migrations/202608210001_initial_production_schema.sql',
    'create table public.meetings (id uuid primary key);\n',
  )
  await writeFixtureFile(root, 'supabase/seed/staging.sql', 'select 1;\n')
  await writeFixtureFile(root, 'supabase/seed/production.sql', 'select 1;\n')
  await writeFixtureFile(root, 'src/config.ts', 'export const mode = "safe"\n')
  await writeFixtureFile(
    root,
    'scripts/lib/initialAdminProvisioning.mjs',
    "export const INITIAL_ADMIN_EMAIL = 'pichailakarm@gmail.com'\n",
  )
  return root
}

function runVerifier(root: string) {
  const result = spawnSync(process.execPath, [scriptPath, '--root', root], {
    encoding: 'utf8',
  })

  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  }
}

afterEach(async () => {
  await Promise.all(fixtureRoots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
  })))
})

describe('verify-environment', () => {
  it('exits successfully for a complete secret-free project', async () => {
    const root = await createCleanFixture()

    const result = runVerifier(root)

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('Environment verification passed')
  })

  it('rejects a server secret without printing its value', async () => {
    const root = await createCleanFixture()
    const leakedValue = ['sb', 'secret', 'leaked-value'].join('_')
    await writeFixtureFile(
      root,
      'src/leak.ts',
      `SUPABASE_SECRET_KEY=${leakedValue}\n`,
    )

    const result = runVerifier(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Potential server secret found')
    expect(result.output).toContain('src/leak.ts')
    expect(result.output).not.toContain(leakedValue)
  })

  it('rejects a project without the isolated production seed', async () => {
    const root = await createCleanFixture()
    await rm(join(root, 'supabase', 'seed', 'production.sql'))

    const result = runVerifier(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Missing required file: supabase/seed/production.sql')
  })

  it('rejects an incomplete public and server environment contract', async () => {
    const root = await createCleanFixture()
    await writeFixtureFile(root, '.env.example', 'VITE_SUPABASE_URL=\n')

    const result = runVerifier(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Missing environment name: FA_CODE_PEPPER')
  })

  it('rejects a committed SMTP password without printing its value', async () => {
    const root = await createCleanFixture()
    const smtpKey = ['SMTP', 'PASSWORD'].join('_')
    const password = ['mail', 'credential', 'value'].join('-')
    await writeFixtureFile(root, 'supabase/config.toml', `${smtpKey}=${password}\n`)

    const result = runVerifier(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('[smtp-password]')
    expect(result.output).not.toContain(password)
  })

  it('rejects a committed SMTP password in structured configuration', async () => {
    const root = await createCleanFixture()
    const smtpKey = ['smtp', 'password'].join('_')
    const password = ['structured', 'mail', 'credential'].join('-')
    await writeFixtureFile(
      root,
      'supabase/settings.json',
      `{ "${smtpKey}": "${password}" }\n`,
    )

    const result = runVerifier(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('[smtp-password]')
    expect(result.output).not.toContain(password)
  })

  it('allows SMTP configuration to reference an environment variable', async () => {
    const root = await createCleanFixture()
    const smtpKey = ['smtp', 'pass'].join('_')
    const environmentReference = `env(${['SMTP', 'PASS'].join('_')})`
    await writeFixtureFile(
      root,
      'supabase/config.toml',
      `${smtpKey} = "${environmentReference}"\n`,
    )

    const result = runVerifier(root)

    expect(result.status, result.output).toBe(0)
  })

  it('rejects a canonical Supabase SMTP password without printing its value', async () => {
    const root = await createCleanFixture()
    const password = ['canonical', 'mail', 'credential'].join('-')
    await writeFixtureFile(root, 'supabase/config.toml', [
      '[auth.email.smtp]',
      `pass = "${password}"`,
      '',
    ].join('\n'))

    const result = runVerifier(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('[smtp-password]')
    expect(result.output).not.toContain(password)
  })

  it('allows canonical Supabase SMTP pass to use safe environment indirection', async () => {
    const root = await createCleanFixture()
    const environmentReference = `env(${['SMTP', 'PASS'].join('_')})`
    await writeFixtureFile(root, 'supabase/config.toml', [
      '[auth.email.smtp]',
      `pass = "${environmentReference}"`,
      '',
    ].join('\n'))

    const result = runVerifier(root)

    expect(result.status, result.output).toBe(0)
  })

  it('rejects a confirmation URL containing a concrete token hash', async () => {
    const root = await createCleanFixture()
    const parameterName = ['token', 'hash'].join('_')
    const token = ['concrete', 'confirmation', 'value'].join('-')
    await writeFixtureFile(
      root,
      'supabase/templates/admin-invite.html',
      `<a href="https://preview.example/admin/auth/confirm?${parameterName}=${token}&type=invite">Confirm</a>`,
    )

    const result = runVerifier(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('[concrete-confirmation-token]')
    expect(result.output).not.toContain(token)
  })

  it('allows the checked-in TokenHash template variable', async () => {
    const root = await createCleanFixture()
    await writeFixtureFile(
      root,
      'supabase/templates/admin-invite.html',
      '<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite">Confirm</a>',
    )

    const result = runVerifier(root)

    expect(result.status, result.output).toBe(0)
  })

  it('allows a clearly synthetic token in test fixtures', async () => {
    const root = await createCleanFixture()
    await writeFixtureFile(
      root,
      'src/auth.test.ts',
      "const path = '/admin/auth/confirm?token_hash=test-token&type=invite'\n",
    )

    const result = runVerifier(root)

    expect(result.status, result.output).toBe(0)
  })

  it('rejects an arbitrary initial Admin email in the operator script', async () => {
    const root = await createCleanFixture()
    const arbitraryEmail = ['unexpected', 'example.com'].join('@')
    await writeFixtureFile(
      root,
      'scripts/invite-initial-admin.mjs',
      `const INITIAL_ADMIN_EMAIL = '${arbitraryEmail}'\n`,
    )

    const result = runVerifier(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('[invalid-initial-admin-declaration]')
    expect(result.output).not.toContain(arbitraryEmail)
  })

  it.each([
    ['missing', 'export const unrelated = true\n'],
    ['dynamic', "export const INITIAL_ADMIN_EMAIL = ['pichailakarm', 'gmail.com'].join('@')\n"],
    ['multiple', [
      "export const INITIAL_ADMIN_EMAIL = 'pichailakarm@gmail.com'",
      "export const INITIAL_ADMIN_EMAIL = 'pichailakarm@gmail.com'",
      '',
    ].join('\n')],
    ['unapproved', "export const INITIAL_ADMIN_EMAIL = 'unexpected@example.test'\n"],
  ])('rejects a %s canonical initial Admin declaration', async (_name, content) => {
    const root = await createCleanFixture()
    await writeFixtureFile(
      root,
      'scripts/lib/initialAdminProvisioning.mjs',
      content,
    )

    const result = runVerifier(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('[invalid-initial-admin-declaration]')
  })

  it('rejects an additional initial Admin declaration in the CLI', async () => {
    const root = await createCleanFixture()
    await writeFixtureFile(
      root,
      'scripts/invite-initial-admin.mjs',
      "const INITIAL_ADMIN_EMAIL = 'pichailakarm@gmail.com'\n",
    )

    const result = runVerifier(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('[invalid-initial-admin-declaration]')
  })

  it('rejects an additional initial Admin declaration in another production script', async () => {
    const root = await createCleanFixture()
    await writeFixtureFile(
      root,
      'scripts/alternate.mjs',
      "export const INITIAL_ADMIN_EMAIL = 'pichailakarm@gmail.com'\n",
    )

    const result = runVerifier(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('[invalid-initial-admin-declaration]')
  })

  it('does not treat a declaration-shaped test fixture as production configuration', async () => {
    const root = await createCleanFixture()
    await writeFixtureFile(
      root,
      'scripts/alternate.test.ts',
      "const INITIAL_ADMIN_EMAIL = ['fixture'].join('')\n",
    )

    const result = runVerifier(root)

    expect(result.status, result.output).toBe(0)
  })

  it('allows reasonable whitespace around the one canonical exported declaration', async () => {
    const root = await createCleanFixture()
    await writeFixtureFile(
      root,
      'scripts/lib/initialAdminProvisioning.mjs',
      '  export   const   INITIAL_ADMIN_EMAIL   =   "pichailakarm@gmail.com";\n',
    )

    const result = runVerifier(root)

    expect(result.status, result.output).toBe(0)
  })

  it('rejects an indented duplicate declaration in an alternate production script', async () => {
    const root = await createCleanFixture()
    await writeFixtureFile(
      root,
      'scripts/alternate.mjs',
      '    export const INITIAL_ADMIN_EMAIL = "pichailakarm@gmail.com";\n',
    )

    const result = runVerifier(root)

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('[invalid-initial-admin-declaration]')
  })
})

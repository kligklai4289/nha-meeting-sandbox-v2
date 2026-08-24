import { access, readdir, readFile } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'

const REQUIRED_FILES = [
  'supabase/seed/staging.sql',
  'supabase/seed/production.sql',
]

const REQUIRED_ENVIRONMENT_NAMES = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'FA_SESSION_SIGNING_SECRET',
  'FA_CODE_PEPPER',
]

const SCANNED_EXTENSIONS = new Set([
  '.css',
  '.env',
  '.example',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.cjs',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
])

const SKIPPED_DIRECTORIES = new Set([
  '.codex',
  '.git',
  '.vercel',
  'coverage',
  'dist',
  'node_modules',
  'output',
  'playwright-report',
  'test-results',
])

const LOCAL_ONLY_FILE_PATTERNS = [
  /^\.env\.local$/,
  /^\.env\..+\.local$/,
  /^\.supabase-projects\.local\.json$/,
]

function parseRoot(argv) {
  if (argv.length === 0) return process.cwd()

  if (argv.length === 2 && argv[0] === '--root' && argv[1]) {
    return resolve(argv[1])
  }

  throw new Error('Usage: node scripts/verify-environment.mjs [--root <path>]')
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function toPortablePath(root, path) {
  return relative(root, path).split(sep).join('/')
}

function shouldScanFile(name) {
  if (LOCAL_ONLY_FILE_PATTERNS.some((pattern) => pattern.test(name))) return false
  return name === '.env.example' || SCANNED_EXTENSIONS.has(extname(name).toLowerCase())
}

async function collectSourceFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        files.push(...await collectSourceFiles(root, path))
      }
      continue
    }

    if (entry.isFile() && shouldScanFile(entry.name)) files.push(path)
  }

  return files
}

function secretRules(content) {
  const rules = []
  const modernKeys = content.match(/sb_secret_[A-Za-z0-9_-]+/g) ?? []
  if (modernKeys.some((key) => !/^sb_secret_(?:test|local)(?:_|-)/.test(key))) {
    rules.push('supabase-secret-key')
  }

  if (/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(content)) {
    rules.push('supabase-legacy-jwt')
  }

  const protectedAssignment = /^[ \t]*(SUPABASE_SECRET_KEY|FA_SESSION_SIGNING_SECRET|FA_CODE_PEPPER)[ \t]*=[ \t]*([^\r\n]*\S[^\r\n]*)[ \t]*$/gm
  for (const match of content.matchAll(protectedAssignment)) {
    const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
    if (value && !/^(?:test|local)(?:_|-)/.test(value)) {
      rules.push('nonempty-server-secret')
      break
    }
  }

  return [...new Set(rules)]
}

function operatorSafetyRules(content, path) {
  const rules = []
  const smtpAssignment = /(?:^|[{\r\n,])[ \t]*["']?(?:SMTP_PASSWORD|SMTP_PASS)["']?[ \t]*(?:=|:)[ \t]*([^,\r\n}]+)/gim
  for (const match of content.matchAll(smtpAssignment)) {
    const value = match[1].trim().replace(/^(['"])(.*)\1$/, '$2')
    const isEnvironmentReference = /^(?:env\([A-Z0-9_]+\)|\$\{[A-Z0-9_]+\}|\{\{[^}]+\}\})$/i.test(value)
    if (
      value
      && !/^(?:test|local)(?:_|-)/.test(value)
      && !isEnvironmentReference
    ) {
      rules.push('smtp-password')
      break
    }
  }

  if (path === 'supabase/config.toml') {
    let section = ''
    for (const line of content.split(/\r?\n/)) {
      const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/)
      if (sectionMatch) {
        section = sectionMatch[1].trim().toLowerCase()
        continue
      }
      if (section !== 'auth.email.smtp') continue
      const passMatch = line.match(/^\s*pass\s*=\s*(.+?)\s*(?:#.*)?$/i)
      if (!passMatch) continue
      const value = passMatch[1].trim().replace(/^(['"])(.*)\1$/, '$2')
      const isEnvironmentReference = /^(?:env\([A-Z0-9_]+\)|\$\{[A-Z0-9_]+\}|\{\{[^}]+\}\})$/i.test(value)
      if (value && !/^(?:test|local)(?:_|-)/.test(value) && !isEnvironmentReference) {
        rules.push('smtp-password')
      }
    }
  }

  const tokenParameter = ['token', 'hash'].join('_')
  const confirmationToken = new RegExp(`${tokenParameter}=(\\{\\{[^}]+\\}\\}|[^&\\s"'<>]+)`, 'gi')
  for (const match of content.matchAll(confirmationToken)) {
    const value = match[1].trim()
    const isTestArtifact = /(?:\.test\.|\.spec\.)/.test(path)
    const isPlanExample = path.startsWith('docs/superpowers/plans/')
    const isSyntheticFixture = /^(?:test|e2e|invite|recovery|unavailable|expired)-(?:token|secret)$/.test(value)
    if (
      value !== '{{ .TokenHash }}'
      && !(isSyntheticFixture && (isTestArtifact || isPlanExample))
    ) {
      rules.push('concrete-confirmation-token')
      break
    }
  }

  return [...new Set(rules)]
}

async function initialAdminDeclarationFailures(root) {
  const canonicalRelativePath = 'scripts/lib/initialAdminProvisioning.mjs'
  const scriptsDirectory = resolve(root, 'scripts')
  const declaration = /(?:^|\r?\n)[ \t]*(?:export[ \t\r\n]+)?(?:const|let|var)[ \t\r\n]+INITIAL_ADMIN_EMAIL[ \t\r\n]*=/g
  const exactDeclaration = /(?:^|\r?\n)[ \t]*export[ \t\r\n]+const[ \t\r\n]+INITIAL_ADMIN_EMAIL[ \t\r\n]*=[ \t\r\n]*(['"])pichailakarm@gmail\.com\1[ \t]*;?[ \t]*(?=\r?\n|$)/g
  const declarations = []
  const exactDeclarations = []

  if (await exists(scriptsDirectory)) {
    const files = await collectSourceFiles(root, scriptsDirectory)
    for (const file of files) {
      const path = toPortablePath(root, file)
      if (/(?:\.test\.|\.spec\.)/.test(path)) continue
      const content = await readFile(file, 'utf8')
      declarations.push(...(content.match(declaration) ?? []).map(() => path))
      exactDeclarations.push(...(content.match(exactDeclaration) ?? []).map(() => path))
    }
  }

  const isValid = declarations.length === 1
    && exactDeclarations.length === 1
    && exactDeclarations[0] === canonicalRelativePath
  return isValid ? [] : [
    `Unsafe operator configuration found: ${canonicalRelativePath} [invalid-initial-admin-declaration]`,
  ]
}

async function verify(root) {
  const failures = []

  failures.push(...await initialAdminDeclarationFailures(root))

  for (const file of REQUIRED_FILES) {
    if (!await exists(resolve(root, file))) failures.push(`Missing required file: ${file}`)
  }

  const migrationsDirectory = resolve(root, 'supabase', 'migrations')
  let hasInitialMigration = false
  if (await exists(migrationsDirectory)) {
    const migrations = await readdir(migrationsDirectory, { withFileTypes: true })
    hasInitialMigration = migrations.some((entry) => (
      entry.isFile() && entry.name.endsWith('_initial_production_schema.sql')
    ))
  }
  if (!hasInitialMigration) {
    failures.push('Missing initial migration: supabase/migrations/*_initial_production_schema.sql')
  }

  const environmentExamplePath = resolve(root, '.env.example')
  if (!await exists(environmentExamplePath)) {
    failures.push('Missing required file: .env.example')
  } else {
    const environmentExample = await readFile(environmentExamplePath, 'utf8')
    for (const name of REQUIRED_ENVIRONMENT_NAMES) {
      if (!new RegExp(`^\\s*${name}\\s*=`, 'm').test(environmentExample)) {
        failures.push(`Missing environment name: ${name}`)
      }
    }
  }

  const files = await collectSourceFiles(root)
  files.sort((left, right) => left.localeCompare(right))
  for (const file of files) {
    const content = await readFile(file, 'utf8')
    const portablePath = toPortablePath(root, file)
    for (const rule of secretRules(content)) {
      failures.push(`Potential server secret found: ${portablePath} [${rule}]`)
    }
    for (const rule of operatorSafetyRules(content, portablePath)) {
      failures.push(`Unsafe operator configuration found: ${portablePath} [${rule}]`)
    }
  }

  return failures.sort((left, right) => left.localeCompare(right))
}

try {
  const root = parseRoot(process.argv.slice(2))
  const failures = await verify(root)

  if (failures.length === 0) {
    console.log('Environment verification passed.')
  } else {
    console.error('Environment verification failed:')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Environment verification failed.')
  process.exitCode = 1
}

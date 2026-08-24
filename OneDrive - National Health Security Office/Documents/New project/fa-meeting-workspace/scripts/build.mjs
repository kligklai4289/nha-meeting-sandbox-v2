import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const CANARY_ENVIRONMENT_NAME = 'VITE_BUILD_OUTPUT_CANARY'

const forbiddenPatterns = [
  {
    rule: 'server-secret-name',
    pattern: /\b(?:SUPABASE_SECRET_KEY|FA_SESSION_SIGNING_SECRET|FA_CODE_PEPPER)\b/,
  },
  {
    rule: 'server-secret-value',
    pattern: /\bsb_secret_[A-Za-z0-9_-]+\b/,
  },
  {
    rule: 'smtp-credential-name',
    pattern: /\bSMTP_(?:PASS|PASSWORD|USER|USERNAME)\b/,
  },
  {
    rule: 'token-shape',
    pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  },
]

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(path))
    } else if (entry.isFile()) {
      files.push(path)
    }
  }

  return files
}

export async function scanBuildOutput({ directory, canary }) {
  const failures = new Set()
  const files = await collectFiles(directory)

  for (const file of files) {
    const content = await readFile(file)
    const text = content.toString('utf8')

    if (content.includes(Buffer.from(canary))) {
      failures.add('synthetic-vite-canary')
    }
    for (const { rule, pattern } of forbiddenPatterns) {
      if (pattern.test(text)) failures.add(rule)
    }
  }

  if (failures.size > 0) {
    const rules = [...failures].sort().map((rule) => `[${rule}]`).join(', ')
    throw new Error(`Build output safety scan failed: ${rules}`)
  }
}

export async function runViteBuild({
  root = process.cwd(),
  viteBin = resolve(root, 'node_modules/vite/bin/vite.js'),
  canary = `synthetic-vite-canary-${randomUUID()}`,
  environment = process.env,
  stdio = 'inherit',
} = {}) {
  const child = spawn(process.execPath, [viteBin, 'build'], {
    cwd: root,
    env: {
      ...environment,
      [CANARY_ENVIRONMENT_NAME]: canary,
    },
    stdio,
  })
  const [code] = await once(child, 'exit')

  if (code !== 0) {
    throw new Error(`Vite build failed with exit code ${typeof code === 'number' ? code : 1}`)
  }

  await scanBuildOutput({ directory: resolve(root, 'dist'), canary })
}

const isEntryPoint = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isEntryPoint) {
  try {
    await runViteBuild()
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Build failed.')
    process.exitCode = 1
  }
}

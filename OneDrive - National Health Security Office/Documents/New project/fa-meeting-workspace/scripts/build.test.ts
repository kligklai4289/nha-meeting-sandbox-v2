import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { build as viteBuild } from 'vite'
import { runViteBuild, scanBuildOutput } from './build.mjs'

const temporaryDirectories: string[] = []

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'fa-build-safety-'))
  temporaryDirectories.push(directory)
  return directory
}

async function rejectedMessage(operation: Promise<unknown>): Promise<string> {
  try {
    await operation
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('Expected operation to reject')
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )))
})

describe('production build safety wrapper', () => {
  it('is the build command used by npm', async () => {
    const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8'))

    expect(packageJson.scripts.build).toBe('node scripts/build.mjs')
  })

  it('injects a synthetic VITE canary and rejects an env-enumerating bundle without exposing it', async () => {
    const root = await createTemporaryDirectory()
    const canary = 'synthetic-vite-canary-8da24b53'
    await writeFile(
      join(root, 'index.html'),
      '<script type="module" src="/main.js"></script>',
    )
    await writeFile(join(root, 'main.js'), 'globalThis.fixtureEnvironment = import.meta.env')

    const message = await rejectedMessage(runViteBuild({
      root,
      viteBin: resolve('node_modules/vite/bin/vite.js'),
      canary,
      stdio: 'pipe',
    }))

    expect(message).toContain('[synthetic-vite-canary]')
    expect(message).not.toContain(canary)
  })

  it('allows a bundle that reads only an explicitly approved VITE value', async () => {
    const root = await createTemporaryDirectory()
    await writeFile(
      join(root, 'index.html'),
      '<script type="module" src="/main.js"></script>',
    )
    await writeFile(
      join(root, 'main.js'),
      'globalThis.safeValue = import.meta.env.VITE_APPROVED_BROWSER_VALUE',
    )

    await expect(runViteBuild({
      root,
      viteBin: resolve('node_modules/vite/bin/vite.js'),
      canary: 'synthetic-vite-canary-safe-94c348f7',
      environment: {
        ...process.env,
        VITE_APPROVED_BROWSER_VALUE: 'approved-browser-value',
      },
      stdio: 'pipe',
    })).resolves.toBeUndefined()

    const assets = await readdir(join(root, 'dist', 'assets'))
    const javascriptAsset = assets.find((asset) => asset.endsWith('.js'))
    expect(javascriptAsset).toBeDefined()
    const bundle = await readFile(join(root, 'dist', 'assets', javascriptAsset!), 'utf8')
    expect(bundle).toContain('approved-browser-value')
  })

  it('keeps synthetic VITE values outside the real AppProviders bundle boundary', async () => {
    const canaryName = 'VITE_APP_PROVIDERS_BOUNDARY_CANARY'
    const canaryValue = 'synthetic-app-providers-canary-4b9c6e71'
    const previousValue = process.env[canaryName]
    process.env[canaryName] = canaryValue

    try {
      const result = await viteBuild({
        root: process.cwd(),
        configFile: false,
        envFile: false,
        logLevel: 'silent',
        plugins: [react()],
        build: {
          minify: false,
          write: false,
          rollupOptions: {
            input: resolve('src/app/AppProviders.tsx'),
          },
        },
      })
      const builds = Array.isArray(result) ? result : [result]
      const emittedJavaScript = builds.flatMap((build) => (
        'output' in build
          ? build.output
            .filter((output) => output.type === 'chunk')
            .map((output) => output.code)
          : []
      )).join('\n')

      expect(emittedJavaScript).not.toContain(canaryValue)
    } finally {
      if (previousValue === undefined) {
        delete process.env[canaryName]
      } else {
        process.env[canaryName] = previousValue
      }
    }
  })

  it.each([
    ['server secret name', ['SUPABASE', 'SECRET', 'KEY'].join('_'), 'server-secret-name'],
    ['SMTP credential name', ['SMTP', 'PASSWORD'].join('_'), 'smtp-credential-name'],
    [
      'JWT-shaped token',
      `eyJ${'a'.repeat(24)}.${'b'.repeat(24)}.${'c'.repeat(24)}`,
      'token-shape',
    ],
  ])('rejects a %s without printing the matched value', async (_name, value, rule) => {
    const root = await createTemporaryDirectory()
    await writeFile(join(root, 'index.js'), `globalThis.fixture = ${JSON.stringify(value)}`)

    const message = await rejectedMessage(scanBuildOutput({
      directory: root,
      canary: 'synthetic-vite-canary-not-present',
    }))

    expect(message).toContain(`[${rule}]`)
    expect(message).not.toContain(value)
  })
})

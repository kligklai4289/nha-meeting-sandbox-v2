import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { runViteBuild } from './build.mjs'

const baseURL = 'http://127.0.0.1:4173/fa'

async function runBuild() {
  try {
    await runViteBuild({
      environment: {
        ...process.env,
        VITE_SUPABASE_URL: 'https://auth-e2e.invalid',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_e2e',
      },
    })
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Build failed.')
    return 1
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseURL)
      if (response.ok) return
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 200))
    }
  }
  throw new Error(`Vite preview did not start at ${baseURL}`)
}

const buildCode = await runBuild()

if (buildCode !== 0) {
  process.exitCode = buildCode
} else {
  const vite = spawn(
    process.execPath,
    [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4173'],
    { stdio: 'inherit' },
  )

  try {
    await waitForServer()
    const playwright = spawn(
      process.execPath,
      [resolve('node_modules/playwright/cli.js'), 'test', ...process.argv.slice(2)],
      { stdio: 'inherit' },
    )
    const [code] = await once(playwright, 'exit')
    process.exitCode = typeof code === 'number' ? code : 1
  } finally {
    vite.kill()
    await Promise.race([
      once(vite, 'exit'),
      new Promise((resolveDelay) => setTimeout(resolveDelay, 2000)),
    ])
  }
}

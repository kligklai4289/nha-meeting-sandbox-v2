import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type HeaderRule = {
  source: string
  headers: Array<{ key: string; value: string }>
}

type VercelConfig = {
  headers?: HeaderRule[]
  routes?: Array<Record<string, string>>
  rewrites?: Array<{ source: string; destination: string }>
}

async function readConfig(): Promise<VercelConfig> {
  return JSON.parse(await readFile(resolve('vercel.json'), 'utf8'))
}

describe('Vercel response configuration', () => {
  it.each([
    '/admin/login',
    '/admin/forgot-password',
    '/admin/auth/confirm',
    '/admin/update-password',
  ])('sets exactly Cache-Control: no-store on %s', async (path) => {
    const config = await readConfig()
    const matchingRules = config.headers?.filter((rule) => rule.source === path) ?? []

    expect(matchingRules).toEqual([{
      source: path,
      headers: [{ key: 'Cache-Control', value: 'no-store' }],
    }])
  })

  it('uses a modern SPA rewrite that is compatible with response headers', async () => {
    const config = await readConfig()

    expect(config.routes).toBeUndefined()
    expect(config.rewrites).toEqual([
      { source: '/(.*)', destination: '/index.html' },
    ])
  })
})

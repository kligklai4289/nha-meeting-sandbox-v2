import { z } from 'zod'

const serverEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_'),
  FA_SESSION_SIGNING_SECRET: z.string().min(32),
  FA_CODE_PEPPER: z.string().min(32),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export function parseServerEnv(
  input: Readonly<Record<string, string | undefined>>,
): ServerEnv {
  const result = serverEnvSchema.safeParse(input)
  if (result.success) return result.data

  const names = result.error.issues
    .map((issue) => issue.path.join('.'))
    .sort()
    .join(', ')
  throw new Error(`Invalid server environment configuration: ${names}`)
}

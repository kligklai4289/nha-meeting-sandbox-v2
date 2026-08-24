import { z } from 'zod'
import { publicMeetingSchema } from './publicMeetingContract'

export const faSessionDataSchema = z.object({
  meetingId: z.uuid(),
  groupId: z.uuid(),
  expiresAt: z.iso.datetime(),
})

export const faIssueSchema = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  sortOrder: z.number().int().positive(),
  topic: z.string(),
  findings: z.string(),
  proposal: z.string(),
  actionPlan: z.string(),
  monitoring: z.string(),
  stakeholderRoles: z.string(),
  rowVersion: z.number().int().positive(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})

const responseEnvelope = <T extends z.ZodType>(data: T) => z.object({
  data,
  requestId: z.string(),
})

export const faSessionResponseSchema = responseEnvelope(faSessionDataSchema)
export const faIssueMutationResponseSchema = responseEnvelope(faIssueSchema).extend({
  replayed: z.boolean(),
})
export const faReorderMutationResponseSchema = responseEnvelope(z.object({
  issues: z.array(faIssueSchema),
})).extend({ replayed: z.boolean() })
export const faDeleteMutationResponseSchema = responseEnvelope(z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  deleted: z.literal(true),
  rowVersion: z.number().int().positive(),
  updatedAt: z.iso.datetime({ offset: true }),
})).extend({ replayed: z.boolean() })

export const faGroupSchema = z.object({
  id: z.uuid(),
  meetingId: z.uuid(),
  groupNo: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  groupName: z.string().min(1),
  groupDescription: z.string(),
  presenter: z.string(),
  status: z.enum(['draft', 'review_ready', 'final']),
  rowVersion: z.number().int().positive(),
  finalizedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})

export const faBootstrapResponseSchema = responseEnvelope(z.object({
  meeting: publicMeetingSchema.omit({ groups: true }),
  group: faGroupSchema,
  issues: z.array(faIssueSchema),
}))

export const faGroupMutationResponseSchema = responseEnvelope(z.object({
  id: z.uuid(),
  presenter: z.string().optional(),
  status: z.enum(['draft', 'review_ready', 'final']),
  rowVersion: z.number().int().positive(),
  finalizedAt: z.iso.datetime({ offset: true }).nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
})).extend({ replayed: z.boolean() })

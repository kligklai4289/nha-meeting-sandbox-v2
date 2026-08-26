import { z } from 'zod'

export const publicMeetingSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  fiscalYear: z.string().min(1),
  meetingDate: z.iso.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().min(1),
  status: z.literal('active'),
  isActive: z.literal(true),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  groups: z
    .array(
      z.object({
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
      }),
    )
    .max(3),
})

export const publicMeetingResponseSchema = z.object({
  data: publicMeetingSchema.nullable(),
  requestId: z.string().min(1),
})

export type PublicMeeting = z.infer<typeof publicMeetingSchema>
export type PublicMeetingResponse = z.infer<typeof publicMeetingResponseSchema>

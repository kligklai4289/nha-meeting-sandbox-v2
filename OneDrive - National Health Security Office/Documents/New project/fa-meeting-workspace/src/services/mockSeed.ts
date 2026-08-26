import type { MeetingGroup } from '../domain/group'
import type { Issue } from '../domain/issue'
import type { Meeting } from '../domain/meeting'

export interface MockSeed {
  meeting: Meeting
  groups: MeetingGroup[]
  issues: Issue[]
}

const meetingId = '00000000-0000-4000-8000-000000000001'
const createdAt = '2026-08-20T02:00:00.000Z'

const groupNames = [
  {
    groupNo: 1 as const,
    groupName: 'บริหารกองทุน เหมาจ่าย',
    groupDescription:
      'IP กับโรคค่าใช้จ่ายสูง / OP กับปฐมภูมิ หน่วยนวัตกรรม / โรคมุ่งเน้นมีผลกระทบ จิตเวช ไต สมอง หัวใจ / Audit',
  },
  {
    groupNo: 2 as const,
    groupName: 'กองทุนท้องถิ่น การจัดการส่งเสริม ป้องกัน ฟื้นฟู',
    groupDescription: 'การบริหารกองทุนท้องถิ่นและการทำงานด้านส่งเสริม ป้องกัน และฟื้นฟู',
  },
  {
    groupNo: 3 as const,
    groupName: 'งานคุ้มครองสิทธิ ม.57, ม.59, การป้องกันเกิดซ้ำ (RCA)',
    groupDescription: 'การคุ้มครองสิทธิและการวิเคราะห์สาเหตุเพื่อป้องกันปัญหาเกิดซ้ำ',
  },
]

function createIssue(groupId: string, sortOrder: number): Issue {
  const suffix = `${groupId.slice(0, 8)}-${sortOrder}`
  return {
    id: `20000000-0000-4000-8000-${suffix.padEnd(12, '0').slice(0, 12)}`,
    groupId,
    sortOrder,
    topic: `ตัวอย่างประเด็นที่ ${sortOrder}`,
    findings: 'ตัวอย่างข้อค้นพบจากการประชุมกลุ่มย่อย',
    proposal: 'ตัวอย่างข้อเสนอเพื่อร่วมกันพิจารณา',
    actionPlan: 'ตัวอย่างแนวทางดำเนินงานและผู้รับผิดชอบ',
    monitoring: 'ตัวอย่างวิธีติดตามความก้าวหน้า',
    stakeholderRoles: 'ตัวอย่างบทบาทของหน่วยงานที่เกี่ยวข้อง',
    rowVersion: 1,
    createdAt,
    updatedAt: createdAt,
  }
}

export function createMockSeed(): MockSeed {
  const meeting: Meeting = {
    id: meetingId,
    title: 'แผนการดำเนินงาน ทิศทางการทำงานร่วมกันของอนุกรรมการ ปีงบประมาณ 2570',
    fiscalYear: '2570',
    meetingDate: '2026-08-27',
    startTime: '09:00',
    endTime: '16:30',
    location: 'โรงแรมกรุงศรีริเวอร์ จังหวัดพระนครศรีอยุธยา',
    status: 'active',
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  }

  const groups: MeetingGroup[] = groupNames.map((group, index) => ({
    id: `10000000-0000-4000-8000-00000000000${index + 1}`,
    meetingId,
    ...group,
    presenter: '',
    status: index === 1 ? 'final' : index === 2 ? 'review_ready' : 'draft',
    rowVersion: 1,
    finalizedAt: index === 1 ? '2026-08-20T03:41:00.000Z' : null,
    createdAt,
    updatedAt: `2026-08-20T03:4${index + 1}:00.000Z`,
  }))

  const issues = groups.flatMap((group) => [
    createIssue(group.id, 1),
    createIssue(group.id, 2),
  ])

  return { meeting, groups, issues }
}

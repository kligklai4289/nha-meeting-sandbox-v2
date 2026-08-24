import type { Page } from '@playwright/test'

interface MeetingDirectoryRequest {
  method: string
  url: string
}

export interface MeetingDirectoryFixtureObserver {
  requests: MeetingDirectoryRequest[]
}

const createdAt = '2026-08-20T02:00:00.000Z'
const meetingId = '00000000-0000-4000-8000-000000000001'
export const e2eGroups = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    groupNo: 1 as const,
    groupName: 'บริหารกองทุน เหมาจ่าย',
    groupDescription: 'IP กับโรคค่าใช้จ่ายสูง / OP กับปฐมภูมิ หน่วยนวัตกรรม / โรคมุ่งเน้นมีผลกระทบ จิตเวช ไต สมอง หัวใจ / Audit',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    groupNo: 2 as const,
    groupName: 'กองทุนท้องถิ่น การจัดการส่งเสริม ป้องกัน ฟื้นฟู',
    groupDescription: 'การบริหารกองทุนท้องถิ่นและการทำงานด้านส่งเสริม ป้องกัน และฟื้นฟู',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    groupNo: 3 as const,
    groupName: 'งานคุ้มครองสิทธิ ม.57, ม.59, การป้องกันเกิดซ้ำ (RCA)',
    groupDescription: 'การคุ้มครองสิทธิและการวิเคราะห์สาเหตุเพื่อป้องกันปัญหาเกิดซ้ำ',
  },
].map((group) => ({
  ...group,
  meetingId,
  presenter: '',
  status: 'draft' as const,
  rowVersion: 1,
  finalizedAt: null,
  createdAt,
  updatedAt: createdAt,
}))

export const e2eMeeting = {
  id: meetingId,
  title: 'แผนการดำเนินงาน ทิศทางการทำงานร่วมกันของอนุกรรมการ ปีงบประมาณ 2570',
  fiscalYear: '2570',
  meetingDate: '2026-08-27',
  startTime: '09:00',
  endTime: '16:30',
  location: 'โรงแรมกรุงศรีริเวอร์ จังหวัดพระนครศรีอยุธยา',
  isActive: true as const,
  createdAt,
  updatedAt: createdAt,
  groups: e2eGroups,
}

export async function installMeetingDirectoryFixture(
  page: Page,
): Promise<MeetingDirectoryFixtureObserver> {
  const requests: MeetingDirectoryRequest[] = []
  await page.route('**/api/public/active-meeting', async (route) => {
    const request = route.request()
    requests.push({ method: request.method(), url: request.url() })
    if (request.method() !== 'GET') return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: e2eMeeting,
        requestId: 'e2e-request-id',
      }),
    })
  })
  return { requests }
}

# Supabase environments runbook

คู่มือนี้ใช้สำหรับนำ migration และ seed ของ FA Meeting Workspace ขึ้น Staging และ Production โดยไม่ปะปนข้อมูลหรือความลับระหว่าง environment

## กฎบังคับ

- ใช้ Supabase คนละ project สำหรับ Staging และ Production
- ห้ามคัดลอกข้อมูล Staging ไป Production โดยเด็ดขาด
- ห้าม commit project ref, database URL, password, publishable key, secret key, JWT หรือ FA secrets
- เก็บ project ref เฉพาะเครื่องใน `.supabase-projects.local.json` ซึ่งถูก ignore แล้ว
- รัน `npm run verify:environment` ก่อน push หรือ deploy ทุกครั้ง
- ก่อน link หรือเปลี่ยนแปลง Production ต้องหยุดและขออนุมัติจากเจ้าของระบบอย่างชัดเจนทุกครั้ง
- ห้ามใช้ `supabase db reset` กับฐานข้อมูล remote

## เตรียมเครื่อง

1. ตรวจว่า Supabase CLI และ dependencies พร้อมใช้งาน

   ```powershell
   npm install
   npx supabase --version
   npm run verify:environment
   ```

2. เตรียม project ref ไว้เฉพาะเครื่อง ห้ามใส่ค่าจริงลงเอกสารหรือไฟล์ที่ Git ติดตาม
3. เตรียมโฟลเดอร์ backup ที่อยู่นอก repository และจำกัดสิทธิ์การเข้าถึง

## นำขึ้น Staging

1. Link ไป Staging เท่านั้น แล้วตรวจ target ที่แสดงบนหน้าจอก่อนทำต่อ

   ```powershell
   npx supabase link --project-ref <STAGING_PROJECT_REF>
   ```

2. สำรอง schema ปัจจุบันก่อน migration ทุกครั้ง โดยบันทึกไฟล์ไว้นอก repository

   ```powershell
   npx supabase db dump --linked --schema public --file <BACKUP_FILE_OUTSIDE_REPOSITORY>
   ```

3. Dry run และอ่านรายชื่อ migration ทุกไฟล์ ถ้ามีไฟล์ที่ไม่คาดหมายให้หยุด

   ```powershell
   npx supabase db push --linked --dry-run
   ```

4. เมื่อ dry run ถูกต้องจึง push migration

   ```powershell
   npx supabase db push --linked
   ```

5. ใส่ข้อมูลทดลองเฉพาะ Staging

   ```powershell
   npx supabase db query --linked --file supabase/seed/staging.sql
   ```

6. รัน pgTAP บน linked Staging และต้องผ่านทั้งหมด

   ```powershell
   npx supabase test db --linked supabase/tests/database
   ```

7. ตรวจผลขั้นต่ำ: มี 1 รอบประชุม, 3 กลุ่ม, 6 issues ทดลอง, ทุกกลุ่มเป็น `draft`, ไม่มี FA code และไม่มี Auth user ที่ไม่ตั้งใจสร้าง

## ประตูก่อน Production

หยุดที่จุดนี้และแจ้งเจ้าของระบบให้เห็นรายการต่อไปนี้ก่อนขออนุมัติ:

- Supabase project ที่จะใช้เป็น Production
- รายชื่อ migration จาก dry run
- ตำแหน่งและเวลาของ backup ล่าสุด
- ผล pgTAP จาก Staging
- ยืนยันว่า `production.sql` ไม่มี issues ทดลอง

ห้าม link, dump, push, seed, invite user หรือเปลี่ยนค่า environment ของ Production จนกว่าจะได้รับคำว่าอนุมัติสำหรับขั้นตอน Production โดยตรง

## นำขึ้น Production หลังได้รับอนุมัติ

1. Link ไป Production และตรวจ project name/ref บนหน้าจอซ้ำ

   ```powershell
   npx supabase link --project-ref <PRODUCTION_PROJECT_REF>
   ```

2. Dry run ก่อน และห้าม push หาก migration ไม่ตรงกับชุดที่ผ่าน Staging

   ```powershell
   npx supabase db push --linked --dry-run
   ```

3. สำรอง schema ก่อนการเปลี่ยนแปลง remote ทุกครั้ง

   ```powershell
   npx supabase db dump --linked --schema public --file <PRODUCTION_BACKUP_FILE_OUTSIDE_REPOSITORY>
   ```

4. Push migration แล้วใช้ seed สำหรับ Production เท่านั้น

   ```powershell
   npx supabase db push --linked
   npx supabase db query --linked --file supabase/seed/production.sql
   ```

5. รัน pgTAP บน Production

   ```powershell
   npx supabase test db --linked supabase/tests/database
   ```

6. ใน Supabase Dashboard ไปที่ Authentication > Users แล้วเชิญ `pichailakarm@gmail.com` เป็น Admin เริ่มต้น จากนั้นตรวจว่า profile/role ถูกสร้างตาม workflow ที่อนุมัติ
7. ยืนยันว่า Production ไม่มีข้อมูลทดลอง:

   ```powershell
   npx supabase db query --linked "select count(*) as issue_count from public.issues;"
   ```

   ผลต้องเป็น `0` และต้องมีรอบประชุมวันที่ 27 สิงหาคม 2569 จำนวน 1 รอบกับ 3 กลุ่มสถานะ `draft`

## Rollback และเหตุขัดข้อง

1. ถ้าปัญหาเกิดหลัง deploy แอป ให้ rollback Vercel deployment ไปเวอร์ชันที่ผ่านการตรวจสอบก่อน
2. ถ้า schema ผิด ให้สร้าง forward migration เพื่อแก้ไข ทดสอบที่ Staging แล้วผ่านประตูอนุมัติ Production ใหม่
3. ห้ามแก้ migration ที่เคย push, ห้ามลบ migration history และห้าม reset ฐานข้อมูล remote
4. ถ้าสงสัยว่าความลับรั่ว ให้หยุด deploy, rotate ค่าที่เกี่ยวข้อง และตรวจ audit/deployment logs โดยไม่คัดลอกค่าความลับลง issue หรือเอกสาร
5. Backup ใช้เพื่อการวิเคราะห์และแผนกู้คืนที่ได้รับอนุมัติ ไม่ให้นำไป restore ทับ remote โดยพลการ

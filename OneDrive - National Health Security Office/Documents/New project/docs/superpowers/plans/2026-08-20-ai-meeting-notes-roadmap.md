# AI Meeting Notes Delivery Roadmap

**Spec:** `docs/superpowers/specs/2026-08-20-ai-meeting-notes-design.md`

ระบบถูกแบ่งเป็น 5 ระยะ เพราะแต่ละระยะมีความเสี่ยงและเกณฑ์ตรวจรับต่างกัน ทุกระยะต้องมี implementation plan ของตนเองก่อนเริ่มเขียนโค้ด

## ระยะที่ 1: Foundation, Identity, Organization และ Audit

ผลส่งมอบ: Backend และเว็บผู้ดูแลที่เข้าสู่ระบบด้วย Google, สร้างพื้นที่ส่วนตัว, เชิญ/อนุมัติสมาชิกองค์กร, บังคับสิทธิ์ระดับองค์กร และบันทึก Audit Log ได้

แผนละเอียด: `docs/superpowers/plans/2026-08-20-ai-meeting-notes-foundation.md`

## ระยะที่ 2: Android Recording และ Resumable Upload

ผลส่งมอบ: แอป Android บันทึกเสียงแบบ foreground service, แบ่งชิ้น 10 นาที, เข้ารหัส, กู้คืน และอัปโหลดต่อจากจุดค้างได้ โดยมี harness ทดสอบเวลาจำลองและการบันทึก 8 ชั่วโมงจริง

องค์ประกอบหลัก: Android app shell, Google Sign-in, local encrypted manifest, recording engine, device-health checks, upload session, object storage และ checksum reconciliation

## ระยะที่ 3: Thai Transcription และ Transcript Review

ผลส่งมอบ: Pipeline ถอดเสียงไทย แยกผู้พูด เก็บ confidence และหน้าแก้ไข transcript ที่กดกลับไปยังเวลาเสียงได้

องค์ประกอบหลัก: queue workers, AI provider adapter, diarization, glossary, transcript segments, review versioning และ processing status

## ระยะที่ 4: Summary, To-do และ Cited Chat

ผลส่งมอบ: สรุป มติ รายการสิ่งที่ต้องทำ และแชตที่ตอบเฉพาะหลักฐานใน transcript พร้อม citation validator

องค์ประกอบหลัก: structured generation schema, action-item extraction, retrieval index, answer policy, citation validation และ regeneration หลังแก้ transcript

## ระยะที่ 5: Privacy Operations, Export และ Production Hardening

ผลส่งมอบ: อายุข้อมูลเสียง 7 วัน/เนื้อหา 30 วัน/Audit 1 ปี, DSAR, incident workflow, Word/PDF export, production security checks และรายงานทดสอบ 8 ชั่วโมง

องค์ประกอบหลัก: deletion orchestration, lifecycle reconciliation, backup policy, privacy admin, incident controls, exports, load/security tests, observability และ deployment runbook

## Gate ระหว่างระยะ

- ระยะใหม่เริ่มได้เมื่อ automated tests ของระยะก่อนผ่านทั้งหมด
- ต้องไม่มี Critical/High security finding ที่ยังไม่ปิด
- API contract ที่ระยะถัดไปใช้ต้องถูก freeze และมี contract tests
- Migration ต้องมีทั้ง upgrade test และ rollback/runbook
- ทุกระยะต้องมีคู่มือใช้งานหรือ runbook สำหรับผลส่งมอบของระยะนั้น


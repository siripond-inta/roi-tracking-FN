// src/app/services/page-header.service.ts
// State ที่ใช้ร่วมกันระหว่าง layout (UserLayout/AdminLayout) กับหน้าลูก เพื่อโชว์หัวข้อของหน้า
// ปัจจุบันที่ header ด้านบน (ระดับเดียวกับชื่อ user) — สำหรับหน้าที่มีหัวข้อคงที่ (Community,
// Dashboard, ...) layout จะตั้งค่าให้อัตโนมัติจาก route data (ดู app.routes.ts) ส่วนหน้าที่มีหัวข้อ
// ไม่คงที่ (เช่นหน้ารายงานที่ต้องโชว์ชื่อโปรเจกต์จริง) component นั้นๆ เรียก .set() เองได้หลังโหลด
// ข้อมูลเสร็จ โดยไม่ต้องให้ layout รู้จัก component ลูกเป็นรายตัว
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PageHeaderService {
  title = signal('');
  subtitle = signal('');

  set(title: string, subtitle: string = ''): void {
    this.title.set(title);
    this.subtitle.set(subtitle);
  }
}

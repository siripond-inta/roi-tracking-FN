// src/app/guards/writer.guard.ts
// Guard สำหรับหน้าที่สร้าง/แก้ไขโครงการ — บัญชี viewer ดูได้อย่างเดียว (FR01-2)
// backend ปฏิเสธอยู่แล้ว แต่ไม่ควรให้ viewer เปิดฟอร์มที่กรอกเสร็จแล้วบันทึกไม่ได้

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const writerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.canEditProjects()) return true;
  return router.createUrlTree(['/user/dashboard']);
};

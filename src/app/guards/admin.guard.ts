// src/app/guards/admin.guard.ts
// Guard สำหรับป้องกันหน้า /admin/**
// ต้อง login แล้วและต้องมี role = 'admin' เท่านั้น

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // ✅ Login แล้วและเป็น Admin → เข้าได้
  if (auth.isLoggedIn() && auth.getRole() === 'admin') {
    return true;
  }

  // ❌ ยังไม่ได้ Login เลย → ไปหน้า Login
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  // ❌ Login แล้วแต่ไม่ใช่ Admin → ส่งกลับไป Dashboard ของ User
  return router.createUrlTree(['/user/dashboard']);
};

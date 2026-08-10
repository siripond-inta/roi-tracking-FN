// src/app/guards/auth.guard.ts
// Guard สำหรับป้องกันหน้า /user/**
// ถ้าไม่ได้ login → redirect ไป /login

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true; // ✅ มี token → อนุญาตให้เข้าหน้านี้ได้
  }

  // ❌ ไม่มี token → ส่งกลับไปหน้า Login
  // createUrlTree() เป็น Angular way ที่ดีกว่า router.navigate() ใน Guard
  return router.createUrlTree(['/login']);
};

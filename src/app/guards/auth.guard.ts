// src/app/guards/auth.guard.ts
// Guard สำหรับป้องกันหน้า /user/**
// ถ้าไม่ได้ login → redirect ไป /login

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    // ❌ ไม่มี token → ส่งกลับไปหน้า Login
    // createUrlTree() เป็น Angular way ที่ดีกว่า router.navigate() ใน Guard
    return router.createUrlTree(['/login']);
  }

  // ถ้า user ที่แท็บนี้จำไว้ ไม่ตรงกับ token ใน localStorage (เช่นไป login เป็นคนอื่นในอีกแท็บ)
  // → reload ทั้งหน้า เพื่อให้ทุก component ดึงข้อมูลของเจ้าของ token ที่ถูกต้องใหม่ทั้งหมด
  // ไม่งั้นจะเกิดอาการ header เป็นชื่อคนหนึ่ง แต่ project ที่โหลดมาเป็นของอีกคน
  if (!auth.isInSyncWithStorage()) {
    window.location.reload();
    return false;
  }

  return true; // ✅ มี token และ state ตรงกัน → อนุญาตให้เข้าหน้านี้ได้
};

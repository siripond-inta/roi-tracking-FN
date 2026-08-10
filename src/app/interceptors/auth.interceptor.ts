// src/app/interceptors/auth.interceptor.ts
// Interceptor: ทำงานทุกครั้งที่มี HTTP Request ออกไปจาก Angular
// หน้าที่: แนบ JWT Token ใน Authorization Header อัตโนมัติ

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();

  // ถ้ามี token → clone request แล้วแนบ Header
  // HTTP Request เป็น immutable (แก้ไขตรงๆ ไม่ได้) จึงต้อง .clone() ก่อน
  if (token) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(authReq);
  }

  return next(req); // ถ้าไม่มี token ส่ง request ตามปกติ (เช่น login/signup เอง)
};

// src/app/services/auth.service.ts
// หัวใจของระบบ Auth — จัดการ Token, User State, Login, Logout

import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

// ─── Interfaces ───────────────────────────────────────────
// ข้อมูล User ที่เก็บใน localStorage และใช้ใน Navbar
export interface AuthUser {
  userId: number;
  fullName: string;
  email: string;
  role: 'admin' | 'user';
}

// รูปแบบ Response ที่ได้จาก POST /api/auth/login
interface LoginResponse {
  token: string;
  user: AuthUser;
}

// ─── Service ──────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // Key ที่ใช้เก็บข้อมูลใน localStorage
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';

  // URL ของ Backend API
  private readonly API_URL = 'http://localhost:3000/api/auth';

  // signal() คือ Reactive State ของ Angular 21
  // ทุก Component ที่ใช้ currentUser() จะ re-render อัตโนมัติเมื่อค่าเปลี่ยน
  // โหลดจาก localStorage ทันทีเพื่อรองรับกรณีที่ refresh หน้า
  currentUser = signal<AuthUser | null>(this.loadUserFromStorage());

  // ─── Actions ────────────────────────────────────────────

  // เรียก POST /api/auth/login แล้วเก็บ token และ user ที่ได้
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, { email, password })
      .pipe(
        // tap() ทำงาน "ข้างๆ" stream — ไม่เปลี่ยนค่าที่ส่งต่อ แต่ทำ side effect ได้
        tap(response => {
          localStorage.setItem(this.TOKEN_KEY, response.token);
          localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
          // อัปเดต signal เพื่อให้ทุก Component รับรู้ทันที (Navbar, etc.)
          this.currentUser.set(response.user);
        })
      );
  }

  // เรียก POST /api/auth/signup
  signup(fullName: string, email: string, password: string, companyName?: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/signup`, {
      full_name: fullName,
      email,
      password,
      company_name: companyName || null
    });
  }

  // ออกจากระบบ: ลบข้อมูลทุกอย่างและ redirect ไป login
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  // ─── Helper Methods ─────────────────────────────────────

  // ตรวจสอบว่ามี token ใน localStorage หรือไม่
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // ดึง token เพื่อส่งไปใน HTTP Header (ใช้ใน Interceptor)
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // ดึง role ของ user ปัจจุบัน
  getRole(): 'admin' | 'user' | null {
    return this.currentUser()?.role ?? null;
  }

  // โหลด user จาก localStorage เมื่อ app เริ่มต้น (กรณี refresh หน้า)
  // JSON.parse() แปลง string กลับเป็น object
  private loadUserFromStorage(): AuthUser | null {
    const stored = localStorage.getItem(this.USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }
}

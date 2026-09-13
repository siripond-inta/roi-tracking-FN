// src/app/services/auth.service.ts
// หัวใจของระบบ Auth — จัดการ Token, User State, Login, Logout

import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

// ─── Interfaces ───────────────────────────────────────────
// ข้อมูล User ที่เก็บใน localStorage และใช้ใน Navbar
export interface AuthUser {
  userId: number;
  fullName: string;
  email: string;
  role: 'admin' | 'project_owner' | 'viewer';
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

  // Key ที่ใช้เก็บข้อมูลใน localStorage
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';

  // URL ของ Backend API
  private readonly API_URL = 'http://localhost:3000/api/auth';

  // signal() คือ Reactive State ของ Angular 21
  // ทุก Component ที่ใช้ currentUser() จะ re-render อัตโนมัติเมื่อค่าเปลี่ยน
  // โหลดจาก localStorage ทันทีเพื่อรองรับกรณีที่ refresh หน้า
  currentUser = signal<AuthUser | null>(this.loadUserFromStorage());

  constructor() {
    // ── สำคัญ: localStorage ถูกแชร์ร่วมกันทุกแท็บของ origin เดียวกัน แต่ signal ด้านบนเป็น
    // state ในหน่วยความจำของ "แท็บนี้" เท่านั้น (อ่าน localStorage แค่ตอนแท็บโหลดครั้งแรก)
    // ถ้าไป login เป็นคนอื่นในอีกแท็บ แท็บนี้จะยังโชว์ชื่อคนเดิม แต่ getToken() จะอ่าน token
    // ของคนใหม่สดๆ ทุก request → กลายเป็น "ชื่อบน header เป็นคนหนึ่ง แต่ข้อมูลเป็นของอีกคน"
    // storage event จะยิงเฉพาะแท็บ "อื่น" ที่ไม่ได้เป็นคนแก้ค่า — พอรู้ว่าเปลี่ยนก็ reload ให้ตรงกัน
    window.addEventListener('storage', (event) => {
      if (event.key === this.TOKEN_KEY || event.key === this.USER_KEY) {
        window.location.reload();
      }
    });
  }

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

  // เรียก PUT /api/auth/profile — แก้ไขชื่อ/อีเมล (เปลี่ยนอีเมลต้องยืนยันด้วยรหัสผ่านปัจจุบัน)
  // สำเร็จแล้วอัปเดต currentUser signal + localStorage ทันที ให้ header/sidebar เปลี่ยนตาม
  updateProfile(fullName: string, email: string, currentPassword?: string): Observable<{ message: string; user: AuthUser }> {
    return this.http.put<{ message: string; user: AuthUser }>(`${this.API_URL}/profile`, {
      full_name: fullName,
      email,
      current_password: currentPassword || undefined
    }).pipe(
      tap(response => {
        localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
        this.currentUser.set(response.user);
      })
    );
  }

  // เรียก PUT /api/auth/password — เปลี่ยนรหัสผ่าน (ต้องยืนยันด้วยรหัสผ่านปัจจุบัน)
  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.API_URL}/password`, {
      current_password: currentPassword,
      new_password: newPassword
    });
  }

  // ออกจากระบบ: ลบข้อมูลทุกอย่างและ redirect ไป login
  // ใช้ window.location.href (full page reload) แทน router.navigate() โดยตั้งใจ —
  // เพื่อล้าง state ของ SPA ทั้งหมด (component data ที่ค้างอยู่ใน memory ของ tab เดิม) ไม่ให้
  // ข้อมูลของ user คนก่อนหลุดติดไปโผล่ตอน login เป็นคนใหม่ในหน้าเดิม
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    window.location.href = '/login';
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
  getRole(): 'admin' | 'project_owner' | 'viewer' | null {
    return this.currentUser()?.role ?? null;
  }

  // ตรวจว่า user ที่แท็บนี้จำไว้ ตรงกับ user ใน localStorage (ซึ่งคือเจ้าของ token ที่จะถูกแนบไป
  // กับทุก API call จริงๆ) หรือไม่ — ใช้เป็นด่านที่สองเผื่อ storage event ไม่ยิง เช่นแท็บถูก
  // suspend หรือถูกกู้คืนจาก back/forward cache
  isInSyncWithStorage(): boolean {
    return this.loadUserFromStorage()?.userId === this.currentUser()?.userId;
  }

  // โหลด user จาก localStorage เมื่อ app เริ่มต้น (กรณี refresh หน้า)
  // JSON.parse() แปลง string กลับเป็น object — ถ้าข้อมูลเสียหายให้ถือว่ายังไม่ได้ login
  // (ไม่ปล่อยให้ throw ไม่งั้นแอปพังทั้งตัวตั้งแต่ตอนสร้าง service)
  private loadUserFromStorage(): AuthUser | null {
    const stored = localStorage.getItem(this.USER_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as AuthUser;
    } catch {
      return null;
    }
  }
}

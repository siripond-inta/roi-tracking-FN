// src/app/services/admin.service.ts
// เรียก API ฝั่ง /api/admin/* — ใช้เฉพาะหน้า admin (ต้อง login เป็น role admin เท่านั้น)

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface AdminUser {
  user_id: number;
  full_name: string;
  email: string;
  role: 'admin' | 'project_owner' | 'viewer';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  project_count: number;
  is_dormant: boolean; // active มากกว่า 3 ปีแล้วไม่ login เลย — คือ candidate สำหรับ soft delete
}

export interface AdminProject {
  project_id: number;
  project_name: string;
  duration_months: number;
  initial_budget: number;
  created_at: string;
  is_public: boolean;
  owner_name: string;
  owner_email: string;
  project_type: string | null;
  status: 'Estimated' | 'Actual';
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api/admin';

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<ApiResponse<AdminUser[]>>(`${this.API_URL}/users`).pipe(
      map(res => (res.data || []).map(u => ({
        ...u,
        user_id: Number(u.user_id),
        is_active: !!u.is_active,
        is_dormant: !!u.is_dormant,
        project_count: Number(u.project_count || 0),
      })))
    );
  }

  // Soft delete: ปิดใช้งานบัญชีที่ไม่ active เกิน 3 ปี (backend ตรวจเงื่อนไขซ้ำอีกชั้นด้วย)
  deactivateUser(userId: number): Observable<any> {
    return this.http.patch(`${this.API_URL}/users/${userId}/deactivate`, {});
  }

  // โปรเจกต์ทั้งหมดในระบบ (ทุก user) — ใช้แสดงในหน้า admin dashboard สำหรับ monitor ภาพรวม
  getProjects(): Observable<AdminProject[]> {
    return this.http.get<ApiResponse<AdminProject[]>>(`${this.API_URL}/projects`).pipe(
      map(res => (res.data || []).map(p => ({
        ...p,
        project_id: Number(p.project_id),
        initial_budget: Number(p.initial_budget || 0),
        is_public: !!p.is_public,
      })))
    );
  }
}

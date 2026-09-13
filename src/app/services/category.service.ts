// src/app/services/category.service.ts
// หมวดหมู่รายรับ/รายจ่าย — ดึงจาก database ผ่าน API แทนการ hardcode ในแต่ละหน้า
// GET ใช้ได้ทุก user ที่ login แล้ว, POST/PUT/DELETE ใช้ได้แค่ admin (backend ตรวจซ้ำอีกชั้นด้วย)

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Category {
  category_id: string;
  category_name: string;
  type_id: number;
  category_group: 'INV' | 'OPC' | 'ADC' | 'BEN';
  type_name: string;
  is_inflow: boolean; // true = รายรับ, false = รายจ่าย
}

export interface EntryType {
  type_id: number;
  type_name: string;
  is_inflow: boolean;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api/categories';

  getCategories(): Observable<Category[]> {
    return this.http.get<ApiResponse<Category[]>>(this.API_URL).pipe(
      map(res => (res.data || []).map(c => ({ ...c, is_inflow: !!c.is_inflow })))
    );
  }

  getEntryTypes(): Observable<EntryType[]> {
    return this.http.get<ApiResponse<EntryType[]>>(`${this.API_URL}/entry-types`).pipe(
      map(res => (res.data || []).map(t => ({ ...t, is_inflow: !!t.is_inflow })))
    );
  }

  // category_id ไม่ต้องส่งมาแล้ว — backend สร้างรหัสให้อัตโนมัติ (REVxxx/CATxxx ตามประเภท)
  createCategory(category: { category_name: string; type_id: number; category_group: string }): Observable<any> {
    return this.http.post(this.API_URL, category);
  }

  updateCategory(id: string, category: { category_name?: string; type_id?: number; category_group?: string }): Observable<any> {
    return this.http.put(`${this.API_URL}/${id}`, category);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.API_URL}/${id}`);
  }
}

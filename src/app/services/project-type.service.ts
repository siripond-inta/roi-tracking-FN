// src/app/services/project-type.service.ts
// FR07-4: ประเภทโครงการ — ดึงจาก database ผ่าน API (ใช้เติม dropdown ตอนสร้าง/แก้ไขโครงการ)
// อ่านได้ทุก user ที่ login แล้ว, เพิ่ม/แก้/ลบได้เฉพาะ admin (backend ตรวจซ้ำอีกชั้น)

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface ProjectType {
  type_id: number;
  type_name: string;
  description: string | null;
  calculation_method: 'REVENUE' | 'COST_SAVING' | 'MIXED' | null;
  project_count: number;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class ProjectTypeService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api/project-types';

  getProjectTypes(): Observable<ProjectType[]> {
    return this.http.get<ApiResponse<ProjectType[]>>(this.API_URL).pipe(map((res) => res.data || []));
  }

  createProjectType(payload: {
    type_name: string;
    description?: string | null;
    calculation_method?: string | null;
  }): Observable<any> {
    return this.http.post(this.API_URL, payload);
  }

  updateProjectType(
    id: number,
    payload: { type_name?: string; description?: string | null; calculation_method?: string | null }
  ): Observable<any> {
    return this.http.put(`${this.API_URL}/${id}`, payload);
  }

  deleteProjectType(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${id}`);
  }
}

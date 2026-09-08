import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Project, ProjectLedger } from '../models/roi-tracking-model';

// Interface สำหรับโครงสร้าง Response ทั่วไปของ backend API
interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private http = inject(HttpClient);
  // URL พื้นฐานของระบบ Project API
  private readonly API_URL = 'http://localhost:3000/api/projects';

  // 1. ดึงรายการโปรเจกต์ทั้งหมดจาก MySQL
  getProjects(): Observable<Project[]> {
    return this.http.get<ApiResponse<Project[]>>(this.API_URL).pipe(
      map(res => (res.data || []).map(p => ({
        ...p,
        project_id: Number(p.project_id),
        initial_budget: Number(p.initial_budget || 0)
      })))
    );
  }

  // 2. ดึงข้อมูลโปรเจกต์เดียวด้วย ID
  getProjectById(id: number): Observable<Project> {
    return this.http.get<ApiResponse<Project>>(`${this.API_URL}/${id}`).pipe(
      map(res => ({
        ...res.data,
        project_id: Number(res.data.project_id),
        initial_budget: Number(res.data.initial_budget || 0)
      }))
    );
  }

  // 3. ดึงรายการ Ledger ทั้งหมด (ใช้คำนวณ Summary สถิติที่หน้า Dashboard)
  getLedgers(): Observable<ProjectLedger[]> {
    return this.http.get<ApiResponse<ProjectLedger[]>>(`${this.API_URL}/ledgers`).pipe(
      map(res => (res.data || []).map(l => ({
        ...l,
        ledger_id: Number(l.ledger_id),
        project_id: Number(l.project_id),
        type_id: Number(l.type_id),
        total_value: Number(l.total_value || 0)
      })))
    );
  }

  // 4. ดึงรายการ Ledger ของโปรเจกต์ที่ระบุ
  getLedgersByProjectId(projectId: number): Observable<ProjectLedger[]> {
    return this.http.get<ApiResponse<ProjectLedger[]>>(`${this.API_URL}/${projectId}/ledgers`).pipe(
      map(res => (res.data || []).map(l => ({
        ...l,
        ledger_id: Number(l.ledger_id),
        project_id: Number(l.project_id),
        type_id: Number(l.type_id),
        total_value: Number(l.total_value || 0)
      })))
    );
  }

  // 5. สร้างโปรเจกต์ใหม่และบันทึกข้อมูล Ledger เริ่มต้น (Estimated)
  // ใช้ switchMap ในการจอง ID และบันทึก Ledger ต่อเนื่องกันใน Stream เดียว
  addProject(newProject: Partial<Project>, initialLedgers: Partial<ProjectLedger>[]): Observable<any> {
    return this.http.post<ApiResponse<{ project_id: number }>>(this.API_URL, {
      project_name: newProject.project_name,
      project_type_id: newProject.project_type_id,
      duration_months: newProject.duration_months,
      initial_budget: newProject.initial_budget
    }).pipe(
      switchMap(res => {
        const createdProjectId = res.data.project_id;
        // ปรับฟอร์แมตวันที่ให้อยู่ในรูป YYYY-MM-DD
        const ledgersToSend = initialLedgers.map(l => ({
          type_id: l.type_id,
          category_id: l.category_id,
          total_value: l.total_value,
          note: l.note,
          transaction_date: l.transaction_date instanceof Date 
            ? l.transaction_date.toISOString().split('T')[0] 
            : l.transaction_date
        }));
        // บันทึก Ledger Phase "Estimated" ไปยังโปรเจกต์ที่สร้างใหม่
        return this.http.post(`${this.API_URL}/${createdProjectId}/ledgers`, {
          phase: 'Estimated',
          ledgers: ledgersToSend
        });
      })
    );
  }

  // 6. บันทึกข้อมูลจริง (Actual) ไปยังตาราง project_ledger
  saveActualData(projectId: number, actualLedgers: Partial<ProjectLedger>[]): Observable<any> {
    const ledgersToSend = actualLedgers.map(l => ({
      type_id: l.type_id,
      category_id: l.category_id,
      total_value: l.total_value,
      note: l.note,
      transaction_date: l.transaction_date instanceof Date 
        ? l.transaction_date.toISOString().split('T')[0] 
        : l.transaction_date
    }));
    return this.http.post(`${this.API_URL}/${projectId}/ledgers`, {
      phase: 'Actual',
      ledgers: ledgersToSend
    });
  }

  // 7. ลบโปรเจกต์และข้อมูล Ledger ที่เกี่ยวข้อง
  deleteProject(projectId: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${projectId}`);
  }
}
